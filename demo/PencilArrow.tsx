import { useLayoutEffect, useState, type RefObject } from "react";

// A pencil arrow in the page background: out of the right of the title at 45°, one full loop, a
// wider turn, then one long curve to the rail on the left. Desktop arcs over the title; mobile is
// the same line mirrored, dipping behind the content. It's built from exact pieces placed from the
// title's box, so it stays smooth at any size and a resize simply redraws it.

type Pt = [number, number];

export function PencilArrow({ from }: { from: RefObject<HTMLElement | null> }) {
  const [geo, setGeo] = useState<{ d: string; head: string; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = from.current;
      if (!el) return;
      const w = innerWidth, h = innerHeight;
      // the glyphs' box, not the padded block's
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      const x0 = r.right + 12, cy = r.top + r.height * 0.5;
      const s = Math.max(0.45, Math.min(1, (w - x0 - 12) / 120));
      // the tip sits just right of the resting rail
      const tx = w < 640 ? 44 : 64;
      // Built exactly rather than through waypoints: a straight lead-in at 45°, a true circle for
      // the loop, a turn twice its size tangent at the same point, then one long curve into the
      // rail. Each piece leaves in the direction the next arrives, all of it turns the same way, and
      // nothing is tighter than the loop, so there's no corner or wiggle to see. Desktop climbs and
      // crests over the title; mobile is the same line mirrored, dipping under the content instead.
      const flip = w < 640;
      const Y = (y: number) => (flip ? 2 * cy - y : y);  // the mirror, about the title's middle
      const sweep = flip ? 1 : 0;                         // mirroring reverses the arcs' direction
      const f = (n: number) => n.toFixed(1);
      const R = 30 * s;                                   // loop radius
      const tip: Pt = [tx, cy + 6];
      const q = Math.SQRT1_2;
      // a circle point at angle θ (screen coords); travelling with θ decreasing turns anticlockwise
      const on = (c: Pt, rad: number, deg: number): Pt =>
        [c[0] + rad * Math.cos((deg * Math.PI) / 180), c[1] + rad * Math.sin((deg * Math.PI) / 180)];
      // the lead-in leaves the title at 45° to the loop's lower right (θ = 45°), where the loop is
      // heading the same way
      const start: Pt = [x0 + 16 * s, cy + 12 * s];
      const lead = 44 * s;
      const e: Pt = [start[0] + lead * q, start[1] - lead * q];
      const loopC: Pt = [e[0] - R * q, e[1] - R * q];
      const opp = on(loopC, R, 45 - 180);
      // the turn: a circle twice the loop's size tangent at the same point, so the loop hands
      // straight over to it; from θ = 45° to −60°, where it's heading away at 30° from level
      const turnR = 2 * R;
      const turnC: Pt = [e[0] - turnR * q, e[1] - turnR * q];
      const [kx, ky] = on(turnC, turnR, -60);
      // then one long curve that keeps going, crests, and comes into the rail at 28°. Its controls
      // sit on the two tangent lines, so it bends one way only
      const dist = Math.hypot(kx - tip[0], ky - tip[1]);
      const up = 0.38 * dist, down = 0.34 * dist, a28 = (28 * Math.PI) / 180;
      const c3y = ky - up * Math.sin(Math.PI / 6);
      const c3: Pt = [kx - up * Math.cos(Math.PI / 6), flip ? c3y : Math.max(12, c3y)];
      const c4: Pt = [tip[0] + down * Math.cos(a28), tip[1] - down * Math.sin(a28)];
      const P = (p: Pt) => `${f(p[0])} ${f(Y(p[1]))}`;
      const d = [
        `M ${P(start)}`,
        `L ${P(e)}`,
        // the loop: once round, back to where it came in
        `A ${f(R)} ${f(R)} 0 0 ${sweep} ${P(opp)}`,
        `A ${f(R)} ${f(R)} 0 0 ${sweep} ${P(e)}`,
        // straight on into the bigger turn, then the long curve to the rail
        `A ${f(turnR)} ${f(turnR)} 0 0 ${sweep} ${P([kx, ky])}`,
        `C ${P(c3)} ${P(c4)} ${P(tip)}`,
      ].join(" ");
      const pts: Pt[] = [[c4[0], Y(c4[1])], [tip[0], Y(tip[1])]];
      // arrowhead: two strokes back along the last stretch
      const [px, py] = pts[pts.length - 2], [ex, ey] = pts[pts.length - 1];
      const len = Math.hypot(px - ex, py - ey), ux = (px - ex) / len, uy = (py - ey) / len;
      const rot = (a: number) => [ux * Math.cos(a) - uy * Math.sin(a), ux * Math.sin(a) + uy * Math.cos(a)];
      const [lx, ly] = rot(0.5), [rx, ry] = rot(-0.45), H = 13;
      const head = `M ${ex + lx * H} ${ey + ly * H} L ${ex} ${ey} L ${ex + rx * (H + 2)} ${ey + ry * (H + 2)}`;
      setGeo({ d, head, w, h });
    };
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    measure();
    addEventListener("resize", onResize);
    document.fonts?.ready.then(measure);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", onResize); };
  }, [from]);

  if (!geo) return null;
  return (
    <svg className="pencil" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
      <defs>
        {/* graphite: a little wobble, then grain eaten out of the stroke */}
        <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4" result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="line" />
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="9" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -2.4 0 0 0 1.9" result="mask" />
          <feComposite in="line" in2="mask" operator="in" />
        </filter>
      </defs>
      <g filter="url(#pencil)" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        <path className="pencil-line" d={geo.d} pathLength={1} strokeWidth={1.7} opacity={0.9} />
        {/* the second, lighter pass a pencil leaves */}
        <path className="pencil-line" d={geo.d} pathLength={1} strokeWidth={1} opacity={0.35} transform="translate(0.8 0.6)" />
        <path className="pencil-head" d={geo.head} strokeWidth={1.8} opacity={0.9} />
      </g>
    </svg>
  );
}
