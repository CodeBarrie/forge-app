// Notification sounds using Web Audio API — no audio files needed

let audioCtx: AudioContext | null = null;

function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// ─── Soft reverb for dreamy tails ────────────────────
function softVerb(decay: number, mix: number) {
  const c = getCtx();
  const dry = c.createGain();
  const wet = c.createGain();
  const out = c.createGain();
  dry.gain.value = 1 - mix;
  wet.gain.value = mix;
  const inp = c.createGain();
  inp.connect(dry);
  dry.connect(out);
  [0.023, 0.031, 0.043, 0.057, 0.067].forEach((t, i) => {
    const d = c.createDelay(0.1);
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 2200;
    d.delayTime.value = t;
    g.gain.value = 0.45 * Math.pow(0.78, i);
    d.connect(g);
    g.connect(f);
    f.connect(d);
    inp.connect(d);
    d.connect(wet);
  });
  wet.connect(out);
  return { input: inp, output: out };
}

// ─── Chime variants ─────────────────────────────────

type ChimeFn = (ctx: AudioContext, dest: AudioNode) => void;

/** Morning Dew — ascending C major arp */
const morningDew: ChimeFn = (ctx, dest) => {
  const now = ctx.currentTime;
  const rv = softVerb(1.8, 0.35);
  rv.output.connect(dest);
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    const t = now + i * 0.12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    o.connect(g);
    g.connect(rv.input);
    o.start(t);
    o.stop(t + 0.9);
  });
};

/** Skypath — rising fourths with octave ghost */
const skypath: ChimeFn = (ctx, dest) => {
  const now = ctx.currentTime;
  const rv = softVerb(2.0, 0.4);
  rv.output.connect(dest);
  [466.16, 622.25, 830.61].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const g2 = ctx.createGain();
    o.type = "sine";
    o2.type = "sine";
    o.frequency.value = freq;
    o2.frequency.value = freq * 2;
    const t = now + i * 0.14;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.02, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g);
    o2.connect(g2);
    g.connect(rv.input);
    g2.connect(rv.input);
    o.start(t);
    o2.start(t);
    o.stop(t + 1.1);
    o2.stop(t + 0.6);
  });
};

/** Daydrift — ascending D major, long blurred tails */
const daydrift: ChimeFn = (ctx, dest) => {
  const now = ctx.currentTime;
  const rv = softVerb(2.5, 0.5);
  rv.output.connect(dest);
  [587.33, 739.99, 880].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    const t = now + i * 0.18;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    o.connect(g);
    g.connect(rv.input);
    o.start(t);
    o.stop(t + 1.5);
  });
};

/** Breeze — perfect fifth, triangle waves */
const breeze: ChimeFn = (ctx, dest) => {
  const now = ctx.currentTime;
  const rv = softVerb(1.8, 0.35);
  rv.output.connect(dest);
  [783.99, 1174.66].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    const t = now + i * 0.16;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g);
    g.connect(rv.input);
    o.start(t);
    o.stop(t + 1.0);
  });
};

/** Cloud Nine — Fmaj7 with detuned sine+triangle layers */
const cloudNine: ChimeFn = (ctx, dest) => {
  const now = ctx.currentTime;
  const rv = softVerb(2.2, 0.45);
  rv.output.connect(dest);
  [349.23, 440, 523.25, 659.25].forEach((freq, i) => {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o1.type = "sine";
    o2.type = "triangle";
    o1.frequency.value = freq;
    o2.frequency.value = freq * 1.002;
    const t = now + i * 0.15;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.025, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    o1.connect(g);
    o2.connect(g);
    g.connect(rv.input);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 1.1);
    o2.stop(t + 1.1);
  });
};

// ─── Chime rotation + per-session locking ───────────

const CHIME_POOL: ChimeFn[] = [morningDew, skypath, daydrift, breeze, cloudNine];
let nextChimeIndex = 0;
const sessionChimeMap = new Map<string, ChimeFn>();

/** Assign a chime to a session (round-robin), or return the one already locked */
function getChimeForSession(sessionId: string): ChimeFn {
  let fn = sessionChimeMap.get(sessionId);
  if (!fn) {
    fn = CHIME_POOL[nextChimeIndex % CHIME_POOL.length];
    nextChimeIndex++;
    sessionChimeMap.set(sessionId, fn);
  }
  return fn;
}

/** Remove a session's locked chime (call on session close) */
export function releaseSessionChime(sessionId: string) {
  sessionChimeMap.delete(sessionId);
}

/** Play this session's chime — locked for the session's lifetime */
export function playChime(sessionId?: string) {
  const ctx = getCtx();
  const chimeFn = sessionId ? getChimeForSession(sessionId) : CHIME_POOL[0];
  chimeFn(ctx, ctx.destination);
}

/** Quick soft pop — toast or minor event */
export function playPop() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

/** Error buzz — short low tone */
export function playError() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 220;
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}
