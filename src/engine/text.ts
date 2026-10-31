import type { Project, Stats } from './types'

export interface TemplateContext {
  project: Project
  stats: Stats
  cutieName: string
}

/**
 * Replace `{var}` tokens in dialogue. Unknown tokens are left as-is so typos stay visible.
 * Supported: {player} {cutie} {day} {todayWords} {totalWords} {dailyGoal} {totalGoal}
 *            {wordsLeftToday} {wordsLeft} {streak} {flag:name}
 */
export function fillTemplate(text: string, ctx: TemplateContext): string {
  const { project, stats } = ctx
  const fmt = (n: number) => Math.max(0, Math.round(n)).toLocaleString('en-US')
  const vars: Record<string, string> = {
    player: project.playerName || 'you',
    cutie: ctx.cutieName,
    day: String(stats.day),
    todayWords: fmt(stats.todayWords),
    totalWords: fmt(stats.totalWords),
    dailyGoal: fmt(project.dailyGoal),
    totalGoal: fmt(project.totalGoal),
    wordsLeftToday: fmt(project.dailyGoal - stats.todayWords),
    wordsLeft: fmt(project.totalGoal - stats.totalWords),
    streak: String(stats.streak),
  }
  return text.replace(/\{([a-zA-Z]+(?::[\w-]+)?)\}/g, (whole, key: string) => {
    if (key.startsWith('flag:')) {
      const v = project.flags[key.slice(5)]
      return v === undefined ? whole : String(v)
    }
    return vars[key] ?? whole
  })
}

export const PLACEHOLDER_RE = /\[PLACEHOLDER[^\]]*\]/i

export function isPlaceholderText(text: string): boolean {
  return PLACEHOLDER_RE.test(text)
}
