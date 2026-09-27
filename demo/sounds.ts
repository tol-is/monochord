import { pulse, scale, type BlipOptions, type TickKind } from "../src";

export type SoundPreset = { id: string; name: string; options: BlipOptions; kinds?: TickKind[] };

export const SOUNDS: SoundPreset[] = [
  // the default: every tick A4, decades a low D
  { id: "pulse", name: "Pulse", options: { pitch: pulse("A4", "D3") } },
  // each decade falls through D minor and starts high again
  { id: "fall", name: "Fall", options: { pitch: scale("D3", "minor"), decay: 0.05 } },
  // a pentatonic run that climbs over fifteen ticks, triangle and a touch longer
  {
    id: "climb", name: "Climb",
    options: { pitch: scale("A3", "pentatonic", { per: 15, direction: "up" }), wave: "triangle", voices: [[1, 1]], decay: 0.06, volume: 0.05 },
  },
  // bell partials an octave up, long tail, wetter echo
  {
    id: "glass", name: "Glass",
    options: {
      pitch: scale("A4", "majorPentatonic", { per: 10, direction: "down" }),
      voices: [[1, 1], [2.76, 0.28], [5.4, 0.1]], decay: 0.16, volume: 0.035,
      echo: { time: 0.31, feedback: 0.35, wet: 0.22, cutoff: 2400 },
    },
  },
  // a dry mechanical click, silent on hover
  {
    id: "click", name: "Click",
    options: { pitch: (i) => (i % 10 === 0 ? 1600 : 2400), wave: "square", voices: [[1, 1]], attack: 0.001, decay: 0.004, volume: 0.025, echo: false },
    kinds: ["scrub", "tap", "keyboard"],
  },
];
