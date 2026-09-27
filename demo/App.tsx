import { useEffect, useRef, useState } from "react";
import { Monochord, blip, type MonochordHandle, type SelectSource } from "../src";
import { FONTS } from "./fonts";

const pad = (i: number) => String(i).padStart(3, "0");
const REPO = "https://github.com/tol-is/monochord";

export function App() {
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const toggleSound = () => {
    audio.current ??= new AudioContext();
    void audio.current.resume();
    setSound((s) => !s);
  };
  return (
    <>
      <button className="sound" aria-pressed={sound} onClick={toggleSound}>
        SOUND {sound ? "ON" : "OFF"}
      </button>
      <Gallery onCross={(i, s) => sound && audio.current && blip(audio.current, i, s)} />
      <a className="mark" href={REPO}>MONOCHORD</a>
    </>
  );
}

function Gallery({ onCross }: { onCross: (i: number, s: number) => void }) {
  // undefined = the intro
  const [value, setValue] = useState<string | undefined>(undefined);
  const gallery = useRef<HTMLElement>(null);
  const rail = useRef<MonochordHandle>(null);
  // while a glide is in flight, plates passed on the way don't become current
  const nav = useRef<{ target: string | null; t: number }>({ target: null, t: 0 });
  const jumping = useRef(false);

  const section = (v: string | undefined) => gallery.current?.querySelector<HTMLElement>(`[data-plate="${v ?? "intro"}"]`);

  useEffect(() => {
    const root = gallery.current!;
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.intersectionRatio <= 0.5) continue;
        const p = (e.target as HTMLElement).dataset.plate!;
        const v = p === "intro" ? undefined : p;
        if (nav.current.target !== null && v !== nav.current.target) continue;
        nav.current.target = null;
        setValue(v);
      }
    }, { root, threshold: [0.5, 0.51] });
    root.querySelectorAll("[data-plate]").forEach((s) => io.observe(s));
    // scroll velocity shivers the string
    let last = root.scrollTop;
    const onScroll = () => {
      const d = root.scrollTop - last;
      last = root.scrollTop;
      if (!jumping.current) rail.current?.kick(d * 3);
    };
    const release = () => { nav.current.target = null; };
    root.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("wheel", release, { passive: true });
    root.addEventListener("touchstart", release, { passive: true });
    root.scrollTop = 0;
    return () => {
      io.disconnect();
      root.removeEventListener("scroll", onScroll);
      root.removeEventListener("wheel", release);
      root.removeEventListener("touchstart", release);
    };
  }, []);

  const go = (v: string, source: SelectSource) => {
    setValue(v);
    const el = section(v);
    if (!el) return;
    if (source === "scrub") {
      jumping.current = true;
      el.scrollIntoView();
      requestAnimationFrame(() => requestAnimationFrame(() => { jumping.current = false; }));
      return;
    }
    // a far jump lands on the neighbour instantly and glides only the last screen
    const from = value === undefined ? -1 : Number(value), to = Number(v);
    if (Math.abs(to - from) > 1) {
      jumping.current = true;
      section(String(to > from ? to - 1 : to + 1))?.scrollIntoView();
      requestAnimationFrame(() => requestAnimationFrame(() => { jumping.current = false; }));
    }
    nav.current.target = v;
    clearTimeout(nav.current.t);
    nav.current.t = window.setTimeout(() => { nav.current.target = null; }, 1500);
    el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <Monochord.Root
        className="rail"
        aria-label="Typefaces"
        value={value}
        onValueChange={(v, { source }) => go(v, source)}
        onTickCross={onCross}
        handle={rail}
      >
        <Monochord.String />
        {FONTS.map((f, i) => (
          <Monochord.Item key={i} value={String(i)} className="item">
            <span className="label">
              <span className="num">{f.year.replace("c. ", "")}</span>
              <Monochord.Scramble>{f.name.toUpperCase()}</Monochord.Scramble>
            </span>
          </Monochord.Item>
        ))}
      </Monochord.Root>

      <main className="gallery" ref={gallery}>
        <section className="intro" data-plate="intro">
          <div className="intro-body">
            <h1>A navigation rail you can pluck.</h1>
            <p>
              Monochord is a vertical index drawn as a single string. Bring the pointer to the left edge and
              the ticks spread apart under it, labels resolving as they swell. Press and drag to scrub,
              tap to jump. Scrolling, scrubbing and changing pages all set the string ringing.
            </p>
            <p>
              It is built from composable parts on Base UI: <code>Root</code>, <code>String</code>,{" "}
              <code>Item</code> and <code>Scramble</code>. Items are real buttons, or anything via <code>render</code>,
              styled through <code>data-state</code>, <code>data-highlighted</code> and <code>data-active</code>.
            </p>
            <pre><code>{USAGE}</code></pre>
            <p className="meta">
              {FONTS.length} famous typefaces, oldest first · <a href={REPO}>GitHub</a> · MIT · <a href="https://tol.is">tol.is</a>
            </p>
            <p className="hint">HOVER THE LEFT EDGE ← · OR SCROLL ↓</p>
          </div>
        </section>
        {FONTS.map((f, i) => (
          <section key={i} data-plate={String(i)} className="plate">
            <div className="plate-num">{pad(i)} / {pad(FONTS.length - 1)}</div>
            {/* set in the face itself when it's installed locally */}
            <h2 style={f.family ? { fontFamily: `"${f.family}", var(--mono)` } : undefined}>{f.name}</h2>
            <div className="plate-meta">{f.designer.toUpperCase()} · {f.year}</div>
          </section>
        ))}
      </main>
    </>
  );
}

const USAGE = `npm i monochord

import { Monochord } from "monochord";
import "monochord/styles.css";

<Monochord.Root value={page} onValueChange={setPage}>
  <Monochord.String />
  {pages.map((p) => (
    <Monochord.Item key={p.id} value={p.id}>
      <Monochord.Scramble>{p.title}</Monochord.Scramble>
    </Monochord.Item>
  ))}
</Monochord.Root>`;
