# monochord

A navigation rail you can pluck. A vertical index drawn as a single string: bring the pointer to the
left edge and the ticks spread apart under it, labels resolving as they swell. Press and drag to scrub,
tap to jump. Each pluck rings a short span of string in place, in its first three modes, so
taps, scrubs, value changes and scrolling set the ticks vibrating off a still line.

**[monochord-ui.vercel.app](https://monochord-ui.vercel.app)** · [AGENTS.md](AGENTS.md) for coding agents

Composable parts built on [Base UI](https://base-ui.com)'s `useRender`, for React 19.

## Install

```sh
npm i monochord
```

## Usage

```tsx
import { Monochord } from "monochord";

<Monochord.Root className="rail" value={page} onValueChange={(v) => setPage(v)}>
  <Monochord.String />
  {pages.map((p) => (
    <Monochord.Item key={p.id} value={p.id}>
      <Monochord.Label>{p.title}</Monochord.Label>
    </Monochord.Item>
  ))}
</Monochord.Root>
```

```css
.rail { position: fixed; top: 0; left: 0; width: 420px; height: 100dvh; color: white; }
```

## Parts

### `Root`

Owns the value and the physics. Renders a `<nav>`, or your own element via `render`. Give it a size and
position; the string fills it. Arrow keys, Home and End move focus between items.

| Prop | Type | |
| --- | --- | --- |
| `value` / `defaultValue` | `string` | controlled / uncontrolled current item |
| `onValueChange` | `(value, { source }) => void` | `source` is `"tap"`, `"scrub"` or `"keyboard"` |
| `onTickCross` | `(index, event) => void` | each tick crossed or chosen; see [Tick events](#tick-events) |
| `reach` | `number` | px right of the string that opens the fisheye (240, or 60 under 400px wide) |
| `magnify` | `number` | extra spacing at the focus, in ticks (7) |
| `spread` | `number` | fisheye width, in ticks (5.5) |
| `labelRoom` | `number` | px a label needs from its neighbours to open (its font size − 3) |
| `trackWidth` | `number` | px width of the press/scrub strip at rest (56, or 40 under 400px wide) |
| `handle` | `Ref<{ kick(velocity) }>` | a light pluck at the current tick from scroll velocity (delta × 3), at most every 120 ms |

### `String`

The canvas (string, ticks, current marker) plus the invisible strip that takes presses and scrubs.
Drawn in the element's CSS `color`. `trackProps` go to the strip.

### `Item`

One entry. A `<button>` by default; `render` swaps in your own element, e.g.
`render={<a href="/page" />}`, or a function `(props, { active }) => …`. The engine sets
its `transform` and `opacity`; style everything else through:

- `data-state="open" | "closed"`: whether its label is revealed
- `data-highlighted`: nearest the pointer or keyboard focus
- `data-active`, `aria-current`: the current value
- `--monochord-reveal`: 0 to 1 emphasis while open

### `Sound`

Plays a note per tick; renders nothing. See [Sound](#sound).

### `Label`

The visible text of an item: a plain `<span>` (or your element via `render`), styled however you like.
Optional; an item can hold anything.

## Styling

No stylesheet to import. Each part carries only the inline styles it needs to work (positioning,
the strip's hit area, a plain button reset), and the engine drives each item's transform, opacity
and reveal every frame. Everything else is yours:

- Style state through the data attributes: `data-state="open" | "closed"`, `data-highlighted`,
  `data-active`, plus `--monochord-reveal` (0–1) for emphasis.
- `Item` takes `className` and `style` as values or, Base UI style, as functions of its state:
  `className={(s) => (s.active ? "on" : undefined)}`.
- The string, ticks and marker draw in the `String` canvas's CSS `color`; labels inherit the
  `Root`'s font and colour.
- Motion respects `prefers-reduced-motion`.

## Sound

Silent by default. Add a `Sound` part to give each tick a note:

```tsx
<Monochord.Root>
  <Monochord.String />
  <Monochord.Sound context={audioCtx} muted={!soundOn} />
  …
</Monochord.Root>
```

Create the `AudioContext` on a user gesture (browsers block audio until then); nothing plays while
`context` is missing. The default is a pulse: every tick A4, decade ticks (0, 10, 20…) a low D, as a
soft, short sine with a quiet octave under it and a faint dark echo. Every part of it is a prop:

| Prop | Default | |
| --- | --- | --- |
| `pitch` | `pulse("A4", "D3")` | `(index, event) => Hz`; return `null` for silence |
| `voices` | `[[1, 1], [0.5, 0.45]]` | `[multiple of the pitch, level]` per oscillator |
| `wave` | `"sine"` | any `OscillatorType` |
| `attack` / `decay` | `0.006` / `0.035` | seconds (decay is a time constant) |
| `volume` | `0.06` | peak level at strength 1 |
| `echo` | `{ time: 0.23, feedback: 0.25, wet: 0.15, cutoff: 1300 }` | or `false` for a dry note |
| `destination` | `context.destination` | route into your own mixer |
| `kinds` | all | which ticks sound: `"hover"`, `"scrub"`, `"tap"`, `"keyboard"` |
| `muted` | `false` | |

Pitch presets:

```ts
import { pulse, scale, note } from "monochord";

pulse("A4", "D3")                                  // one note, decades marked by another
scale("D3", "minor")                               // each decade falls from high to D3, then starts again
scale("A3", "pentatonic", { per: 15, direction: "up" })  // climbs; also major, dorian, chromatic, or your own intervals
note("C4")                                         // every tick the same
(i, e) => (e.kind === "tap" ? 880 : null)          // your own: sound only on taps
```

Without the part, `createBlip(ctx, options)` returns a `play(index, event)` function with the same
options (plus `.set(options)` and `.dispose()`), for `onTickCross` or code outside React.

### Tick events

`onTickCross(index, event)` fires for every tick crossed or chosen. `event.kind` says why (`"hover"`,
`"scrub"`, `"tap"`, `"keyboard"`), `event.strength` is a loudness hint (0.5, 1, 1.4, 1.4), and
`event.decade` marks multiples of ten. Use it for your own sound, haptics (`navigator.vibrate`) or
analytics.

## Without React

`createEngine(rootEl, options)` is the framework-free core: it positions any elements you hand it with
`setItems`, draws on a canvas passed to `attach`, and reports selections through `onSelect`.

## Demo

`npm run dev`. A single page with a rail of a hundred famous typefaces, oldest first, from Jenson (1470)
to Söhne (2019), and five sound voices to try: Pulse, Fall, Climb, Glass and Click.

MIT © Apostolos Christodoulou
