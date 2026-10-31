import { useState, type DragEvent } from 'react'
import type { Beat, CutieManifest, Line } from '../engine/types'
import type { Draft } from './draft'
import { cleanName, IconBtn } from './fields'
import type { UpdateDraft } from './Studio'

type Kind = 'expression' | 'background' | 'cg' | 'select' | 'sound'

const SECTIONS: { kind: Kind; title: string; hint: string; maxWidth: number }[] = [
  { kind: 'expression', title: 'Expressions', hint: 'Tall sprites with a see-through background. The file name is the expression name.', maxWidth: 900 },
  { kind: 'background', title: 'Backgrounds', hint: 'Rooms and places. 1920 × 1080 is plenty.', maxWidth: 1920 },
  { kind: 'cg', title: 'Reward art', hint: 'Special pictures shown full-screen by a line, and kept in the gallery.', maxWidth: 1920 },
  { kind: 'select', title: 'Portrait', hint: 'Square picture for the cutie picker.', maxWidth: 400 },
  { kind: 'sound', title: 'Sounds', hint: 'Short .mp3, .ogg or .wav clips a line can play.', maxWidth: 0 },
]

const prefix = (k: Kind) => (k === 'background' ? 'bg_' : k === 'cg' ? 'cg_' : '')
const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)$/i

function kindOf(path: string): Kind {
  if (path.startsWith('sounds/')) return 'sound'
  const stem = path.slice(7).replace(/\.\w+$/, '')
  return stem === 'select' ? 'select' : stem.startsWith('bg_') ? 'background' : stem.startsWith('cg_') ? 'cg' : 'expression'
}

/** Logical name: file stem without folder, extension or bg_/cg_ prefix. */
const logical = (path: string) => path.replace(/^(images|sounds)\//, '').replace(/\.\w+$/, '').replace(/^(bg|cg)_/, '')

/** Shrink big images to WebP so packs stay small. Small ones are kept as they are. */
async function shrink(file: File, maxWidth: number): Promise<{ bytes: Uint8Array; ext: string }> {
  const original = { bytes: new Uint8Array(await file.arrayBuffer()), ext: file.name.split('.').pop()!.toLowerCase() }
  if (!maxWidth || file.type === 'image/gif') return original
  try {
    const bmp = await createImageBitmap(file)
    if (bmp.width <= maxWidth && file.size < 600_000) return original
    const scale = Math.min(1, maxWidth / bmp.width)
    const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale))
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.88 })
    return blob.size < file.size ? { bytes: new Uint8Array(await blob.arrayBuffer()), ext: 'webp' } : original
  } catch {
    return original
  }
}

/** Rename an asset everywhere the script and profile mention it. */
function renameRefs(d: Draft, kind: Kind, from: string, to: string): Pick<Draft, 'manifest' | 'script'> {
  const key: keyof Line | null = kind === 'expression' ? 'expression' : kind === 'background' ? 'background' : kind === 'cg' ? 'cg' : kind === 'sound' ? 'sound' : null
  if (!key) return d
  const fixLine = (l: Line): Line => (l[key] === from ? { ...l, [key]: to } : l)
  const fixLines = (ls?: Line[]) => ls?.map(fixLine)
  const beats: Beat[] = d.script.beats.map((b) => ({
    ...b,
    lines: fixLines(b.lines),
    variants: b.variants?.map((v) => v.map(fixLine)),
    choices: b.choices?.map((c) => ({ ...c, lines: fixLines(c.lines) })),
  }))
  const m: CutieManifest = { ...d.manifest }
  if (kind === 'expression') {
    if (m.defaultExpression === from) m.defaultExpression = to
    m.stages = m.stages?.map((s) => (s.defaultExpression === from ? { ...s, defaultExpression: to } : s))
    if (m.idle) m.idle = { ...m.idle, expressions: m.idle.expressions.map((e) => (e.expression === from ? { ...e, expression: to } : e)) }
  }
  if (kind === 'background') {
    if (m.defaultBackground === from) m.defaultBackground = to
    m.backgroundBySlot = Object.fromEntries(Object.entries(m.backgroundBySlot ?? {}).map(([k, v]) => [k, v === from ? to : v]))
  }
  return { manifest: m, script: { ...d.script, beats } }
}

function usage(d: Draft, kind: Kind, name: string): number {
  const all = d.script.beats.flatMap((b) => [...(b.lines ?? []), ...(b.variants ?? []).flat(), ...(b.choices ?? []).flatMap((c) => c.lines ?? [])])
  const key = kind === 'expression' ? 'expression' : kind === 'background' ? 'background' : kind === 'cg' ? 'cg' : 'sound'
  return all.filter((l) => l[key as keyof Line] === name).length
}

