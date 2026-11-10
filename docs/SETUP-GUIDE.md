# Setup guide: GitHub → pipeline → live website

This takes about an hour the first time. At the end you'll have:

- the code on **GitHub**, with `develop` and `main` branches protected by checks
- a **pipeline** (GitHub Actions) that tests every change and deploys it to **dev → staging → production**
- the site **hosted on Cloudflare** (free plan), with a separate address for each environment

```
 your laptop                GitHub                                   Cloudflare
 ───────────   push    ┌──────────────┐  tests pass   ┌──────────────────────────────────────┐
 feature/xyz  ───────▶ │ PR → develop │ ────────────▶ │ dev        pegboard-dev.…workers.dev  │
                       └──────────────┘               │                                      │
                       ┌──────────────┐  tests pass   │ staging    pegboard-staging.…workers.dev│
                       │ PR → main    │ ────────────▶ │     │  you click “Approve”             │
                       └──────────────┘               │     ▼                                 │
                                                      │ production pegboard.…workers.dev       │
                                                      │            (later: your own domain)    │
                                                      └──────────────────────────────────────┘
```

> **Why Cloudflare?** Free, fast worldwide, unlimited requests for static files, HTTPS included, and each environment is a separate deployment you can open side by side. Cloudflare recommends **Workers with static assets** for new sites (Pages still works, but new features land on Workers), so that's what this project uses. Alternatives are listed at the end.

---

## 0. What you need installed

