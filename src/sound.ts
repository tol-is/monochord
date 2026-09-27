// Optional pluck sound: a soft short tick per tick crossed, with a faint dark echo.
// Every tick is A4; decade ticks (0, 10, 20…) drop to a low D, so a scrub is a pulse
// with the decades marked. Wire it to Root's onTickCross.

/** pitch in Hz for tick i: A4, or D3 on the decades */
export const blipPitch = (i: number) => (i % 10 === 0 ? 146.83 : 440);

// one echo bus per context: a short lowpassed feedback delay, mixed in quietly
const buses = new WeakMap<BaseAudioContext, GainNode>();
const bus = (c: BaseAudioContext) => {
  let b = buses.get(c);
  if (b) return b;
  b = c.createGain();
  b.connect(c.destination);
  const dl = c.createDelay(1), lp = c.createBiquadFilter(), fb = c.createGain(), wet = c.createGain();
  dl.delayTime.value = 0.23;
  lp.type = "lowpass";
  lp.frequency.value = 1300;
  fb.gain.value = 0.25;
  wet.gain.value = 0.15;
  b.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
  lp.connect(wet); wet.connect(c.destination);
  buses.set(c, b);
  return b;
};

/** play one blip on ctx; strength 1 is a scrub step, ~0.5 a hover, ~1.4 a tap */
export function blip(ctx: AudioContext, i: number, strength = 1, volume = 0.06) {
  if (ctx.state !== "running") return;
  const at = ctx.currentTime, f = blipPitch(i);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(volume * strength, at + 0.006);
  g.gain.setTargetAtTime(0, at + 0.008, 0.035);
  g.connect(bus(ctx));
  // fundamental plus a quiet octave under for body
  for (const [mul, amp] of [[1, 1], [0.5, 0.45]]) {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f * mul;
    og.gain.value = amp;
    o.connect(og); og.connect(g);
    o.start(at); o.stop(at + 0.3);
  }
}
