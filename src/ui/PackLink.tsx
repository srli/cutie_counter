import { useEffect, useState } from 'react'
import type { Pack } from '../engine/types'
import { imageUrl, loadPackBytes } from '../pack/load'
import type { Issue } from '../pack/validate'
import { installPack } from '../store'

const MAX_BYTES = 50 * 1024 * 1024

/** The `?pack=<url>` in the address bar, if any. */
export function packLinkFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('pack')
}

function clearPackLink() {
  const url = new URL(window.location.href)
  url.searchParams.delete('pack')
  window.history.replaceState(null, '', url)
}

/**
 * Someone shared a link like `…/cutie_counter/?pack=https://example.com/mira.cutie`.
 * Fetch it, check it, and ask before adding. The host must allow cross-site downloads (CORS).
 */
export function PackLink({ src, onDone }: { src: string; onDone: (added: boolean) => void }) {
  const [state, setState] = useState<{ bytes?: Uint8Array; pack?: Pack | null; issues?: Issue[]; error?: string }>({})
  const url = (() => { try { return new URL(src, window.location.href) } catch { return null } })()
  const safe = !!url && (url.protocol === 'https:' || url.origin === window.location.origin)

  useEffect(() => {
    if (!url || !safe) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(url, { credentials: 'omit' })
        if (!res.ok) throw new Error(`the server said ${res.status}`)
        if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('the file is too big')
        const bytes = new Uint8Array(await res.arrayBuffer())
        if (bytes.length > MAX_BYTES) throw new Error('the file is too big')
        const { pack, issues } = loadPackBytes(bytes)
        if (!cancelled) setState({ bytes, pack, issues })
      } catch (e) {
        if (!cancelled) setState({ error: (e as Error).message || 'it could not be downloaded' })
      }
    })()
    return () => { cancelled = true }
  }, [src])

  const close = (added: boolean) => { clearPackLink(); onDone(added) }
  async function add() {
    if (!state.bytes) return
    await installPack(state.bytes)
    close(true)
  }

  const errors = state.issues?.filter((i) => i.level === 'error') ?? []
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-label="Add a shared cutie">
        <h2 className="title">A cutie was shared with you</h2>
        <p className="hint">From <code>{url?.host || src}</code></p>
        {!safe && <p className="error">This link isn't a secure (https) address, so it wasn't opened.</p>}
        {safe && !state.bytes && !state.error && <p className="hint">Downloading…</p>}
        {state.error && <p className="error">Couldn't get this cutie: {state.error}. The site hosting it may not allow sharing.</p>}
        {state.pack && (
          <div className="load-success">
            <img src={imageUrl(state.pack, 'select')} alt="" />
            <p><b>{state.pack.manifest.name}</b>{state.pack.manifest.author ? ` by ${state.pack.manifest.author}` : ''}<br /><small>{state.pack.manifest.intro}</small></p>
          </div>
        )}
        {errors.length > 0 && (
          <div className="issues"><p>This pack has problems and can't be added:</p>
            <ul>{errors.map((i, n) => <li key={n}><b>{i.where}</b>: {i.message}</li>)}</ul></div>
        )}
        <div className="modal-actions">
          <button className="pill" onClick={() => close(false)}>No thanks</button>
          {state.pack && <button className="pill primary" onClick={add}>Add {state.pack.manifest.name}</button>}
        </div>
      </div>
    </div>
  )
}
