// Web Audio synthesis — no file dependency, works offline.
// Uses a single AudioContext per call; browsers auto-close stale ones.

export type BellType = 'new' | 'ready' | 'urgent'

export function playBell(type: BellType = 'new'): void {
  try {
    const ctx  = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    const beep = (freq: number, start: number, dur: number, vol = 0.6) => {
      const osc = ctx.createOscillator()
      osc.connect(gain)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(vol, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    }

    if (type === 'urgent') {
      // Fast triple beep — escalating pitch
      beep(440, 0,    0.15, 0.8)
      beep(660, 0.18, 0.15, 0.8)
      beep(880, 0.36, 0.25, 0.8)
    } else if (type === 'ready') {
      // Rising two-tone chime
      beep(660, 0,    0.3,  0.6)
      beep(880, 0.32, 0.45, 0.7)
    } else {
      // Double bell for new order — more noticeable in loud kitchen
      beep(880, 0,    0.55, 0.7)
      beep(880, 0.65, 0.40, 0.5)
    }
  } catch { /* no user gesture yet — silent */ }
}
