/**
 * Tiny sound helper. A soft built-in "pop" marks new dialogue (made with
 * WebAudio, so no file needed); packs can add their own clips per line.
 */
const KEY = 'cutie-counter:muted'
let ctx: AudioContext | null = null
const listeners = new Set<(m: boolean) => void>()

export function isMuted(): boolean {
  return localStorage.getItem(KEY) === '1'
}

export function setMuted(muted: boolean) {
  localStorage.setItem(KEY, muted ? '1' : '0')
  listeners.forEach((fn) => fn(muted))
}

export function onMutedChange(fn: (m: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** A short, soft two-note pop. Browsers only allow sound after the user has interacted. */
export function playPop() {
  if (isMuted()) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    for (const [freq, at] of [[880, 0], [1320, 0.07]] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t + at)
      gain.gain.exponentialRampToValueAtTime(0.06, t + at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t + at)
      osc.stop(t + at + 0.2)
    }
  } catch {
    // No audio available; stay quiet.
  }
}

export function playClip(url: string | undefined) {
  if (!url || isMuted()) return
  const audio = new Audio(url)
  audio.volume = 0.7
  void audio.play().catch(() => {})
}
