// Web Audio synthesis — no file dependency, works offline.
// Uses a single AudioContext per call; browsers auto-close stale ones.

export type BellType = 'new' | 'ready' | 'urgent'

export function playBell(type: BellType = 'new'): void {
  try {
    const ctx  = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    const beep = (freq: number, start: number, dur: number, vol = 0.35) => {
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
      beep(440, 0,    0.12, 0.5)
      beep(660, 0.15, 0.12, 0.5)
      beep(880, 0.30, 0.20, 0.5)
    } else if (type === 'ready') {
      // Rising two-tone chime
      beep(660, 0,    0.25)
      beep(880, 0.28, 0.35)
    } else {
      // Single warm bell for new order
      beep(880, 0, 0.55)
    }
  } catch { /* no user gesture yet — silent */ }
}
