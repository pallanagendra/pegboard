# Setup guide: GitHub → pipeline → live website

This takes about an hour the first time. At the end you'll have:

- the code on **GitHub**, with `develop` and `main` branches protected by checks
- a **pipeline** (GitHub Actions) that tests every change and deploys it to **dev → staging → production**
- the site **hosted on Cloudflare Pages** (free plan), with a separate address for each environment
- production on **your own subdomain**, such as `tools.yourdomain.com`, while your existing website and email stay on Hostinger, untouched

```
 your laptop               GitHub                         Cloudflare Pages (project "pegboard")
 ───────────  push   ┌──────────────┐  tests pass
 feature/xyz ──────▶ │ PR → develop │ ────────────▶  dev         https://dev.pegboard.pages.dev
                     └──────────────┘
                     ┌──────────────┐  tests pass
                     │ PR → main    │ ────────────▶  staging     https://staging.pegboard.pages.dev
                     └──────────────┘                   │
                                                        │  you click "Approve"
                                                        ▼
                                                     production  https://pegboard.pages.dev
                                                                 https://tools.yourdomain.com
                                                                   ▲
                                                                   one CNAME record in Hostinger's DNS (step 7)
```

> **Why Cloudflare Pages?** It's free, fast worldwide, has unlimited requests for static files and includes HTTPS. Each environment gets its own address you can open side by side. And it accepts a subdomain whose DNS stays at Hostinger, so connecting your domain is one DNS record — nothing about your current website or email changes.

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
git branch -M main
gh repo create pegboard --public --source=. --push
```

**Or in the browser:** github.com → **+** → **New repository** → name `pegboard`, **Public**, leave README, .gitignore and license off → **Create**. Then:

```bash
git init
git add .
git commit -m "Initial site: 5 tools, pipeline, docs"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/pegboard.git
git push -u origin main
```

Now create the `develop` branch — this is where day-to-day work lands:

```bash
git switch -c develop
git push -u origin develop
```

On GitHub: **Settings → General → Default branch** → switch to `develop`. New pull requests then target `develop` by default.

> The first pushes start the **Deploy** workflow, and it fails at the Cloudflare step. That's expected — it doesn't have the keys yet. You'll re-run it in step 5.

---

## 2. Set up Cloudflare

1. Create a free account at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and verify your email. You don't need to add your domain to Cloudflare.
2. **Copy your Account ID.** Open **Workers & Pages** in the left menu; the Account ID is in the right-hand column (or use the account menu → *Copy account ID*). It's a 32-character code.
3. **Create an API token** for GitHub to deploy with:
   - Go to **My Profile → API Tokens** (or **Manage account → Account API tokens**) → **Create Token**.
   - Under **Custom token**, click **Get started**.
   - **Token name:** `GitHub deploy – pegboard`
   - **Permissions:** `Account` · `Cloudflare Pages` · `Edit` — this is the only permission it needs.
   - **Account resources:** `Include` · *your account*.
   - **Continue to summary → Create Token.** Copy the token now — Cloudflare shows it only once.

Treat this token like a password. It can only manage Pages projects in your account, but if it ever leaks, delete it in the same screen and make a new one.

You don't need to create the Pages project yourself: the pipeline creates a project called `pegboard` on its first deploy.

---

## 3. Give GitHub the Cloudflare keys

In your repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Add two:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from step 2.3 |
| `CLOUDFLARE_ACCOUNT_ID` | the Account ID from step 2.2 |

Secrets are encrypted, hidden in logs, and never visible again after saving — even to you.

---

## 4. Set up the three environments

**Settings → Environments.** You may already see `dev` and `staging`: GitHub creates environments automatically the first time a workflow uses them. Open each one (or click **New environment**) and set:

| Environment | Deployment branches and tags | Protection |
|---|---|---|
| `dev` | Selected branches → `develop` | none |
| `staging` | Selected branches → `main` | none |
| `production` | Selected branches → `main` | **Required reviewers** → add yourself. Leave *Prevent self-review* unticked if you work alone. |

**Set up `production` before anything runs on `main` again.** If GitHub creates it automatically, it has no approval rule, and production would deploy without waiting for you.

The branch rule means only `develop` can deploy to dev, and only `main` can deploy to staging and production — even if someone edits a workflow.

Don't add any variables yet. You'll add `SITE_URL` to production in step 7, once your own domain works.

---

## 5. First deploy

Re-run the failed workflow: **Actions → Deploy → the failed run → Re-run failed jobs**. Or push any small change.

What happens on `develop`:

1. **test** — builds the site with production settings, checks every page and link, runs the unit tests.
2. **dev** — builds for dev, creates the Pages project `pegboard` if it doesn't exist yet, uploads the site, then the **smoke test** opens every page on the live address and confirms it's serving *this exact commit*.

Open the finished run: its **summary** shows the address. That's also where you'll see if Cloudflare gave your project a slightly different name — `pages.dev` addresses are shared by everyone, so if `pegboard` was taken you might get something like `pegboard-4kx.pages.dev`. Use whatever the summary shows in place of `pegboard.pages.dev` below.

What happens on `main`: **test → staging → production**. Production pauses with *"Waiting for review"*. Open the run, click **Review deployments → production → Approve and deploy**.

Your addresses:

| Environment | Address | Search engines |
|---|---|---|
| dev | `https://dev.pegboard.pages.dev` | blocked (noindex + robots.txt) |
| staging | `https://staging.pegboard.pages.dev` | blocked |
| production | `https://pegboard.pages.dev`, then `https://tools.yourdomain.com` | allowed |

