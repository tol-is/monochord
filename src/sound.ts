// Optional sound: a soft short note per tick crossed, with a faint dark echo. Everything is an
// option; the defaults are a pulse: every tick A4, decade ticks (0, 10, 20…) a low D.
//
//   const play = createBlip(audioCtx, { pitch: scale("D3", "minor") });
//   <Monochord.Root onTickCross={play} />
// or, composed: <Monochord.Sound context={audioCtx} pitch={scale("D3", "minor")} />

/** why a tick fired: pointer passing over, a scrub step, a tap/click, or Enter/Space */
export type TickKind = "hover" | "scrub" | "tap" | "keyboard";
export type TickEvent = {
  kind: TickKind;
  /** loudness hint: 0.5 hover, 1 scrub, 1.4 tap and keyboard */
  strength: number;
  /** index is a multiple of ten */
  decade: boolean;
};
export const tickStrength: Record<TickKind, number> = { hover: 0.5, scrub: 1, tap: 1.4, keyboard: 1.4 };
export const tickEvent = (index: number, kind: TickKind): TickEvent =>
  ({ kind, strength: tickStrength[kind], decade: index % 10 === 0 });

/** Hz for a tick; null or 0 stays silent */
export type Pitch = (index: number, event: TickEvent) => number | null;

export type EchoOptions = {
  /** seconds between repeats; default 0.23 */
  time?: number;
  /** 0–1, how much each repeat feeds the next; default 0.25 */
  feedback?: number;
  /** level of the echo against the dry note; default 0.15 */
  wet?: number;
  /** lowpass on the repeats, Hz; default 1300 */
  cutoff?: number;
};

export type BlipOptions = {
  pitch?: Pitch;
  /** [multiple of the pitch, level] per oscillator; default a fundamental and a quiet octave under */
  voices?: [number, number][];
  wave?: OscillatorType;
  /** seconds to peak; default 0.006 */
  attack?: number;
  /** decay time constant, seconds (≈ a third of the audible tail); default 0.035 */
  decay?: number;
  /** peak level at strength 1; default 0.06 */
  volume?: number;
  /** the echo, or false for a dry note */
  echo?: EchoOptions | false;
  /** where the sound goes; default ctx.destination */
  destination?: AudioNode;
};

export type Blip = ((index: number, event?: TickEvent) => void) & {
  /** change options live; omitted keys return to their defaults */
  set(options: BlipOptions): void;
  dispose(): void;
};

/* ─── pitch presets ─── */

const NOTE: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
/** "A4" → 440, "D3" → 146.83, "Bb4", "F#2"; numbers pass through as Hz */
export const hz = (note: string | number) => {
  if (typeof note === "number") return note;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note.trim());
  if (!m) throw new Error(`monochord: can't read note "${note}"`);
  const semis = NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * Math.pow(2, semis / 12);
};

export const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
} as const;

/** every tick one note, decade ticks another: a pulse with the decades marked (the default) */
export const pulse = (tick: string | number = "A4", decade: string | number = "D3"): Pitch => {
  const a = hz(tick), d = hz(decade);
  return (i) => (i % 10 === 0 ? d : a);
};

/**
 * Each run of `per` ticks walks a scale from `root` (its lowest note). "down" starts every run high,
 * so a scrub down the rail falls and each decade starts again; "up" climbs.
 */
export const scale = (
  root: string | number,
  mode: keyof typeof MODES | readonly number[] = "minor",
  { per = 10, direction = "down" }: { per?: number; direction?: "up" | "down" } = {},
): Pitch => {
  const base = hz(root), steps = typeof mode === "string" ? MODES[mode] : mode;
  return (i) => {
    const r = ((i % per) + per) % per, k = direction === "down" ? per - 1 - r : r;
    const semis = steps[k % steps.length] + 12 * Math.floor(k / steps.length);
    return base * Math.pow(2, semis / 12);
  };
};

/** the same note for every tick */
export const note = (n: string | number): Pitch => { const f = hz(n); return () => f; };

/* ─── the voice ─── */

const DEFAULTS = {
  voices: [[1, 1], [0.5, 0.45]] as [number, number][],
  wave: "sine" as OscillatorType,
  attack: 0.006, decay: 0.035, volume: 0.06,
  echo: { time: 0.23, feedback: 0.25, wet: 0.15, cutoff: 1300 },
};

export function createBlip(ctx: AudioContext, options: BlipOptions = {}): Blip {
  let o = options;
  let pitch = o.pitch ?? pulse();
  // one bus per voice: dry straight out, plus a lowpassed feedback delay mixed in quietly
  const bus = ctx.createGain();
  const dl = ctx.createDelay(2), lp = ctx.createBiquadFilter(), fb = ctx.createGain(), wet = ctx.createGain();
  lp.type = "lowpass";
  bus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet);
  let out: AudioNode | null = null;
  const route = (to: AudioNode) => {
    if (to === out) return;
    if (out) { bus.disconnect(out); wet.disconnect(); }
    bus.connect(to); wet.connect(to);
    out = to;
  };
  const apply = () => {
    pitch = o.pitch ?? pulse();
    const e = o.echo === false ? null : { ...DEFAULTS.echo, ...o.echo };
    const at = ctx.currentTime;
    dl.delayTime.setTargetAtTime(e?.time ?? DEFAULTS.echo.time, at, 0.02);
    lp.frequency.setTargetAtTime(e?.cutoff ?? DEFAULTS.echo.cutoff, at, 0.02);
    fb.gain.setTargetAtTime(e ? Math.min(0.95, e.feedback) : 0, at, 0.02);
    wet.gain.setTargetAtTime(e ? e.wet : 0, at, 0.02);
    route(o.destination ?? ctx.destination);
  };
  apply();

  const play = ((index: number, event: TickEvent = tickEvent(index, "scrub")) => {
    if (ctx.state !== "running") return;
    const f = pitch(index, event);
    if (!f) return;
    const { voices, wave, attack, decay, volume } = { ...DEFAULTS, ...o };
    const at = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(volume * event.strength, at + attack);
    g.gain.setTargetAtTime(0, at + attack + 0.002, decay);
    g.connect(bus);
    const stop = at + attack + decay * 8;
    for (const [mul, amp] of voices) {
      const osc = ctx.createOscillator(), og = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = f * mul;
      og.gain.value = amp;
      osc.connect(og); og.connect(g);
      osc.start(at); osc.stop(stop);
    }
  }) as Blip;
  play.set = (next) => { o = next; apply(); };
  play.dispose = () => { bus.disconnect(); wet.disconnect(); lp.disconnect(); fb.disconnect(); dl.disconnect(); out = null; };
  return play;
}
