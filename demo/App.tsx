import { useEffect, useRef, useState, type ReactNode } from "react";
import { Monochord, createBlip, tickEvent } from "../src";
import { SOUNDS, type SoundPreset } from "./sounds";
import { FONTS } from "./fonts";
import { PencilArrow } from "./PencilArrow";

const REPO = "https://github.com/tol-is/monochord";
const NPM = "https://www.npmjs.com/package/monochord";

export function App() {
  // on by default; browsers only allow audio after a gesture, so the first press or key starts it
  const [sound, setSound] = useState(true);
  const [preset, setPreset] = useState<SoundPreset>(SOUNDS[0]);
  const [audio, setAudio] = useState<AudioContext | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const ensureAudio = () => {
    const ctx = (ctxRef.current ??= new AudioContext());
    void ctx.resume();
    setAudio(ctx);
    return ctx;
  };
  // capture, so it runs before anything that stops propagation
  useEffect(() => {
    const first = () => ensureAudio();
    for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, first, { capture: true, once: true });
    return () => { for (const ev of ["pointerdown", "keydown"]) window.removeEventListener(ev, first, { capture: true }); };
  }, []);
  const toggleSound = () => { ensureAudio(); setSound((s) => !s); };
  // picking a voice turns sound on and plays a short run of it
  const choose = (p: SoundPreset) => {
    const ctx = ensureAudio();
    setPreset(p);
    setSound(true);
    const play = createBlip(ctx, p.options);
    [3, 2, 1, 0].forEach((i, k) => setTimeout(() => play(i, tickEvent(i, "scrub")), 30 + k * 90));
    setTimeout(() => play.dispose(), 2000);
  };
  // the voices as a small horizontal monochord: a string, a numbered tick per voice, and the
  // rail's long tick + diamond on the one playing
  const voices = (
    <div className="voices" role="radiogroup" aria-label="Voice">
      {SOUNDS.map((p, i) => (
        <button key={p.id} role="radio" aria-checked={p.id === preset.id} className="voice" onClick={() => choose(p)}>
          <span className="voice-num">{String(i + 1).padStart(2, "0")}</span>
          <span className="voice-tick" aria-hidden="true" />
          <span className="voice-name">{p.name.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
  return (
    <>
      <Page audio={audio} muted={!sound} preset={preset} voices={voices} />
      {/* the pixel speaker, bottom right: waves when on, a cross when off */}
      <button className="speaker" aria-pressed={sound} aria-label={sound ? "Sound on" : "Sound off"} onClick={toggleSound}>
        <svg viewBox="0 0 13 11" width="26" height="22" shapeRendering="crispEdges" aria-hidden="true">
          <path fill="currentColor" d="M0 4h2v3H0zM2 3h1v5H2zM3 2h1v7H3zM4 1h1v9H4zM5 0h1v11H5z" />
          {sound ? (
            <path fill="currentColor" d="M8 4h1v3H8zM10 2h1v1h-1zM11 3h1v5h-1zM10 8h1v1h-1z" />
          ) : (
            <path fill="currentColor" d="M8 3h1v1H8zM9 4h1v1H9zM10 5h1v1h-1zM11 4h1v1h-1zM12 3h1v1h-1zM9 6h1v1H9zM8 7h1v1H8zM11 6h1v1h-1zM12 7h1v1h-1z" />
          )}
        </svg>
      </button>
    </>
  );
}

function Page({ audio, muted, preset, voices }: { audio: AudioContext | null; muted: boolean; preset: SoundPreset; voices: ReactNode }) {
  // nothing chosen until the rail is used
  const title = useRef<HTMLHeadingElement>(null);
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <>
      <Monochord.Root className="rail" aria-label="Typefaces" value={value} onValueChange={setValue}>
        <Monochord.String />
        <Monochord.Sound context={audio} muted={muted} kinds={preset.kinds} {...preset.options} />
        {FONTS.map((f, i) => (
          <Monochord.Item key={i} value={String(i)} className="item">
            <Monochord.Label className="label">
              <span className="num">{f.year.replace("c. ", "")}</span>
              {f.name.toUpperCase()}
            </Monochord.Label>
          </Monochord.Item>
        ))}
      </Monochord.Root>

      <PencilArrow from={title} />
      <main className="intro">
        <div className="intro-body">
          <h1 ref={title}>MONOCHORD</h1>
          <p className="lede">Navigation with a string attached.</p>
          {voices}
          <nav className="links" aria-label="Project">
            <a href="/AGENTS.md">AGENTS.MD ↗</a>
            <a href={REPO}>GITHUB ↗</a>
            <a href={NPM}>NPM ↗</a>
          </nav>
        </div>
      </main>
    </>
  );
}
