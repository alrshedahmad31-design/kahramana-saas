// Singleton AudioContext for the KDS board. Creating a new AudioContext per
// beep leaks memory and most browsers cap at ~6 contexts — on a long shift
// with hundreds of bumps that ceiling is hit and audio silently dies.
// Lazily created, resumed on first beep call (which always follows a user
// gesture: clicking Bump, advancing an item, or the realtime INSERT after
// the operator first interacted with the page).

type AudioCtor = typeof AudioContext

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx && ctx.state !== 'closed') {
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }
  const Ctor: AudioCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

export function playTripleBeep(): void {
  const c = getCtx()
  if (!c) return
  ;[0, 0.18, 0.36].forEach((delay) => {
    const osc  = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0, c.currentTime + delay)
    gain.gain.linearRampToValueAtTime(0.5, c.currentTime + delay + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.28)
    osc.start(c.currentTime + delay)
    osc.stop(c.currentTime + delay + 0.3)
  })
}

export function playBumpTone(): void {
  const c = getCtx()
  if (!c) return
  const osc  = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.frequency.value = 523
  osc.type = 'sine'
  gain.gain.setValueAtTime(0.4, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5)
  osc.start()
  osc.stop(c.currentTime + 0.5)
}
