# ITL Curation Web

## Code style

Prettier is the formatting source of truth for the whole repo (both `apps/api` and `apps/web`), configured once at the root (`.prettierrc.json`) rather than per workspace.

- Run `npm run format` before committing; `npm run format:check` verifies without writing (useful in CI later).
- `printWidth` is raised to `100` (from Prettier's default 80) because this is a React codebase with deep JSX nesting (`Card > CardHeader > CardTitle`, `Dialog > DialogContent > form > ...`) that wraps awkwardly at 80 columns.
- `prettier-plugin-tailwindcss` is enabled, so `className` strings are auto-sorted into Tailwind's canonical order on every format — don't hand-order utility classes.
- Every other setting is Prettier's own default (`singleQuote: true` and `trailingComma: "all"` are explicit for clarity, but already match the defaults as of Prettier 3.x).
- `apps/web/src/components/ui/**` (shadcn-managed) is excluded via `.prettierignore`. Those files are regenerated verbatim by the shadcn CLI in its own style (double quotes, no semicolons) — don't hand-edit them for style, and don't fight the CLI's output on the next `npx shadcn add`.

A one-time repo-wide reformat was applied when Prettier was formalized as the standard; its commit SHA is recorded in `.git-blame-ignore-revs` so it doesn't show up in blame. Run `git config blame.ignoreRevsFile .git-blame-ignore-revs` once locally to have `git blame` skip it (GitHub's own blame view picks this file up automatically).
