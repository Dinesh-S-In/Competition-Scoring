# Competition judging app

Vanilla HTML/CSS/JS in the repository root: `index.html`, `styles.css`, and `app.js`. No build step.

## Deploy on Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In [Vercel](https://vercel.com), import the repository.
3. The included `vercel.json` sets **Framework Preset** to **Other** (`framework: null`) and **Output Directory** to the project root (`.`). You do not need a build command; leave it empty if the dashboard still shows one.
4. Deploy. The app is served at the project URL (e.g. `https://your-project.vercel.app`).

Using the CLI (optional): run `npx vercel` from the project root; the same `vercel.json` applies.

## Deploy on GitHub Pages

1. In the repository **Settings → Pages**, set the source to your default branch and folder **/ (root)**.
2. The app will be available at `https://<user>.github.io/<repo>/`. Asset paths in `index.html` use relative URLs (`./styles.css`, `./app.js`) so they work under that base path.

## Local use

Open `index.html` in a browser, or use any static file server (e.g. `npx serve .` from this directory).
