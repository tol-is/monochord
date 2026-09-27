# monochord: notes for coding agents

A vertical index navigation for React 19: a canvas string on the left edge whose ticks spread
apart (fisheye) near the pointer, with labels beside them. Press and drag to scrub, tap to jump.
Composable parts on Base UI's `useRender`. No stylesheet. MIT.

Demo: https://monochord-ui.vercel.app · Source: https://github.com/tol-is/monochord

## Install

```sh
npm i monochord
```

Peer deps: `react` and `react-dom` 19+. Ships ESM only, marked `"use client"`.

## Minimal use

```tsx
import { Monochord } from "monochord";

function Rail({ pages, page, setPage }) {
  return (
    <Monochord.Root
      value={page}
      onValueChange={(value) => setPage(value)}
      style={{ position: "fixed", top: 0, left: 0, width: 420, height: "100dvh", color: "white" }}
    >
      <Monochord.String />
      {pages.map((p) => (
        <Monochord.Item key={p.id} value={p.id}>
          <Monochord.Label>{p.title}</Monochord.Label>
        </Monochord.Item>
      ))}
    </Monochord.Root>
  );
}
```

Rules that matter:

- **Give `Root` a size and position.** The string fills it. ~420px wide and full height is typical;
  the root ignores pointer events, only the strip and open labels take them, so it can overlay content.
- **`Item` values are strings** and must be unique. Order on the string is document order.
- **Colour:** the string draws in the `String` canvas's CSS `color` (inherited from `Root`); labels
  inherit the root's font and colour.
- **No CSS import.** Don't look for `monochord/styles.css`; it doesn't exist.

## Parts

| Part | Renders | Notes |
| --- | --- | --- |
| `Root` | `<nav>` | State, physics, keyboard (↑ ↓ Home End move focus; Enter selects). |
| `String` | `<canvas>` + strip `<div>` | The drawn string, ticks and marker, plus the press/scrub strip. `trackProps` go to the strip. |
| `Item` | `<button>` | One entry, positioned by the engine beside its tick. |
| `Label` | `<span>` | Optional text wrapper inside an `Item`. |
| `Sound` | nothing | Optional note per tick. Omit for a silent rail. |

Every rendering part takes Base UI's `render` prop to swap the element:
`<Monochord.Item value="docs" render={<a href="/docs" />} />`.

### `Root` props

| Prop | Type | Default |
| --- | --- | --- |
| `value` / `defaultValue` | `string` | controlled / uncontrolled |
| `onValueChange` | `(value, { source: "tap" \| "scrub" \| "keyboard" }) => void` | |
| `onTickCross` | `(index, { kind, strength, decade }) => void` | fires per tick crossed or chosen |
| `reach` | px right of the string that opens the fisheye | 240 (60 under 400px wide) |
| `magnify` | extra spacing at the focus, in ticks | 7 |
| `spread` | fisheye width, in ticks | 5.5 |
| `labelRoom` | px a label needs from its neighbours to open | label font size − 3 |
| `trackWidth` | px width of the scrub strip at rest | 56 (40 under 400px wide) |
| `handle` | `Ref<{ kick(velocity: number): void }>` | pluck from scroll: `kick(scrollDelta * 3)` |

Scrubbing calls `onValueChange` on every tick crossed with `source: "scrub"`: navigate instantly
for scrubs and animate for taps.

## Styling

The engine owns each item's `transform`, `opacity` and `z-index` (don't set them). Everything
else is yours:

- Data attributes on `Item`: `data-state="open" | "closed"` (label shown), `data-highlighted`
  (nearest the pointer or keyboard focus), `data-active` + `aria-current` (the current value).
- CSS variable `--monochord-reveal` (0–1) on open items: emphasis. Item text fades with it by default.
- `Item` `className` / `style` accept functions of state: `className={(s) => (s.active ? "on" : "")}`.
- Items carry an inline button reset (font, padding, background, border), which beats classes for
  those properties. Style a child (`Label`) or use the `style` prop instead.
- For readable labels over content, give the `Label` an opaque background.

## Sound

```tsx
const [ctx, setCtx] = useState<AudioContext | null>(null);
// browsers block audio until a gesture: create or resume the context in a click/keydown handler
<Monochord.Sound context={ctx} muted={!on} />
```

Nothing plays while `context` is null. Default voice: every tick A4, decade ticks D3, a short
sine with an octave under and a faint echo. Props (all optional): `pitch`, `voices`, `wave`,
`attack`, `decay`, `volume`, `echo` (object or `false`), `destination`, `kinds`, `muted`.

Pitch presets: `pulse("A4", "D3")`, `scale("D3", "minor", { per: 10, direction: "down" })`,
`note("C4")`, or `(index, event) => hz | null`. Modes: `major`, `minor`, `dorian`,
`pentatonic`, `majorPentatonic`, `chromatic`, or an interval array.

Outside the part: `createBlip(ctx, options)` returns `play(index, event)` with `.set()` and `.dispose()`.

## Without React

`createEngine(rootElement, { onSelect, onCross, ... })` is the framework-free core. Call
`attach(canvas, strip)`, `setItems(elements)`, `setCurrent(index)`; it positions the elements
and draws the canvas every frame. `destroy()` when done.

## Common mistakes

- Root with no height: nothing draws.
- Expecting labels for every tick at rest: only the current one shows until the pointer is near.
- Setting `transform`/`opacity` on items: the engine overwrites them every frame.
- Creating an `AudioContext` on mount: it stays suspended until a user gesture.
