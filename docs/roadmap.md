# Roadmap and status

Phases follow section 20 of the feature document. Months are indicative for a solo build; each phase is re-estimated at its gate.

## Phase 1: Foundations — mostly done

| Gate criterion | Status |
| --- | --- |
| Design system with Indic support, RTL-ready | Tokens and layout in place; RTL `dir` wired through the locale table; brand palette is a placeholder until the design language is chosen |
| One article and one chapter in two languages | Done: 50/30/20 article and Budgeting chapter in English and Tamil (AI-draft labelled) |
| Rule-pack format validated with India check-up rules | Done: `rulepacks/india-2025-26.v1.json`, zod schema, 8 dimensions, tests |
| Auth with passkeys | Done in Phase 3: email + password with breach check, email verification, database sessions, passkeys |
| CMS skeleton | Content model and JSON store done; console not started |

## Phase 2: Public site — in progress

| Gate criterion | Status |
| --- | --- |
| Home feed | Done (hero, latest, tracks, featured calculators); article search and category filters done; newsletter sign-up with double opt-in done (sends from hello@mymoneyandme.in over Hostinger SMTP, subscribers in MySQL); the weekly digest sender is pending |
| Learning hub, 3 modules per track in English + one Indian language | Done for the gate: the first three modules of each track (22 chapters) have full English bodies and Tamil AI drafts; the remaining 20 modules are listed as coming soon. A content test enforces that every translation mirrors its source block by block |
| 46 calculators passing reference tests | 60 definitions, all run on defaults; 8 reference cases pinned. Needs more reference cases per family and a review of the simplified NPS, take-home and capital-gains rules |
| WCAG AA audit, Core Web Vitals | axe-core WCAG 2.1 AA + best-practice audit run on 14 page types in English and Tamil (home, feed, article, hub, chapters, calculators, check-up before and after scoring, legal): all clean after fixing the heading outline, nested landmarks, glossary markup and a duplicated navigation landmark. Core Web Vitals not yet measured on a deployed host |
| Legal pages live | Draft text live in both languages; legal review deferred per decision log |

Next steps, in order:
1. Weekly digest sender: a cron job on the hosting account that emails confirmed subscribers the week's new articles and chapters.
2. Native Tamil review of the AI drafts (they publish with the AI label until reviewed).
3. Core Web Vitals check on the deployed site.
4. Chapter bodies for the remaining 20 modules, three or four modules per batch.

## Phase 3: Member app — first slice built

Runs on the MySQL that comes with the hosting plan (no Postgres), with the schema in `src/lib/db/migrations.ts` applied on first use. Financial payloads, check-up inputs and results are encrypted at the application level (AES-256-GCM, `DATA_ENCRYPTION_KEY` on the server).

| Gate criterion | Status |
| --- | --- |
| Accounts | Email + password (12+ characters, checked against known breaches), email verification and password reset from hello@mymoneyandme.in, database sessions (30-minute idle, 30-day absolute, remote sign-out), passkeys. Google, Apple and phone OTP wait for provider credentials |
| Full data capture | Onboarding quick start, household members, six families (income, expenses, assets, investments, loans, insurance) with add, edit, archive, member assignment and confidence level. CSV/XLSX import, documents and household invites not yet built |
| Check-up with 8 dimensions | Full check-up from stored data, history with "what changed", confidence with the fields that would raise it. Peer comparison and PDF export not yet built |
| Goals | Templates, inflation, required monthly investment, on-track status, conflicts. Monte Carlo deferred to v2 |
| Plan with checklist | Prioritised checklist with statuses, skip reasons and snooze; projected score for the next three items. Reminders and calendar export not yet built |
| Data export and deletion | JSON and CSV export; deletion by email confirmation with a 30-day grace, purged by `/api/cron/purge` or on sign-in |
| Pen test closed, 500 beta households | Not started |

## Phase 4: Scale and v2 — not started

Remaining seven languages, donations (hosted payment page), kids workbooks as PDF, notifications, analytics dashboards, authoring and admin consoles.
