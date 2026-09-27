import { PLATES } from "./plates";

export type TitleSet = { id: string; name: string; note: string; titles: string[] };

const CLOUDS = [
  "Cirrus", "Cirrocumulus", "Cirrostratus", "Altocumulus", "Altostratus", "Nimbostratus",
  "Stratocumulus", "Stratus", "Cumulus", "Cumulonimbus", "Fibratus", "Uncinus", "Spissatus",
  "Castellanus", "Floccus", "Stratiformis", "Nebulosus", "Lenticularis", "Fractus", "Humilis",
  "Mediocris", "Congestus", "Calvus", "Capillatus", "Volutus", "Intortus", "Vertebratus",
  "Undulatus", "Radiatus", "Lacunosus", "Duplicatus", "Translucidus", "Perlucidus", "Opacus",
  "Incus", "Mamma", "Virga", "Praecipitatio", "Arcus", "Tuba", "Pileus", "Velum", "Pannus",
  "Asperitas", "Fluctus", "Cavum", "Murus", "Cauda",
];

const BEAUFORT = [
  "Calm", "Light air", "Light breeze", "Gentle breeze", "Moderate breeze", "Fresh breeze",
  "Strong breeze", "Near gale", "Gale", "Strong gale", "Storm", "Violent storm", "Hurricane force",
];

// long, uneven titles: labels of very different widths
const ESSAYS = [
  "On weather", "A short history of looking up", "Why clouds won't hold still", "The engraver's sky",
  "Pen plotters and patience", "Notes from the dot-matrix", "Rain as a unit of time",
  "Thunder counts in seconds", "What the photocopier forgot", "Telegraphing a storm",
  "The crossword setter's cumulus", "Seven ways to draw nothing", "Edges", "Afterglow",
  "Everything is a gradient", "Lightning, briefly", "The long way down", "Coda",
];

export const SETS: TitleSet[] = [
  { id: "plates", name: "Plates", note: `${PLATES.length} renderers from Stormy Clouds`, titles: PLATES },
  { id: "clouds", name: "Clouds", note: "Genera, species, varieties and features", titles: CLOUDS.map((s) => s.toUpperCase()) },
  { id: "essays", name: "Essays", note: "Mixed-case titles of uneven length", titles: ESSAYS },
  { id: "beaufort", name: "Beaufort", note: "Thirteen steps from calm to hurricane", titles: BEAUFORT.map((s) => s.toUpperCase()) },
];
