# Deployment

The site runs on Hostinger Business web hosting as a Node.js web app (the plan that already holds the mymoneyandme.in domain and the hello@ mailbox). There is no separate build server: Hostinger installs dependencies with pnpm, runs `pnpm build` and starts the Next.js server.

## Hosting account

| Item | Value |
| --- | --- |
| Hosting order | Business plan, order 1010049079 |
| Account username | u567978051 |
| Staging site | lightcyan-mandrill-691431.hostingersite.com (temporary subdomain created 2026-10-18) |
| Build settings | Node 22, framework `next`, root `.`, output `.next`, build script `build`, package manager pnpm |

## Build notes

Tailwind is compiled ahead of `next build` by the Tailwind CLI (`pnpm css`, from `src/styles/app.css` into the git-ignored `src/app/globals.css`). The Turbopack loader (`@tailwindcss/turbopack`) runs in a helper Node process that must connect back over a local socket, and Hostinger's build sandbox does not allow that: the first build failed with "node process exited before we could connect to it". Plain CSS needs no helper process, so the precompiled file builds anywhere. `pnpm dev` runs the CLI in watch mode next to `next dev`.

## How a deploy works today

Direct file uploads to the hosting file browser are blocked from the build session, so the source reaches Hostinger through Git:

1. `git archive --format=zip -o app.zip <commit>` produces the source archive (no `node_modules`, no `.next`).
2. The archive is committed to the orphan branch `deploy-archive` of this repository with a `COMMIT` file naming the source commit.
3. Hostinger clones that branch into `public_html/deploy` (Git section of hPanel, or the API's "Deploy website Git repository").
4. A Node.js build is started from `deploy/app.zip` with the settings above (hPanel: Websites, Manage, Node.js; or the API's "Start Node.js build").

To move to push-to-deploy: connect the GitHub account once in hPanel (Websites, Manage, Advanced, Git), then set the Git auto-deployment to `craftnship/mymoneyandme`, branch `main`. Every push to `main` then rebuilds with the stored settings, and the `deploy-archive` branch can be deleted.

## Environment variables

Set these in hPanel (Websites, Manage, Node.js, Environment variables) or through the API's "Replace Node.js environment variables". Values never go into the repository. `NEXT_PUBLIC_*` values are baked in at build time, so a change needs a new build.

| Variable | Purpose | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata, sitemap and confirmation links | `https://mymoneyandme.in` |
| `DATABASE_URL` | MySQL on the same server (newsletter subscribers now; the Phase 3 data model later) | `mysql://u567978051_mmapp:<password>@127.0.0.1:3306/u567978051_mmapp` |
| `SMTP_HOST` | Hostinger mail | `smtp.hostinger.com` |
| `SMTP_PORT` | | `465` |
| `SMTP_USER` | The sending mailbox | `hello@mymoneyandme.in` |
| `SMTP_PASS` | That mailbox's password | |
| `NEWSLETTER_FROM` | Optional sending address; defaults to `SMTP_USER`. Use a bare address: the display name "My Money & Me" is added by the app, and values with `<` or `&` have broken the Hostinger build | `hello@mymoneyandme.in` |

Without `DATABASE_URL` and the SMTP settings the site runs fine; the newsletter form reports that sign-up is not available.

Create the database in hPanel (Websites, Manage, Databases) or with the API's "Create account database"; the name and user are prefixed with the account username. The app creates its `newsletter_subscribers` table on first use. Node.js apps must connect to `127.0.0.1`, not `localhost`.

## Switching the domain

mymoneyandme.in currently serves the Hostinger Horizons site (DNS: `@` ALIAS and `www` CNAME to `*.cdn.hstgr.net`). Once the staging site is approved:

1. In hPanel, change the website's domain from the temporary subdomain to `mymoneyandme.in` (or create the Node.js website on the domain and repeat the deploy).
2. Hostinger rewrites the `@` and `www` records to the hosting server; leave the MX, SPF, DKIM and DMARC records for the mailbox untouched.
3. Rebuild with `NEXT_PUBLIC_SITE_URL=https://mymoneyandme.in` so canonical URLs, the sitemap and confirmation links use the real domain.
4. Keep the Horizons site unpublished but not deleted for a week in case of a rollback.

## Checks after each deploy

- `/en` and `/ta` return 200 and the footer shows the expected rule-pack version.
- `/sitemap.xml` lists both languages with the production origin.
- `POST /api/checkup/quick` and `POST /api/calculators/sip` return JSON.
- The newsletter form shows the confirmation message (or "not available" when the variables are not set).
