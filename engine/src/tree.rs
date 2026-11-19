//! Flat arena holding the scanned tree, plus the queries the UI runs on it.

use crate::scan::TmpNode;
use serde_json::{json, Value};
use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};
use std::path::PathBuf;

pub const NONE: u32 = u32::MAX;

pub struct Node {
    pub name: Box<str>,
    pub parent: u32,
    pub size: u64,
    pub files: u64,
    pub dirs: u64,
    pub mtime: i64,
    pub is_dir: bool,
    pub removed: bool,
    /// Sorted by size, largest first.
    pub children: Vec<u32>,
}

pub struct Tree {
    pub root_path: PathBuf,
    pub nodes: Vec<Node>,
}

impl Tree {
    pub fn from_scan(root_path: PathBuf, root: TmpNode) -> Tree {
        let capacity = (root.files + root.dirs + 1) as usize;
        let mut nodes = Vec::with_capacity(capacity);
        build(&mut nodes, root, NONE);
        Tree { root_path, nodes }
    }

    pub fn get(&self, id: u64) -> Result<&Node, String> {
        let node = self
            .nodes
            .get(id as usize)
            .ok_or_else(|| format!("unknown node {id}"))?;
        // A node is gone if it or any ancestor was removed.
        let mut cur = node;
        loop {
            if cur.removed {
                return Err(format!("node {id} was removed"));
            }
            if cur.parent == NONE {
                return Ok(node);
            }
            cur = &self.nodes[cur.parent as usize];
        }
    }

    pub fn path(&self, id: u32) -> PathBuf {
        let mut parts = Vec::new();
        let mut cur = id;
        while cur != NONE && self.nodes[cur as usize].parent != NONE {
            parts.push(&*self.nodes[cur as usize].name);
            cur = self.nodes[cur as usize].parent;
        }
        let mut path = self.root_path.clone();
        for part in parts.iter().rev() {
            path.push(part);
        }
        path
    }

    pub fn summary(&self, id: u32) -> Value {
        let n = &self.nodes[id as usize];
        json!({
            "id": id,
            "name": &*n.name,
            "size": n.size,
            "files": n.files,
            "dirs": n.dirs,
            "mtime": n.mtime,
            "isDir": n.is_dir,
            "childCount": n.children.len(),
        })
    }

    /// The node, its breadcrumb chain and (up to `limit`) direct children.
    pub fn view(&self, id: u32, limit: usize) -> Value {
        let n = &self.nodes[id as usize];
        let mut ancestors = Vec::new();
        let mut cur = n.parent;
        while cur != NONE {
            ancestors.push(json!({ "id": cur, "name": &*self.nodes[cur as usize].name }));
            cur = self.nodes[cur as usize].parent;
        }
        ancestors.reverse();
        let shown: Vec<Value> = n
            .children
            .iter()
            .take(limit)
            .map(|&c| self.summary(c))
            .collect();
        let hidden = &n.children[n.children.len().min(limit)..];
        let hidden_size: u64 = hidden.iter().map(|&c| self.nodes[c as usize].size).sum();
        json!({
            "node": self.summary(id),
            "path": self.path(id).to_string_lossy(),
            "ancestors": ancestors,
            "children": shown,
            "more": { "count": hidden.len(), "size": hidden_size },
        })
    }

    /// Nested tree for the sunburst: `depth` levels, children smaller than
    /// `min_size` are folded into a single "other" bucket.
    pub fn subtree(&self, id: u32, depth: u32, min_size: u64) -> Value {
        let n = &self.nodes[id as usize];
        let mut obj = self.summary(id);
        if depth > 0 && n.is_dir && !n.children.is_empty() {
            let mut kids = Vec::new();
            let mut shown_size = 0;
            for &c in &n.children {
                let child = &self.nodes[c as usize];
                if child.size < min_size || child.size == 0 {
                    break; // children are sorted by size
                }
                shown_size += child.size;
                kids.push(self.subtree(c, depth - 1, min_size));
            }
            let other_count = n.children.len() - kids.len();
            obj["children"] = Value::Array(kids);
            if other_count > 0 {
                obj["other"] = json!({ "count": other_count, "size": n.size - shown_size });
            }
        }
        obj
    }

