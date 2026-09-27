// the snippets on the landing page; highlighted at build time (see vite.config.ts)
export const INSTALL = `npm i monochord`;

export const USAGE = `import { Monochord } from "monochord";

<Monochord.Root value={page} onValueChange={setPage}>
  <Monochord.String />
  <Monochord.Sound context={audioCtx} />
  {pages.map((p) => (
    <Monochord.Item key={p.id} value={p.id}>
      <Monochord.Label>{p.title}</Monochord.Label>
    </Monochord.Item>
  ))}
</Monochord.Root>`;
