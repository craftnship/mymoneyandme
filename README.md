# My Money & Me

Free financial education for India at [mymoneyandme.in](https://mymoneyandme.in): a public article feed, a learning hub for adults, kids and women, 60 calculators, and a financial health check-up that returns a prioritised plan.

Built and run by one person with AI-assisted development. The product requirements live in `docs/feature-requirements.md`; delivery follows the phases in its section 20. See `docs/architecture.md` for how the code is organised, `docs/roadmap.md` for what each phase ships and `docs/deployment.md` for the Hostinger setup.

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

## What is here (Phase 1, public site, member app slice)

- **Next.js 16 app, TypeScript, Tailwind v4**, server-rendered public pages with Cache Components.
- **Internationalised routing** (`/en/...`, `/ta/...`) with next-intl; English is the source language, Tamil ships now, the other seven launch languages are one messages file each (`src/i18n/routing.ts`).
- **India rule pack** (`rulepacks/india-2025-26.v1.json`): tax slabs, scheme rates, insurance norms, scoring weights and bands, inflation and return defaults. Validated with zod on load; every calculator and check-up result records the version used.
- **Calculator engine** (`src/lib/calculators`): formula families plus JSON-shaped definitions for 60 calculators across 9 groups. Live recalculation, sliders, shareable URLs, year-by-year tables, SVG charts, lakh/crore or international grouping.
- **Check-up engine** (`src/lib/checkup`): eight weighted dimensions scored from declarative bands, life-stage weight adjustments, confidence indicator, and a plan builder that follows the fixed priority sequence. Exposed as the public 5-question quick check at `/check-up` via `POST /api/checkup/quick`.
- **Content store**: articles, 29 learning-hub modules and news in MySQL, seeded from the JSON files in `content/` (which the site falls back to when the database is not available), with per-language translations, publish states, AI-draft labels and fallback rules. Four articles and 22 chapters (the first three modules of each track) have full bodies in English and Tamil; the rest are listed as coming soon.
- **Article search and category filters** as plain query-string state, so filtered views are shareable and work without JavaScript.
- **Newsletter** sign-up with double opt-in from the site's own mailbox; subscribers in MySQL behind a store interface (`src/lib/newsletter`). See `docs/deployment.md` for the variables.
- **Member app** (`/app`): accounts with passkeys, encrypted financial data for a household, the full eight-dimension check-up with history, goals, the prioritised plan checklist, settings with sessions, consents, export and deletion. See `docs/deployment.md` for `DATA_ENCRYPTION_KEY`.
- **SEO**: per-language sitemap, hreflang alternates, Article JSON-LD, robots, PWA manifest, secure headers.

## Not yet built

Household invites, CSV import and document uploads in the member app, Google and Apple sign-in, one-click Tamil AI drafts and reviewer roles in the authoring console, the admin console, donations, notifications, and the remaining seven languages. `docs/roadmap.md` lists them in order with what each needs.

## Editing content

Articles, chapters, modules and news are all edited in the authoring console at `/en/admin`. It shows every item with its language states.

- Articles and chapters: English and Tamil side by side, blocks that stay in step across languages (quizzes included), a preview per language, and a publish check that refuses empty text or a Tamil copy whose blocks differ from the source. Articles also take a cover image.
- Modules: title and summary per language, difficulty and hours, chapter order, and "Add chapter". A chapter's web address is fixed after its first save; a chapter that is not published in any language can be removed.
- News: date, category, source name and link, and a title and summary per language. Every language with a title is live on save; news can be removed from the site.

- Everywhere: an image block (upload once, alt text and an optional caption per language), "Publish at" to schedule a language for a later time (India time), an "out of date" flag on a translation when the source text changes after it, and a history of saved versions with what changed since and "Restore this version".
- "Export all content" on the overview downloads everything, drafts included, as one JSON file in the same shape as `content/`.

A save is live on the site at once and kept as a revision. Access needs a staff role (`ADMIN_EMAILS` grants `admin` to a verified account, see `docs/deployment.md`) and a session started with a passkey. The JSON files under `content/` are only the seed and fallback now: each deploy copies changed files into the database, except for items edited in the console, so edit there rather than in the files. `{placeholders}` such as `{section_80c_limit}` resolve against the rule pack at render time.

- Add a calculator: add a definition to `src/lib/calculators/definitions.ts` (or a new formula family in `formulas.ts`) and names/labels to `messages/en.json`.
- Change a rate or limit: edit the rule pack (or copy it to a new version with a new `effectiveFrom`).
- Add a language: add `messages/<code>.json`, flip `enabled` in `src/i18n/routing.ts`.