Dev and staging show a striped banner at the top so nobody mistakes them for the real site. Every deployment also keeps its own permanent address (like `https://3f9a1c2e.pegboard.pages.dev`), listed in the run summary and in Cloudflare — handy for comparing two versions.

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

## 7. Put production on your Hostinger domain

Your domain and current website stay with Hostinger. You add one DNS record that sends a subdomain — `tools` in these examples — to Cloudflare. Do the steps in this order: if the DNS record exists before Cloudflare expects it, the domain shows a connection error (522) until Cloudflare catches up.

1. **Tell Cloudflare about the subdomain.** Cloudflare dashboard → **Workers & Pages** → `pegboard` → **Custom domains** → **Set up a custom domain** → enter `tools.yourdomain.com` → **Continue**. Because your DNS is at Hostinger, Cloudflare shows a CNAME record for you to add. Keep that page open.
2. **Add the record in Hostinger.** hPanel → **Domains** → your domain → **DNS / Nameservers** (the DNS Zone Editor).
   - If a record named `tools` already exists, delete it first.
   - Add a new record: **Type** `CNAME`, **Name** `tools`, **Target** `pegboard.pages.dev` (exactly what Cloudflare showed), **TTL** leave the default. Save.
3. **Wait for it to go live.** Back in Cloudflare, the custom domain shows **Verifying**, then **Active**. That usually takes minutes, sometimes a few hours, at most 24. Cloudflare issues the HTTPS certificate automatically.
4. **Tell the pipeline the public address.** GitHub → **Settings → Environments → production → Environment variables → Add variable**: name `SITE_URL`, value `https://tools.yourdomain.com`.
5. **Redeploy production** so links and the sitemap use your domain: **Actions → Redeploy → Run workflow** → branch `main` → environment `production` → approve. From now on the smoke test checks your domain too.
6. **Tell Google.** Add `https://tools.yourdomain.com` in [Google Search Console](https://search.google.com/search-console) and submit `https://tools.yourdomain.com/sitemap.xml`. A link to the tools from your main website's menu helps people (and search engines) find them.

`pegboard.pages.dev` keeps working; every page tells search engines that your domain is the real address, so you won't get duplicate listings. Dev and staging stay on their `pages.dev` addresses.

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
| **Roll back production now** | Cloudflare dashboard → **Workers & Pages** → `pegboard` → **Deployments** → find an earlier *Production* deployment → **⋯** → **Rollback to this deployment**. Takes effect in seconds. |
| Roll back via the pipeline | **Actions → Redeploy → Run workflow** → in *Use workflow from* pick an older **tag** (e.g. `v0.1.0`) → environment `production`. |
| "Cloudflare rejected the API token" | The token is incomplete or lacks permission. Make a new one with `Account · Cloudflare Pages · Edit` (step 2.3) and paste it into the `CLOUDFLARE_API_TOKEN` secret again. |
| "Cloudflare doesn't recognize the account" | `CLOUDFLARE_ACCOUNT_ID` is wrong — copy the 32-character Account ID again (step 2.2). |
| Warning about the production branch | The Pages project's production branch must be `main`. Cloudflare → `pegboard` → **Settings** → **Branch control**. |
| Custom domain stuck on *Verifying* | Check the Hostinger record: type CNAME, name `tools`, target exactly as Cloudflare showed, and no other record named `tools`. If it's still pending after 24 hours, look for **CAA** records in Hostinger's DNS (most domains have none); they can stop the certificate being issued. |
| Custom domain shows error 522 | The CNAME was added before step 7.1. Make sure the domain is listed under the project's **Custom domains**, then wait a few minutes. |
| Smoke test says the live build doesn't match | Usually an old copy cached for a few seconds — re-run the job. If it persists, check `SITE_URL` points at this environment. |
| "Waiting for review" and nothing happens | You're a required reviewer — open the run and click **Review deployments**. |
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
| **Hostinger** (your current host) | everything with one company | deploys by FTP; no separate dev/staging addresses, one-click rollback or header control out of the box |
| **Cloudflare Workers** | Cloudflare's newer platform | to use your own domain, its DNS has to move to Cloudflare |
| **GitHub Pages** | simplest possible: one site, no extra account | one environment per repo, so no dev/staging; fewer header controls |
| **Netlify** | automatic preview site for every pull request | free plan has monthly usage limits |

The site is plain HTML, CSS and JavaScript in `dist/`, so moving to any of these later only means swapping the deploy step.
