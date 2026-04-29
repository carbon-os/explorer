// Plain JSON IPC bridge. window.ipc is injected by the arc host at runtime.

declare global {
  interface Window {
    ipc: {
      post(channel: string, data: string | ArrayBuffer): void
      on(channel: string, cb: (payload: string | ArrayBuffer) => void): void
      off(channel: string): void
    }
  }
}

type Listener = (data: any) => void

const registry = new Map<string, Set<Listener>>()
const hooked   = new Set<string>()

function hookChannel(channel: string) {
  if (hooked.has(channel)) return
  hooked.add(channel)
  window.ipc.on(channel, (raw) => {
    const str = typeof raw === 'string'
      ? raw
      : new TextDecoder().decode(new Uint8Array(raw as ArrayBuffer))
    let data: any
    try { data = JSON.parse(str) } catch { data = str }
    registry.get(channel)?.forEach(fn => { try { fn(data) } catch {} })
  })
}

export function on(channel: string, cb: Listener): () => void {
  hookChannel(channel)
  if (!registry.has(channel)) registry.set(channel, new Set())
  registry.get(channel)!.add(cb)
  return () => registry.get(channel)?.delete(cb)
}

export function send(channel: string, data: unknown = null): void {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  window.ipc.post(channel, bytes.buffer as ArrayBuffer)  // ← binary, not string
}

export const ipc = { on, send } as const