# Competition judging app

Vanilla HTML/CSS/JS, `styles.css`, and one shared `app.js`. There is no JavaScript build step. Each judge is meant to get **their own HTML page** (e.g. `example-smith.html`, cloned from the sample) with their name set in a small script block. The public **index** page is a minimal home with the current sample **Example SMITH**—there is no judge name picker in the app.

- **Scoring + Git merge:** [Vercel](#deploy-on-vercel) (run `npx vercel` or connect the repo) so the `/api/submit` serverless route can run.
- **Static only:** [GitHub Pages](#github-pages) can host the files, but **submissions will not** be written back into the repository from the browser. Use Vercel if you need the combined file in `data/submissions.json`.

## Judge pages (clone per person)

1. Open `example-smith.html` as a reference. It includes:

   ```html
   <script>
     window.__JUDGE_PAGE = { name: "Example SMITH" };
   </script>
   ```

2. **Save as a new file** (e.g. `jane-doe.html`) and set `name` to the judge’s display name. Update the `<title>` in the same file. Share the full URL to that file, for example:  
   `https://<your-project>.vercel.app/jane-doe.html`
3. Optional: set an ingest key in Vercel (see [Environment variables](#vervironment-variables)) and the same file can include  
   `window.__JUDGE_PAGE = { name: "…", ingestKey: "<same as INGEST_SECRET>" }` (only in private or trusted settings—any value in static HTML is visible to people who can load the page).

## Deploy on Vercel

1. Push the repository to GitHub, GitLab, or Bitbucket and import it in the [Vercel](https://vercel.com) dashboard, or run `npx vercel` from the project root.
2. **Framework / build:** `vercel.json` uses **Other** with no build command. The **Output Directory** can be left as default (the project root), not a `dist` folder.
3. Add the [environment variables](#environment-variables) for GitHub.
4. Deploy. Static pages and `api/submit` are available at your project URL (e.g. `https://your-project.vercel.app/example-smith.html`).

### Merged submissions in Git (Excel-friendly JSON)

1. A **classic** or **fine-grained** GitHub token is needed with `contents: write` on the target repository (same repo the app uses, or another you choose). Store it in Vercel as `GITHUB_TOKEN`.
2. Set `GITHUB_OWNER` and `GITHUB_REPO` (and optionally `GITHUB_BRANCH`, default `main`, and `SUBMISSIONS_FILE_PATH`, default `data/submissions.json`).
3. Each **Submit** from a judge page POSTs to `/api/submit`, which read–modify–writes the JSON file and **commits to the default branch** so you can `git pull` a single file with every judge. Open `data/submissions.json` in a spreadsheet, or import JSON in Excel, as you prefer.
4. To avoid a **new production deployment on every data commit** (commit messages from the API include `[skip deploy]`), set **Project → Settings → Git → Ignored Build Step** to something that exits `0` when the latest commit message contains `skip deploy`, so those commits do not start a new build. Adjust to match your Vercel docs, since behaviour can change.

## Environment variables

| Name | Required | Description |
|------|----------|-------------|
| `GITHUB_TOKEN` | For repo writes | Token with `repo` (classic) or repository Contents write (fine-grained) |
| `GITHUB_OWNER` | For repo writes | e.g. `my-org` or your username |
| `GITHUB_REPO` | For repo writes | Repository name (without `.git`) |
| `GITHUB_BRANCH` | No | Branch to update, default `main` |
| `SUBMISSIONS_FILE_PATH` | No | Path in repo, default `data/submissions.json` |
| `INGEST_SECRET` | No | If set, requests must include header `x-ingest-key: <value>`; optional `ingestKey` in `__JUDGE_PAGE` to send the same from the static page (visible in the client) |

See `.env.example` for a template (do not commit real tokens).

## GitHub Pages

1. In **Settings → Pages**, set the source to the default branch and **/ (root)**.
2. The site is available at a URL like `https://github-username.github.io/repository-name/`. Relative links (`./styles.css`, `./app.js`) work for subpaths.
3. The `/api` route is **not** available on GitHub Pages; use Vercel for auto-merge into the repo.

## Local use

From this directory, run a static server (e.g. `npx serve .`) and open `index.html` or a judge page like `example-smith.html`. A plain `file://` open may not call `/api/submit` correctly; use a local server. Without Vercel env, submissions still **save in the browser** (per judge) via `localStorage`.
