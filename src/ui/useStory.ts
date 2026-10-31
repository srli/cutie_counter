import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { idleThresholds, step, type Input } from '../engine/director'
import { computeStats } from '../engine/progress'
import { weightedPick } from '../engine/rng'
import type { Line, Pack, Project, Scene } from '../engine/types'
import { saveProject } from '../store'
import { playClip, playPop } from './sound'

const TICK_MS = 30_000
const SAVE_DEBOUNCE_MS = 400
const WORDS_DEBOUNCE_MS = 300

const realNow = () => new Date()

interface Display {
  scene: Scene
  line: number
}

export type SaveState = 'saved' | 'saving'

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
  const [expression, setExpression] = useState(pack.manifest.defaultExpression)
  const [bgOverride, setBgOverride] = useState<string | null>(null)
  const [cg, setCg] = useState<string | null>(null)
  const [clock, setClock] = useState(now)

  // ------------------------------------------------------------ saving
  const saveTimer = useRef<number>(undefined)
  const dirty = useRef(0) // bumps on every change; a save only clears the version it wrote
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current)
    const version = dirty.current
    await saveProject(projectRef.current)
    if (dirty.current === version) setSaveState('saved')
  }, [])
  const markDirty = useCallback(() => {
    dirty.current++
    setSaveState('saving')
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS)
  }, [flush])
  const commit = useCallback((p: Project) => {
    projectRef.current = p
    setProject(p)
    markDirty()
  }, [markDirty])

  const leaveRef = useRef<() => Promise<void>>(flush) // set to `leave` below
  useEffect(() => {
    const save = () => void leaveRef.current()
    const onHide = () => { if (document.visibilityState === 'hidden') save() }
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      save()
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flush])

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
    const r = step(projectRef.current, input, pack, now(), rng)
    commit(r.project)
    enqueue(r.scenes, front)
    return r
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

  // A new line sets the pose; expression-less lines keep the last one.
  useEffect(() => {
    if (!line) return
    if (line.expression) setExpression(line.expression)
    if (line.background) setBgOverride(line.background)
    if (line.sound) playClip(pack.sounds[line.sound])
    setCg(line.cg ?? null) // a picture stays up for its own line only
    if (line.cg) {
      const seen = projectRef.current.gallery ?? []
      if (!seen.includes(line.cg)) commit({ ...projectRef.current, gallery: [...seen, line.cg] })
    }
  }, [line, pack, commit])

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

  // Clock: new day, new time slot.
  const lastSlot = useRef<string>('')
  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(now())
      run({ kind: 'tick' })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [run, now])

  const stats = computeStats(project, pack.manifest, clock)
  useEffect(() => {
    if (lastSlot.current && lastSlot.current !== stats.timeSlot) setBgOverride(null)
    lastSlot.current = stats.timeSlot
  }, [stats.timeSlot])

  // Typing: count words after a short pause, and reset idle timers.
  const lastTyped = useRef(Date.now())
  const idleFired = useRef<number[]>([])
  const wordsTimer = useRef<number>(undefined)
  const pendingWords = useRef<number | null>(null)
  const countWordsNow = useCallback(() => {
    window.clearTimeout(wordsTimer.current)
    if (pendingWords.current === null) return
    const count = pendingWords.current
    pendingWords.current = null
    run({ kind: 'words', count })
  }, [run])
  const onEdit = useCallback((doc: string, words: number) => {
    lastTyped.current = Date.now()
    idleFired.current = []
    projectRef.current = { ...projectRef.current, doc }
    markDirty()
    pendingWords.current = words
    window.clearTimeout(wordsTimer.current)
    wordsTimer.current = window.setTimeout(countWordsNow, WORDS_DEBOUNCE_MS)
  }, [markDirty, countWordsNow])

  /** Count any last words and finish saving before leaving the page. */
  const leave = useCallback(async () => {
    countWordsNow()
    await flush()
  }, [countWordsNow, flush])
  leaveRef.current = leave

  const idleList = useMemo(() => idleThresholds(pack), [pack])
  useEffect(() => {
    if (!idleList.length) return
    const id = window.setInterval(() => {
      const minutes = (Date.now() - lastTyped.current) / 60_000
      const due = idleList.filter((m) => minutes >= m && !idleFired.current.includes(m)).pop()
      if (due === undefined) return
      idleFired.current.push(...idleList.filter((m) => m <= due))
      run({ kind: 'idle', minutes: due })
    }, 15_000)
    return () => window.clearInterval(id)
  }, [idleList, run])

  // Ambient chatter, only when nothing is waiting to be read.
  const quiet = (!display || (atEnd && !choices)) && queueRef.current.length === 0
  const quietRef = useRef(quiet)
  quietRef.current = quiet
  useEffect(() => {
    const ambient = pack.manifest.ambient
    if (!ambient || ambient.everyMinutes <= 0) return
    const id = window.setInterval(() => { if (quietRef.current) run({ kind: 'ambient' }) }, ambient.everyMinutes * 60_000)
    return () => window.clearInterval(id)
  }, [pack, run])

  // Idle fidgets: small pose changes while nothing is happening.
  useEffect(() => {
    const idle = pack.manifest.idle
    if (!idle?.expressions.length || idle.everySeconds <= 0) return
    const id = window.setInterval(() => {
      if (!quietRef.current) return
      const pick = weightedPick(idle.expressions, (e) => e.weight, rng)
      if (pick) setExpression(pick.expression)
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
    leave,
    saveState,
  }
}
