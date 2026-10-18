# My Money & Me

Free financial education for India at [mymoneyandme.in](https://mymoneyandme.in): a public article feed, a learning hub for adults, kids and women, 60 calculators, and a financial health check-up that returns a prioritised plan.

Built and run by one person with AI-assisted development. The product requirements live in `docs/feature-requirements.md`; delivery follows the phases in its section 20. See `docs/architecture.md` for how the code is organised and `docs/roadmap.md` for what each phase ships.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000 → redirects to /en
pnpm test         # unit tests: calculators, check-up engine, rule pack
pnpm typecheck    # next typegen + tsc
pnpm lint
pnpm build && pnpm start
```

Node 22 and pnpm 10.

## What is here (Phase 1 + public site slice)

- **Next.js 16 app, TypeScript, Tailwind v4**, server-rendered public pages with Cache Components.
- **Internationalised routing** (`/en/...`, `/ta/...`) with next-intl; English is the source language, Tamil ships now, the other seven launch languages are one messages file each (`src/i18n/routing.ts`).
- **India rule pack** (`rulepacks/india-2025-26.v1.json`): tax slabs, scheme rates, insurance norms, scoring weights and bands, inflation and return defaults. Validated with zod on load; every calculator and check-up result records the version used.
- **Calculator engine** (`src/lib/calculators`): formula families plus JSON-shaped definitions for 60 calculators across 9 groups. Live recalculation, sliders, shareable URLs, year-by-year tables, SVG charts, lakh/crore or international grouping.
- **Check-up engine** (`src/lib/checkup`): eight weighted dimensions scored from declarative bands, life-stage weight adjustments, confidence indicator, and a plan builder that follows the fixed priority sequence. Exposed as the public 5-question quick check at `/check-up` via `POST /api/checkup/quick`.
- **Content store** (`content/`): articles and 29 learning-hub modules as JSON with per-language translations, publish states, AI-draft labels and fallback rules. Four articles and five chapters have full bodies; the rest are listed as coming soon.
- **SEO**: per-language sitemap, hreflang alternates, Article JSON-LD, robots, PWA manifest, secure headers.

## Not yet built

Accounts and the member app (Phase 3), the authoring and admin consoles, the database, donations, notifications, and the remaining seven languages. `docs/roadmap.md` lists them in order with what each needs.

## Editing content

- Add an article: new JSON file in `content/articles/` following an existing one. `{placeholders}` such as `{section_80c_limit}` resolve against the rule pack at render time.
- Add a chapter body: edit the module file in `content/modules/<track>/`, set the translation `state` to `published`.
- Add a calculator: add a definition to `src/lib/calculators/definitions.ts` (or a new formula family in `formulas.ts`) and names/labels to `messages/en.json`.
- Change a rate or limit: edit the rule pack (or copy it to a new version with a new `effectiveFrom`).
- Add a language: add `messages/<code>.json`, flip `enabled` in `src/i18n/routing.ts`.
