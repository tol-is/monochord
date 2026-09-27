import { useLayoutEffect, useState, type RefObject } from "react";

// A pencil arrow in the page background: out of the right of the title, one full loop, then an
// arc back over the title and down to the rail on the left edge. Placed from the title's box, so
// it follows the layout; the loop shrinks when there's little room right of the title.
export function PencilArrow({ from }: { from: RefObject<HTMLElement | null> }) {
  const [geo, setGeo] = useState<{ d: string; head: string; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = from.current;
      if (!el) return;
      const w = innerWidth, h = innerHeight;
      // the glyphs' right edge, not the padded block's
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      const x0 = r.right + 14, cy = r.top + r.height * 0.55;
      const s = Math.max(0.45, Math.min(1, (w - x0 - 12) / 130));
      const P = (dx: number, dy: number) => `${(x0 + dx * s).toFixed(1)} ${(cy + dy * s).toFixed(1)}`;
      // the tip sits just right of the resting rail, level with the title
      const tx = w < 640 ? 44 : 64, ty = cy + 6;
      // the arc clears the title with room to spare, even when the loop is scaled down
      const top = Math.max(24, r.top - Math.max(100, 110 * s));
      const d = [
        `M ${P(0, 4)}`,
        // out and up into the loop
        `C ${P(40, 10)} ${P(96, -8)} ${P(98, -46)}`,
        // over the top and back down: the loop closes across its own stroke
        `C ${P(100, -86)} ${P(44, -92)} ${P(40, -58)}`,
        `C ${P(36, -26)} ${P(92, -18)} ${P(112, -50)}`,
        // a long arc back over the title
        `C ${P(128, -76)} ${Math.max(x0 + 90 * s, w / 2 + 40).toFixed(1)} ${top.toFixed(1)} ${(w / 2).toFixed(1)} ${top.toFixed(1)}`,
        // down the left side, coming in nearly level so it points at the rail
        `C ${(w / 2 - Math.max(40, (w / 2 - tx) * 0.45)).toFixed(1)} ${top.toFixed(1)} ${(tx + 64).toFixed(1)} ${(ty - 26).toFixed(1)} ${tx} ${ty}`,
      ].join(" ");
      // arrowhead: two strokes back along the last tangent
      const ax = 64, ay = -26, len = Math.hypot(ax, ay);
      const ux = ax / len, uy = ay / len, L = 14;
      const rot = (a: number) => [ux * Math.cos(a) - uy * Math.sin(a), ux * Math.sin(a) + uy * Math.cos(a)];
      const [lx, ly] = rot(0.5), [rx, ry] = rot(-0.45);
      const head = `M ${tx + lx * L} ${ty + ly * L} L ${tx} ${ty} L ${tx + rx * (L + 2)} ${ty + ry * (L + 2)}`;
      setGeo({ d, head, w, h });
    };
    measure();
    addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => removeEventListener("resize", measure);
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
