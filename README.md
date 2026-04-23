# Competition judging app

Vanilla HTML/CSS/JS, `styles.css`, and one shared `app.js`. There is no JavaScript build step. Each judge is meant to get **their own HTML page** (e.g. `example-smith.html`, cloned from the sample) with their name set in a small script block. The public **index** page is a minimal home with the current sample **Example SMITH**—there is no judge name picker in the app.

On each judge page’s **Welcome** screen, a **Submission records** table lists that judge’s teams, weighted total, grade, award, standout / overall feedback text, and each criterion score (0–10). **Download CSV for Excel** exports the same columns. **Reset all my marks** clears the judge’s data in the browser and, if Vercel + GitHub are set up, replaces that judge’s JSON file in the repo with an empty list.

### Data in Git (per judge, Excel-friendly)

- With Vercel, each **Submit** is merged into **one file per judge** under **`data/judges/`** — file name = **slug of the display name** (e.g. `Example SMITH` → `data/judges/example-smith.json`). The array holds that judge’s submissions; pull the repo to open in Excel, compare judges, or archive.
- The previous single file `data/submissions.json` is no longer written; if you have old data there, copy it out before discarding the file.
- **Scoring + Git:** [Vercel](#deploy-on-vercel) (run `npx vercel` or connect the repo) so the `/api/submit` and `/api/reset-judge` serverless routes run.
- **Static only:** [GitHub Pages](#github-pages) can host the files, but **no Git writes** from the app. Use Vercel for repo updates.

## Judge pages (clone per person)

1. Open `example-smith.html` as a reference. It includes:

   ```html
   <script>
     window.__JUDGE_PAGE = { name: "Example SMITH" };
   </script>
   ```

2. **Save as a new file** (e.g. `jane-doe.html`) and set `name` to the judge’s display name. Update the `<title>` in the same file. Share the full URL to that file, for example:  
   `https://<your-project>.vercel.app/jane-doe.html`
3. Optional: set an ingest key in Vercel (see [Environment variables](#environment-variables)) and the same file can include  
   `window.__JUDGE_PAGE = { name: "…", ingestKey: "<same as INGEST_SECRET>" }` (only in private or trusted settings—any value in static HTML is visible to people who can load the page).

## Deploy on Vercel

1. Push the repository to GitHub, GitLab, or Bitbucket and import it in the [Vercel](https://vercel.com) dashboard, or run `npx vercel` from the project root.
2. **Framework / build:** `vercel.json` uses **Other** with no build command. The **Output Directory** can be left as default (the project root), not a `dist` folder.
3. Add the [environment variables](#environment-variables) for GitHub.
4. Deploy. Static pages and the API routes are available (e.g. `https://your-project.vercel.app/example-smith.html`).

## Environment variables

| Name | Required | Description |
|------|----------|-------------|
| `GITHUB_TOKEN` | For repo writes | Token with `repo` (classic) or repository Contents write (fine-grained) |
| `GITHUB_OWNER` | For repo writes | e.g. `my-org` or your username |
| `GITHUB_REPO` | For repo writes | Repository name (without `.git`) |
| `GITHUB_BRANCH` | No | Branch to update, default `main` |
| `JUDGE_DATA_DIR` | No | Directory in repo for judge JSON files, default `data/judges` (no leading slash) |
| `INGEST_SECRET` | No | If set, `POST` to `/api/submit` and `/api/reset-judge` must send header `x-ingest-key: <value>`; optional `ingestKey` in `__JUDGE_PAGE` on the static page (visible in the client) |

**Build noise:** API commits include `[skip deploy]` in the message. Configure **Ignored Build Step** in Vercel if you want to skip redeploys on those commits (see current Vercel docs).

See `.env.example` for a template (do not commit real tokens).

## GitHub Pages

1. In **Settings → Pages**, set the source to the default branch and **/ (root)**.
2. The site is available at a URL like `https://github-username.github.io/repository-name/`. Relative links (`./styles.css`, `./app.js`) work for subpaths.
3. The `/api` routes are **not** available on GitHub Pages; use Vercel for Git integration.

## Local use

From this directory, run a static server (e.g. `npx serve .`) and open `index.html` or a judge page like `example-smith.html`. A plain `file://` open may not call `/api/submit` correctly; use a local server. Without Vercel env, submissions still **save in the browser** (per judge) via `localStorage`. Reset still clears the browser; Git is unchanged without the server.
