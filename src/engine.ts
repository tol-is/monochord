// The string: a vertical run of N ticks drawn on a canvas every frame.
//   · fisheye: near the pointer the ticks spread apart (spring-eased focus + magnification)
//   · the string vibrates where it's plucked: each pluck is a short span ringing in place in its
//     first three modes, the higher ones fading first; taps, scrubs, value changes and kicks pluck it
//   · press + drag scrubs; a tap on the strip jumps to the nearest tick
// Items are DOM elements the engine positions next to their tick each frame and flags with
// data-state="open|closed" and data-highlighted, so labels stay real, styleable, focusable nodes.

export type SelectSource = "tap" | "scrub" | "keyboard";

export type EngineOptions = {
  /** px to the right of the string that still opens the fisheye; default 240 (60 under 400px wide) */
  reach?: number;
  /** extra spacing given to the focused tick, in tick units; default 7 */
  magnify?: number;
  /** width of the fisheye, in ticks; default 5.5 */
  spread?: number;
  /** minimum px between neighbouring ticks before a label may open; default the label's font size − 3 */
  labelRoom?: number;
  onSelect: (index: number, source: SelectSource) => void;
  onCross?: (index: number, strength: number) => void;
};

export type Engine = ReturnType<typeof createEngine>;

const DEFAULTS = { magnify: 7, spread: 5.5 };

