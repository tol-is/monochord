import { useState } from "react";
import { Monochord, createBlip, tickEvent } from "../src";
import { SOUNDS, type SoundPreset } from "./sounds";
import { FONTS } from "./fonts";

const REPO = "https://github.com/tol-is/monochord";

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
  return (
    <>
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
      <Page audio={audio} muted={!sound} preset={preset} />
      <a className="mark" href={REPO}>MONOCHORD</a>
    </>
  );
}

function Page({ audio, muted, preset }: { audio: AudioContext | null; muted: boolean; preset: SoundPreset }) {
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
          <h1>A navigation rail you can pluck.</h1>
          <p>
            Monochord is a vertical index drawn as a single string. Bring the pointer to the left edge and
            the ticks spread apart under it, labels resolving as they swell. Press and drag to scrub,
            tap to jump. Every pluck sets the string ringing.
          </p>
          <p>
            It is built from composable parts on Base UI: <code>Root</code>, <code>String</code>,{" "}
            <code>Item</code>, <code>Sound</code> and <code>Scramble</code>. Items are real buttons, or anything via <code>render</code>,
            styled through <code>data-state</code>, <code>data-highlighted</code> and <code>data-active</code>.
          </p>
          <pre><code>{USAGE}</code></pre>
          <p className="meta">
            {FONTS.length} famous typefaces, oldest first · <a href={REPO}>GitHub</a> · MIT · <a href="https://tol.is">tol.is</a>
          </p>
          <p className="hint">HOVER THE LEFT EDGE ←</p>
        </div>
      </main>
    </>
  );
}

const USAGE = `npm i monochord

import { Monochord } from "monochord";
import "monochord/styles.css";

<Monochord.Root value={page} onValueChange={setPage}>
  <Monochord.String />
  <Monochord.Sound context={audioCtx} />
  {pages.map((p) => (
    <Monochord.Item key={p.id} value={p.id}>
      <Monochord.Scramble>{p.title}</Monochord.Scramble>
    </Monochord.Item>
  ))}
</Monochord.Root>`;
