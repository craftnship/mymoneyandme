# Deployment

The site runs on Hostinger Business web hosting as a Node.js web app (the plan that already holds the mymoneyandme.in domain and the hello@ mailbox). There is no separate build server: Hostinger installs dependencies with pnpm, runs `pnpm build` and starts the Next.js server.

## Hosting account

| Item | Value |
| --- | --- |
| Hosting order | Business plan, order 1010049079 |
| Account username | u567978051 |
| Website domain | mymoneyandme.in (switched from the temporary subdomain lightcyan-mandrill-691431.hostingersite.com on 2026-10-18) |
| Build settings | Node 22, framework `next`, root `.`, output `.next`, build script `build`, package manager pnpm |

## Build notes

Tailwind is compiled ahead of `next build` by the Tailwind CLI (`pnpm css`, from `src/styles/app.css` into the git-ignored `src/app/globals.css`). The Turbopack loader (`@tailwindcss/turbopack`) runs in a helper Node process that must connect back over a local socket, and Hostinger's build sandbox does not allow that: the first build failed with "node process exited before we could connect to it". Plain CSS needs no helper process, so the precompiled file builds anywhere. `pnpm dev` runs the CLI in watch mode next to `next dev`.

## How a deploy works today

Direct file uploads to the hosting file browser are blocked from the build session, so the source reaches Hostinger through Git:

1. `git archive --format=zip -o app.zip <commit>` produces the source archive (no `node_modules`, no `.next`).
2. The archive is committed to the orphan branch `deploy-archive` of this repository with a `COMMIT` file naming the source commit.
3. Hostinger clones that branch into `public_html/deploy` (Git section of hPanel, or the API's "Deploy website Git repository").
4. A Node.js build is started from `deploy/app.zip` with the settings above (hPanel: Websites, Manage, Node.js; or the API's "Start Node.js build").

Publishing a build replaces the contents of `public_html`, which removes the `deploy` folder. Step 3 therefore has to run again before every build; a build started without the archive in place fails within seconds and leaves no log.

To move to push-to-deploy: connect the GitHub account once in hPanel (Websites, Manage, Advanced, Git), then set the Git auto-deployment to `craftnship/mymoneyandme`, branch `main`. Every push to `main` then rebuilds with the stored settings, and the `deploy-archive` branch can be deleted.

## Environment variables

Set these in hPanel (Websites, Manage, Node.js, Environment variables) or through the API's "Replace Node.js environment variables". Values never go into the repository. `NEXT_PUBLIC_*` values are baked in at build time, so a change needs a new build.

| Variable | Purpose | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata, sitemap and confirmation links | `https://mymoneyandme.in` |
| `DATABASE_URL` | MySQL on the same server: newsletter subscribers and the member-app tables | `mysql://u567978051_mmapp:<password>@127.0.0.1:3306/u567978051_mmapp` |
| `DATA_ENCRYPTION_KEY` | 32-byte key (64 hex characters) for the AES-256-GCM encryption of financial data at rest. Generate once with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, keep a copy in a password manager: losing it makes every stored household's data unreadable. Accounts are disabled until it is set | |
| `CRON_SECRET` | Optional bearer token that protects `GET /api/cron/purge` and `GET /api/cron/reminders` (purges accounts whose 30-day deletion grace has passed); the same purge also runs opportunistically on sign-in | |
| `REMINDERS_ENABLED` | Set to `true` to send the monthly plan reminder to members who opted in (sign-up checkbox or Settings, Privacy). Needs SMTP set up; call `GET /api/cron/reminders` once a day with the `CRON_SECRET` bearer token. Each member gets at most one every 28 days. Left unset, the route answers 503 and nothing is sent | |
| `ADMIN_EMAILS` | Comma-separated addresses that get the `admin` role for the authoring console at `/en/admin`. The account must exist with a verified email; it is promoted the next time it opens the console. The console only opens on a session started with a passkey, so add one under Settings, Security first. Removing an address does not demote the account | `santhoshcse@live.com` |
| `SMTP_HOST` | Hostinger mail | `smtp.hostinger.com` |
| `SMTP_PORT` | | `465` |
| `SMTP_USER` | The sending mailbox | `hello@mymoneyandme.in` |
| `SMTP_PASS` | That mailbox's password | |
| `NEWSLETTER_FROM` | Optional sending address; defaults to `SMTP_USER`. A bare address is enough: the app adds the display name "My Money & Me" | `hello@mymoneyandme.in` |

Without `DATABASE_URL` and the SMTP settings the public site runs fine; the newsletter form and the member sign-up report that they are not available. The member app additionally needs `DATA_ENCRYPTION_KEY`; the account pages say "Accounts are not available right now" until it is set.

Create the database in hPanel (Websites, Manage, Databases) or with the API's "Create account database"; the name and user are prefixed with the account username. The app creates its tables on first use (`newsletter_subscribers`, and the member-app tables listed in `src/lib/db/migrations.ts`, tracked in `schema_migrations`). Node.js apps must connect to `127.0.0.1`, not `localhost`.

Content (articles, modules, chapters, news) is also stored there: on first use the app imports the JSON files from `content/` into `content_items` and `content_translations`, and on every later start it copies in files that changed, leaving items edited in the authoring console alone. If the build can reach the database it prerenders from it; if not, it prerenders from the files and the running site switches to the database within five minutes. Images uploaded in the console (PNG, JPEG or WebP, up to 2 MB) are stored in the `media` table and served from `/media/<id>`, so they survive redeploys and are covered by the same backups. Hostinger's daily database backups now cover content written in the console.

## Domain

mymoneyandme.in was switched from the Hostinger Horizons site to this Node.js website on 2026-10-18 through hPanel (Horizons "Change domain", then "Connect domain" on the Node.js website). Hostinger rewrote the `@` and `www` records to the hosting server; the MX, SPF, DKIM and DMARC records for the mailbox were left untouched. The build runs with `NEXT_PUBLIC_SITE_URL=https://mymoneyandme.in`, so canonical URLs, the sitemap and email links use the real domain. The Horizons site is kept unpublished for a while in case of a rollback.

## Checks after each deploy

- `/en` and `/ta` return 200 and the footer shows the expected rule-pack version.
- `/sitemap.xml` lists both languages with the production origin.
- `POST /api/checkup/quick` and `POST /api/calculators/sip` return JSON.
- The newsletter form shows the confirmation message (or "not available" when the variables are not set).
