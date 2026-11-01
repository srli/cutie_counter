import type { ReactNode } from 'react'

/** Small form controls shared by the Studio tabs. */

export function Field({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`sfield ${wide ? 'wide' : ''}`}>
      <span className="sfield-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Text({ value, onChange, placeholder, mono }: { value: string | undefined; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return <input className={mono ? 'mono' : ''} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

export function Num({ value, onChange, min, max, step, placeholder }: {
  value: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; step?: number; placeholder?: string
}) {
  return (
    <input type="number" value={value ?? ''} min={min} max={max} step={step} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
  )
}

export function Select({ value, onChange, options, empty }: {
  value: string | undefined; onChange: (v: string | undefined) => void; options: (string | { value: string; label: string })[]; empty?: string
}) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const known = value === undefined || value === '' || opts.some((o) => o.value === value)
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {!known && <option value={value}>{value} (missing!)</option>}
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/** Two side-by-side buttons for a choice between two things. */
export function Toggle<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: [{ value: T; label: string }, { value: T; label: string }]
}) {
  return (
    <span className="toggle" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </span>
  )
}

/** Comma-separated numbers, e.g. "10, 33, 50". */
export function NumList({ value, onChange }: { value: number[] | undefined; onChange: (v: number[]) => void }) {
  return (
    <input defaultValue={(value ?? []).join(', ')}
      onBlur={(e) => onChange(e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b))} />
  )
}

export function IconBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return <button type="button" className={`icon-btn ${danger ? 'danger' : ''}`} title={title} aria-label={title} onClick={onClick}>{children}</button>
}

/** Move an item within a list. */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export const cleanName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '')

/** Text that only commits when you leave the box (for values that are costly to change, like ids). */
export function BlurText({ value, onCommit, mono }: { value: string; onCommit: (v: string) => void; mono?: boolean }) {
  return (
    <input key={value} className={mono ? 'mono' : ''} defaultValue={value}
      onBlur={(e) => { if (e.target.value !== value) onCommit(e.target.value) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}
