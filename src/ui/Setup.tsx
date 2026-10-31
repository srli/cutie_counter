import { useState } from 'react'
import type { Packs } from '../App'
import { newProject } from '../engine/director'
import { DEFAULT_TOTAL_GOAL, defaultDailyGoal } from '../engine/progress'
import { localDate } from '../engine/time'
import { imageUrl } from '../pack/load'
import { saveProject, setLastProjectId } from '../store'
import { fmt } from './files'
import { LoadCutie } from './LoadCutie'

interface Props {
  packs: Packs
  go: (path: string) => void
  reloadPacks: () => Promise<void>
}

/** Late October? Start on November 1st, NaNoWriMo style. Otherwise start today. */
function defaultStartDate(): string {
  const now = new Date()
  if (now.getMonth() === 9 && now.getDate() >= 15) return `${now.getFullYear()}-11-01`
  return localDate(now)
}

export function Setup({ packs, go, reloadPacks }: Props) {
  const ids = Object.keys(packs)
  const [title, setTitle] = useState('')
  const [player, setPlayer] = useState('')
  const [totalGoal, setTotalGoal] = useState(DEFAULT_TOTAL_GOAL)
  const [dailyGoal, setDailyGoal] = useState<number | null>(null) // null = follow total / 30
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [cutieId, setCutieId] = useState(ids[0] ?? '')
  const [hovered, setHovered] = useState<string | null>(null)
  const [loadingCutie, setLoadingCutie] = useState(false)

  const daily = dailyGoal ?? defaultDailyGoal(totalGoal)
  const shown = packs[hovered ?? cutieId]?.pack
  const ready = player.trim() && totalGoal > 0 && daily > 0 && packs[cutieId]

  async function start() {
    if (!ready) return
    const now = new Date()
    const project = newProject({
      id: crypto.randomUUID(),
      title: title.trim() || 'Untitled story',
      playerName: player.trim(),
      cutieId,
      totalGoal,
      dailyGoal: daily,
      startDate,
      now,
    })
    await saveProject(project)
    await setLastProjectId(project.id)
    go(`write/${project.id}`)
  }

  return (
    <div className="setup-screen">
      <button className="back-link" onClick={() => go('')}>‹ Menu</button>
      <h1 className="title">New Story</h1>

      <div className="setup-fields">
        <label className="bubble-field">
          <span>Your Name</span>
          <input value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="What should they call you?" autoFocus />
        </label>
        <label className="bubble-field">
          <span>Story Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled story" />
        </label>
        <label className="bubble-field">
          <span>Goal Word Count</span>
          <input type="number" min={1} step={1000} value={totalGoal}
            onChange={(e) => setTotalGoal(Math.max(0, Number(e.target.value)))} />
        </label>
        <label className="bubble-field">
          <span>Daily Goal</span>
          <input type="number" min={1} step={100} value={daily}
            onChange={(e) => setDailyGoal(Math.max(0, Number(e.target.value)))} />
          <small>{dailyGoal === null ? `${fmt(totalGoal)} ÷ 30 days, NaNoWriMo style` : <a onClick={() => setDailyGoal(null)}>Reset to ÷ 30</a>}</small>
        </label>
        <label className="bubble-field">
          <span>Day 1</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
      </div>

      <h2 className="title small">Select a Cutie</h2>
      <div className="cutie-picker">
        {ids.map((id) => {
          const pack = packs[id].pack
          return (
            <button key={id}
              className={`cutie-card ${id === cutieId ? 'selected' : ''}`}
              onClick={() => setCutieId(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
            >
              <img src={imageUrl(pack, 'select')} alt="" />
              <span>{pack.manifest.name}</span>
              {packs[id].source === 'user' && <em className="tag">loaded</em>}
            </button>
          )
        })}
        <button className="cutie-card add" onClick={() => setLoadingCutie(true)}>
          <span className="plus">+</span>
          <span>Load Cutie</span>
        </button>
      </div>
      {shown && <p className="cutie-intro">{shown.manifest.intro}</p>}

      <button className="confirm" disabled={!ready} onClick={start}>Let's Start!</button>
      {!player.trim() && <p className="hint">Add your name to begin.</p>}

      {loadingCutie && <LoadCutie onClose={() => setLoadingCutie(false)} onLoaded={() => void reloadPacks()} />}
    </div>
  )
}
