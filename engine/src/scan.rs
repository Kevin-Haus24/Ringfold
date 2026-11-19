//! Parallel directory walker. Each directory is a rayon task, so wide trees
//! saturate the disk queue while deep trees still make progress.

use rayon::prelude::*;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

/// Temporary owned tree produced by the walker; flattened into
/// [`crate::tree::Tree`] once the scan is done.
pub struct TmpNode {
    pub name: Box<str>,
    pub size: u64,
    pub files: u64,
    pub dirs: u64,
    pub mtime: i64,
    pub is_dir: bool,
    pub children: Vec<TmpNode>,
}

#[derive(Default)]
pub struct Progress {
    pub files: AtomicU64,
    pub dirs: AtomicU64,
    pub bytes: AtomicU64,
    pub errors: AtomicU64,
    pub current: Mutex<String>,
}

struct Ctx<'a> {
    progress: &'a Progress,
    cancel: &'a AtomicBool,
    excluded: Vec<PathBuf>,
    #[cfg(unix)]
    inodes: Mutex<std::collections::HashSet<(u64, u64)>>,
}

impl Ctx<'_> {
    fn is_excluded(&self, path: &Path) -> bool {
        self.excluded.iter().any(|e| e == path)
    }
}

/// Virtual or duplicated file systems that would distort the picture when
/// the user scans the system root.
fn default_excludes() -> Vec<PathBuf> {
    let list: &[&str] = if cfg!(target_os = "linux") {
        &["/proc", "/sys", "/dev", "/run", "/mnt", "/media"]
    } else if cfg!(target_os = "macos") {
        // The Data volume is already visible through firmlinks (/Users, /Applications, ...).
        &["/System/Volumes/Data", "/Volumes", "/dev", "/net", "/home"]
    } else {
        &[]
    };
    list.iter().map(PathBuf::from).collect()
}

pub fn scan(root: &Path, progress: &Progress, cancel: &AtomicBool) -> io::Result<TmpNode> {
    let meta = fs::metadata(root)?;
    if !meta.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "not a directory",
        ));
    }
    let ctx = Ctx {
        progress,
        cancel,
        excluded: default_excludes(),
        #[cfg(unix)]
        inodes: Mutex::new(Default::default()),
    };
    // Directory walking is I/O bound: oversubscribe the CPU a little.
    let threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads((threads * 2).clamp(4, 32))
        .stack_size(16 << 20)
        .build()
        .map_err(io::Error::other)?;
    let children = pool.install(|| scan_children(root, &ctx));
    Ok(dir_node(root.to_string_lossy().into(), children))
}

fn dir_node(name: Box<str>, mut children: Vec<TmpNode>) -> TmpNode {
    let (mut size, mut files, mut dirs, mut mtime) = (0u64, 0u64, 0u64, 0i64);
    for c in &children {
        size += c.size;
        mtime = mtime.max(c.mtime);
        if c.is_dir {
            files += c.files;
            dirs += c.dirs + 1;
        } else {
            files += 1;
        }
    }
    children.sort_unstable_by_key(|c| std::cmp::Reverse(c.size));
    children.shrink_to_fit();
    TmpNode {
        name,
        size,
        files,
        dirs,
        mtime,
        is_dir: true,
        children,
    }
}

fn scan_children(dir: &Path, ctx: &Ctx) -> Vec<TmpNode> {
    if ctx.cancel.load(Relaxed) {
        return Vec::new();
    }
    let seen = ctx.progress.dirs.fetch_add(1, Relaxed);
    if seen.is_multiple_of(256) {
        if let Ok(mut current) = ctx.progress.current.try_lock() {
            *current = dir.to_string_lossy().into_owned();
        }
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => {
            ctx.progress.errors.fetch_add(1, Relaxed);
            return Vec::new();
        }
    };

    let mut out = Vec::new();
    let mut subdirs: Vec<(Box<str>, PathBuf)> = Vec::new();
    for entry in entries {
        let Ok(entry) = entry else {
            ctx.progress.errors.fetch_add(1, Relaxed);
            continue;
        };
        let name: Box<str> = entry.file_name().to_string_lossy().into();
        let Ok(file_type) = entry.file_type() else {
            ctx.progress.errors.fetch_add(1, Relaxed);
            continue;
        };
        // Symlinks and Windows junctions report is_dir() == false, so they are
        // never followed — that keeps sizes honest and avoids cycles.
        if file_type.is_dir() {
            let path = entry.path();
            if !ctx.is_excluded(&path) {
                subdirs.push((name, path));
            }
            continue;
        }
        let (size, mtime) = match entry.metadata() {
            Ok(m) => (file_size(&m, ctx), mtime_of(&m)),
            Err(_) => {
                ctx.progress.errors.fetch_add(1, Relaxed);
                (0, 0)
            }
        };
        ctx.progress.files.fetch_add(1, Relaxed);
        ctx.progress.bytes.fetch_add(size, Relaxed);
        out.push(TmpNode {
            name,
            size,
            files: 0,
            dirs: 0,
            mtime,
            is_dir: false,
            children: Vec::new(),
        });
    }

    let dirs: Vec<TmpNode> = subdirs
        .into_par_iter()
        .map(|(name, path)| dir_node(name, scan_children(&path, ctx)))
        .collect();
    out.extend(dirs);
    out
}

#[cfg(unix)]
fn file_size(meta: &fs::Metadata, ctx: &Ctx) -> u64 {
    use std::os::unix::fs::MetadataExt;
    // Count hard-linked files once.
    if meta.is_file() && meta.nlink() > 1 {
        let mut seen = ctx.inodes.lock().unwrap_or_else(|e| e.into_inner());
        if !seen.insert((meta.dev(), meta.ino())) {
            return 0;
        }
    }
    meta.len()
}

#[cfg(not(unix))]
fn file_size(meta: &fs::Metadata, _ctx: &Ctx) -> u64 {
    meta.len()
}

fn mtime_of(meta: &fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
