import { useEffect, useRef } from 'react'
import type { Choice, Line, Pack, Project } from '../engine/types'
import { isPlaceholderText } from '../engine/text'
import { imageUrl } from '../pack/load'
import { useTypewriter } from './CutiePane'

interface Props {
  pack: Pack
  project: Project
  line?: Line
  prompt?: string
  choices?: Choice[]
  /** More lines or scenes waiting after this one. */
  pending: number
  expression: string
  background: string
  /** A picture (CG) replaces the room and the cutie while it's up. */
  cg: string | null
  onAdvance: () => void
  onChoose: (id: string) => void
  /** Leave the scene (offered once everything has been read). */
  onClose: () => void
  onSkip: () => void
}

/**
 * A cutscene that takes over the writing area. Dialog parts show the room with the cutie centered;
 * picture (CG) parts show only the picture, with the dialog on top.
 */
export function ScenePane(p: Props) {
  const { pack, project, line } = p
  const [shown, done, finish] = useTypewriter(line?.text ?? '')
  const narrator = line?.speaker === 'narrator'
  const thought = line?.style === 'thought'
  const speaker = line?.speaker === 'player' ? project.playerName : narrator ? '' : line?.speaker ?? pack.manifest.name
  const finished = done && !p.choices && p.pending === 0
  const root = useRef<HTMLDivElement>(null)

  // Take the keyboard from the editor so typing can't land in the novel by accident.
  useEffect(() => { root.current?.focus() }, [])

  const next = () => (!done ? finish() : finished ? p.onClose() : p.onAdvance())

  return (
    <div className={`scene-mode ${p.cg ? 'showing-cg' : ''}`} ref={root} tabIndex={-1} role="dialog" aria-label={`Scene with ${pack.manifest.name}`}
      style={{ ['--accent' as string]: pack.manifest.colors?.accent, ['--name' as string]: pack.manifest.colors?.name }}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !p.choices) { e.preventDefault(); next() } }}>
      {p.cg
        ? <img className="scene-mode-cg" key={p.cg} src={imageUrl(pack, 'cg', p.cg)} alt="" />
        : <>
            <img className="scene-mode-bg" src={imageUrl(pack, 'background', p.background)} alt="" />
            <img className="scene-mode-sprite" key={p.expression} src={imageUrl(pack, 'expression', p.expression)} alt={`${pack.manifest.name}, ${p.expression}`} />
          </>}
      <div className="scene-mode-shade" />

      <button className="pill scene-skip" onClick={finished ? p.onClose : p.onSkip}>{finished ? 'Back to writing ▸' : 'Skip scene ▸▸'}</button>

      {p.choices && (
        <div className="scene-mode-choices">
          {p.prompt && <div className="choice-prompt">{project.playerName}: “{p.prompt}”</div>}
          {p.choices.map((c) => <button key={c.id} className="choice" onClick={() => p.onChoose(c.id)}>{c.text}</button>)}
        </div>
      )}

      <div className={`scene-mode-box ${line && isPlaceholderText(line.text) ? 'placeholder' : ''}`} onClick={next} role="button" tabIndex={0}>
        {speaker && <div className="textbox-name">{speaker}</div>}
        <div className={`textbox-text ${thought ? 'thought' : ''} ${narrator ? 'narration' : ''}`}>
          {thought && shown ? `(${shown}${done ? ')' : ''}` : shown}
        </div>
        {done && !p.choices && <span className="more">{finished ? 'back to writing ▸' : 'click for more ▸'}</span>}
      </div>
    </div>
  )
}
