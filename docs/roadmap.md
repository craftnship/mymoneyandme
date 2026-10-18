# Roadmap and status

Phases follow section 20 of the feature document. Months are indicative for a solo build; each phase is re-estimated at its gate.

## Phase 1: Foundations — mostly done

| Gate criterion | Status |
| --- | --- |
| Design system with Indic support, RTL-ready | Tokens and layout in place; RTL `dir` wired through the locale table; brand palette is a placeholder until the design language is chosen |
| One article and one chapter in two languages | Done: 50/30/20 article and Budgeting chapter in English and Tamil (AI-draft labelled) |
| Rule-pack format validated with India check-up rules | Done: `rulepacks/india-2025-26.v1.json`, zod schema, 8 dimensions, tests |
| Auth with passkeys | Not started; needs a database (see Phase 3) |
| CMS skeleton | Content model and JSON store done; console not started |

## Phase 2: Public site — in progress

| Gate criterion | Status |
| --- | --- |
| Home feed | Done (hero, latest, tracks, featured calculators); article search and category filters done; digest and newsletter pending (needs an email provider) |
| Learning hub, 3 modules per track in English + one Indian language | Done for the gate: the first three modules of each track (22 chapters) have full English bodies and Tamil AI drafts; the remaining 20 modules are listed as coming soon. A content test enforces that every translation mirrors its source block by block |
| 46 calculators passing reference tests | 60 definitions, all run on defaults; 8 reference cases pinned. Needs more reference cases per family and a review of the simplified NPS, take-home and capital-gains rules |
| WCAG AA audit, Core Web Vitals | Keyboard-operable inputs, labels and focus styles in place; no audit run yet |
| Legal pages live | Draft text live in both languages; legal review deferred per decision log |

Next steps, in order:
1. Native Tamil review of the AI drafts (they publish with the AI label until reviewed).
2. Newsletter sign-up (needs an email provider) and the weekly digest.
3. Accessibility audit and Lighthouse pass on home, article, calculator, check-up.
4. Deploy (Vercel or any Node host; the site has no database yet) and point mymoneyandme.in at it.
5. Chapter bodies for the remaining 20 modules, three or four modules per batch.

## Phase 3: Member app — not started

Needs: Postgres with the data model in section 19 (Prisma), Auth.js with passkeys + Google + Apple + 2FA, encrypted financial items, full check-up and plan persistence, goals, data export and deletion.

## Phase 4: Scale and v2 — not started

Remaining seven languages, donations (hosted payment page), kids workbooks as PDF, notifications, analytics dashboards, authoring and admin consoles.
