# monochord

A navigation rail you can pluck. A vertical index drawn as a single string: bring the pointer to the
left edge and the ticks spread apart under it, labels resolving as they swell. Press and drag to scrub,
tap to jump. Scrolling, scrubbing and value changes set the string ringing.

Composable parts in the Radix style, for React 19. Extracted from [Stormy Clouds](https://stormyclouds.com).

## Install

```sh
npm i monochord
```

## Usage

```tsx
import { Monochord } from "monochord";
import "monochord/styles.css";

<Monochord.Root className="rail" value={page} onValueChange={(v) => setPage(v)}>
  <Monochord.String />
  {pages.map((p) => (
    <Monochord.Item key={p.id} value={p.id}>
      <Monochord.Scramble>{p.title}</Monochord.Scramble>
    </Monochord.Item>
  ))}
</Monochord.Root>
```

```css
.rail { position: fixed; top: 0; left: 0; width: 420px; height: 100dvh; color: white; }
```

## Parts

### `Root`

Owns the value and the physics. Renders a `<nav>` (or your element with `asChild`). Give it a size and
position; the string fills it. Arrow keys, Home and End move focus between items.

| Prop | Type | |
| --- | --- | --- |
| `value` / `defaultValue` | `string` | controlled / uncontrolled current item |
| `onValueChange` | `(value, { source }) => void` | `source` is `"tap"`, `"scrub"` or `"keyboard"` |
| `onTickCross` | `(index, strength) => void` | each tick crossed; hook sound here |
| `reach` | `number` | px right of the string that opens the fisheye (240, or 60 under 400px wide) |
| `magnify` | `number` | extra spacing at the focus, in ticks (7) |
| `spread` | `number` | fisheye width, in ticks (5.5) |
| `labelRoom` | `number` | px a label needs from its neighbours to open (15) |
| `handle` | `Ref<{ kick(velocity) }>` | pluck the string, e.g. with scroll delta × 3 |

### `String`

The canvas (string, ticks, current marker) plus the invisible strip that takes presses and scrubs.
Drawn in the element's CSS `color`. `trackProps` go to the strip.

### `Item`

One entry. A `<button>` by default; `asChild` renders your own element (a link, say). The engine sets
its `transform`; style everything else through:

- `data-state="open" | "closed"`: whether its label is revealed
- `data-highlighted`: nearest the pointer or keyboard focus
- `data-active`, `aria-current`: the current value
- `--monochord-reveal`: 0 to 1 emphasis while open

### `Scramble`

Text that resolves out of random glyphs whenever its item opens. Screen readers get the plain text.
`speed` (ms per character, 18) and `glyphs`.

## Styling

`monochord/styles.css` holds the structural defaults and a Radix-style reveal, all wrapped in `:where()`
so your classes always win. Custom properties on `Root`: `--monochord-ease`, `--monochord-enter`,
`--monochord-exit`, `--monochord-track-width`.

## Sound

```ts
import { blip } from "monochord";
<Monochord.Root onTickCross={(i, s) => blip(audioCtx, i, s)} />
```

A short triangle blip per tick, climbing a minor pentatonic ladder, so a scrub plays a run.

## Without React

`createEngine(rootEl, options)` is the framework-free core: it positions any elements you hand it with
`setItems`, draws on a canvas passed to `attach`, and reports selections through `onSelect`.

## Demo

`npm run dev`. Four title sets of different lengths and shapes: 181 plate names, 48 cloud types,
18 essay titles, and the 13-step Beaufort scale.

MIT © Apostolos Christodoulou