    fn for_each_file(&self, id: u32, mut f: impl FnMut(u32, &Node)) {
        let mut stack = vec![id];
        while let Some(cur) = stack.pop() {
            let n = &self.nodes[cur as usize];
            if n.is_dir {
                stack.extend_from_slice(&n.children);
            } else {
                f(cur, n);
            }
        }
    }

    pub fn top_files(&self, id: u32, limit: usize) -> Value {
        let mut heap: BinaryHeap<Reverse<(u64, u32)>> = BinaryHeap::with_capacity(limit + 1);
        self.for_each_file(id, |fid, n| {
            if heap.len() < limit {
                heap.push(Reverse((n.size, fid)));
            } else if let Some(Reverse((min, _))) = heap.peek() {
                if n.size > *min {
                    heap.pop();
                    heap.push(Reverse((n.size, fid)));
                }
            }
        });
        let mut items: Vec<(u64, u32)> = heap.into_iter().map(|Reverse(x)| x).collect();
        items.sort_unstable_by_key(|a| Reverse(a.0));
        let files: Vec<Value> = items
            .into_iter()
            .map(|(_, fid)| {
                let mut v = self.summary(fid);
                v["path"] = json!(self.path(fid).to_string_lossy());
                v
            })
            .collect();
        json!({ "files": files })
    }

    pub fn types(&self, id: u32) -> Value {
        let mut map: HashMap<String, (u64, u64)> = HashMap::new();
        self.for_each_file(id, |_, n| {
            let e = map.entry(ext_of(&n.name)).or_default();
            e.0 += n.size;
            e.1 += 1;
        });
        let mut list: Vec<(String, (u64, u64))> = map.into_iter().collect();
        list.sort_unstable_by_key(|a| Reverse(a.1 .0));
        let exts: Vec<Value> = list
            .into_iter()
            .map(|(ext, (size, count))| json!({ "ext": ext, "size": size, "count": count }))
            .collect();
        json!({ "extensions": exts })
    }

    /// Drops a node after it was moved to the trash and fixes ancestor totals.
    pub fn remove(&mut self, id: u32) -> Result<u64, String> {
        let n = self.get(id as u64)?;
        if n.parent == NONE {
            return Err("cannot remove the scan root".into());
        }
        let (size, parent) = (n.size, n.parent);
        let (files, dirs) = if n.is_dir {
            (n.files, n.dirs + 1)
        } else {
            (1, 0)
        };
        self.nodes[id as usize].removed = true;
        self.nodes[parent as usize].children.retain(|&c| c != id);

        let mut cur = parent;
        while cur != NONE {
            let node = &mut self.nodes[cur as usize];
            node.size = node.size.saturating_sub(size);
            node.files = node.files.saturating_sub(files);
            node.dirs = node.dirs.saturating_sub(dirs);
            cur = node.parent;
        }
        // Ancestors shrank, so their position among siblings may have changed.
        let mut cur = self.nodes[parent as usize].parent;
        while cur != NONE {
            let mut kids = std::mem::take(&mut self.nodes[cur as usize].children);
            kids.sort_by(|&a, &b| {
                self.nodes[b as usize]
                    .size
                    .cmp(&self.nodes[a as usize].size)
            });
            self.nodes[cur as usize].children = kids;
            cur = self.nodes[cur as usize].parent;
        }
        Ok(size)
    }
}

