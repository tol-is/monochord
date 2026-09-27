import { useLayoutEffect, useState, type RefObject } from "react";

// A pencil arrow in the page background: out of the right of the title, one full loop, then to the
// rail on the left. Desktop arcs over the title; mobile U-turns and runs behind the content. The route is a handful of waypoints placed from the
// title's box, joined by one centripetal Catmull-Rom spline, so the curve stays smooth at any size and a
// resize simply redraws it. The loop shrinks when there's little room right of the title.

type Pt = [number, number];

// centripetal Catmull-Rom through the points, as cubic Béziers: unlike the uniform kind it
// doesn't overshoot where short steps meet long ones, so no hooks or cusps (ends padded by repetition)
const spline = (pts: Pt[]) => {
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const dist = (p: Pt, q: Pt) => Math.sqrt(Math.hypot(q[0] - p[0], q[1] - p[1]));
  const f = (n: number) => n.toFixed(1);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const d1 = dist(p0, p1), d2 = dist(p1, p2), d3 = dist(p2, p3);
    const c1: Pt = d1 < 1e-6 ? p1 : [0, 1].map((k) =>
      (d1 * d1 * p2[k] - d2 * d2 * p0[k] + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1[k]) / (3 * d1 * (d1 + d2))) as Pt;
    const c2: Pt = d3 < 1e-6 ? p2 : [0, 1].map((k) =>
      (d3 * d3 * p1[k] - d2 * d2 * p3[k] + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2[k]) / (3 * d3 * (d3 + d2))) as Pt;
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
};

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
      let pts: Pt[], d: string;
      if (w >= 640) {
        // desktop, built exactly rather than through waypoints: a straight lead-in, a true circle
        // for the loop, a turn twice its size that carries it up and away, then one long curve that
        // crests and comes down into the rail. Each piece leaves in the direction the next arrives, all of it turns the same
        // way, and nothing is tighter than the loop itself, so there's no corner or wiggle to see.
        const top = Math.max(24, r.top - 96);
        const f = (n: number) => n.toFixed(1);
        const R = 30 * s;                                   // loop radius
        const bx = x0 + 50 * s, by = cy;                    // bottom of the loop: in and out, heading right
        const tip: Pt = [tx, cy + 6];
        // the turn: up the right side of a circle twice the loop's size, stopping 150° round while
        // it's still climbing (heading up and left, 30° above level)
        const turnR = (by - top) / 2;
        const ty0 = by - turnR;                             // turn centre y (x is bx)
        const ex = bx + turnR * Math.cos(-Math.PI / 3), ey = ty0 + turnR * Math.sin(-Math.PI / 3);
        // then one long curve that keeps climbing, crests, and comes down into the rail heading left
        // and down at 28°. Its controls sit on the two tangent lines, so it bends one way only
        const dist = Math.hypot(ex - tip[0], ey - tip[1]);
        const up = 0.38 * dist, down = 0.34 * dist, a28 = (28 * Math.PI) / 180;
        const c3: Pt = [ex - up * Math.cos(Math.PI / 6), Math.max(12, ey - up * Math.sin(Math.PI / 6))];
        const c4: Pt = [tip[0] + down * Math.cos(a28), tip[1] - down * Math.sin(a28)];
        d = [
          `M ${f(x0)} ${f(cy)}`,
          `L ${f(bx)} ${f(by)}`,
          // the loop: up the right side and over, then back down to where it came in
          `A ${f(R)} ${f(R)} 0 0 0 ${f(bx)} ${f(by - 2 * R)}`,
          `A ${f(R)} ${f(R)} 0 0 0 ${f(bx)} ${f(by)}`,
          // out of the loop still heading right, round and up, then over and down
          `A ${f(turnR)} ${f(turnR)} 0 0 0 ${f(ex)} ${f(ey)}`,
          `C ${f(c3[0])} ${f(c3[1])} ${f(c4[0])} ${f(c4[1])} ${f(tip[0])} ${f(tip[1])}`,
        ].join(" ");
        pts = [c4, tip];
      } else {
      // mobile: one rotation throughout, clockwise: out to the right, a full loop, then a wide
      // U-turn that ends heading left behind the content, so the line never doubles back
      const arc = (cx: number, cy2: number, rx: number, ry: number, from: number, to: number, step = 45): Pt[] => {
        const out: Pt[] = [];
        for (let a = from; a <= to + 0.01; a += step) {
          const t = (a * Math.PI) / 180;
          out.push([cx + rx * Math.cos(t), cy2 + ry * Math.sin(t)]);
        }
        return out;
      };
      const R = 24 * s;                                 // the loop hangs from the line
      const loopX = x0 + 36 * s;                         // its top, where the line enters and leaves
      const bottom = r.bottom + 40;                      // the run to the rail, behind the description
      const turnX = x0 + 70 * s, turnY = (cy + bottom) / 2; // the U-turn's centre
      pts = [
        [x0, cy],
        [x0 + 18 * s, cy],
        ...arc(loopX, cy + R, R, R, -90 + 45, 270 - 45),  // clockwise, back up to the top
        [loopX + 14 * s, cy - 1],
        ...arc(turnX, turnY, Math.max(30, 44 * s), (bottom - cy) / 2, -60, 90, 30),
        [(r.left + r.right) / 2, bottom + 4],
        [tx, bottom - 14],
      ];
      d = spline(pts);
      }
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
