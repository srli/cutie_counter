import {
  CONDITION_OPS, PACK_FORMAT_VERSION, TRIGGER_TYPES,
  type Beat, type CutieManifest, type Line, type Script,
} from '../engine/types'

export interface Issue {
  level: 'error' | 'warning'
  /** Where the problem is, in words the author recognizes, e.g. "Beat d8-morning, line 2". */
  where: string
  message: string
}

export interface PackFiles {
  expressions: string[]
  backgrounds: string[]
  cgs: string[]
  sounds?: string[]
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Validate parsed cutie.json + script.json against the images found in the pack. */
export function validatePack(manifestRaw: unknown, scriptRaw: unknown, files: PackFiles): Issue[] {
  const issues: Issue[] = []
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message })
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message })

  // ---- manifest
  if (!isObj(manifestRaw)) {
    err('cutie.json', 'This file is missing or is not valid JSON.')
    return issues
  }
  const m = manifestRaw as Partial<CutieManifest>
  if (m.formatVersion !== undefined && m.formatVersion > PACK_FORMAT_VERSION) {
    err('cutie.json', `This pack needs a newer app (format ${m.formatVersion}).`)
  }
  for (const key of ['id', 'name', 'intro'] as const) {
    if (typeof m[key] !== 'string' || !m[key]) err('cutie.json', `"${key}" is required.`)
  }
  if (typeof m.id === 'string' && !/^[a-z0-9_-]+$/.test(m.id)) {
    err('cutie.json', `"id" should be lowercase letters, numbers, - or _ (got "${m.id}").`)
  }

  const hasExpr = (e: string) => files.expressions.includes(e)
  const hasBg = (b: string) => files.backgrounds.includes(b)
  const exprHint = () => `Available: ${files.expressions.join(', ') || 'none'}.`

  if (!files.expressions.length) err('images/', 'No expression sprites found. Add files like neutral.png or neutral.jpg.')
  if (m.defaultExpression && !hasExpr(m.defaultExpression)) {
    err('cutie.json', `Default expression "${m.defaultExpression}" has no image. ${exprHint()}`)
  }
  if (m.defaultBackground && !hasBg(m.defaultBackground)) {
    err('cutie.json', `Default background "${m.defaultBackground}" needs images/bg_${m.defaultBackground}.png or .jpg.`)
  }
  for (const [slot, bg] of Object.entries(m.backgroundBySlot ?? {})) {
    if (!hasBg(bg)) err('cutie.json', `Background for ${slot} "${bg}" needs images/bg_${bg}.png or .jpg.`)
  }
  for (const s of m.stages ?? []) {
    if (s.defaultExpression && !hasExpr(s.defaultExpression)) {
      err(`Stage ${s.name ?? s.id}`, `Expression "${s.defaultExpression}" has no image. ${exprHint()}`)
    }
  }
  for (const e of m.idle?.expressions ?? []) {
    if (!hasExpr(e.expression)) err('cutie.json idle', `Expression "${e.expression}" has no image. ${exprHint()}`)
  }
  const slotIds = new Set((m.timeSlots ?? []).map((s) => s.id))
  const stageIds = new Set((m.stages ?? []).map((s) => s.id))

  // ---- script
  if (!isObj(scriptRaw) || !Array.isArray((scriptRaw as Partial<Script>).beats)) {
    err('script.json', 'This file is missing, is not valid JSON, or has no "beats" list.')
    return issues
  }
  const beats = (scriptRaw as unknown as Script).beats
  const ids = new Set<string>()

  const checkLine = (line: Line, where: string) => {
    if (typeof line.text !== 'string') err(where, 'Line has no text.')
    if (line.expression && !hasExpr(line.expression)) {
      err(where, `Expression "${line.expression}" has no image. ${exprHint()}`)
    }
    if (line.background && !hasBg(line.background)) {
      err(where, `Background "${line.background}" needs images/bg_${line.background}.png or .jpg.`)
    }
    if (line.cg && line.cg !== 'none' && !files.cgs.includes(line.cg)) err(where, `Reward art "${line.cg}" needs images/cg_${line.cg}.png or .jpg.`)
    if (line.sound && !(files.sounds ?? []).includes(line.sound)) err(where, `Sound "${line.sound}" needs sounds/${line.sound}.mp3 (or .ogg/.wav).`)
  }

  beats.forEach((beat: Beat, i) => {
    const where = `Beat ${beat?.id || `#${i + 1}`}`
    if (!isObj(beat)) return err(`Beat #${i + 1}`, 'Not a valid beat.')
    if (!beat.id) err(where, 'Beat needs an "id".')
    else if (ids.has(beat.id)) err(where, `Two beats share the id "${beat.id}".`)
    else ids.add(beat.id)

    if (!isObj(beat.trigger) || !TRIGGER_TYPES.includes(beat.trigger.type)) {
      err(where, `Unknown trigger "${(beat.trigger as { type?: string })?.type}". Use one of: ${TRIGGER_TYPES.join(', ')}.`)
    } else {
      const { type, value } = beat.trigger
      if (type === 'time_slot' && value !== undefined && slotIds.size && !slotIds.has(String(value))) {
        err(where, `Time slot "${value}" is not in cutie.json timeSlots.`)
      }
      if (type === 'stage' && value !== undefined && !stageIds.has(String(value))) {
        err(where, `Stage "${value}" is not in cutie.json stages.`)
      }
      if (type === 'date' && value !== undefined && !/^\d{2}-\d{2}$/.test(String(value))) {
        err(where, `Date should look like 10-31 (got "${value}").`)
      }
      if (['daily_pct', 'total_pct', 'words_today', 'words_total', 'words_every', 'words_deleted', 'idle', 'streak', 'day_start'].includes(type)
        && value !== undefined && !Number.isFinite(Number(value))) {
        err(where, `Trigger value should be a number (got "${value}").`)
      }
    }

    if (beat.display !== undefined && beat.display !== 'scene') err(where, `"display" can only be "scene" (got "${beat.display}").`)
    for (const c of beat.when ?? []) {
      if (!CONDITION_OPS.includes(c.op)) err(where, `Unknown comparison "${c.op}".`)
    }

    const lineSets = beat.variants?.length ? beat.variants : [beat.lines ?? []]
    lineSets.forEach((set, v) => set.forEach((l, n) =>
      checkLine(l, `${where}${beat.variants?.length ? `, variant ${v + 1}` : ''}, line ${n + 1}`)))
    if (!beat.lines?.length && !beat.variants?.length && !beat.choices?.length) {
      warn(where, 'Beat has no lines or choices, so nothing will show.')
    }

    const choiceIds = new Set<string>()
    for (const c of beat.choices ?? []) {
      if (!c.id) err(where, 'A choice needs an "id".')
      else if (choiceIds.has(c.id)) err(where, `Two choices share the id "${c.id}".`)
      choiceIds.add(c.id)
      if (!c.text) err(where, `Choice ${c.id} needs "text".`)
      c.lines?.forEach((l, n) => checkLine(l, `${where}, choice ${c.id}, line ${n + 1}`))
    }
  })

  // `after` triggers must point at something real.
  for (const beat of beats) {
    if (beat?.trigger?.type !== 'after' || beat.trigger.value === undefined) continue
    for (const alt of String(beat.trigger.value).split('|')) {
      const target = alt.split('/')[0]
      if (!ids.has(target)) err(`Beat ${beat.id}`, `Follows "${alt}", but no beat has id "${target}".`)
    }
  }

  return issues
}
