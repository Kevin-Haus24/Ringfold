//! Duplicate finder: group by size, then by a hash of the first block, then
//! by a hash of the whole file. Only files that survive each stage are read.

use crate::tree::Tree;
use rayon::prelude::*;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs::File;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use xxhash_rust::xxh3::Xxh3;

const HEAD: u64 = 64 * 1024;
const MAX_GROUPS: usize = 1000;

#[derive(Default)]
pub struct Progress {
    pub stage: AtomicU64, // 1 = quick hash, 2 = full hash
    pub done_files: AtomicU64,
    pub total_files: AtomicU64,
    pub done_bytes: AtomicU64,
    pub total_bytes: AtomicU64,
}

pub struct Candidate {
    pub id: u32,
    pub size: u64,
    pub path: PathBuf,
}

/// Collects files under `id` whose size is shared by at least one other file.
pub fn candidates(tree: &Tree, id: u32, min_size: u64) -> Vec<Candidate> {
    let mut by_size: HashMap<u64, Vec<u32>> = HashMap::new();
    let mut stack = vec![id];
    while let Some(cur) = stack.pop() {
        let n = &tree.nodes[cur as usize];
        if n.is_dir {
            stack.extend_from_slice(&n.children);
        } else if n.size >= min_size.max(1) {
            by_size.entry(n.size).or_default().push(cur);
        }
    }
    by_size
        .into_iter()
        .filter(|(_, ids)| ids.len() > 1)
        .flat_map(|(size, ids)| ids.into_iter().map(move |id| (size, id)))
        .map(|(size, id)| Candidate {
            id,
            size,
            path: tree.path(id),
        })
        .collect()
}

fn hash_file(
    path: &Path,
    limit: u64,
    cancel: &AtomicBool,
    progress: &Progress,
) -> io::Result<u128> {
    let mut file = File::open(path)?.take(limit);
    let mut hasher = Xxh3::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        if cancel.load(Relaxed) {
            return Err(io::Error::new(io::ErrorKind::Interrupted, "cancelled"));
        }
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        progress.done_bytes.fetch_add(n as u64, Relaxed);
    }
    Ok(hasher.digest128())
}

/// Splits each group into sub-groups of identical hashes; drops singletons.
fn refine(
    groups: Vec<Vec<Candidate>>,
    limit: impl Fn(u64) -> u64 + Sync,
    cancel: &AtomicBool,
    progress: &Progress,
) -> Vec<Vec<Candidate>> {
    let files: Vec<Candidate> = groups.into_iter().flatten().collect();
    progress.done_files.store(0, Relaxed);
    progress.done_bytes.store(0, Relaxed);
    progress.total_files.store(files.len() as u64, Relaxed);
    progress.total_bytes.store(
        files.iter().map(|c| limit(c.size).min(c.size)).sum(),
        Relaxed,
    );

    let hashed: Vec<(u64, u128, Candidate)> = files
        .into_par_iter()
        .filter_map(|c| {
            let h = hash_file(&c.path, limit(c.size), cancel, progress).ok();
            progress.done_files.fetch_add(1, Relaxed);
            h.map(|h| (c.size, h, c))
        })
        .collect();

    let mut map: HashMap<(u64, u128), Vec<Candidate>> = HashMap::new();
    for (size, h, c) in hashed {
        map.entry((size, h)).or_default().push(c);
    }
    map.into_values().filter(|g| g.len() > 1).collect()
}

pub fn find(cands: Vec<Candidate>, cancel: &AtomicBool, progress: &Progress) -> Option<Value> {
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(8)
        .build()
        .ok()?;
    let mut by_size: HashMap<u64, Vec<Candidate>> = HashMap::new();
    for c in cands {
        by_size.entry(c.size).or_default().push(c);
    }

    pool.install(|| {
        progress.stage.store(1, Relaxed);
        let quick = refine(by_size.into_values().collect(), |_| HEAD, cancel, progress);
        if cancel.load(Relaxed) {
            return None;
        }
        // Files no bigger than the head block are already fully compared.
        let (done, need_full): (Vec<_>, Vec<_>) =
            quick.into_iter().partition(|g| g[0].size <= HEAD);
        progress.stage.store(2, Relaxed);
        let mut groups = done;
        groups.extend(refine(need_full, |size| size, cancel, progress));
        if cancel.load(Relaxed) {
            return None;
        }

        groups.sort_unstable_by_key(|g| std::cmp::Reverse(g[0].size * (g.len() as u64 - 1)));
        let total_groups = groups.len();
        let wasted: u64 = groups
            .iter()
            .map(|g| g[0].size * (g.len() as u64 - 1))
            .sum();
        let list: Vec<Value> = groups
            .into_iter()
            .take(MAX_GROUPS)
            .map(|mut g| {
                g.sort_by(|a, b| a.path.cmp(&b.path));
                let size = g[0].size;
                json!({
                    "size": size,
                    "wasted": size * (g.len() as u64 - 1),
                    "files": g.iter().map(|c| json!({
                        "id": c.id,
                        "path": c.path.to_string_lossy(),
                        "name": c.path.file_name().map(|n| n.to_string_lossy()).unwrap_or_default(),
                    })).collect::<Vec<_>>(),
                })
            })
            .collect();
        Some(json!({ "groups": list, "totalGroups": total_groups, "wasted": wasted }))
    })
}
