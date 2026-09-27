// Optional pluck sound: a short triangle blip per tick crossed, pitched up a minor-pentatonic
// ladder so a scrub plays a run. Wire it to Root's onTickCross.

const PENTA = [0, 3, 5, 7, 10];

/** pitch in Hz for tick i: A3 minor pentatonic, three octaves, then repeats */
export const blipPitch = (i: number, base = 220) =>
  base * Math.pow(2, ((Math.floor(i / 5) % 3) * 12 + PENTA[i % 5]) / 12);

/** play one blip on ctx; strength 1 is a scrub step, ~0.5 a hover, ~1.4 a tap */
export function blip(ctx: AudioContext, i: number, strength = 1, volume = 0.05) {
  if (ctx.state !== "running") return;
  const at = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(blipPitch(i) * 2, at);
  o.frequency.exponentialRampToValueAtTime(blipPitch(i), at + 0.03);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(volume * strength, at + 0.003);
  g.gain.setTargetAtTime(0, at + 0.005, 0.035);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(at);
  o.stop(at + 0.3);
}
