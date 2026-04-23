# Competition Judging (static site)

Vanilla HTML/CSS/JS. Data stays in the browser (`localStorage`) unless you add a backend later.

## Publish with GitHub Pages

### 1. Create a new repository on GitHub

1. Log in to [github.com](https://github.com) and click **+** → **New repository**.
2. Name it (e.g. `competition-judging`), keep it **Public** (free Pages for public repos).
3. Do **not** add a README, .gitignore, or license (this project already has files).
4. Click **Create repository**.

### 2. Push this folder from your computer

In a terminal, open this project folder and run (replace `YOUR_USER` and `YOUR_REPO`):

```bash
git init
git add .
git commit -m "Add competition judging site"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

If GitHub shows you a different `origin` URL (SSH), use that instead.

### 3. Turn on GitHub Pages

1. On GitHub, open your repository → **Settings** → **Pages** (left sidebar).
2. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
3. **Branch**: `main`, folder **`/ (root)`**, then **Save**.

### 4. Open your site

After 1–3 minutes, the site will be at:

`https://YOUR_USER.github.io/YOUR_REPO/`

(Example: user `jane` and repo `competition-judging` → `https://jane.github.io/competition-judging/`)

Refresh the **Actions** or **Pages** page if the URL is not ready yet.

---

**Note:** Each visitor’s browser has its own `localStorage`. For shared, centralized scores you would connect Supabase (or another backend) later.