| Tool | Why | Check it works |
|---|---|---|
| [Git](https://git-scm.com/downloads) | version control | `git --version` |
| [Node.js 24 LTS](https://nodejs.org/) (22 also works) | builds the site and runs tests | `node --version` |
| [GitHub CLI](https://cli.github.com/) (optional, recommended) | create the repo and sign in from the terminal | `gh --version` |
| An editor — [VS Code](https://code.visualstudio.com/) is a good default | | |

Tell Git who you are (once per computer):

```bash
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

Try the site locally first:

```bash
cd pegboard
npm run dev          # builds, then serves at http://localhost:8080
npm run verify       # build + link check + unit tests — the same checks the pipeline runs
```

There's nothing to `npm install`: the project has zero dependencies.

---

## 1. Create the GitHub repository

1. Sign up or sign in at [github.com](https://github.com). Turn on two-factor authentication (Settings → Password and authentication) — you'll be storing a deploy key here.
2. **Make the repository public.** On the free GitHub plan, the features this pipeline relies on — deployment *environments* with an approval step, and branch rules — only work on public repositories. The site is all front-end code that browsers download anyway, so there's nothing secret in it. (Private repo? See [the note at the end](#keeping-the-repository-private).)

**With the GitHub CLI** (from inside the `pegboard` folder):

```bash
gh auth login                      # pick GitHub.com → HTTPS → log in with a browser
git init
git add .
git commit -m "Initial site: 5 tools, pipeline, docs"
gh repo create pegboard --public --source=. --push
```

**Or in the browser:** github.com → **+** → **New repository** → name `pegboard`, **Public**, *don't* add a README or .gitignore → **Create**. Then:

```bash
git init
git add .
git commit -m "Initial site: 5 tools, pipeline, docs"
git remote add origin https://github.com/YOUR-USERNAME/pegboard.git
git push -u origin main
```

Now create the `develop` branch — this is where day-to-day work lands:

```bash
git switch -c develop
git push -u origin develop
```

On GitHub: **Settings → General → Default branch** → switch to `develop`. New pull requests then target `develop` by default.

> The first push to `main` and `develop` will start the **Deploy** workflow and it will fail at the Cloudflare step. That's expected — it doesn't have the keys yet. You'll re-run it in step 5.

---

## 2. Set up Cloudflare

1. Create a free account at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and verify your email.
2. Open **Workers & Pages** in the left menu once. The first time, Cloudflare asks you to choose your **workers.dev subdomain** (for example `yourname.workers.dev`). Pick something short — it becomes part of your dev and staging addresses. Deploys fail until this is set.
3. **Copy your Account ID.** It's on the Workers & Pages overview page (right-hand side) and in the account menu. You can also run `npx wrangler login` then `npx wrangler whoami` locally.
4. **Create an API token** for GitHub to deploy with:
   - Go to **Manage account → Account API tokens** (or **My Profile → API Tokens**) → **Create Token**.
   - Choose the **Edit Cloudflare Workers** template.
   - **Account resources:** *Include → your account* (only this one).
   - **Zone resources:** *All zones from an account → your account* (needed later for a custom domain).
   - **Continue to summary → Create Token.** Copy the token now — Cloudflare shows it only once.

Treat this token like a password: it can deploy anything to your account. If it ever leaks, delete it in the same screen and make a new one.

---

## 3. Give GitHub the Cloudflare keys

In your repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Add two:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from step 2.4 |
| `CLOUDFLARE_ACCOUNT_ID` | the Account ID from step 2.3 |

Secrets are encrypted, hidden in logs, and never visible again after saving — even to you.

---

## 4. Create the three environments

**Settings → Environments → New environment**, three times:

| Environment | Deployment branches and tags | Protection |
|---|---|---|
| `dev` | Selected branches → `develop` | none |
| `staging` | Selected branches → `main` | none |
| `production` | Selected branches → `main` | **Required reviewers** → add yourself. Leave *Prevent self-review* unticked if you work alone. |

The branch rule means only `develop` can ever deploy to dev, and only `main` can deploy to staging and production — even if someone edits a workflow.

**Optional: `SITE_URL` variable.** In each environment you can add a *variable* (not a secret) named `SITE_URL`, such as `https://pegboard-staging.yourname.workers.dev`. The build uses it for canonical links and the sitemap, and the smoke test checks that exact address. If you leave it out, the pipeline uses the address Cloudflare reports after deploying. For production, set it only once your custom domain works (step 7).

---

## 5. First deploy

Re-run the failed workflow: **Actions → Deploy → the failed run → Re-run all jobs**. Or push any small change.

What happens on `develop`:

1. **test** — builds the site with production settings, checks every page and link, runs the unit tests.
2. **dev** — builds for dev, deploys with `wrangler deploy --env dev`, then the **smoke test** opens every page on the live address and confirms it's serving *this exact commit* (it compares `build-info.json`).

What happens on `main`: **test → staging → production**. Production pauses with *“Waiting for review”*. Open the run, click **Review deployments → production → Approve and deploy**.

Your addresses:

| Environment | Address | Search engines |
|---|---|---|
| dev | `https://pegboard-dev.<subdomain>.workers.dev` | blocked (noindex + robots.txt) |
| staging | `https://pegboard-staging.<subdomain>.workers.dev` | blocked |
| production | `https://pegboard.<subdomain>.workers.dev` | allowed, with sitemap |

Dev and staging show a striped banner at the top so nobody mistakes them for the real site.

---

## 6. Protect the branches

**Settings → Rules → Rulesets → New ruleset → New branch ruleset**:

- **Name:** `protect main and develop` · **Enforcement:** Active
- **Target branches → Add target → Include by pattern:** `main`, then again for `develop`
- Tick **Restrict deletions** and **Block force pushes**
- Tick **Require a pull request before merging** (required approvals: `0` if you work alone, `1` with a teammate)
- Tick **Require status checks to pass** → **Add checks** → search `Build, check and test` (it appears after CI has run once)
- **Create**

Now nothing reaches `develop` or `main` without passing the checks.

---

## 7. Your own domain (when you're ready)

1. Buy a domain through **Cloudflare Registrar** (sold at cost), or add a domain you already own to Cloudflare (**Add a domain**) and switch its nameservers at your current registrar to the two Cloudflare gives you.
2. In `wrangler.jsonc`, uncomment the `routes` line under `production` and set your domain:
   ```jsonc
   "routes": [{ "pattern": "tools.yourdomain.com", "custom_domain": true }]
   ```
   You can do the same for staging (`staging.yourdomain.com`).
3. In `site.config.mjs`, set `urls.production` to `https://tools.yourdomain.com`.
4. Merge to `main` and approve. Cloudflare creates the DNS record and HTTPS certificate automatically.
5. Then set the `SITE_URL` variable on the `production` environment to the same address, and submit `https://tools.yourdomain.com/sitemap.xml` in [Google Search Console](https://search.google.com/search-console).

---

## 8. Everyday workflow

```bash
git switch develop && git pull
git switch -c feature/case-converter      # one branch per change

npm run new-tool -- "Case converter" text  # scaffolds src/tools/case-converter/ as a draft
npm run dev                                # work on it at http://localhost:8080
npm run verify                             # same checks as CI

git add . && git commit -m "Add case converter (draft)"
git push -u origin feature/case-converter
gh pr create --base develop --fill         # or open the PR on github.com
```

1. CI runs on the pull request. Merge when it's green → **dev** updates automatically.
2. Check it on the dev address, on your phone too.
3. When `develop` has something worth releasing, open a PR **develop → main**. Merge → **staging** updates → look it over → **Approve** → **production**.
4. Tag releases so you can roll back to them:
   ```bash
   git switch main && git pull
   git tag v0.2.0 && git push origin v0.2.0
   ```

**Draft tools.** A tool with `"status": "draft"` in its `meta.json` appears on dev and staging (with a *Draft* badge) but is left out of production builds. Remove that line when it's ready. This lets you merge unfinished work without it going live.

---

## 9. When something goes wrong

| Problem | Fix |
|---|---|
| **Roll back production now** | Cloudflare dashboard → Workers & Pages → `pegboard` → **Deployments** → pick the previous one → **Rollback**. Or locally: `npx wrangler rollback --env production`. |
| Roll back via the pipeline | **Actions → Redeploy → Run workflow** → in *Use workflow from* pick an older **tag** (e.g. `v0.1.0`) → environment `production`. |
| Deploy fails with an authentication error | Check both secrets exist and are spelled exactly right; make sure the token uses the *Edit Cloudflare Workers* template and includes your account. |
| Deploy fails mentioning a workers.dev subdomain | Open Workers & Pages in the dashboard once and choose your subdomain (step 2.2). |
| Smoke test says the live build doesn't match | Usually the edge caching an old copy for a few seconds — re-run the job. If it persists, check `SITE_URL` points at this environment. |
| “Waiting for review” and nothing happens | You're a required reviewer — open the run and click **Review deployments**. |
| `npm run check` fails in CI | Run `npm run verify` locally — it prints the exact page and broken link. |

---

## Keeping the repository private

On the free GitHub plan, private repositories can't use deployment environments, environment approvals, or branch rulesets. If you need the repo private, either upgrade to GitHub Pro / Team, or:

1. Delete the `environment:` block (3 lines) from `.github/workflows/deploy-env.yml`.
2. Delete the `production:` job from `.github/workflows/deploy.yml`, so merging to `main` only updates staging.
3. Release to production by hand: **Actions → Redeploy → environment: production**. That manual click replaces the approval step.

## Other hosting options

| Host | Good for | Trade-off |
|---|---|---|
| **GitHub Pages** | simplest possible: one site, no extra account | one environment per repo, so no dev/staging; fewer header controls |
| **Netlify** | automatic preview site for every pull request | free plan has monthly usage limits |
| **Vercel** | same as Netlify, very polished | free plan is for non-commercial use |
| **Cloudflare Pages** | still supported and simple | Cloudflare now puts new features into Workers |

The site is plain HTML, CSS and JavaScript in `dist/`, so moving to any of these later only means swapping the deploy step.