fn build(nodes: &mut Vec<Node>, tmp: TmpNode, parent: u32) -> u32 {
    let idx = nodes.len() as u32;
    let TmpNode {
        name,
        size,
        files,
        dirs,
        mtime,
        is_dir,
        children,
    } = tmp;
    nodes.push(Node {
        name,
        parent,
        size,
        files,
        dirs,
        mtime,
        is_dir,
        removed: false,
        children: Vec::new(),
    });
    let ids: Vec<u32> = children.into_iter().map(|c| build(nodes, c, idx)).collect();
    nodes[idx as usize].children = ids;
    idx
}

/// Lower-case extension without the dot, or "" when there is none.
pub fn ext_of(name: &str) -> String {
    match name.rfind('.') {
        Some(i) if i > 0 && i + 1 < name.len() && name.len() - i - 1 <= 12 => {
            name[i + 1..].to_ascii_lowercase()
        }
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(name: &str, size: u64) -> TmpNode {
        TmpNode {
            name: name.into(),
            size,
            files: 0,
            dirs: 0,
            mtime: 0,
            is_dir: false,
            children: vec![],
        }
    }

    fn dir(name: &str, children: Vec<TmpNode>) -> TmpNode {
        let size = children.iter().map(|c| c.size).sum();
        let files = children
            .iter()
            .map(|c| if c.is_dir { c.files } else { 1 })
            .sum();
        let dirs = children
            .iter()
            .map(|c| if c.is_dir { c.dirs + 1 } else { 0 })
            .sum();
        TmpNode {
            name: name.into(),
            size,
            files,
            dirs,
            mtime: 0,
            is_dir: true,
            children,
        }
    }

    fn sample() -> Tree {
        let root = dir(
            "root",
            vec![
                dir("big", vec![file("a.MP4", 700), file("b.mp4", 100)]),
                dir("small", vec![file("c.txt", 50)]),
                file("d", 10),
            ],
        );
        Tree::from_scan(PathBuf::from("root"), root)
    }

    #[test]
    fn extensions() {
        assert_eq!(ext_of("movie.MKV"), "mkv");
        assert_eq!(ext_of(".gitignore"), "");
        assert_eq!(ext_of("noext"), "");
        assert_eq!(ext_of("trailing."), "");
    }

    #[test]
    fn totals_and_paths() {
        let t = sample();
        assert_eq!(t.nodes[0].size, 860);
        assert_eq!(t.nodes[0].files, 4);
        assert_eq!(t.nodes[0].dirs, 2);
        let big = t.nodes[0].children[0];
        assert_eq!(&*t.nodes[big as usize].name, "big");
        let a = t.nodes[big as usize].children[0];
        assert_eq!(t.path(a), PathBuf::from("root").join("big").join("a.MP4"));
    }

    #[test]
    fn remove_updates_ancestors_and_order() {
        let mut t = sample();
        let big = t.nodes[0].children[0];
        let a = t.nodes[big as usize].children[0];
        assert_eq!(t.remove(a).unwrap(), 700);
        assert_eq!(t.nodes[0].size, 160);
        assert_eq!(t.nodes[0].files, 3);
        assert_eq!(t.nodes[big as usize].size, 100);
        assert!(t.get(a as u64).is_err());
        assert!(t.remove(0).is_err());
        // "big" (100) still ahead of "small" (50)
        assert_eq!(t.nodes[0].children[0], big);
    }

    #[test]
    fn subtree_folds_small_children() {
        let t = sample();
        let v = t.subtree(0, 3, 60);
        assert_eq!(v["children"].as_array().unwrap().len(), 1);
        assert_eq!(v["other"]["count"], 2);
        assert_eq!(v["other"]["size"], 60);
    }

    #[test]
    fn top_and_types() {
        let t = sample();
        let top = t.top_files(0, 2);
        let files = top["files"].as_array().unwrap();
        assert_eq!(files.len(), 2);
        assert_eq!(files[0]["size"], 700);
        let types = t.types(0);
        assert_eq!(types["extensions"][0]["ext"], "mp4");
        assert_eq!(types["extensions"][0]["size"], 800);
        assert_eq!(types["extensions"][0]["count"], 2);
    }
}
