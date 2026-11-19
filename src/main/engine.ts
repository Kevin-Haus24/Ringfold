import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createInterface } from 'node:readline'

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

/**
 * Talks to the Rust engine over stdin/stdout (one JSON object per line).
 * The process is started lazily and restarted if it dies.
 * Emits `event` for progress messages.
 */
export class Engine extends EventEmitter {
  private proc?: ChildProcess
  private nextId = 1
  private pending = new Map<number, Pending>()

  constructor(private readonly binary: string) {
    super()
  }

  request<T>(cmd: string, params: Record<string, unknown> = {}): Promise<T> {
    const proc = this.ensure()
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      proc.stdin!.write(JSON.stringify({ id, cmd, ...params }) + '\n')
    })
  }

  dispose(): void {
    this.proc?.stdin?.end()
    this.proc?.kill()
    this.proc = undefined
  }

  private ensure(): ChildProcess {
    if (this.proc && this.proc.exitCode === null) return this.proc

    const proc = spawn(this.binary, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    createInterface({ input: proc.stdout! }).on('line', (line) => this.onLine(line))
    proc.stderr!.on('data', (d) => console.error('[engine]', String(d).trimEnd()))
    const fail = (error: Error): void => {
      for (const p of this.pending.values()) p.reject(error)
      this.pending.clear()
      if (this.proc === proc) this.proc = undefined
    }
    proc.on('error', (err) => fail(new Error(`engine failed to start: ${err.message}`)))
    proc.on('exit', (code) => fail(new Error(`engine exited with code ${code}`)))
    this.proc = proc
    return proc
  }

  private onLine(line: string): void {
    let msg: { id?: number; ok?: boolean; result?: unknown; error?: string; event?: string }
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    if (msg.event) {
      this.emit('event', msg)
      return
    }
    const p = msg.id === undefined ? undefined : this.pending.get(msg.id)
    if (!p) return
    this.pending.delete(msg.id!)
    if (msg.ok) p.resolve(msg.result)
    else p.reject(new Error(msg.error ?? 'engine error'))
  }
}
