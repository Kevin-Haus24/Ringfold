//! Line-delimited JSON protocol between the Electron app and the engine.
//!
//! Requests arrive on stdin, one JSON object per line:
//!   `{"id": 1, "cmd": "scan", "path": "C:\\"}`
//! Responses go to stdout, one JSON object per line:
//!   `{"id": 1, "ok": true, "result": {...}}`
//!   `{"id": 1, "ok": false, "error": "..."}`
//! Progress events have no id:
//!   `{"event": "scan-progress", ...}`

use serde_json::{json, Value};
use std::io::Write;

/// Writes one JSON value as a line to stdout. `StdoutLock` serialises writers
/// from different threads, so lines never interleave.
pub fn emit(value: &Value) {
    let mut out = std::io::stdout().lock();
    let _ = serde_json::to_writer(&mut out, value);
    let _ = out.write_all(b"\n");
    let _ = out.flush();
}

pub fn reply(id: &Value, result: Result<Value, String>) {
    match result {
        Ok(result) => emit(&json!({ "id": id, "ok": true, "result": result })),
        Err(error) => emit(&json!({ "id": id, "ok": false, "error": error })),
    }
}

pub fn event(name: &str, mut payload: Value) {
    if let Value::Object(map) = &mut payload {
        map.insert("event".into(), Value::String(name.into()));
    }
    emit(&payload);
}
