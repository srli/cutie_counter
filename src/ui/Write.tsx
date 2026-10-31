import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor as TipTap } from '@tiptap/react'
import type { Packs } from '../App'
import type { Pack, Project } from '../engine/types'
import { getProject, setLastProjectId } from '../store'
import { CutiePane } from './CutiePane'
import { Editor } from './Editor'
import { download, slug } from './files'
import { Gallery } from './Gallery'
import { isMuted, onMutedChange, setMuted } from './sound'
import { exportBackup } from './Stories'
import { useStory } from './useStory'

interface Props {
  projectId?: string
  packs: Packs
  go: (path: string) => void
}

export function Write({ projectId, packs, go }: Props) {
  const [project, setProject] = useState<Project | null | undefined>(undefined)
  useEffect(() => {
    if (!projectId) return setProject(null)
    void getProject(projectId).then((p) => {
      setProject(p ?? null)
      if (p) void setLastProjectId(p.id)
    })
  }, [projectId])

  if (project === undefined) return <div className="loading">Loading…</div>
  if (!project) return <Missing go={go} text="That story couldn't be found." />
  const pack = packs[project.cutieId]?.pack
  if (!pack) return <Missing go={go} text={`This story's cutie (“${project.cutieId}”) isn't loaded. Load their pack from the menu.`} />
  return <WriteScreen initial={project} pack={pack} go={go} />
}

function Missing({ go, text }: { go: (p: string) => void; text: string }) {
  return (
    <div className="stories-screen">
      <p className="error">{text}</p>
      <button className="pill" onClick={() => go('')}>Back to menu</button>
    </div>
  )
}

function WriteScreen({ initial, pack, go }: { initial: Project; pack: Pack; go: (p: string) => void }) {
  const story = useStory(initial, pack)
  const [gallery, setGallery] = useState(false)
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => onMutedChange(setMutedState), [])
  const editorRef = useRef<TipTap | null>(null)
  const onReady = useCallback((e: TipTap) => { editorRef.current = e }, [])

  const exportText = (kind: 'md' | 'txt') => {
    const ed = editorRef.current
    if (!ed) return
    const text = ed.getText({ blockSeparator: '\n\n' })
    download(`${slug(story.project.title)}.${kind}`, kind === 'md' ? `# ${story.project.title}\n\n${text}\n` : text, 'text/plain')
  }

  return (
    <div className="write-screen">
      <header className="toolbar">
        <button className="pill" onClick={async () => { await story.leave(); go('') }}>‹ Menu</button>
        <h1 className="story-title">{story.project.title}</h1>
        <div className="toolbar-right">
          <span className="saved" title="Your story is kept in this browser">
            {story.saveState === 'saved' ? 'Saved ♡' : 'Saving…'}
          </span>
          <button className="pill icon" onClick={() => setMuted(!muted)} title={muted ? 'Sound off' : 'Sound on'} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? '🔇' : '🔊'}</button>
          <button className="pill" onClick={() => setGallery(true)}>Gallery</button>
          <button className="pill wide-only" onClick={() => exportText('md')}>Export</button>
          <button className="pill wide-only" onClick={() => exportBackup(story.project)}>Back up</button>
          <details className="more-menu narrow-only">
            <summary className="pill" aria-label="More">⋯</summary>
            <div className="more-items">
              <button onClick={() => exportText('md')}>Export text</button>
              <button onClick={() => exportBackup(story.project)}>Back up story</button>
            </div>
          </details>
        </div>
      </header>
      <main className="write-main">
        <CutiePane
          pack={pack}
          project={story.project}
          stats={story.stats}
          line={story.line}
          prompt={story.scene?.prompt}
          choices={story.choices}
          pending={story.pending}
          expression={story.expression}
          background={story.background}
          cg={story.cg}
          onAdvance={story.advance}
          onChoose={story.choose}
          onDismissCg={story.dismissCg}
        />
        <Editor initial={initial.doc} onChange={story.onEdit} onReady={onReady} />
      </main>
      {gallery && <Gallery pack={pack} project={story.project} onClose={() => setGallery(false)} />}
    </div>
  )
}
