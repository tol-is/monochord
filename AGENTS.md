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
`<Monochord.Item value="docs" render={<a href="/docs" />} />`, or a function
`render={(props, { active }) => <a {...props} href="/docs" />}`. An item can hold anything;
`Label` is just a convenient `<span>`.

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
| `handle` | `Ref<MonochordHandle>` (`{ kick(velocity: number): void }`) | a light pluck at the current tick from scroll: `kick(scrollDelta * 3)`; rate-limited to every 120 ms |

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
- Motion respects `prefers-reduced-motion`.

## Sound

```tsx
const [ctx, setCtx] = useState<AudioContext | null>(null);
// browsers block audio until a gesture: create or resume the context in a click/keydown handler
<Monochord.Sound context={ctx} muted={!on} />
```

Nothing plays while `context` is null. The default is a pulse: every tick A4, decade ticks
(0, 10, 20…) D3, as a soft, short sine with a quiet octave under it and a faint dark echo.
All props are optional:

| Prop | Default | |
| --- | --- | --- |
| `context` | | `AudioContext \| null`; silent while null |
| `pitch` | `pulse("A4", "D3")` | `(index, event) => Hz`; return `null` for silence |
| `voices` | `[[1, 1], [0.5, 0.45]]` | `[multiple of the pitch, level]` per oscillator |
| `wave` | `"sine"` | any `OscillatorType` |
| `attack` / `decay` | `0.006` / `0.035` | seconds (decay is a time constant) |
| `volume` | `0.06` | peak level at strength 1 |
| `echo` | `{ time: 0.23, feedback: 0.25, wet: 0.15, cutoff: 1300 }` | partial objects merge with the default; `false` for a dry note |
| `destination` | `context.destination` | route into your own mixer |
| `kinds` | all | which ticks sound: `"hover"`, `"scrub"`, `"tap"`, `"keyboard"` |
| `muted` | `false` | |

Pitch presets:

```ts
import { pulse, scale, note, hz, MODES } from "monochord";

pulse("A4", "D3")                                        // one note, decades marked by another
scale("D3", "minor")                                     // each decade falls from high to D3, then repeats
scale("A3", "pentatonic", { per: 15, direction: "up" })  // climbs; per = ticks per cycle (default 10)
note("C4")                                               // every tick the same
(i, e) => (e.kind === "tap" ? 880 : null)                // your own: sound only on taps
hz("A4")                                                 // 440; takes a note name ("C#4", "Bb3") or Hz
```

Modes (`MODES`): `major`, `minor`, `dorian`, `pentatonic`, `majorPentatonic`, `chromatic`, or your
own semitone interval array such as `[0, 2, 5, 7]`.

Outside the part: `createBlip(ctx, options)` takes the same options and returns a
`play(index, event?)` function with `.set(options)` and `.dispose()`, for `onTickCross` or code
outside React.

### Tick events

`onTickCross(index, event)` fires for every tick crossed or chosen. `event.kind` says why
(`"hover"`, `"scrub"`, `"tap"`, `"keyboard"`), `event.strength` is a loudness hint (hover 0.5,
scrub 1, tap 1.4, keyboard 1.4; also exported as `tickStrength`), and `event.decade` is true for
multiples of ten. Use it for your own sound, haptics (`navigator.vibrate`) or analytics.
`tickEvent(index, kind)` builds one.

## Without React

`createEngine(rootElement, options)` is the framework-free core. Options are `reach`, `magnify`,
`spread`, `labelRoom`, `trackWidth` (as on `Root`), plus `onSelect(index, source)` (required) and
`onCross(index, kind)`. It positions the elements you give it and draws the canvas every frame.

| Method | |
| --- | --- |
| `attach(canvas, strip)` | the canvas to draw on and the element that takes presses and scrubs |
| `setItems(elements)` | item elements in display order |
| `setCurrent(index)` | the current item |
| `setKeyFocus(index)` | open the fisheye around an item for keyboard focus; `-1` releases it |
| `setOptions(options)` | replace the options |
| `kick(velocity)` | pluck from scroll, as `handle.kick` |
| `pluck(index, amplitude, halfWidth)` | ring a span of string at a tick (px) |
| `destroy()` | stop the loop and remove listeners |

## Common mistakes

- Root with no height: nothing draws.
- Expecting labels for every tick at rest: only the current one shows until the pointer is near.
- Setting `transform`/`opacity` on items: the engine overwrites them every frame.
- Creating an `AudioContext` on mount: it stays suspended until a user gesture.