export function ArtTab({ draft, update, urlCache }: { draft: Draft; update: UpdateDraft; urlCache: Map<Uint8Array, string> }) {
  const [over, setOver] = useState<Kind | null>(null)
  const [busy, setBusy] = useState(false)

  const urlOf = (path: string) => {
    const bytes = draft.files[path]
    let url = urlCache.get(bytes)
    if (!url) {
      url = URL.createObjectURL(new Blob([bytes as BlobPart]))
      urlCache.set(bytes, url)
    }
    return url
  }

  async function add(kind: Kind, files: FileList | File[]) {
    setBusy(true)
    const section = SECTIONS.find((s) => s.kind === kind)!
    const added: Record<string, Uint8Array> = {}
    for (const file of Array.from(files)) {
      const isSound = /\.(mp3|ogg|wav|m4a)$/i.test(file.name)
      if (kind === 'sound' ? !isSound : !IMAGE_RE.test(file.name)) continue
      const stem = kind === 'select' ? 'select' : cleanName(file.name.replace(/\.\w+$/, '').replace(/^(bg|cg)_/i, ''))
      const { bytes, ext } = await shrink(file, section.maxWidth)
      added[`${kind === 'sound' ? 'sounds' : 'images'}/${prefix(kind)}${stem}.${ext}`] = bytes
    }
    update((d) => {
      // Replace any file with the same logical name but another extension.
      const keep = Object.fromEntries(Object.entries(d.files).filter(([p]) =>
        !Object.keys(added).some((a) => a.replace(/\.\w+$/, '') === p.replace(/\.\w+$/, ''))))
      return { ...d, files: { ...keep, ...added } }
    })
    setBusy(false)
  }

  function rename(path: string, kind: Kind) {
    const from = logical(path)
    const raw = prompt(`New name for "${from}":`, from)
    const to = raw && cleanName(raw)
    if (!to || to === from) return
    const ext = path.split('.').pop()
    const folder = kind === 'sound' ? 'sounds' : 'images'
    update((d) => {
      const files = { ...d.files }
      files[`${folder}/${prefix(kind)}${to}.${ext}`] = files[path]
      delete files[path]
      return { ...d, files, ...renameRefs(d, kind, from, to) }
    })
  }

  function remove(path: string, kind: Kind) {
    const n = usage(draft, kind, logical(path))
    if (!confirm(`Delete ${logical(path)}?${n ? ` ${n} line(s) use it and will show an error until changed.` : ''}`)) return
    update((d) => {
      const files = { ...d.files }
      delete files[path]
      return { ...d, files }
    })
  }

  return (
    <div className="studio-form">
      {busy && <p className="shint">Adding files…</p>}
      {SECTIONS.map((s) => {
        const paths = Object.keys(draft.files).filter((p) => kindOf(p) === s.kind).sort()
        const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(null); void add(s.kind, e.dataTransfer.files) }
        return (
          <section key={s.kind}>
            <h3>{s.title} <span className="count">{paths.length}</span></h3>
            <p className="shint">{s.hint}</p>
            <div className="asset-grid">
              {paths.map((p) => (
                <figure key={p} className={`asset kind-${s.kind}`}>
                  {s.kind === 'sound'
                    ? <audio controls src={urlOf(p)} />
                    : <img src={urlOf(p)} alt={logical(p)} />}
                  <figcaption>
                    <span className="mono">{s.kind === 'select' ? 'portrait' : logical(p)}</span>
                    {s.kind !== 'select' && <span className="uses">{usage(draft, s.kind, logical(p))} uses</span>}
                    <span className="asset-btns">
                      {s.kind !== 'select' && <IconBtn title="Rename" onClick={() => rename(p, s.kind)}>✎</IconBtn>}
                      <IconBtn title="Delete" danger onClick={() => remove(p, s.kind)}>✕</IconBtn>
                    </span>
                  </figcaption>
                </figure>
              ))}
              <label className={`asset add ${over === s.kind ? 'over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOver(s.kind) }} onDragLeave={() => setOver(null)} onDrop={onDrop}>
                <input type="file" hidden multiple={s.kind !== 'select'}
                  accept={s.kind === 'sound' ? 'audio/*' : 'image/*'}
                  onChange={(e) => { if (e.target.files) void add(s.kind, e.target.files); e.target.value = '' }} />
                <span className="plus">+</span>
                <span>Drop or choose</span>
              </label>
            </div>
          </section>
        )
      })}
    </div>
  )
}
