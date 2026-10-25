# Architecture

A modular monolith in one Next.js app (feature doc section 18). The engines are plain TypeScript modules with no framework imports so they can be tested in isolation and, later, moved behind the API without change.

```
src/
  app/[locale]/           public pages; every route is under the language segment
    page.tsx              home: hero article, latest feed, tracks, featured calculators
    articles/             feed and article pages
    learn/                hub → track → module → chapter
    calculators/          index and per-calculator pages (shareable inputs via query string)
    check-up/             public 5-question quick check
    legal/[page]/         disclaimer, privacy, terms, grievance, accessibility
  app/api/
    calculators/[slug]    GET definition, POST inputs → result with rule-pack version
    checkup/quick         POST answers → score, dimensions, plan
  i18n/                   routing (locales, prefix), request config (messages, formats), navigation
  lib/
    rulepack/             zod schema, loader, {placeholder} resolution
    calculators/          math.ts (shared finance maths), tax.ts (slabs, HRA), formulas.ts
                          (formula families), definitions.ts (60 JSON-shaped calculators), index.ts (runner)
    checkup/              engine.ts (metrics + declarative scoring), plan.ts (priority checklist)
    content/              types.ts (blocks, translations), store.ts (cached reads, fallback rules),
                          json.ts (the /content files), rows.ts + db.ts (database tables, JSON sync),
                          source.ts (database first, files as fallback), schema.ts + editing.ts
                          (console validation and language-mirrored edits), admin.ts + actions.ts (saves)
    media/                image checks and the media table behind /media/<id>
    auth/                 sessions, passwords, passkeys; roles.ts + admin.ts (authoring console access)
    format.ts             INR formatting, lakh/crore vs international grouping
  components/             server components for layout/content, client components for calculators,
                          quiz, quick check, language switcher
content/                  articles/*.json, modules/<track>/*.json
rulepacks/                versioned India parameter packs
messages/                 UI strings per locale (ICU MessageFormat); English is the base, others overlay it
```

## Key decisions

- **Rule pack is data.** Scoring weights, bands, tax tables and defaults are JSON validated at load. Engine code never hard-codes a rate. A Budget change is a new pack version with an `effectiveFrom`; old results keep their version string.
- **Calculators are definitions + formula families.** A definition lists inputs (with rule-pack references for defaults), outputs and a chart kind; it names a formula family. New calculators in an existing family need no code. Formulas run in the browser for instant feedback and on the server for saved results, from the same module.
- **Scores are computed on the server.** Clients post a snapshot to `/api/checkup/*` and receive a result stamped with the rule-pack version (section 18). The quick check is the same engine with defaults for missing fields and a low confidence label.
- **Content is one source, many labelled translations.** A translation carries `state`, `aiDraft` and `outOfDate`. Readers see their language when published, else the source with a banner; modules list as fully translated only when every published chapter exists in that language.
- **Content lives in the database, the files are the seed and the fallback.** Every process syncs `/content` into the `content_items` and `content_translations` tables on its first read: new files are added, changed files replace their rows, removed files archive them. Rows edited in the authoring console (`origin = 'admin'`) are never overwritten by a file. Reads go through one `"use cache"` snapshot tagged `content` (5-minute revalidation as the backstop); a publish clears the tag. Without `DATABASE_URL`, or when MySQL is down, the site serves the files.
- **The authoring console is staff-only and passkey-only.** `/[locale]/admin` checks the `users.role` (`admin` or `editor`) and that the session was started with a passkey, on the server for every page and action. `ADMIN_EMAILS` promotes a verified account to `admin`; members get a 404.
- **Language is the only locale dimension.** Currency INR, financial year April–March, Indian number grouping by default with a per-visitor toggle.
- **Static where possible.** Cache Components prerender every public page per locale; only the shareable calculator inputs (query string), the member app, the authoring console and the API routes are request-time.

## Conventions

- UI strings live in `messages/en.json`; a locale file overrides keys it has and inherits the rest.
- Calculator labels are shared keys under `calc.labels`, so one translation covers every calculator using that input.
- Tests sit next to the code (`*.test.ts`) and run with vitest. Reference cases in `calculators.test.ts` pin published figures (SIP, EMI, FD, tax).
- Dates in content are ISO strings; amounts are numbers in rupees; rates are decimals.
