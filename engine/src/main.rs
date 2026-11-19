//! Ringfold engine: scans directories in parallel and answers queries about
//! the result over a JSON-lines protocol (see `protocol.rs`).

mod dupes;
mod protocol;
mod scan;
mod tree;

use protocol::{event, reply};
use serde_json::{json, Value};
use std::io::{self, BufRead};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering::Relaxed};
use std::sync::{Arc, Mutex, RwLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

#[derive(Default)]
struct State {
    tree: RwLock<Option<tree::Tree>>,
    cancel: AtomicBool,
    job: Mutex<Option<JoinHandle<()>>>,
}

fn main() {
    if std::env::args().any(|a| a == "--version") {
        println!("ringfold-engine {}", env!("CARGO_PKG_VERSION"));
        return;
    }
    let state = Arc::new(State::default());
    for line in io::stdin().lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let req: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                event("error", json!({ "message": format!("bad request: {e}") }));
                continue;
            }
        };
        let id = req.get("id").cloned().unwrap_or(Value::Null);
        match req.get("cmd").and_then(Value::as_str).unwrap_or("") {
            "scan" => start_job(&state, id, req, run_scan),
            "duplicates" => start_job(&state, id, req, run_duplicates),
            "cancel" => {
                state.cancel.store(true, Relaxed);
                reply(&id, Ok(Value::Null));
            }
            "ping" => reply(&id, Ok(json!({ "version": env!("CARGO_PKG_VERSION") }))),
            cmd => reply(&id, query(&state, cmd, &req)),
        }
    }
    // stdin closed: the app went away.
    state.cancel.store(true, Relaxed);
}

/// Long-running commands run on their own thread so queries stay responsive.
/// Starting a new job cancels the previous one first.
fn start_job(
    state: &Arc<State>,
    id: Value,
    req: Value,
    job: fn(&State, &Value) -> Result<Value, String>,
) {
    let mut slot = state.job.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(prev) = slot.take() {
        state.cancel.store(true, Relaxed);
        let _ = prev.join();
    }
    state.cancel.store(false, Relaxed);
    let state = Arc::clone(state);
    let handle = thread::Builder::new()
        .stack_size(64 << 20) // tree building recurses once per directory level
        .spawn(move || reply(&id, job(&state, &req)))
        .expect("failed to spawn job thread");
    *slot = Some(handle);
}

fn arg_u64(req: &Value, key: &str) -> Option<u64> {
    req.get(key).and_then(Value::as_u64)
}

/// Repeats `tick` every `every` until `work` returns.
fn with_ticker<T>(every: Duration, tick: impl Fn() + Sync, work: impl FnOnce() -> T) -> T {
    let done = AtomicBool::new(false);
    thread::scope(|s| {
        s.spawn(|| {
            let mut last = Instant::now();
            while !done.load(Relaxed) {
                thread::sleep(Duration::from_millis(20));
                if last.elapsed() >= every {
                    tick();
                    last = Instant::now();
                }
            }
        });
        let out = work();
        done.store(true, Relaxed);
        out
    })
}

fn run_scan(state: &State, req: &Value) -> Result<Value, String> {
    let path = req
        .get("path")
        .and_then(Value::as_str)
        .ok_or("missing path")?;
    let root = PathBuf::from(path);
    let progress = scan::Progress::default();
    let started = Instant::now();

    let tick = || {
        let current = progress
            .current
            .lock()
            .map(|c| c.clone())
            .unwrap_or_default();
        event(
            "scan-progress",
            json!({
                "files": progress.files.load(Relaxed),
                "dirs": progress.dirs.load(Relaxed),
                "bytes": progress.bytes.load(Relaxed),
                "errors": progress.errors.load(Relaxed),
                "current": current,
                "elapsedMs": started.elapsed().as_millis() as u64,
            }),
        );
    };
    let result = with_ticker(Duration::from_millis(120), tick, || {
        scan::scan(&root, &progress, &state.cancel)
    });
    let tmp = result.map_err(|e| format!("{}: {e}", root.display()))?;
    if state.cancel.load(Relaxed) {
        return Err("cancelled".into());
    }

    let tree = tree::Tree::from_scan(root, tmp);
    let summary = tree.summary(0);
    *state.tree.write().unwrap_or_else(|e| e.into_inner()) = Some(tree);
    Ok(json!({
        "root": summary,
        "errors": progress.errors.load(Relaxed),
        "elapsedMs": started.elapsed().as_millis() as u64,
    }))
}

fn run_duplicates(state: &State, req: &Value) -> Result<Value, String> {
    let id = arg_u64(req, "node").unwrap_or(0);
    let min_size = arg_u64(req, "minSize").unwrap_or(1 << 20);
    let cands = {
        let guard = state.tree.read().unwrap_or_else(|e| e.into_inner());
        let tree = guard.as_ref().ok_or("nothing scanned yet")?;
        tree.get(id)?;
        dupes::candidates(tree, id as u32, min_size)
    };
    let progress = dupes::Progress::default();
    let tick = || {
        event(
            "dupes-progress",
            json!({
                "stage": progress.stage.load(Relaxed),
                "doneFiles": progress.done_files.load(Relaxed),
                "totalFiles": progress.total_files.load(Relaxed),
                "doneBytes": progress.done_bytes.load(Relaxed),
                "totalBytes": progress.total_bytes.load(Relaxed),
            }),
        );
    };
    let result = with_ticker(Duration::from_millis(150), tick, || {
        dupes::find(cands, &state.cancel, &progress)
    });
    result.ok_or_else(|| "cancelled".to_string())
}

fn query(state: &State, cmd: &str, req: &Value) -> Result<Value, String> {
    let id = arg_u64(req, "node").unwrap_or(0);
    if cmd == "remove" {
        let mut guard = state.tree.write().unwrap_or_else(|e| e.into_inner());
        let tree = guard.as_mut().ok_or("nothing scanned yet")?;
        let freed = tree.remove(id as u32)?;
        return Ok(json!({ "freed": freed }));
    }

    let guard = state.tree.read().unwrap_or_else(|e| e.into_inner());
    let tree = guard.as_ref().ok_or("nothing scanned yet")?;
    tree.get(id)?;
    let id = id as u32;
    match cmd {
        "view" => Ok(tree.view(id, arg_u64(req, "limit").unwrap_or(400) as usize)),
        "tree" => {
            let depth = arg_u64(req, "depth").unwrap_or(5).min(12) as u32;
            let fraction = req
                .get("minFraction")
                .and_then(Value::as_f64)
                .unwrap_or(0.002);
            let min_size = (tree.nodes[id as usize].size as f64 * fraction) as u64;
            Ok(tree.subtree(id, depth, min_size))
        }
        "top" => Ok(tree.top_files(id, arg_u64(req, "limit").unwrap_or(100).min(5000) as usize)),
        "types" => Ok(tree.types(id)),
        "path" => Ok(json!(tree.path(id).to_string_lossy())),
        _ => Err(format!("unknown command '{cmd}'")),
    }
}
