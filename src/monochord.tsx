"use client";
// Compound parts on Base UI's useRender: Root owns state and the engine, String draws, Item is a
// real element (button by default, anything via `render`) the engine positions beside its tick.
//
//   <Monochord.Root value={v} onValueChange={setV}>
//     <Monochord.String />
//     {pages.map((p) => (
//       <Monochord.Item key={p.id} value={p.id}><Monochord.Scramble>{p.title}</Monochord.Scramble></Monochord.Item>
//     ))}
//   </Monochord.Root>
import * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { createEngine, type Engine, type SelectSource } from "./engine";
import { createBlip, tickEvent, type Blip, type BlipOptions, type TickEvent, type TickKind } from "./sound";

export type { SelectSource, TickEvent, TickKind };
type TickListener = (index: number, event: TickEvent) => void;
export type MonochordHandle = {
  /** light pluck at the current tick from scroll velocity (delta × ~3); rate-limited to every 120 ms */
  kick(velocity: number): void;
};

type Ctx = {
  value: string | undefined;
  tabbable: string | undefined;
  register(el: HTMLElement): () => void;
  attach(canvas: HTMLCanvasElement | null, track: HTMLElement | null): void;
  select(value: string, source: SelectSource): void;
  keyFocus(el: HTMLElement | null): void;
  /** subscribe to ticks crossed; returns the unsubscribe */
  onTick(listener: TickListener): () => void;
};
const MonochordContext = React.createContext<Ctx | null>(null);
const useMonochord = (part: string) => {
  const ctx = React.useContext(MonochordContext);
  if (!ctx) throw new Error(`<Monochord.${part}> must be used within <Monochord.Root>`);
  return ctx;
};

const setRef = <T,>(ref: React.Ref<T> | undefined, node: T | null) => {
  if (typeof ref === "function") ref(node);
  else if (ref) (ref as React.RefObject<T | null>).current = node;
};

/* ─── Root ─── */

export type RootProps = Omit<useRender.ComponentProps<"nav">, "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, details: { source: SelectSource }) => void;
  /** fires for each tick crossed or chosen, with why (`kind`) and a loudness hint (`strength`) */
  onTickCross?: (index: number, event: TickEvent) => void;
  /** px right of the string that still opens the fisheye; default 240 (60 when narrower than 400px) */
  reach?: number;
  /** spacing given to the focused tick, in tick units; default 7 */
  magnify?: number;
  /** fisheye width, in ticks; default 5.5 */
  spread?: number;
  /** px of clearance a label needs from its neighbours to open; default its font size − 3 */
  labelRoom?: number;
  /** px width of the press/scrub strip at rest; default 56 (40 when narrower than 400px) */
  trackWidth?: number;
  handle?: React.Ref<MonochordHandle>;
};

