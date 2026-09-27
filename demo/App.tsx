import { useState, type ReactNode } from "react";
import { Monochord, createBlip, tickEvent } from "../src";
import { SOUNDS, type SoundPreset } from "./sounds";
import { install, usage } from "virtual:code";
import { FONTS } from "./fonts";

const REPO = "https://github.com/tol-is/monochord";
const NPM = "https://www.npmjs.com/package/monochord";

export function App() {
  const [sound, setSound] = useState(false);
  const [preset, setPreset] = useState<SoundPreset>(SOUNDS[0]);
  // audio may only start from a gesture: the first press creates the context
  const [audio, setAudio] = useState<AudioContext | null>(null);
  const ensureAudio = () => {
    const ctx = audio ?? new AudioContext();
    void ctx.resume();
    if (!audio) setAudio(ctx);
    return ctx;
  };
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
  // the voices, then the pixel speaker: waves when on, a cross when off
  const controls = (
        <div className="controls">
          <div className="voices" role="group" aria-label="Sound">
            {SOUNDS.map((p) => (
              <button key={p.id} aria-pressed={sound && p.id === preset.id} onClick={() => choose(p)}>
                {p.name.toUpperCase()}
              </button>
            ))}
          </div>
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
        </div>
  );
  return (
    <>
      <Page audio={audio} muted={!sound} preset={preset} controls={controls} />
    </>
  );
}

function Page({ audio, muted, preset, controls }: { audio: AudioContext | null; muted: boolean; preset: SoundPreset; controls: ReactNode }) {
  // nothing chosen until the rail is used
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <>
      <Monochord.Root className="rail" aria-label="Typefaces" value={value} onValueChange={setValue}>
        <Monochord.String />
        <Monochord.Sound context={audio} muted={muted} kinds={preset.kinds} {...preset.options} />
        {FONTS.map((f, i) => (
          <Monochord.Item key={i} value={String(i)} className="item">
            <span className="label">
              <span className="num">{f.year.replace("c. ", "")}</span>
              <Monochord.Scramble>{f.name.toUpperCase()}</Monochord.Scramble>
            </span>
          </Monochord.Item>
        ))}
      </Monochord.Root>

      <main className="intro">
        <div className="intro-body">
          <h1>MONOCHORD</h1>
          <p className="lede">A vertical index navigation, drawn as a single string you can pluck.</p>
          {controls}
          <nav className="links" aria-label="Project">
            <a href={REPO}>GITHUB ↗</a>
            <a href={NPM}>NPM ↗</a>
          </nav>
          <div className="code" dangerouslySetInnerHTML={{ __html: install }} />
          <div className="code" dangerouslySetInnerHTML={{ __html: usage }} />
          <ul className="badges" aria-label="Built with">
            <li>REACT</li>
            <li>BASE UI</li>
            <li>MIT</li>
          </ul>
        </div>
      </main>
    </>
  );
}
