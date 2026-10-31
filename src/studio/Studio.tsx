import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Packs } from '../App'
import type { Beat } from '../engine/types'
import { imageUrl } from '../pack/load'
import { getPackBytes, installPack, removeUserPack } from '../store'
import { download, pickFile } from '../ui/files'
import { ArtTab } from './ArtTab'
import { BeatsTab } from './BeatsTab'
import { CoverageTab } from './CoverageTab'
import {
  blankDraft, deleteDraft, draftFromBytes, draftToBytes, draftToPack, getDraft, listDrafts, saveDraft, type Draft,
} from './draft'
import { cleanName } from './fields'
import { PreviewTab } from './PreviewTab'
import { downloadSheet, SheetImport } from './SheetImport'
import { ProfileTab } from './ProfileTab'
import './studio.css'

interface Props {
  draftId?: string
  packs: Packs
  go: (path: string) => void
  reloadPacks: () => Promise<void>
}

export function Studio(props: Props) {
  return props.draftId ? <StudioEditor key={props.draftId} {...props} draftId={props.draftId} /> : <StudioHome {...props} />
}

// ------------------------------------------------------------------ home

function StudioHome({ packs, go, reloadPacks }: Props) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [error, setError] = useState('')
  const refresh = () => void listDrafts().then(setDrafts)
  useEffect(refresh, [])

  async function open(d: Draft) {
    // Don't overwrite an existing draft with the same id.
    let id = d.manifest.id
    const taken = new Set((drafts ?? []).map((x) => x.manifest.id))
    for (let n = 2; taken.has(id); n++) id = `${d.manifest.id}-${n}`
    const draft = { ...d, manifest: { ...d.manifest, id } }
    await saveDraft(draft)
    go(`studio/${id}`)
  }

  async function startNew() {
    const name = prompt('What is your cutie called?')?.trim()
    if (!name) return
    await open(blankDraft(cleanName(name) || 'cutie', name))
  }

  async function copyPack(id: string) {
    const bytes = await getPackBytes(id, packs[id].source)
    if (bytes) await open(draftFromBytes(bytes))
  }

  async function openFile() {
    const file = await pickFile('.cutie,.zip')
    if (!file) return
    try {
      await open(draftFromBytes(new Uint8Array(await file.arrayBuffer())))
    } catch (e) {
      setError(`Couldn't open that file: ${(e as Error).message}`)
    }
  }

  async function remove(d: Draft) {
    if (!confirm(`Delete the draft "${d.manifest.name}"? Export it first if you want to keep it.`)) return
    await deleteDraft(d.manifest.id)
    refresh()
  }

  const userPacks = Object.values(packs).filter((p) => p.source === 'user')

  return (
    <div className="stories-screen">
      <button className="back-link" onClick={() => go('')}>‹ Menu</button>
      <h1 className="title">Cutie Studio</h1>
      <p className="hint">Make or edit a cutie. Everything saves in this browser as you go; use Export to get a <code>.cutie</code> file to share.</p>

      <div className="studio-start">
        <button className="pill primary" onClick={startNew}>+ New cutie</button>
        <button className="pill" onClick={openFile}>Open a .cutie file…</button>
        {Object.keys(packs).map((id) => (
          <button key={id} className="pill" onClick={() => copyPack(id)}>Copy {packs[id].pack.manifest.name}</button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}

      <h2 className="title small">Drafts</h2>
      {drafts?.length === 0 && <p className="hint">No drafts yet.</p>}
      <ul className="story-list">
        {drafts?.map((d) => (
          <li key={d.manifest.id} className="story-row">
            <div className="story-info">
              <b>{d.manifest.name}</b>
              <span>{d.script.beats.length} beats · {Object.keys(d.files).length} files · edited {new Date(d.updatedAt).toLocaleString()}</span>
            </div>
            <div className="story-actions">
              <button className="pill primary" onClick={() => go(`studio/${d.manifest.id}`)}>Edit</button>
              <button className="pill danger" onClick={() => remove(d)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>

      {userPacks.length > 0 && <>
        <h2 className="title small">Loaded cuties</h2>
        <ul className="story-list">
          {userPacks.map(({ pack }) => (
            <li key={pack.manifest.id} className="story-row">
              <img src={imageUrl(pack, 'select')} alt="" />
              <div className="story-info"><b>{pack.manifest.name}</b><span>id: {pack.manifest.id}</span></div>
              <div className="story-actions">
                <button className="pill danger" onClick={async () => {
                  if (!confirm(`Remove ${pack.manifest.name} from this browser? Stories using them will need the pack again.`)) return
                  await removeUserPack(pack.manifest.id)
                  await reloadPacks()
                }}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      </>}
    </div>
  )
}

// ------------------------------------------------------------------ editor

export type Tab = 'profile' | 'art' | 'beats' | 'coverage' | 'preview'
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'art', label: 'Art & Sound' },
  { id: 'beats', label: 'Script' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'preview', label: 'Preview' },
]

export type UpdateDraft = (fn: (d: Draft) => Draft) => void

function StudioEditor({ draftId, packs, go, reloadPacks }: Props & { draftId: string }) {
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('profile')
  const [beatId, setBeatId] = useState<string | null>(null)
  const [previewBeat, setPreviewBeat] = useState<Beat | null>(null)
  const [notice, setNotice] = useState('')
  const [showIssues, setShowIssues] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const urlCache = useRef(new Map<Uint8Array, string>())

  useEffect(() => { void getDraft(draftId).then((d) => setDraft(d ?? null)) }, [draftId])

  // Autosave shortly after each change. An id change moves the draft.
  const saveTimer = useRef<number>(undefined)
  const update: UpdateDraft = useCallback((fn) => {
    setDraft((d) => {
      if (!d) return d
      const next = fn(d)
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(async () => {
        await saveDraft(next)
        if (next.manifest.id !== draftId) {
          await deleteDraft(draftId)
          go(`studio/${next.manifest.id}`)
        }
      }, 500)
      return next
    })
  }, [draftId, go])

  const result = useMemo(() => (draft ? draftToPack(draft, urlCache.current) : null), [draft])

  if (draft === undefined) return <div className="loading">Loading…</div>
  if (!draft || !result) return <div className="stories-screen"><p className="error">Draft not found.</p><button className="pill" onClick={() => go('studio')}>Back</button></div>

  const errors = result.issues.filter((i) => i.level === 'error')
  const warnings = result.issues.filter((i) => i.level === 'warning')
  const builtinClash = packs[draft.manifest.id]?.source === 'builtin'

  async function tryIt() {
    const { pack, issues } = await installPack(draftToBytes(draft!))
    if (!pack) {
      setNotice(`Fix ${issues.filter((i) => i.level === 'error').length} problem(s) first.`)
      setShowIssues(true)
      return
    }
    await reloadPacks()
    setNotice(`${pack.manifest.name} is in your cutie list now${builtinClash ? ' (replacing the built-in one in this browser)' : ''}. Start a New Story to play.`)
  }

  const openBeat = (id: string) => { setBeatId(id); setTab('beats') }
  const playBeat = (b: Beat) => { setPreviewBeat(b); setTab('preview') }

  return (
    <div className="studio">
      <header className="toolbar">
        <button className="pill" onClick={() => go('studio')}>‹ Studio</button>
        <h1 className="story-title">{draft.manifest.name} <span className="studio-id">{draft.manifest.id}</span></h1>
        <button className={`status-badge ${errors.length ? 'bad' : warnings.length ? 'warn' : 'good'}`} onClick={() => setShowIssues((s) => !s)}>
          {errors.length ? `✗ ${errors.length} to fix` : warnings.length ? `! ${warnings.length} notes` : '✓ Ready'}
        </button>
        <button className="pill" onClick={() => setSheetOpen(true)}>Import spreadsheet</button>
        <button className="pill" onClick={() => downloadSheet(draft)}>Download spreadsheet</button>
        <button className="pill" onClick={tryIt}>Try it</button>
        <button className="pill primary" onClick={() => download(`${draft.manifest.id}.cutie`, draftToBytes(draft) as BlobPart, 'application/zip')}>Export .cutie</button>
      </header>

      {notice && <div className="studio-notice" onClick={() => setNotice('')}>{notice} <span>✕</span></div>}
      {showIssues && result.issues.length > 0 && (
        <div className="issues studio-issues">
          <ul>{result.issues.map((i, n) => (
            <li key={n} className={i.level}>
              <b>{i.where}</b>: {i.message}
              {i.where.startsWith('Beat ') && <button className="link" onClick={() => openBeat(i.where.slice(5).split(',')[0])}>open</button>}
            </li>
          ))}</ul>
        </div>
      )}

      <nav className="studio-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      <div className="studio-body">
        {tab === 'profile' && <ProfileTab draft={draft} pack={result.pack} update={update} />}
        {tab === 'art' && <ArtTab draft={draft} update={update} urlCache={urlCache.current} />}
        {tab === 'beats' && <BeatsTab draft={draft} pack={result.pack} update={update} selected={beatId} onSelect={setBeatId} onPlay={playBeat} />}
        {tab === 'coverage' && <CoverageTab draft={draft} update={update} onOpenBeat={openBeat} />}
        {tab === 'preview' && <PreviewTab pack={result.pack} beat={previewBeat} onClearBeat={() => setPreviewBeat(null)} onOpenBeat={openBeat} />}
      </div>
      {sheetOpen && <SheetImport draft={draft} update={update} onClose={() => setSheetOpen(false)} />}
    </div>
  )
}