function Root({
  value: valueProp, defaultValue, onValueChange, onTickCross,
  reach, magnify, spread, labelRoom, trackWidth, handle, render, ref, className, style, onKeyDown, ...props
}: RootProps) {
  const [inner, setInner] = React.useState(defaultValue);
  const value = valueProp !== undefined ? valueProp : inner;
  const rootRef = React.useRef<HTMLElement | null>(null);
  const engine = React.useRef<Engine | null>(null);
  const items = React.useRef(new Set<HTMLElement>());
  const ordered = React.useRef<HTMLElement[]>([]);
  const parts = React.useRef<[HTMLCanvasElement | null, HTMLElement | null]>([null, null]);
  const [version, bump] = React.useReducer((n: number) => n + 1, 0);
  const [values, setValues] = React.useState<string[]>([]);

  const latest = React.useRef({ controlled: false, onValueChange, onTickCross });
  const listeners = React.useRef(new Set<TickListener>());
  const tick = React.useCallback((i: number, kind: TickKind) => {
    const e = tickEvent(i, kind);
    latest.current.onTickCross?.(i, e);
    for (const l of listeners.current) l(i, e);
  }, []);
  latest.current = { controlled: valueProp !== undefined, onValueChange, onTickCross };

  const select = React.useCallback((v: string, source: SelectSource) => {
    if (!latest.current.controlled) setInner(v);
    latest.current.onValueChange?.(v, { source });
  }, []);

  const options = {
    reach, magnify, spread, labelRoom, trackWidth,
    onSelect: (i: number, source: SelectSource) => {
      const v = ordered.current[i]?.dataset.value;
      if (v !== undefined) select(v, source);
    },
    onCross: tick,
  };

  React.useLayoutEffect(() => {
    const el = rootRef.current!;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    const e = (engine.current = createEngine(el, options));
    e.attach(...parts.current);
    return () => { e.destroy(); engine.current = null; };
    // the engine lives as long as the root; options are pushed below
  }, []);
  React.useLayoutEffect(() => { engine.current?.setOptions(options); });

  // display order is document order, so conditional or reordered items just work
  React.useLayoutEffect(() => {
    const els = [...items.current].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    ordered.current = els;
    engine.current?.setItems(els);
    const vs = els.map((el) => el.dataset.value ?? "");
    setValues((prev) => (prev.length === vs.length && prev.every((x, i) => x === vs[i]) ? prev : vs));
  }, [version]);
  React.useLayoutEffect(() => {
    engine.current?.setCurrent(ordered.current.findIndex((el) => el.dataset.value === value));
  }, [value, version]);

  React.useImperativeHandle(handle, () => ({ kick: (v) => engine.current?.kick(v) }), []);

  const register = React.useCallback((el: HTMLElement) => {
    items.current.add(el);
    bump();
    return () => { items.current.delete(el); bump(); };
  }, []);
  const attach = React.useCallback((canvas: HTMLCanvasElement | null, track: HTMLElement | null) => {
    parts.current = [canvas, track];
    engine.current?.attach(canvas, track);
  }, []);
  const selectItem = React.useCallback((v: string, source: SelectSource) => {
    const i = ordered.current.findIndex((el) => el.dataset.value === v);
    if (i >= 0) tick(i, source === "keyboard" ? "keyboard" : "tap");
    select(v, source);
  }, [select, tick]);
  const onTick = React.useCallback((l: TickListener) => {
    listeners.current.add(l);
    return () => { listeners.current.delete(l); };
  }, []);
  const keyFocus = React.useCallback((el: HTMLElement | null) => {
    engine.current?.setKeyFocus(el && el.matches(":focus-visible") ? ordered.current.indexOf(el) : -1);
  }, []);
  const ctx = React.useMemo<Ctx>(() => ({
    value,
    tabbable: value !== undefined && values.includes(value) ? value : values[0],
    register, attach, select: selectItem, keyFocus, onTick,
  }), [value, values, register, attach, selectItem, keyFocus, onTick]);

  // roving focus: arrows walk the items, Home/End jump to the ends
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const from = ordered.current.indexOf((e.target as Element).closest?.("[data-monochord-item]") as HTMLElement);
    if (from < 0) return;
    const last = ordered.current.length - 1;
    const to = { ArrowDown: from + 1, ArrowUp: from - 1, Home: 0, End: last }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const el = ordered.current[Math.max(0, Math.min(last, to))];
    el.focus({ preventScroll: true });
    engine.current?.setKeyFocus(ordered.current.indexOf(el));
  };

  const element = useRender({
    render,
    defaultTagName: "nav",
    ref: [rootRef as React.Ref<HTMLElement>, ref as React.Ref<HTMLElement>],
    props: { "data-monochord-root": "", ...props, className, style: { ...rootStyle, ...style }, onKeyDown: handleKeyDown },
  });
  return <MonochordContext.Provider value={ctx}>{element}</MonochordContext.Provider>;
}

/* ─── Inline styles: structure only. Override through className/style (functions of state welcome). */

const rootStyle: React.CSSProperties = { pointerEvents: "none" };
const canvasStyle: React.CSSProperties = {
  position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none",
};
// the engine sets its width (wider while open) and cursor
const trackStyle: React.CSSProperties = {
  position: "absolute", top: 0, bottom: 0, left: 0, pointerEvents: "auto", touchAction: "none",
};
// the engine sets transform and opacity every frame; the text fades with --monochord-reveal
const itemStyle: React.CSSProperties = {
  position: "absolute", top: 0, left: 0, opacity: 0, willChange: "transform, opacity",
  whiteSpace: "nowrap", touchAction: "none", cursor: "pointer",
  font: "inherit", letterSpacing: "inherit", background: "none", border: 0, padding: 0, margin: 0,
  color: "color-mix(in oklab, currentColor calc(var(--monochord-reveal, 1) * 100%), transparent)",
};

/* ─── String ─── */

export type StringProps = React.ComponentPropsWithRef<"canvas"> & {
  /** props for the invisible strip that takes presses and scrubs */
  trackProps?: React.ComponentPropsWithoutRef<"div">;
};

/** The drawn string, ticks and current-marker, plus the press/scrub strip. Colour is `color`. */
function StringPart({ trackProps, ref, style, ...props }: StringProps) {
  const ctx = useMonochord("String");
  const canvas = React.useRef<HTMLCanvasElement | null>(null);
  const track = React.useRef<HTMLDivElement | null>(null);
  const { attach } = ctx;
  React.useLayoutEffect(() => {
    attach(canvas.current, track.current);
    return () => attach(null, null);
  }, [attach]);
  return (
    <>
      <canvas
        data-monochord-string=""
        aria-hidden
        {...props}
        style={{ ...canvasStyle, ...style }}
        ref={(node) => { canvas.current = node; setRef(ref, node); }}
      />
      <div data-monochord-track="" aria-hidden {...trackProps} style={{ ...trackStyle, ...trackProps?.style }} ref={track} />
    </>
  );
}

