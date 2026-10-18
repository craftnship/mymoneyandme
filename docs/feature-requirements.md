# My Money & Me — Feature Requirements Document

As of 2026-10-17 · Author: Santhosh (santhoshcse@live.com)
Source doc: https://claude.ai/code/artifact/066ab83f-7043-41a6-a405-b1b6dce20b02

> **For Claude Code:** this is the product requirements source of truth for mymoneyandme.in. Build in the phase order of section 20. Treat every "Decided" item in section 21 as fixed. Diagrams from the original doc are rendered as text blocks below.

## 1. Product overview

**My Money & Me** ([mymoneyandme.in](https://mymoneyandme.in/), domain owned) is a personal finance product that works as a public financial-literacy website and, once a user signs in, as a planning app that captures a family's full financial picture, scores its health and returns a prioritised action plan. It is built and run by a single founder with AI-assisted development, so every feature below is scoped to be buildable and maintainable by one person.

**Vision:** any individual, in any supported language, can learn money basics, run a calculator, get a financial check-up and leave with a concrete checklist in under 20 minutes, without needing an advisor.

**Business model:** free for every user with no feature gating; running costs are met by voluntary donations (UPI, cards, net banking through a hosted payment page). The platform never sells data or financial products. Donors get a receipt and an optional supporter badge.

**Scope at launch (v1)**

- Public website: live articles home page, learning hub (Adults, Kids, Women), full calculator suite, SEO-ready, no login required.
- Logged-in web app: profile and family setup, financial data capture (income, expenses, assets, loans, investments, insurance), financial health check-up with score, goal planning, recommended plan with checklist.
- Authoring console: multilingual article and course authoring with translation workflow, scheduling and review.
- Admin console: users, content, taxonomies, calculator parameters, scoring rules, analytics.

**Out of scope for v1 (listed so they are not assumed):** executing transactions, selling or distributing financial products, automated bank/broker account aggregation, native mobile apps (the web app is responsive and installable as a PWA), human advisor marketplace, any country or currency other than India and INR, paid or premium tiers.

**Guiding principles**

1. Education first, product-neutral: the app never recommends a specific fund, bank or insurer by name; it recommends categories and criteria.
2. Privacy by default: financial data is encrypted, exportable and deletable by the user at any time.
3. Language is a first-class dimension: every piece of content, label and number format follows the user's chosen language and locale.
4. India-only rules: tax, retirement, insurance and inflation assumptions live in one versioned India rule pack; no other country is planned.
5. Progressive capture: a user gets value after three fields (age, income, expenses) and more value with every additional field.

**Reference products studied for this document:** [Dezerv Wealth Monitor](https://www.dezerv.in/wealth-monitor/) (portfolio check-up), [Finology Recipe goal calculators](https://recipe.finology.in/goal-calculators) and [financial check-up](https://recipe.finology.in/financial-checkup), [Zerodha Varsity](https://zerodha.com/varsity/modules/) (module-based learning), [Finshots](https://finshots.in/archive/) and [Money Pechu](https://moneypechu.com/) (article feeds).

## 2. Target users and personas

Six personas drive the feature set; every feature in this document maps to at least one of them.

| Persona | Who they are | Primary need | Entry point |
| --- | --- | --- | --- |
| First-jobber | 22–28, first salary, no investments, little insurance | Learn basics, start an emergency fund, first SIP | Articles, Adults module, SIP calculator |
| Family planner | 30–45, married, 1–2 kids, home loan, mixed investments | Full check-up, goal planning (education, home, retirement) | Logged-in app |
| Woman managing household or own money | Any age; may be new to investing or returning after a career break | Confidence, safety-first guidance, legal and tax points specific to women | Women module, check-up |
| Parent teaching a child | Parent + child aged 8–16 | Age-appropriate money lessons, pocket-money tracking | Kids module |
| Pre-retiree | 50–60, wants to know if the corpus is enough | Retirement gap, withdrawal plan, insurance review | Retirement calculators, check-up |
| Content author / editor | Internal or freelance writer, course designer, translator | Create and translate articles and courses efficiently | Authoring console |

**Roles in the system:** Visitor (no login), Member (logged in), Family member (invited by a Member, read or edit rights), Author, Translator, Editor/Reviewer, Admin, Super-admin. Role details are in section 14.

## 3. Platform structure

The product has three layers sharing one codebase and one content store: a public website that needs no account, a member web app behind login, and two staff consoles.

```
PLATFORM MAP — one sign-in turns the public site into a planning app

┌─ Public website · no login ─────────────────────────────────────────────┐
│  Home              Learning hub          Calculators        Content pages │
│  live article feed Adults·Kids·Women     40+ free tools     articles, courses │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ sign up or sign in
                                   ▼
┌─ Member web app · login ────────────────────────────────────────────────┐
│  Profile and family      Financial data capture     [Financial health check-up] │
│  members, language, city income, expenses, assets   score across 8 dimensions   │
│  Goal planning           [Recommended plan]         Dashboard and reports       │
│  education, home, retire checklist and reminders    net worth, progress, exports│
└──────────────────────────────────▲──────────────────────────────────────┘
                                   │ content, rules and parameters feed both layers
┌─ Staff consoles · role-based ────┴──────────────────────────────────────┐
│  Authoring console                      Admin console                    │
│  articles, courses, translations        users, scoring rules, analytics  │
└─────────────────────────────────────────────────────────────────────────┘
[brackets] = the two core outputs of the member app
```

Everything a visitor can do stays available after login; login adds persistence, the family picture, the check-up, goals and the plan. Staff consoles publish content and tune scoring rules and calculator parameters that both public and member layers consume.

**Navigation (primary)**

| Area | Visitor sees | Member sees in addition |
| --- | --- | --- |
| Home | Live article feed, trending, categories, newsletter sign-up | Personalised feed (language, interests, life stage), continue-reading |
| Learn | Adults, Kids, Women tabs; module and chapter pages; free preview of every chapter | Progress tracking, bookmarks, quizzes with saved scores, certificates |
| Calculators | All calculators, shareable result links, print/PDF | Results saved to profile; inputs pre-filled from the financial profile |
| Check-up | Teaser: a 5-question quick check with an approximate score, CTA to sign up | Full check-up with score, dimension breakdown, history |
| Goals | Sample goals, goal calculators | Goal creation, tracking, linking to investments |
| Plan | — | Prioritised checklist with reminders and progress |
| Profile | — | Personal and family details, language, data export, delete account |

**Public-to-member bridge:** any calculator result or quick check-up can be saved by signing up; the inputs are carried into the new account so the user never re-enters them.

**Responsive and installable:** every page works at 360 px width and up; the member app is a Progressive Web App (installable, offline reading of saved articles and course chapters).

## 4. Home page: live articles

The home page is a continuously updated article feed, in the style of a daily finance newsletter archive, and it is the main organic-traffic entry point. All articles are original and written in-house; there is no syndicated or partner content, so every piece carries the site's own byline and licence.

**Feed features**

- Hero slot for the day's lead story plus three secondary stories, editorially pinned or auto-selected by recency and engagement.
- Infinite-scroll archive sorted newest first, with filters by category (markets, personal finance, tax, insurance, loans, real estate, economy explained, women and money, kids and money), format (explainer, news, how-to, story, video, podcast) and reading time.
- Daily or weekly digest: a "today's briefing" card listing 3–5 short stories, matching the newsletter cadence.
- Full-text search with language-aware stemming, autocomplete and recent searches.
- Article card shows title, excerpt, author, publish date, reading time, category chips and language badge (with an "AI-translated" marker where no human review has happened yet); cards are shown in the user's language when a translation exists, with a fallback to the source language and a "translation coming" marker.
- Trending and most-read widgets over 24 hours and 7 days.
- Newsletter subscription (email, optional WhatsApp/Telegram where lawful) with double opt-in and one-click unsubscribe.

**Article page**

- Clean reading layout, estimated reading time, progress bar, table of contents for long reads, embedded calculators and charts, glossary tooltips for jargon.
- Language switcher on the article itself, showing only languages where a published translation exists; AI-translated articles show a short notice at the top and a "report a translation issue" link that files a reviewer task with the paragraph pre-selected.
- Related articles, related course chapter, related calculator (editor-set or auto-tagged).
- Share (copy link, WhatsApp, X, LinkedIn, email), bookmark (members), text-to-speech playback where the language is supported, print and PDF.
- Comments are off by default; optional moderated comments or reactions per article (admin setting).
- Structured data (Article, BreadcrumbList, FAQ), Open Graph and Twitter cards, canonical and hreflang tags per language, AMP-free but Core Web Vitals compliant.

**Editorial scheduling:** articles can be scheduled per language, embargoed, and auto-expired or flagged as outdated after a configurable period; an "updated on" date is shown when content is revised.

## 5. Learning hub

The learning hub is a module-based curriculum, structured like Zerodha Varsity, with three tracks shown as tabs: **Adults**, **Kids** and **Women**. Each track contains ordered modules, each module ordered chapters, and every chapter is free to read without login.

**Structure**

- Track → Module → Chapter → Sections. A chapter is 8–15 minutes of reading with illustrations, worked examples, a key-takeaways box, a glossary and a 3–5 question quiz.
- Chapters can embed calculators, interactive widgets (e.g. a compounding slider), short videos and audio narration.
- Each module has a difficulty label (Beginner, Intermediate, Advanced), estimated hours, prerequisites and a downloadable PDF.
- Members get progress tracking, resume-where-you-left, bookmarks, notes, quiz scores, a completion certificate per module and a learning streak.

**Adults track (indicative modules, v1)**

1. Money basics: budgeting, cash flow, emergency fund
2. Banking and credit: accounts, credit score, cards, loans
3. Insurance: term life, health, motor, what to avoid
4. Investing fundamentals: risk, return, asset classes, diversification
5. Mutual funds and SIPs
6. Stocks and markets basics
7. Fixed income: deposits, bonds, government schemes
8. Retirement planning
9. Tax planning for individuals
10. Real estate and home loans
11. Estate planning: wills, nominations, succession
12. Behavioural finance and avoiding scams

**Kids track (ages 8–16, split into 8–11 and 12–16 levels)**

1. What is money and where does it come from
2. Needs vs wants, saving jars and pocket money
3. Earning, chores and first bank account
4. How prices work: inflation for kids
5. Compound interest with games
6. Giving and sharing
7. Online safety and scams
8. Teen level: first job, UPI and digital payments, budgeting, intro to investing

Kids content uses larger type, illustrations, story format, badges and a parent companion guide per chapter. Every kids chapter is delivered both on the web and as a printable workbook (PDF per language, generated from the same source blocks) with activities, puzzles and a parent answer key, so families can use it offline or in classrooms. A parent-managed child profile (no direct account for under-18s, since the DPDP Act treats anyone under 18 as a child) keeps the track compliant with Indian privacy law.

**Women track**

1. Taking charge: financial independence at any life stage
2. Managing household money and a joint budget
3. Career breaks, re-entry and income protection
4. Insurance and health cover for women
5. Investing for women: starting late, starting small
6. Legal and tax rights: property, inheritance, maintenance, nominations, tax benefits specific to women
7. Planning for children, elderly parents and single-parent households
8. Widowhood, divorce and financial safety nets
9. Women entrepreneurs: separating business and personal money

The Women track is written by and reviewed with women contributors, uses case studies from several countries and links every chapter to the relevant check-up dimension.

**Hub features for all tracks**

- Learning paths ("Start here", "I have a new job", "I am retiring in 10 years") that string chapters across modules.
- Language switcher per chapter; a module shows only when all its published chapters exist in the chosen language, otherwise falls back to the source language with a notice.
- Search within the hub, glossary index, "ask a question" form routed to editors.
- Live cohorts and webinars (v2): scheduled sessions attached to a module with registration and recordings.

## 6. Calculators

The calculator suite covers saving, investing, borrowing, insurance, tax, retirement and goals; every calculator shares one engine, one UI pattern and one set of country parameters.

**Catalogue (v1, 46 calculators)**

| Group | Calculators |
| --- | --- |
| Savings and investing | SIP, lumpsum, step-up SIP, SIP with delay (cost of waiting), goal SIP (how much to invest), SWP, STP, CAGR, absolute vs annualised return, XIRR from cashflows, rule of 72, power of compounding, inflation-adjusted return, mutual fund expense ratio impact |
| Fixed income | Fixed deposit, recurring deposit, PPF, EPF, NPS, Sukanya Samriddhi, NSC, senior-citizen savings, post-office schemes, bond yield-to-maturity (scheme rates and limits are admin-editable in the rule pack) |
| Loans and credit | EMI (home, car, personal, education), loan eligibility, prepayment and part-payment impact, loan tenure vs EMI trade-off, balance transfer comparison, credit-card interest and minimum-due trap, rent vs buy |
| Insurance | Term life cover needed (human life value and needs-based), health cover needed, premium affordability |
| Retirement | Retirement corpus, retirement age vs corpus, pension/annuity income, withdrawal rate and corpus longevity, gratuity |
| Goals | Child education, child marriage, home down-payment, car, vacation, custom goal; each with inflation and existing-savings inputs |
| Tax (India) | Income tax (old vs new regime where applicable), HRA exemption, capital gains (equity, debt, property), TDS on salary, take-home salary |
| Budgeting | 50/30/20 budget, emergency fund size, net worth, debt-to-income ratio, savings rate, financial freedom number |
| Currency and misc | Currency converter (indicative rates, daily refresh), gold investment returns, salary hike vs inflation, cost of smoking/subscription over years |

**Shared behaviour**

- Live recalculation on every input change; sliders plus typed input; sensible Indian defaults (inflation, expected returns) that are editable and labelled as assumptions.
- Result shows headline number, breakdown table, chart (growth over time, principal vs interest, amortisation) and a plain-language explanation of the formula.
- Every calculator has a "what this means for you" note and links to the related article and chapter.
- Shareable URL that encodes inputs; print and PDF export; embed code for partner sites (v2).
- Members: pre-filled from profile, save a scenario, compare up to three scenarios, add the result as a goal in one click.
- Formula and parameter versioning: each result records the parameter set used so historical saved results stay reproducible.
- Accessibility: keyboard-operable sliders, ARIA labels, INR formatting in lakhs and crores with an optional international-grouping toggle.
- Admin can add a new calculator from a JSON definition (inputs, formula, outputs, chart type) without code deployment for the standard formula families.

## 7. Onboarding, profile and family setup

Onboarding asks for the minimum needed to produce a first score in under three minutes, then invites the user to add detail over time.

**Sign-up and first run**

1. Sign up with email + password, phone OTP, Google or Apple (section 14). Language is detected and confirmed; country is fixed to India.
2. Quick start (required): name, date of birth, gender (optional, with "prefer not to say"), marital status, number of dependants, city, monthly take-home income, monthly expenses.
3. Instant "first look": savings rate, emergency-fund months and a provisional score, with a prompt to complete the full profile.
4. Guided wizard (optional, resumable): family members, income sources, expenses by category, assets, loans, investments, insurance, goals.

**Personal profile fields**

- Identity: name, preferred name, date of birth, gender, city, state, PIN code (optional).
- Preferences: display language, content language(s), number format (lakh/crore or international), risk tolerance (short questionnaire), notification preferences.
- Employment: employment type (salaried, self-employed, business owner, retired, student, homemaker), industry, employer (optional), expected retirement age.
- Health and lifestyle (optional, used for insurance sizing): smoker, existing conditions (yes/no only).

**Family setup**

- Household with members: spouse/partner, children, dependent parents, others. Each member has name, relation, date of birth, whether they earn, whether they are financially dependent.
- Any adult member can be invited by email to join the household with Viewer or Editor rights; the owner can revoke. A child under 18 is a profile managed by a parent, never a login.
- Household view aggregates all members' assets, loans and insurance; personal view shows one member. The check-up runs at household level by default and per adult on request.
- Life events: marriage, birth, job change, relocation, retirement, bereavement trigger a re-check-up prompt and adjust goals.

**Profile completeness** is shown as a percentage with the single next most valuable field suggested.

## 8. Financial data capture

The app captures six data families, each as a list of items with a common pattern: add, edit, archive, attach a document, assign to a family member, and mark as verified.

| Family | Item types | Key fields per item |
| --- | --- | --- |
| Income | Salary, business income, rental, interest/dividends, pension, freelance, other | Member, source, gross and net monthly amount, frequency, growth rate, start/end date, taxability |
| Expenses | Housing, food, utilities, transport, education, healthcare, insurance premiums, EMIs (auto-derived from loans), lifestyle, subscriptions, dependants, charity, other | Category, monthly amount, fixed or variable, essential or discretionary, inflation link |
| Assets | Cash and bank balances, fixed deposits, real estate (self-occupied, let out, land), gold and jewellery, vehicles, business equity, employee stock, retirement accounts (EPF, PPF, NPS), receivables | Owner, type, current value, purchase value and date, liquidity class, linked loan, valuation date |
| Investments | Mutual funds, stocks, ETFs, bonds, government schemes, crypto (flagged high-risk), ULIPs, insurance-linked savings, alternative assets | Owner, instrument, invested amount, current value, units, SIP amount and date, asset class, risk bucket, lock-in, nominee set (yes/no) |
| Loans and liabilities | Home, car, personal, education, gold, credit-card balances, loans from family, buy-now-pay-later | Borrower, lender type, principal, outstanding, interest rate and type, EMI, tenure left, prepayment penalty, insurance attached |
| Insurance | Term life, endowment/ULIP, health (individual, family floater, employer), critical illness, personal accident, motor, home, travel | Insured member(s), insurer type, sum assured, premium and frequency, start and end date, riders, nominee set |

**Capture methods**

- Manual forms with inline validation, smart defaults and unit helpers (lakh/crore, k/M).
- Bulk import from CSV/XLSX templates with a downloadable sample and row-level validation errors.
- No bank, broker or Account Aggregator connections and no statement parsing are planned; all data is user-entered or imported from the user's own spreadsheet.
- Quick-add from a calculator result or an article CTA.
- Periodic refresh prompts: current value of investments monthly, expenses quarterly, everything annually.

**Data quality rules**

- All amounts are in INR; foreign-currency holdings (NRE/NRO accounts, overseas stocks) are entered with their INR value plus the rate and date used.
- Every item carries a confidence level (entered, imported, verified) that the check-up uses to flag weak spots.
- Soft warnings for inconsistencies (expenses greater than income, EMI total not matching loans, sum assured far below income).
- Documents (policies, statements) are stored encrypted, limited to 10 MB each, with virus scanning and user-controlled deletion.

**Derived views:** net worth (assets minus liabilities) over time, cash-flow statement, asset allocation, liquidity ladder, insurance coverage map per member, and a loan amortisation schedule per loan.

## 9. Financial health check-up

The check-up turns the captured data into a 0–100 health score built from eight weighted dimensions, each with its own sub-score, status and one-line verdict, in the spirit of the Finology check-up and the Dezerv wealth monitor.

| Dimension | Weight | Core metrics | Healthy band (default; admin-configurable) |
| --- | --- | --- | --- |
| Cash flow and budgeting | 15% | Savings rate, essential vs discretionary split, income stability | Savings rate ≥ 20%; essentials ≤ 50% of income |
| Emergency fund | 15% | Liquid assets ÷ monthly essential expenses | 6 months (3 for dual-income salaried, 9 for self-employed) |
| Debt | 15% | Debt-to-income, EMI-to-income, high-cost debt share, credit-card revolving | EMI ≤ 35% of take-home; no revolving card debt |
| Insurance protection | 15% | Life cover ÷ income (and vs liabilities + goals), health cover per member, critical gaps | Term cover 10–15× annual income; health cover ≥ configured city-tier amount per member |
| Investments and asset allocation | 15% | Equity/debt/gold/real-estate mix vs age and risk profile, concentration, high-cost products share, idle cash | Within ±10% of target allocation; no single holding > 20% of investable assets |
| Retirement readiness | 10% | Projected corpus ÷ required corpus at retirement age | ≥ 100% on track, 70–99% watch, < 70% act |
| Goal readiness | 10% | Share of goals funded on current trajectory | ≥ 80% of goal value on track |
| Tax and hygiene | 5% | Tax-saving utilisation, nominations set, will or succession plan, documents in place | All nominations set; will in place after 40 or with dependants |

**Outputs**

- Overall score with grade (Excellent 85+, Good 70–84, Fair 50–69, Needs attention < 50) and a gauge.
- Dimension cards: sub-score, status (Good / Watch / Act), what was measured, the exact numbers, and why it matters, each linked to the relevant chapter.
- Top 3 risks and top 3 strengths in plain language.
- Peer comparison (optional, anonymised): same age band, income band and city tier.
- Score history with each re-run stored; a "what changed" diff between two runs.
- Confidence indicator: low when key data is missing, with the fields that would raise it most.
- Report export as PDF in the user's language; shareable read-only link with expiry (optional, off by default).

**Engine rules**

- Scoring rules, weights and bands live in one versioned India rule pack and are editable by admins; every score stores the rule-set version used.
- Rules are written as declarative conditions (metric, operator, threshold, points) so they can be reviewed by a finance expert without code.
- Life-stage adjustments: student, early career, family, pre-retirement, retired change weights (e.g. retirement readiness weight rises with age).
- Quick check (public, 5 questions) uses the same engine with defaults for missing data and shows an approximate score with a clear "approximate" label.

## 10. Goal planning

A goal is a target amount on a target date; the planner tells the user the monthly investment needed, which existing assets to assign, and whether the goal is on track.

**Goal types (templates with defaults):** emergency fund, child education (school, undergraduate, postgraduate, abroad), child wedding, home purchase (down-payment), home renovation, car or vehicle, vacation, starting a business, debt-free date, retirement, parents' care, wealth target, custom.

**Creating a goal**

1. Pick a template; name it and link it to a family member where relevant.
2. Enter today's cost; the planner inflates it at the template's inflation rate (education inflation differs from general inflation) to the target date.
3. Choose priority (Must, Should, Nice) and flexibility (fixed date, flexible by ± years).
4. Assign existing assets or investments (fully or by percentage) and any ongoing SIPs.
5. The planner returns: future value, required monthly investment at the suggested asset mix, shortfall or surplus, and probability of success (Monte Carlo, v2).

**Suggested asset mix by horizon** (defaults editable by admins and adjusted by risk profile): under 3 years mostly debt and liquid; 3–7 years balanced; over 7 years equity-heavy, with a glide path that de-risks in the last 3 years before the target date.

**Tracking**

- Goal dashboard with progress bars, next milestone, months ahead or behind, and a timeline of all goals.
- Conflicts flagged when total required monthly investment exceeds investable surplus; the planner proposes which Nice goals to push out or trim.
- Monthly review nudge; auto-update when linked investment values change.
- Goals feed the check-up (goal readiness) and the recommended plan (section 11).
- Public visitors can run the goal calculators and save the goal on sign-up.

## 11. Recommended plan and action checklist

After every check-up the engine produces one prioritised plan: an ordered checklist of concrete actions, each with the reason, the number behind it, the effort, the expected score gain and a link to learn more.

**Priority order (fixed sequence, standard personal-finance hierarchy)**

1. Stop the bleeding: clear revolving credit-card debt, close high-cost loans, fix expenses exceeding income.
2. Protect: term life cover to the computed gap, health cover for every member, set nominations.
3. Cushion: build the emergency fund to the target months.
4. Optimise debt: prepayment options, balance transfer, tenure changes.
5. Grow: start or raise SIPs toward goals, rebalance allocation, exit high-cost or unsuitable products (category-level, never product-specific).
6. Secure the future: retirement contributions, tax-advantaged accounts, will and estate basics.
7. Review: annual check-up, document refresh.

**Checklist item fields:** title, why (one sentence with the user's numbers), how (2–4 steps), amount or target, suggested deadline, effort (minutes/hours/days), impact on score, status (To do, In progress, Done, Skipped with reason), linked chapter or article, linked calculator, reminder.

**Example (illustrative output):** "Raise term life cover from ₹50 L to ₹1.5 Cr — your dependants need 12× income plus the home-loan balance. Compare 3 insurers on claim-settlement ratio and premium. 30 minutes. +9 points."

**Behaviour**

- Plan is regenerated on each check-up; completed items stay done, changed recommendations are shown as a diff.
- User can snooze, reorder within a priority band, or skip with a reason; skips feed back into analytics.
- Progress ring on the dashboard; score projection shows the expected score if the next three items are done.
- Reminders by email, push or WhatsApp (opt-in) with a configurable cadence; quiet hours respected.
- Plan export to PDF and to calendar (.ics) for dated actions.
- Every recommendation shows the rule and inputs that generated it (explainability), and a disclaimer that it is educational, not regulated advice.

## 12. Authoring tools and multilingual CMS

The authoring console is a headless CMS where every article, chapter, quiz, calculator label and UI string is a translatable entity: one source document, any number of language versions, each with its own workflow state and publish date.

```
CONTENT WORKFLOW — one source article fans out into labelled translations that publish independently

 Draft ──▶ Editorial review ──▶ [Approved source] ──▶ Publish
 (source   (facts, compliance,   (locked; versioned)    (scheduled or now)
  language) SEO)                        │
      ▲                                 │ one task per target language
      │ rejected: back to review        ▼
      └──────────────────────────── Translate ──────▶ Publish per language
                                   (AI draft,          (own date, own URL,
                                    labelled)           labelled until reviewed)
```

A translation starts as an AI draft and can be published immediately in that state, carrying a visible "AI-translated, not yet reviewed" label and a one-tap "report a translation issue" link; when a reviewer later edits and approves it, the label drops. If the source changes, every translation is flagged "out of date" with the changed paragraphs highlighted.

**Editor**

- Block-based rich text editor (headings, paragraphs, lists, tables, quotes, callouts, images with captions and alt text, embedded video, code/formula, footnotes, glossary terms, calculator embeds, chart embeds from data, collapsible FAQ, CTA blocks).
- Side-by-side translation view: source blocks on the left, target on the right, aligned block by block, with per-block status (untranslated, machine, edited, approved) and progress percentage.
- AI translation is the primary path: an LLM-based translator drafts every block from the approved source using a protected glossary (financial terms, scheme names, brand names), translation memory of approved sentences and a per-language style guide; a second automated pass checks numbers, dates, amounts and names against the source and flags mismatches; flagged blocks are held back while the rest publishes as a labelled AI draft, and human review happens later as capacity allows. No external agency is in the loop.
- Transliteration keyboards; Indic script support (Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Odia, Punjabi) with correct line-breaking and fonts; RTL support for Urdu.
- Per-language SEO fields: slug, title tag, meta description, Open Graph image, keywords; per-language reading time computed automatically.
- Parameter placeholders in content: {inflation_default}, {section_80c_limit}, {ppf_rate} resolve at render time from the rule pack, so figures stay current in every language after a Budget change without re-editing articles.
- Media library with image optimisation, language-specific image variants (e.g. text on infographics), and usage tracking.
- Autosave, version history with diff and restore, concurrent-edit locking with presence indicators, inline comments and @mentions for reviewers.
- Preview as any role, device size and language; preview links with expiry.

**Workflow and roles**

- States per language: Draft → In review → Changes requested → Approved → Scheduled → Published → Updated → Archived; a translation also carries a review flag (AI draft or Reviewed) independent of the publish state, so an AI draft can be Published with its label and lose the label once reviewed.
- Roles: Author (own drafts), Editor/Reviewer (approve source), In-house language reviewer (edits the AI draft and approves a language; one or more per language), Publisher, Admin. Assignments and due dates per language; a translation dashboard shows coverage by language and backlog.
- Compliance checklist before publish: disclaimer present, no product endorsement, sources cited, numbers checked, accessibility (alt text, heading order) passed.
- Bulk operations: request AI drafts for N articles into all nine languages in one action, with cost and time estimates; XLIFF export kept only for portability and backup; reviewer dashboard shows AI-draft quality signals (edit distance per block, flagged mismatches) to focus review time.

**Course authoring (same console, extended)**

- Curriculum builder: drag-and-drop tracks, modules, chapters; prerequisites; difficulty; estimated time.
- Chapter editor = article editor plus quiz builder (multiple choice, true/false, numeric, scenario), key-takeaways block, downloadable resources, interactive widget embeds.
- Module-level translation status: a module is listed in a language only when all published chapters are approved in that language (configurable to allow partial with a notice).
- Certificate template per language; quiz questions translated with answer order preserved; kids chapters generate a print-ready workbook PDF per language from the same blocks, with a workbook-only activity block type.
- Versioned courses: a new version can be published while learners finish the old one; progress maps across versions.

**Language fallback rules (consumer side):** show the user's display language; if missing, the user's secondary language; else the source language with a "not yet translated" banner and an option to request it. Fallback events are counted to prioritise translation work.

**UI strings and calculators:** all interface text, calculator labels, help texts and recommendation templates live in the same translation system (resource bundles with ICU MessageFormat for plurals, genders and number/date formatting), so a new language is enabled from the console without a code release.

## 13. Localization and internationalization

Language is the only locale dimension a user chooses: the country is India, the currency is INR and the financial year is April–March for everyone, so localisation effort goes entirely into Indian languages.

**Languages**

- Launch set (confirmed): English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati; the architecture supports any BCP 47 locale, so Odia, Punjabi, Assamese and Urdu (RTL) can follow without code changes.
- Language chosen in profile (members) or detected from browser and overridable (visitors); stored in a cookie for visitors.
- URL structure carries the language (`/ta/articles/...`), with hreflang links between versions and a language-neutral canonical for the source.
- Content shown in the chosen language where available, with the fallback chain in section 12.
- Full UI translation including form validation, error messages, emails, notifications, PDFs, workbooks and certificates.

**Formatting (ICU / CLDR based)**

- Numbers: Indian grouping (1,00,000) and lakh/crore words by default; an international grouping toggle (thousands/millions) for users who prefer it.
- Currency: INR only, ₹ symbol, decimals only where relevant; foreign holdings display their INR value.
- Dates: locale format per language, financial year April–March, assessment-year labels in tax contexts, week starts on Monday.
- Units: age in years, tenure in months or years, percentages with the locale decimal separator.

**India rule pack**

- One versioned rule pack holds income-tax slabs for both regimes, deductions and limits (80C, 80D, NPS), EPF/PPF/NPS/SSY rates and limits, insurance norms, default inflation and return assumptions, scheme calculators and the SEBI-aligned disclaimer text.
- Parameters change with the Union Budget and rate notifications; admins stage a new version with an effective date, and every saved result records the version used.
- No second country is planned; the pack stays a separate module only so that Budget-year changes never touch engine code.

**Accessibility and inclusivity:** WCAG 2.2 AA across all languages, screen-reader tested fonts for Indic scripts, dyslexia-friendly mode, high-contrast theme, minimum 16 px body text, captions for all video, transcripts for audio.

## 14. Accounts, authentication, security and privacy

Financial data is among the most sensitive data a consumer app can hold, so security and privacy controls are product features, visible to the user, not only back-end measures.

**Authentication**

- Sign-up and login: email + password (minimum 12 characters, breached-password check), phone OTP, Google, Apple; passkeys (WebAuthn) as the recommended passwordless option.
- Two-factor authentication (TOTP app, SMS fallback, recovery codes); mandatory for Author/Admin roles.
- Session management: list of active devices, remote sign-out, idle timeout (configurable, 30 minutes default for the member app), re-authentication before viewing or exporting full financial data.
- Account recovery with cooling-off and notification to all channels; account lockout and rate limiting on login.

**Authorisation (RBAC + household ACL)**

| Role | Scope |
| --- | --- |
| Visitor | Public content, calculators, quick check |
| Member | Own household data, check-up, goals, plan |
| Household Viewer / Editor | Invited adult; read or edit the shared household, never the inviter's login details |
| Author / Translator | Own drafts and assigned languages in the authoring console |
| Editor / Language reviewer / Publisher | Approve and publish content |
| Admin | Users, roles, rule packs, calculator parameters, taxonomies, analytics |
| Super-admin | Security settings, audit log, data-residency configuration |

**Privacy controls for the user**

- Consent screens at sign-up with granular toggles (analytics, marketing, peer comparison, personalisation); consent history stored.
- Data export (JSON and CSV) in one click; account deletion with a 30-day grace period and full erasure including backups on schedule.
- Field-level privacy: a member can mark any item as private from household viewers.
- Clear data-use statement in plain language per locale; no sale of data; no advertising based on financial data.

**Security measures**

- Encryption in transit (TLS 1.3, HSTS) and at rest (AES-256), with application-level encryption for financial amounts and documents using per-tenant keys in a KMS.
- OWASP ASVS Level 2 as the development standard; CSP, CSRF protection, input validation, secure headers, dependency scanning, secrets management.
- Audit log of every read and write of financial data by staff; staff access to user data only through a break-glass procedure with justification and expiry.
- Backups encrypted, tested restores quarterly; RPO 1 hour, RTO 4 hours.
- Annual penetration test and a public vulnerability disclosure policy.
- Children's data: no account for anyone under 18 (the DPDP Act requires verifiable parental consent for minors); parent-managed child profiles contain no contact data and no tracking.

## 15. Admin console, analytics and moderation

The admin console gives non-engineers control over users, content, rules and parameters, with every change logged and reversible.

**Modules**

- Users and roles: search, view (masked financial data), suspend, reset 2FA, assign roles, household membership disputes.
- Content governance: taxonomies (categories, tags, glossary), languages enabled, fallback rules, homepage curation (pins, hero), newsletter templates, legal pages per locale.
- Rule packs and parameters: scoring weights and bands, calculator defaults (inflation, returns, tax slabs), recommendation templates, India rule-pack versions; staged changes with preview and effective dates; version history.
- Calculator registry: enable or disable, edit labels, add a calculator from JSON definition, test harness with expected outputs.
- Notifications: templates per channel and language, cadence rules, suppression lists.
- Moderation: comment queues, reported content, translation-issue reports (per paragraph, per language, with one-click fix-and-mark-reviewed), user-submitted questions, spam controls.
- Integrations: AI translation provider keys and per-language prompt or style-guide settings, email/SMS/WhatsApp providers, analytics, donation payment gateway (UPI, cards, net banking), receipt numbering and 80G certificate generation where the entity qualifies.
- Audit log: who changed what, when, before/after, with export.

**Analytics (privacy-respecting, aggregated)**

- Content: views, reads, scroll depth, time on page, by language and state; translation coverage and fallback hits; newsletter open and click rates.
- Learning: enrolments, completion funnel by chapter, quiz scores, drop-off points, certificate counts.
- Calculators: usage by calculator, inputs distribution (bucketed), save and goal-conversion rates.
- App: sign-up funnel, profile completeness, check-up completion, score distribution, checklist completion by item, retention cohorts; donation prompts shown, conversion and amounts (aggregated, never per user).
- Dashboards in the console plus export to a data warehouse; event schema documented; no personally identifiable fields in analytics events.

## 16. Notifications, engagement and community

Notifications exist to bring the user back to an unfinished action, never to generate traffic; every channel is opt-in with per-type controls.

**Channels:** email, web push, PWA push, in-app inbox; SMS and WhatsApp for OTP and, where the user opts in and local law allows, reminders.

**Notification types**

- Transactional: OTP, login from new device, household invite, data export ready, deletion scheduled.
- Plan: checklist reminders, snoozed item due, goal milestone reached, investment value refresh due, insurance renewal due (from policy end date), re-check-up due (quarterly default).
- Content: daily or weekly digest in the chosen language, new chapter in a module the user is taking, article matching saved interests.
- Lifecycle: onboarding nudges (day 1, 3, 7), inactivity re-engagement (30, 90 days), year-end review; one non-intrusive donation ask after a completed check-up, capped at twice a year and dismissible for good.

**Engagement features**

- Streaks and badges for learning; score milestones for the check-up; shareable (image) achievement cards without any financial numbers.
- Personal dashboard home: score, next three actions, goal progress, continue learning, latest articles.
- Annual "financial year in review" report (PDF, in the user's language).
- Community (v2, opt-in): moderated Q&A per chapter, expert AMAs, women's circle group tied to the Women track; strict moderation and no product promotion.

**Controls:** notification centre with per-type toggles, frequency caps, quiet hours in the user's time zone, one-click unsubscribe in every email.

## 17. Non-functional requirements and international standards

The platform targets the standards a global consumer finance product is audited against; the table lists each standard, what it covers here and the acceptance measure.

| Area | Standard or target | Acceptance measure |
| --- | --- | --- |
| Accessibility | WCAG 2.2 AA; EN 301 549 | Automated and manual audit per release; screen-reader test in 3 languages |
| Privacy | India DPDP Act 2023 and its rules; IT Act 2000 with SPDI Rules 2011; GDPR-grade practices adopted as the design baseline; verifiable parental consent for under-18s | Consent records, data-principal requests handled within statutory time, grievance officer appointed, DPIA completed |
| Security | ISO/IEC 27001 controls, OWASP ASVS L2, SOC 2 Type II readiness, NIST password guidance; PCI DSS scope kept to SAQ A by using a hosted donation page | Annual pen test with no open high findings; quarterly vulnerability scans |
| Localisation | Unicode CLDR, ICU MessageFormat, BCP 47, ISO 4217, ISO 3166, W3C i18n best practices | Every locale passes a pseudo-localisation test; no hard-coded strings |
| Performance | Core Web Vitals: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on a mid-range phone over 4G | Lighthouse ≥ 90 on home, article, calculator and dashboard |
| Availability | 99.9% monthly for public site, 99.5% for member app | Status page, incident process, post-mortems |
| Scalability | 1 million monthly visitors, 100,000 members, 10,000 concurrent calculator sessions at launch sizing; horizontal scale beyond | Load test before launch and quarterly |
| Data residency | All data, backups and logs in one Indian cloud region, spread across availability zones | No cross-border transfer; verified in audit; all third-party processors contractually bound to Indian storage |
| Content compliance | Educational-content disclaimers; no personalised regulated advice; SEBI investor-education norms, IRDAI and RBI consumer guidance, ASCI code for any promotion | Self-review of recommendation templates against SEBI investor-education norms with each rule-pack version; formal legal review deferred |
| Financial calculation accuracy | Calculators and scoring reproduce reference results | Automated test suite with published reference cases; parameter versioning |
| Browser and device support | Last 2 versions of Chrome, Safari, Firefox, Edge; Android 9+ and iOS 15+ browsers; 360 px minimum width | Cross-browser test matrix per release |
| Observability | Structured logs, metrics, tracing, error tracking, alerting | On-call runbooks; MTTR tracked |
| SEO | Server-rendered public pages, sitemaps per language, structured data, hreflang | Indexed pages and crawl errors monitored |
| Email deliverability | SPF, DKIM, DMARC; double opt-in | Bounce and complaint rates under provider thresholds |

**Legal pages per locale:** terms of use, privacy notice, cookie notice, children's privacy notice, disclaimer, grievance officer contact (required in India), accessibility statement.

## 18. Technical architecture and integrations

The reference architecture is a modular monolith behind one API, with the rule engine, calculator engine and CMS as separately deployable modules so each can be versioned and tested on its own.

```
REFERENCE ARCHITECTURE — web clients call one API; the rule engine and content store sit behind it

┌─ Clients · server-rendered public site, PWA member app, consoles ───────┐
│  Public site            Member app (PWA)           Authoring and admin   │
│  SSR, SEO, CDN-cached   authenticated, offline     role-gated, 2FA       │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTPS, JSON, locale header
┌─ API gateway · auth, rate limits, locale resolution, audit ─────────────┐
│  Identity service        [Core API]                Localisation service │
│  OIDC, passkeys, 2FA     REST + GraphQL, versioned bundles, fallback    │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ internal calls and events
┌─ Domain services and stores ────────────────────────────────────────────┐
│  Household data   [Rule engine]        Calculator engine   Headless CMS │
│  encrypted PG     check-up, goals,     JSON-defined,       content,     │
│                   plan                 versioned           translations │
│  Shared: search index (per language) · object storage (documents, media) │
│          · cache · event bus · analytics warehouse                       │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ outbound integrations
┌─ External providers ────────────────────────────────────────────────────┐
│  AI translation · email, SMS, WhatsApp · FX rates · donation gateway    │
│  · KMS · CDN and WAF                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

Clients never compute scores or recommendations locally; they call the API so every result carries a rule-set version and can be reproduced. Calculators run in the browser for instant feedback from the same JSON definition the server uses for saved results.

**Recommended stack (indicative; final choice is a team decision)**

| Layer | Choice | Reason |
| --- | --- | --- |
| Front end | TypeScript, React with a server-rendering framework (Next.js or Remix), PWA, Tailwind or a design system with RTL support | SEO for public pages, one codebase for site, app and consoles |
| API | Node.js (NestJS) or Python (FastAPI); OpenAPI spec; GraphQL for the member dashboard | Typed contracts, easy versioning |
| Data | PostgreSQL with row-level security and column encryption; Redis cache; OpenSearch or Meilisearch with per-language analysers | Relational integrity for financial data; multilingual search |
| CMS | Headless CMS with locale-aware content model (e.g. Strapi, Payload or Sanity) or a custom module on the same Postgres | Translation workflow, block editor, API-first |
| Rules | Declarative rule packs (JSON/YAML) evaluated by a rule engine library; property-based tests | Finance experts can edit without code |
| Infra | Containers on a managed Kubernetes or serverless platform in one Indian region across availability zones; CDN + WAF; IaC | Scale, residency, repeatability |
| Observability | OpenTelemetry, centralised logs, error tracking, synthetic checks | Meets availability targets |

**Integrations (adapter pattern, swappable)**

- AI translation (LLM API, swappable) with glossary injection, translation memory store and automated number/name consistency checks; XLIFF export for portability.
- Email, SMS (DLT-registered), push and WhatsApp Business providers.
- FX rate feed (daily), market index data for article widgets (delayed, licensed).
- No financial-data connections (Account Aggregator, bank or broker APIs) are planned.
- Identity providers: Google, Apple; passkeys via WebAuthn.
- Donation payment gateway with a hosted page (UPI, cards, net banking) and webhooks for receipts; analytics warehouse export; customer-support tool; status page.

**Environments and delivery:** dev, staging and production in the same Indian region; feature flags for gradual rollout per language; blue-green deployments; automated test gates (unit, contract, accessibility, i18n pseudo-locale, calculator reference cases).

## 19. High-level data model

The model separates identity, household finances, rules and content so each can have its own retention, encryption and residency policy.

| Entity | Key attributes | Relationships |
| --- | --- | --- |
| User | id, email/phone, auth methods, display language, content languages, city and state, consents, roles | owns or belongs to Household; authors Content |
| Household | id, name, owner | has Members, FinancialItems, Goals, CheckUps |
| Member | id, name, relation, date of birth, earns, dependant, linked User (optional), privacy flags | belongs to Household |
| IncomeSource / Expense / Asset / Investment / Loan / InsurancePolicy | type, amounts (encrypted), currency, dates, owner Member, confidence, attached Documents | belong to Household; Expense may derive from Loan |
| Document | id, type, storage key (encrypted), size, checksum, uploaded by | attached to any FinancialItem |
| RulePack | version, effective date, scoring weights, bands, defaults, tax tables, recommendation templates | referenced by CheckUp, Calculation |
| CheckUp | id, Household, run date, RulePack version, inputs snapshot, overall score, dimension scores, confidence | produces Plan |
| Plan / PlanItem | priority, template, rendered text per language, amount, deadline, status, score impact, links | belongs to CheckUp; PlanItem links Content, Calculator |
| Goal | template, Member, target amount, target date, inflation, priority, flexibility, assigned assets, required monthly | belongs to Household; contributes to CheckUp |
| CalculatorDefinition / Calculation | definition JSON, version; saved inputs, outputs, RulePack version, owner | Calculation may become a Goal |
| Content (Article / Module / Chapter / Quiz / Glossary term) | source locale, block JSON, taxonomy, authors, SEO fields, status, publish dates | has Translations |
| Translation | locale, block JSON aligned to source, per-block status, reviewer, machine-draft flag, out-of-date flag, SEO fields, publish date | belongs to Content |
| LearningProgress | User, Chapter, status, quiz score, timestamps, certificate | per User and Chapter |
| Notification / Subscription | channel, type, locale, status, consent reference | per User |
| AuditEvent | actor, action, entity, before/after hash, timestamp, justification | append-only |

**Donation** (for the free-with-donations model): id, User (optional; anonymous allowed), amount, gateway reference, receipt number, 80G eligibility flag, timestamp. Donations are never linked to financial items or used in scoring.

**Retention:** financial items and check-ups kept while the account is active and 30 days after deletion request; audit events 7 years; analytics events anonymised after 13 months; documents deleted immediately on user request.

## 20. Phased delivery roadmap

Delivery runs in four phases over roughly twelve months; the public site ships first so content and SEO start compounding while the member app is built.

```
DELIVERY ROADMAP — four phases in sequence, each closed by a gate; months are indicative for a solo build

 1 Foundations      2 Public site       [3 Member app]      4 Scale and v2
 months 1–2         months 3–5          months 6–9          months 10–12+
 design system,     articles home, SEO  profile, data       all 9 languages
   i18n             learning hub,       capture             donations,
 auth, CMS skeleton   3 tracks          check-up and goals    workbooks
 rule-pack format   46 calculators      plan and checklist  aggregator-free, community
        ◆                  ◆                   ◆                   ◆
 Gate: 2-language   Gate: public        Gate: member beta   Gate: general release
       demo               launch
 ───────────────────────────────────────────────────────────────────────▶ time, indicative
```

The build is a one-person effort with AI-assisted development (Claude for code, content drafting and translation), so the months are a sequence, not a commitment: ship Phase 2 publicly as early as possible to start SEO and feedback, and re-estimate each later phase at its gate. Each gate has exit criteria below.

**Gate criteria**

1. Two-language demo: design system with RTL and Indic support; one article and one chapter authored, translated and rendered in two languages; auth with passkeys; rule-pack format validated with the India check-up rules.
2. Public launch: home feed, learning hub with at least 3 modules per track in English and one Indian language, 46 calculators passing reference tests, WCAG AA audit passed, Core Web Vitals targets met, legal pages live.
3. Member beta: full data capture, check-up with 8 dimensions, goals, plan with checklist, data export and deletion, pen test closed, 500 beta households.
4. General release: 9 languages at 100% UI and ≥ 80% content coverage, donation flow live with receipts, kids workbooks for every published chapter, notifications, analytics dashboards, 99.9% availability over 60 days.

**After v2:** community, live cohorts, Monte Carlo goal probability, native app shells if PWA metrics warrant.

## 21. Decisions and assumptions

All former open questions are resolved; this list is the decision log.

- [x] Decided: business model is free for everyone with voluntary donations and no premium tier (section 1).
- [x] Decided: all nine languages at launch; translation is in-house, AI-drafted (sections 12 and 13).
- [x] Decided: India only; no second country or currency is planned (section 13).
- [x] Deferred: no legal or regulatory review for now; the product stays strictly educational with disclaimers on every result, and donation receipts carry no tax-benefit claim until 12A/80G status exists.
- [x] Decided: original articles only, no syndication (section 4).
- [x] Decided: single Indian region for all data, backups and logs (section 17).
- [x] Decided: brand is My Money & Me at mymoneyandme.in, domain owned; design language still to be chosen.
- [x] Decided: no Account Aggregator or statement parsing; manual entry and spreadsheet import only (section 8).
- [x] Decided: kids chapters ship both on the web and as a printable workbook per chapter (sections 5 and 12).
- [x] Decided: one person builds and runs the product with Claude's support; the roadmap in section 20 is re-estimated at each gate.
- [x] Decided: AI translations publish immediately with an "AI-translated, not yet reviewed" label and a reader report link; human review follows as capacity allows and removes the label (sections 4 and 12).

**Assumptions used in this document:** India is the only market; English is the source language for all content; numbers in examples use Indian conventions; all scoring thresholds in section 9 are starting defaults to be reviewed by a certified financial planner before launch; this document is educational product scope, not regulated financial advice.

**Sources:** [Dezerv Wealth Monitor](https://www.dezerv.in/wealth-monitor/) · [Finology Recipe goal calculators](https://recipe.finology.in/goal-calculators) · [Finology Recipe financial check-up](https://recipe.finology.in/financial-checkup) · [Zerodha Varsity modules](https://zerodha.com/varsity/modules/) · [Finshots archive](https://finshots.in/archive/) · [Money Pechu](https://moneypechu.com/) · [WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) · [Unicode CLDR](https://cldr.unicode.org/)