export function createEngine(root: HTMLElement, initial: EngineOptions) {
  let opts = initial;
  let canvas: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null;
  let hit: HTMLElement | null = null;
  let items: HTMLElement[] = [];
  let N = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, color = "#fff", colorAge = 0;

  // layout; label open state
  let ys = new Float32Array(0), mag = new Float32Array(0);
  let open = new Uint8Array(0), hl = new Uint8Array(0);
  // per item: half its height (to centre it on its tick) and its font size (the room it needs)
  let halfH = new Float32Array(0), fsz = new Float32Array(0);

  let px = -1e4, py = -1e4, inside = false;
  let focus = 0, focusV = 0, near = 0, keyFocus = -1;
  let cur = -1, curF = 0, curV = 0;
  let scrub = false, moved = false, downY = 0, downItem = -1, lastHover = -1;
  let t = 0, raf = 0, prev = 0;

  // plucks: a span of string (centre y, half-width w, px) ringing in place, standing-wave style
  type Pluck = { y: number; w: number; amp: number; t0: number; f: number };
  const plucks: Pluck[] = [];
  const pluck = (i: number, amp: number, w: number) => {
    if (i < 0 || i >= N) return;
    if (plucks.length >= 12) plucks.shift();
    // shorter spans ring faster, as a shorter string would
    plucks.push({ y: ys[i], w, amp, t0: t, f: 5 + 240 / w });
  };
  // displacement at y: each span's first three modes, the higher ones quieter and faster to fade
  const disp = (y: number) => {
    let d = 0;
    for (const p of plucks) {
      const x = (y - p.y + p.w) / (2 * p.w);
      if (x <= 0 || x >= 1) continue;
      const a = t - p.t0;
      for (let n = 1; n <= 3; n++) {
        // past ~25 Hz a 60 fps frame can't show it: it would only flicker
        if (p.f * n > 25) break;
        d += p.amp * [1, 0.3, 0.16][n - 1] * Math.exp(-a * n / 0.35) * Math.sin(n * Math.PI * x) * Math.cos(2 * Math.PI * p.f * n * a);
      }
    }
    return d;
  };
  let kickT = -1;
  const measure = () => items.forEach((el, i) => {
    halfH[i] = el.offsetHeight / 2;
    fsz[i] = parseFloat(getComputedStyle(el).fontSize) || 16;
  });
  // a label's half-height of room at either end
  const top = () => 12, len = () => H - 24;
  const X0 = 1.5;
  const indexAt = (y: number) => {
    let best = 0, bd = 1e9;
    for (let i = 0; i < N; i++) { const d = Math.abs(ys[i] - y); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const local = () => { const r = root.getBoundingClientRect(); return [px - r.left, py - r.top] as const; };
  const itemIndex = (target: EventTarget | null) => {
    const el = target instanceof Element ? target.closest("[data-monochord-item]") : null;
    return el ? items.indexOf(el as HTMLElement) : -1;
  };

  const resize = () => {
    W = root.clientWidth; H = root.clientHeight;
    measure();
    if (!canvas) return;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(root);

  const onMove = (e: PointerEvent) => {
    px = e.clientX; py = e.clientY; inside = true;
    if (!scrub || N === 0) return;
    // a few px of slop so a tap on a label stays a click
    if (!moved && Math.abs(e.clientY - downY) < 4) return;
    moved = true;
    const i = indexAt(local()[1]);
    if (i === lastHover) return;
    lastHover = i;
    opts.onSelect(i, "scrub");
    opts.onCross?.(i, 1);
    pluck(i, 6 + Math.random() * 3, 30);
  };
  const onDown = (e: PointerEvent) => {
    const onHit = !!hit && hit.contains(e.target as Node);
    const it = itemIndex(e.target);
    if ((!onHit && it < 0) || N === 0 || e.button > 0) return;
    scrub = true; moved = false; downY = e.clientY; downItem = it;
    px = e.clientX; py = e.clientY; inside = true;
    const i = it >= 0 ? it : indexAt(local()[1]);
    pluck(i, 18, 60);
    lastHover = i;
  };
  const suppressClick = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const onUp = () => {
    if (!scrub) return;
    scrub = false;
    if (moved) {
      // a scrub that ends on a label is not a click on it
      window.addEventListener("click", suppressClick, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", suppressClick, { capture: true }), 0);
    } else if (downItem < 0) {
      const i = indexAt(local()[1]);
      opts.onSelect(i, "tap");
      opts.onCross?.(i, 1.4);
    }
    // a tap on an item selects through its own click handler (so links and keyboard behave)
    pluck(lastHover, 20, 80);
  };
  const onOut = (e: PointerEvent) => { if (!e.relatedTarget) inside = false; };
  root.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  document.addEventListener("pointerout", onOut);

  const setAttr = (el: HTMLElement, name: string, on: boolean, value = "") => {
    if (on) el.setAttribute(name, value); else el.removeAttribute(name);
  };

  const frame = (dt: number) => {
    t += dt;
    if (!W || !H) resize();
    const [lx, ly] = local();
    const reach = opts.reach ?? (W < 400 ? 60 : 240);
    const A0 = opts.magnify ?? DEFAULTS.magnify, sg = opts.spread ?? DEFAULTS.spread;
    const dx = lx - X0;
    const pointerNear = inside && dx > -40 && dx < reach && ly > top() - 40 && ly < top() + len() + 40;
    const wantNear = pointerNear || scrub || keyFocus >= 0 ? 1 : 0;
    near += (wantNear - near) * (1 - Math.exp(-dt * 10));

    // focus: the fractional tick under the pointer in the CURRENT (magnified) layout, so the
    // magnified tick sits under the cursor. Keyboard focus steers it when the pointer is away.
    let target = focus;
    if (pointerNear || scrub) {
      if (ly <= ys[0]) target = 0;
      else if (ly >= ys[N - 1]) target = N - 1;
      else for (let i = 0; i < N - 1; i++) if (ly < ys[i + 1]) { target = i + (ly - ys[i]) / Math.max(1e-3, ys[i + 1] - ys[i]); break; }
    } else if (keyFocus >= 0) target = keyFocus;
    focusV += ((target - focus) * 900 - focusV * 55) * dt;
    focus += focusV * dt;
    // current marker glides
    curV += ((Math.max(0, cur) - curF) * 120 - curV * 20) * dt;
    curF += curV * dt;

    // fisheye positions: cumulative weights
    const A = A0 * near;
    let acc = 0;
    for (let i = 0; i < N; i++) {
      const d = i - focus;
      acc += 1 + A * Math.exp(-(d * d) / (2 * sg * sg));
      mag[i] = near * Math.exp(-(d * d) / (2 * (sg * 1.4) * (sg * 1.4)));
      ys[i] = acc;
    }
    const s = len() / Math.max(1, acc);
    for (let i = 0; i < N; i++) ys[i] = top() + ys[i] * s;

    // rung-out plucks go
    for (let k = plucks.length - 1; k >= 0; k--) if (t - plucks[k].t0 > 2) plucks.splice(k, 1);

    const hovered = near > 0.5 && (pointerNear || scrub) ? indexAt(ly) : near > 0.5 ? keyFocus : -1;
    if (hit) {
      // the strip widens while open so the whole fisheye can be scrubbed
      hit.style.width = near > 0.3 || scrub ? `${Math.min(W, reach + 40)}px` : "";
      hit.style.cursor = near > 0.5 ? "pointer" : "";
    }
    // hover blips as the pointer crosses ticks
    if (near > 0.6 && !scrub && pointerNear) {
      if (hovered !== lastHover && hovered >= 0) { lastHover = hovered; opts.onCross?.(hovered, 0.5); }
    } else if (!scrub && near < 0.2) lastHover = -1;

    const sway = (y: number) => 1.2 * Math.sin(t * 1.3 + y * 0.02) * (1 - near);
    // shown displacement: rounds off instead of clipping flat; swings into the edge squash against
    // it like a string on a fretboard
    const shown = (d: number) => (d >= 0 ? 26 : 8) * Math.tanh(d / 26);
    const X = (i: number) => X0 + shown(disp(ys[i])) + sway(ys[i]);
    const tickLen = (i: number) => (i % 10 === 0 ? 9 : 5) + 34 * mag[i] + (i === cur ? 18 : 0);

    // items: open when their tick has swollen and has a line of room, or when current at rest
    for (let i = 0; i < N; i++) {
      const el = items[i];
      const room = Math.min(i > 0 ? ys[i] - ys[i - 1] : 99, i < N - 1 ? ys[i + 1] - ys[i] : 99);
      const show = (mag[i] > 0.32 && room > (opts.labelRoom ?? fsz[i] - 3)) || (i === cur && near < 0.3);
      const isH = i === hovered;
      if (show !== !!open[i]) {
        open[i] = show ? 1 : 0;
        el.dataset.state = show ? "open" : "closed";
        el.style.pointerEvents = show ? "" : "none";
      }
      if (isH !== !!hl[i]) { hl[i] = isH ? 1 : 0; setAttr(el, "data-highlighted", isH); }
      if (!show) continue;
      const reveal = i === cur && near < 0.3 ? 1 : Math.min(1, (mag[i] - 0.32) * 2.2) * (isH ? 1 : 0.55);
      // whole pixels: fractional transforms make backed labels bleed at their edges
      if (!halfH[i]) halfH[i] = el.offsetHeight / 2;
      el.style.transform = `translate3d(${Math.round(X(i) + tickLen(i) + (isH ? 14 : 8))}px,${Math.round(ys[i] - halfH[i])}px,0)`;
      el.style.setProperty("--monochord-reveal", reveal.toFixed(3));
    }

    if (!ctx || !canvas) return;
    if (--colorAge <= 0) { color = getComputedStyle(canvas).color || "#fff"; colorAge = 30; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (N === 0) return;
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.lineWidth = 1;

    // the string itself stays still; only the ticks and labels ride the plucks. Same weight as a
    // plain tick at rest, as bright as a magnified tick when the rail opens
    ctx.globalAlpha = Math.min(1, 0.22 + 0.7 * near);
    ctx.beginPath();
    ctx.moveTo(X0, ys[0] - 14);
    ctx.lineTo(X0, ys[N - 1] + 14);
    ctx.stroke();

    // ticks
    for (let i = 0; i < N; i++) {
      const m = mag[i];
      ctx.globalAlpha = i === cur ? 1 : Math.min(1, 0.22 + 0.35 * (i % 10 === 0 ? 1 : 0) * (1 - m) + 0.7 * m);
      ctx.lineWidth = i === cur ? 1.5 : 1;
      ctx.beginPath();
      // rooted on the still line; the pluck moves only the far end, so the tick stretches, no gap
      ctx.moveTo(X0, ys[i]);
      ctx.lineTo(Math.max(X0 + 1, X(i) + tickLen(i)), ys[i]);
      ctx.stroke();
    }

    // current marker: a diamond gliding along the still line
    if (cur >= 0) {
      const i0 = Math.max(0, Math.min(N - 2, Math.floor(curF))), f = curF - i0, i1 = Math.min(N - 1, i0 + 1);
      const my = ys[i0] + (ys[i1] - ys[i0]) * f, mx = X0;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(mx, my - 4); ctx.lineTo(mx + 4, my); ctx.lineTo(mx, my + 4); ctx.lineTo(mx - 4, my);
      ctx.closePath();
      ctx.fill();
    }

    // lead-in bracket at the highlighted tick
    if (hovered >= 0 && open[hovered]) {
      const bx = X(hovered) + tickLen(hovered);
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 8, ys[hovered] - 6); ctx.lineTo(bx + 4, ys[hovered] - 6);
      ctx.lineTo(bx + 4, ys[hovered] + 6); ctx.lineTo(bx + 8, ys[hovered] + 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0;
    prev = now;
    if (!document.hidden) frame(dt);
  };
  raf = requestAnimationFrame(loop);

  return {
    setOptions(next: EngineOptions) { opts = next; },
    attach(c: HTMLCanvasElement | null, h: HTMLElement | null) {
      canvas = c; hit = h;
      ctx = c ? c.getContext("2d") : null;
      colorAge = 0;
      resize();
    },
    /** items in display order; string state is kept for ticks that survive */
    setItems(els: HTMLElement[]) {
      const n = els.length;
      if (n !== N) {
        const grown = new Float32Array(n);
        grown.set(ys.subarray(0, Math.min(n, ys.length)));
        ys = grown; mag = new Float32Array(n);
        N = n;
        if (cur >= N) cur = N - 1;
      }
      // new elements start closed; survivors keep their state (no re-reveal on list changes)
      open = new Uint8Array(n); hl = new Uint8Array(n); halfH = new Float32Array(n); fsz = new Float32Array(n);
      els.forEach((el, i) => {
        if (!items.includes(el)) { el.dataset.state = "closed"; el.style.pointerEvents = "none"; el.removeAttribute("data-highlighted"); }
        open[i] = el.dataset.state === "open" ? 1 : 0;
        hl[i] = el.hasAttribute("data-highlighted") ? 1 : 0;
      });
      items = els;
      measure();
    },
    setCurrent(i: number) {
      if (i === cur) return;
      if (cur >= 0 && i >= 0) pluck(i, 12, 70);
      else if (i >= 0) curF = i;
      cur = i;
    },
    /** keyboard focus opens the fisheye around an item; -1 releases it */
    setKeyFocus(i: number) { keyFocus = i; },
    /** a light pluck at the current tick from scroll velocity (px/frame × ~3), at most every 120 ms */
    kick(velocity: number) {
      const vel = Math.max(-400, Math.min(400, velocity));
      if (cur < 0 || Math.abs(vel) < 20 || t - kickT < 0.12) return;
      kickT = t;
      pluck(cur, Math.min(8, Math.abs(vel) / 50), 90);
    },
    /** ring a span of string at tick i: amplitude and half-width in px */
    pluck(i: number, amplitude: number, halfWidth: number) { pluck(i, amplitude, halfWidth); },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      root.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("pointerout", onOut);
    },
  };
}