/* ─── Item ─── */

export type ItemState = { active: boolean };
export type ItemProps = Omit<useRender.ComponentProps<"button", ItemState>, "className" | "style"> & {
  value: string;
  className?: string | ((state: ItemState) => string | undefined);
  style?: React.CSSProperties | ((state: ItemState) => React.CSSProperties | undefined);
};

/**
 * One entry on the string. Carries data-state="open|closed" (label revealed), data-highlighted
 * (nearest the pointer), data-active and aria-current (the current value), and the CSS variable
 * --monochord-reveal (0–1 emphasis; the text fades with it by default). The engine drives its
 * transform and opacity. `className` and `style` may be functions of { active }.
 * `render` swaps the button for your own element, e.g. render={<a href={url} />}.
 */
function Item({ value, render, ref, className, style, onClick, onFocus, onBlur, ...props }: ItemProps) {
  const ctx = useMonochord("Item");
  const node = React.useRef<HTMLElement | null>(null);
  const { register } = ctx;
  React.useLayoutEffect(() => register(node.current!), [register]);
  const active = ctx.value === value;
  const state: ItemState = { active };
  return useRender({
    render,
    defaultTagName: "button",
    ref: [node, ref as React.Ref<HTMLElement>],
    state,
    props: {
      type: render ? undefined : "button",
      "data-monochord-item": "",
      "data-value": value,
      "aria-current": active ? "true" : undefined,
      tabIndex: ctx.tabbable === value ? 0 : -1,
      ...props,
      className: typeof className === "function" ? className(state) : className,
      style: { ...itemStyle, ...(typeof style === "function" ? style(state) : style) },
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        // detail 0: Enter/Space, not a pointer
        if (!e.defaultPrevented) ctx.select(value, e.detail === 0 ? "keyboard" : "tap");
      },
      onFocus: (e: React.FocusEvent<HTMLButtonElement>) => { onFocus?.(e); ctx.keyFocus(e.currentTarget); },
      onBlur: (e: React.FocusEvent<HTMLButtonElement>) => { onBlur?.(e); ctx.keyFocus(null); },
    },
  });
}

/* ─── Sound ─── */

export type SoundProps = BlipOptions & {
  /** the AudioContext to play on; create it on a user gesture. Nothing plays while it's missing. */
  context: AudioContext | null | undefined;
  muted?: boolean;
  /** which ticks sound; default all: ["hover", "scrub", "tap", "keyboard"] */
  kinds?: TickKind[];
};

/** Plays a note for each tick crossed. Renders nothing; leave it out for a silent rail. */
function Sound({ context, muted = false, kinds, ...options }: SoundProps) {
  const { onTick } = useMonochord("Sound");
  const blip = React.useRef<Blip | null>(null);
  const latest = React.useRef({ muted, kinds });
  latest.current = { muted, kinds };
  React.useEffect(() => {
    if (!context) return;
    const b = (blip.current = createBlip(context, options));
    const off = onTick((i, e) => {
      const { muted, kinds } = latest.current;
      if (!muted && (!kinds || kinds.includes(e.kind))) b(i, e);
    });
    return () => { off(); b.dispose(); blip.current = null; };
    // options are pushed live below; only a new context rebuilds the voice
  }, [context, onTick]);
  React.useEffect(() => { blip.current?.set(options); });
  return null;
}

/* ─── Scramble ─── */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%*+=/<>";

export type ScrambleProps = Omit<React.ComponentPropsWithoutRef<"span">, "children"> & {
  children: string;
  /** ms per character resolved; default 18 */
  speed?: number;
  glyphs?: string;
};

/** Text that resolves out of random glyphs each time its Item opens. Screen readers get the plain text. */
function Scramble({ children: text, speed = 18, glyphs = GLYPHS, ...props }: ScrambleProps) {
  const span = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    const el = span.current!, item = el.closest("[data-monochord-item]");
    if (!item) return;
    let raf = 0;
    const run = (t0: number) => {
      const step = (now: number) => {
        const resolved = Math.floor((now - t0) / speed);
        let out = "";
        for (let c = 0; c < text.length; c++) {
          out += c < resolved || text[c] === " " ? text[c] : glyphs[(Math.random() * glyphs.length) | 0];
        }
        el.textContent = out;
        if (resolved < text.length) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      if (item.getAttribute("data-state") === "open") run(performance.now());
      else el.textContent = text;
    };
    const mo = new MutationObserver(sync);
    mo.observe(item, { attributes: true, attributeFilter: ["data-state"] });
    el.textContent = text;
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, [text, speed, glyphs]);
  return (
    <span data-monochord-scramble="" {...props}>
      <span aria-hidden ref={span}>{text}</span>
      <span style={srOnly}>{text}</span>
    </span>
  );
}
const srOnly: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap",
};

export { Root, StringPart as String, Item, Sound, Scramble };
