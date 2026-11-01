import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { idleThresholds, step, type Input } from '../engine/director'
import { computeStats, restingExpression } from '../engine/progress'
import { weightedPick } from '../engine/rng'
import type { Line, Pack, Project, Scene } from '../engine/types'
import { getProject, saveProjectIfUnchanged } from '../store'
import { playClip, playPop } from './sound'

const TICK_MS = 30_000
const SAVE_DEBOUNCE_MS = 400
const WORDS_DEBOUNCE_MS = 300
/** No mouse, keys or touches for this long means the writer has stepped away. */
const AWAY_MS = 10 * 60_000

const realNow = () => new Date()

interface Display {
  scene: Scene
  line: number
}

export type SaveState = 'saved' | 'saving'

/** Reads the editor. Serializing a whole novel is slow, so this only runs once typing pauses. */
export type ReadDoc = () => { doc: string; words: number }

/**
 * Runs the story for one open project: feeds inputs to the engine, queues the
 * scenes it returns, and tracks what the cutie pane should show.
 */
export function useStory(initial: Project, pack: Pack, now: () => Date = realNow) {
  const rng = useMemo(() => Math.random, [])
  const projectRef = useRef(initial)
  const [project, setProject] = useState(initial)
  const [display, setDisplay] = useState<Display | null>(null)
  const queueRef = useRef<Scene[]>([])
  const [, bump] = useState(0) // re-render when the queue changes
  const [expression, setExpression] = useState(() => restingExpression(pack.manifest, initial.stage))
  const [bgOverride, setBgOverride] = useState<string | null>(null)
  const [cg, setCg] = useState<string | null>(null)
  const [clock, setClock] = useState(now)

  // ------------------------------------------------------------ saving
  // A save only lands if no other tab or window saved this story since our last one. If one did,
  // this copy is stale: it stops saving rather than overwrite newer writing.
  const saveTimer = useRef<number>(undefined)
  const dirty = useRef(0) // bumps on every change; a save only clears the version it wrote
  const rev = useRef(initial.rev ?? 0)
  const saving = useRef<Promise<void>>(Promise.resolve()) // saves run one at a time
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const staleRef = useRef(false)
  const [stale, setStale] = useState(false)
  const goStale = useCallback(() => {
    staleRef.current = true
    setStale(true)
  }, [])
  const save = useCallback(() => {
    window.clearTimeout(saveTimer.current)
    saving.current = saving.current.then(async () => {
      if (staleRef.current) return
      const version = dirty.current
      const next = await saveProjectIfUnchanged(projectRef.current, rev.current)
      if (next === null) return goStale()
      rev.current = next
      if (dirty.current === version) setSaveState('saved')
    }).catch((e) => console.error('Could not save the story', e))
    return saving.current
  }, [goStale])
  /** Has another tab saved since we did? Checked when this one comes back into view. */
  const checkElsewhere = useCallback(() => {
    saving.current = saving.current.then(async () => {
      if (staleRef.current) return
      const stored = await getProject(initial.id)
      if ((stored?.rev ?? 0) !== rev.current) goStale()
    }).catch((e) => console.error('Could not check the story', e))
    return saving.current
  }, [initial.id, goStale])

  const flushRef = useRef<() => Promise<void>>(save) // set to `flush` below
  const markDirty = useCallback(() => {
    dirty.current++
    setSaveState('saving')
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => void flushRef.current(), SAVE_DEBOUNCE_MS)
  }, [])
  const commit = useCallback((p: Project) => {
    projectRef.current = p
    setProject(p)
    markDirty()
  }, [markDirty])

  useEffect(() => {
    const save = () => void flushRef.current()
    const onHide = () => { if (document.visibilityState === 'hidden') save() }
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      save()
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  // ------------------------------------------------------------ dialogue queue
  // Display lives in a ref so queue updates stay synchronous and side-effect free.
  const displayRef = useRef<Display | null>(null)
  const setShown = useCallback((d: Display | null) => {
    displayRef.current = d
    setDisplay(d)
    bump((n) => n + 1)
  }, [])

  const enqueue = useCallback((scenes: Scene[], front = false) => {
    if (!scenes.length) return
    // A full-screen scene starts right away; whatever was in the textbox waits until it's over.
    const big = scenes.filter((s) => s.display === 'scene')
    const cur = displayRef.current
    if (big.length && cur?.scene.display !== 'scene') {
      const rest = scenes.filter((s) => s.display !== 'scene')
      const unfinished = cur && (cur.line < cur.scene.lines.length - 1 || cur.scene.choices?.length) ? [cur.scene] : []
      queueRef.current = [...big.slice(1), ...unfinished, ...rest, ...queueRef.current]
      setShown({ scene: big[0], line: 0 })
      return
    }
    queueRef.current = front ? [...scenes, ...queueRef.current] : [...queueRef.current, ...scenes]
    const d = displayRef.current
    const finished = !d || (d.line >= d.scene.lines.length - 1 && !d.scene.choices?.length)
    if (finished || front) {
      const next = queueRef.current.shift()
      setShown(next ? { scene: next, line: 0 } : d)
    } else {
      bump((n) => n + 1)
    }
  }, [setShown])

  const run = useCallback((input: Input, front = false) => {
    if (staleRef.current) return
    const r = step(projectRef.current, input, pack, now(), rng)
    // A clock tick or chatter roll where nothing happened has nothing worth saving.
    if (!r.events.length && (input.kind === 'tick' || input.kind === 'ambient')) return
    commit(r.project)
    enqueue(r.scenes, front)
  }, [pack, now, rng, commit, enqueue])

  /** Next line, or next scene. Does nothing while choices are waiting. */
  const advance = useCallback(() => {
    const d = displayRef.current
    if (!d) return
    if (d.line < d.scene.lines.length - 1) return setShown({ ...d, line: d.line + 1 })
    if (d.scene.choices?.length) return
    const next = queueRef.current.shift()
    if (next) setShown({ scene: next, line: 0 })
  }, [setShown])

  /** Leave a full-screen scene once it's all read: show whatever is queued next, or nothing. */
  const endScene = useCallback(() => {
    const d = displayRef.current
    if (d && (d.line < d.scene.lines.length - 1 || d.scene.choices?.length)) return
    const next = queueRef.current.shift()
    setShown(next ? { scene: next, line: 0 } : null)
  }, [setShown])

  /** Skip the rest of a full-screen scene. */
  const skipScene = useCallback(() => {
    queueRef.current = queueRef.current.filter((s) => s.display !== 'scene')
    const next = queueRef.current.shift()
    setShown(next ? { scene: next, line: 0 } : null)
  }, [setShown])

  const choose = useCallback((choiceId: string) => {
    const d = displayRef.current
    if (!d?.scene.choices) return
    // Drop the choices so the scene counts as finished, then play the answer.
    setShown({ scene: { ...d.scene, choices: undefined }, line: Math.max(0, d.scene.lines.length - 1) })
    run({ kind: 'choice', beatId: d.scene.beatId, choiceId }, true)
  }, [run, setShown])

  // A choices-only scene keeps the previous line on screen above its buttons.
  const lastLine = useRef<Line | undefined>(undefined)
  const line: Line | undefined = display?.scene.lines[display.line] ?? lastLine.current
  lastLine.current = line
  const atEnd = !!display && display.line >= display.scene.lines.length - 1
  const choices = atEnd ? display?.scene.choices : undefined
  const inScene = display?.scene.display === 'scene'

  // A new line sets the pose; expression-less lines keep the last one.
  useEffect(() => {
    if (!line) return
    if (line.expression) setExpression(line.expression)
    if (line.background) setBgOverride(line.background)
    if (line.sound) playClip(pack.sounds[line.sound])
    // In the textbox a picture shows for its own line only. In a full-screen scene it stays
    // until a line names another picture, or "none" goes back to the cutie.
    if (line.cg === 'none') setCg(null)
    else if (line.cg) setCg(line.cg)
    else if (!inScene) setCg(null)
    if (line.cg && line.cg !== 'none') {
      const seen = projectRef.current.gallery ?? []
      if (!seen.includes(line.cg)) commit({ ...projectRef.current, gallery: [...seen, line.cg] })
    }
  }, [line, pack, commit, inScene])

  // A soft pop when someone starts talking.
  const sceneShown = display?.scene
  useEffect(() => { if (sceneShown) playPop() }, [sceneShown])

  // ------------------------------------------------------------ inputs
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return // StrictMode runs effects twice in dev
    opened.current = true
    run({ kind: 'open' })
  }, [run])

  // Time-of-day greetings and new-day events are for a writer who is here, not a tab left open
  // overnight: the clock only moves the story while the page is in view and someone is using it.
  const lastActive = useRef(Date.now())
  const present = useCallback(
    () => document.visibilityState === 'visible' && Date.now() - lastActive.current < AWAY_MS, [])

  // Clock: new day, new time slot.
  const tick = useCallback(() => {
    setClock(now())
    if (present()) run({ kind: 'tick' })
  }, [now, present, run])
  useEffect(() => {
    const id = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(id)
  }, [tick])

  // Back at the desk, or back on this tab: catch up on the clock now, not at the next tick.
  useEffect(() => {
    const onActivity = () => {
      const wasAway = !present()
      lastActive.current = Date.now()
      if (wasAway) tick()
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      lastActive.current = Date.now()
      void checkElsewhere().then(tick)
    }
    const kinds = ['pointerdown', 'pointermove', 'keydown', 'input', 'wheel', 'touchstart'] as const
    for (const k of kinds) window.addEventListener(k, onActivity, { passive: true })
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      for (const k of kinds) window.removeEventListener(k, onActivity)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [present, tick, checkElsewhere])

  const stats = computeStats(project, pack.manifest, clock)
  const lastSlot = useRef<string>('')
  useEffect(() => {
    if (lastSlot.current && lastSlot.current !== stats.timeSlot) setBgOverride(null)
    lastSlot.current = stats.timeSlot
  }, [stats.timeSlot])

  // Typing: count words after a short pause, and reset idle timers.
  const lastTyped = useRef(Date.now())
  const idleFired = useRef<number[]>([])
  const wordsTimer = useRef<number>(undefined)
  const pendingRead = useRef<ReadDoc | null>(null)
  const countWordsNow = useCallback(() => {
    window.clearTimeout(wordsTimer.current)
    const read = pendingRead.current
    if (!read) return
    pendingRead.current = null
    const { doc, words } = read()
    projectRef.current = { ...projectRef.current, doc }
    run({ kind: 'words', count: words })
  }, [run])
  const onEdit = useCallback((read: ReadDoc) => {
    lastTyped.current = Date.now()
    idleFired.current = []
    pendingRead.current = read
    markDirty()
    window.clearTimeout(wordsTimer.current)
    wordsTimer.current = window.setTimeout(countWordsNow, WORDS_DEBOUNCE_MS)
  }, [markDirty, countWordsNow])

  /** Count any last words and finish saving, e.g. before leaving the page. */
  const flush = useCallback(async () => {
    countWordsNow()
    await save()
  }, [countWordsNow, save])
  flushRef.current = flush

  const idleList = useMemo(() => idleThresholds(pack), [pack])
  useEffect(() => {
    if (!idleList.length) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const minutes = (Date.now() - lastTyped.current) / 60_000
      const due = idleList.filter((m) => minutes >= m && !idleFired.current.includes(m)).pop()
      if (due === undefined) return
      idleFired.current.push(...idleList.filter((m) => m <= due))
      run({ kind: 'idle', minutes: due })
    }, 15_000)
    return () => window.clearInterval(id)
  }, [idleList, run])

  // Ambient chatter, only when nothing is waiting to be read and someone is here to read it.
  const quiet = (!display || (atEnd && !choices)) && queueRef.current.length === 0
  const quietRef = useRef(quiet)
  quietRef.current = quiet
  useEffect(() => {
    const ambient = pack.manifest.ambient
    if (!ambient || ambient.everyMinutes <= 0) return
    const id = window.setInterval(() => { if (quietRef.current && present()) run({ kind: 'ambient' }) }, ambient.everyMinutes * 60_000)
    return () => window.clearInterval(id)
  }, [pack, run, present])

  // Idle fidgets: small pose changes while nothing is happening. The cutie's usual face
  // follows their affinity stage (a stage's own default expression), so they warm up over the month.
  useEffect(() => {
    const idle = pack.manifest.idle
    if (!idle?.expressions.length || idle.everySeconds <= 0) return
    const id = window.setInterval(() => {
      if (!quietRef.current) return
      const pick = weightedPick(idle.expressions, (e) => e.weight, rng)
      if (!pick) return
      setExpression(pick.expression === pack.manifest.defaultExpression
        ? restingExpression(pack.manifest, projectRef.current.stage)
        : pick.expression)
    }, idle.everySeconds * 1000)
    return () => window.clearInterval(id)
  }, [pack, rng])

  const background = bgOverride
    ?? pack.manifest.backgroundBySlot?.[stats.timeSlot]
    ?? pack.manifest.defaultBackground

  return {
    project,
    stats,
    line,
    scene: display?.scene,
    inScene,
    endScene,
    skipScene,
    choices,
    pending: queueRef.current.length + (display && !atEnd ? 1 : 0),
    expression,
    background,
    cg,
    dismissCg: () => setCg(null),
    advance,
    choose,
    onEdit,
    flush,
    leave: flush,
    saveState,
    stale,
  }
}
