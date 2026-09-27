"use client";
// Compound parts, Radix-style: Root owns state and the engine, String draws, Item is a real
// element (button by default, anything with asChild) the engine positions beside its tick.
//
//   <Monochord.Root value={v} onValueChange={setV}>
//     <Monochord.String />
//     {pages.map((p) => (
//       <Monochord.Item key={p.id} value={p.id}><Monochord.Scramble>{p.title}</Monochord.Scramble></Monochord.Item>
//     ))}
//   </Monochord.Root>
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { createEngine, type Engine, type SelectSource } from "./engine";

export type { SelectSource };
export type MonochordHandle = {
  /** pluck the string at the current tick; pass scroll delta × ~3 for a scroll shiver */
  kick(velocity: number): void;
};

type Ctx = {
  value: string | undefined;
  tabbable: string | undefined;
  register(el: HTMLElement): () => void;
  attach(canvas: HTMLCanvasElement | null, track: HTMLElement | null): void;
  select(value: string, source: SelectSource): void;
  keyFocus(el: HTMLElement | null): void;
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

export type RootProps = Omit<React.ComponentPropsWithRef<"nav">, "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, details: { source: SelectSource }) => void;
  /** fires for each tick crossed: strength ~0.5 hover, 1 scrub, 1.4 tap. Hook sound here. */
  onTickCross?: (index: number, strength: number) => void;
  /** px right of the string that still opens the fisheye; default 240 (60 when narrower than 400px) */
  reach?: number;
  /** spacing given to the focused tick, in tick units; default 7 */
  magnify?: number;
  /** fisheye width, in ticks; default 5.5 */
  spread?: number;
  /** px of clearance a label needs from its neighbours to open; default 15 */
  labelRoom?: number;
  handle?: React.Ref<MonochordHandle>;
  asChild?: boolean;
};

function Root({
  value: valueProp, defaultValue, onValueChange, onTickCross,
  reach, magnify, spread, labelRoom, handle, asChild, ref, onKeyDown, ...props
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
  latest.current = { controlled: valueProp !== undefined, onValueChange, onTickCross };

  const select = React.useCallback((v: string, source: SelectSource) => {
    if (!latest.current.controlled) setInner(v);
    latest.current.onValueChange?.(v, { source });
  }, []);

  const options = {
    reach, magnify, spread, labelRoom,
    onSelect: (i: number, source: SelectSource) => {
      const v = ordered.current[i]?.dataset.value;
      if (v !== undefined) select(v, source);
    },
    onCross: (i: number, s: number) => latest.current.onTickCross?.(i, s),
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
    if (i >= 0) latest.current.onTickCross?.(i, 1.4);
    select(v, source);
  }, [select]);
  const keyFocus = React.useCallback((el: HTMLElement | null) => {
    engine.current?.setKeyFocus(el && el.matches(":focus-visible") ? ordered.current.indexOf(el) : -1);
  }, []);
  const ctx = React.useMemo<Ctx>(() => ({
    value,
    tabbable: value !== undefined && values.includes(value) ? value : values[0],
    register, attach, select: selectItem, keyFocus,
  }), [value, values, register, attach, selectItem, keyFocus]);

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

  const Comp = asChild ? Slot : "nav";
  return (
    <MonochordContext.Provider value={ctx}>
      <Comp
        data-monochord-root=""
        {...props}
        ref={(node: HTMLElement | null) => { rootRef.current = node; setRef(ref as React.Ref<HTMLElement>, node); }}
        onKeyDown={handleKeyDown}
      />
    </MonochordContext.Provider>
  );
}

/* ─── String ─── */

export type StringProps = React.ComponentPropsWithRef<"canvas"> & {
  /** props for the invisible strip that takes presses and scrubs */
  trackProps?: React.ComponentPropsWithoutRef<"div">;
};

/** The drawn string, ticks and current-marker, plus the press/scrub strip. Colour is `color`. */
function StringPart({ trackProps, ref, ...props }: StringProps) {
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
        ref={(node) => { canvas.current = node; setRef(ref, node); }}
      />
      <div data-monochord-track="" aria-hidden {...trackProps} ref={track} />
    </>
  );
}

/* ─── Item ─── */

export type ItemProps = React.ComponentPropsWithRef<"button"> & {
  value: string;
  asChild?: boolean;
};

/**
 * One entry on the string. Carries data-state="open|closed" (label revealed), data-highlighted
 * (nearest the pointer), data-active and aria-current (the current value), and the CSS variable
 * --monochord-reveal (0–1 emphasis). The engine sets its transform; style everything else.
 */
function Item({ value, asChild, ref, onClick, onFocus, onBlur, ...props }: ItemProps) {
  const ctx = useMonochord("Item");
  const node = React.useRef<HTMLElement | null>(null);
  const { register } = ctx;
  React.useLayoutEffect(() => register(node.current!), [register]);
  const active = ctx.value === value;
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : "button"}
      data-monochord-item=""
      data-value={value}
      data-active={active ? "" : undefined}
      aria-current={active ? "true" : undefined}
      tabIndex={ctx.tabbable === value ? 0 : -1}
      {...props}
      ref={(n: HTMLElement | null) => { node.current = n; setRef(ref as React.Ref<HTMLElement>, n); }}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        // detail 0: Enter/Space, not a pointer
        if (!e.defaultPrevented) ctx.select(value, e.detail === 0 ? "keyboard" : "tap");
      }}
      onFocus={(e: React.FocusEvent<HTMLButtonElement>) => { onFocus?.(e); ctx.keyFocus(e.currentTarget); }}
      onBlur={(e: React.FocusEvent<HTMLButtonElement>) => { onBlur?.(e); ctx.keyFocus(null); }}
    />
  );
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

export { Root, StringPart as String, Item, Scramble };
