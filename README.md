# HTML Studio — Standalone GitHub Edition

A complete, browser-based HTML / CSS / JavaScript editor. No build step, no
dependencies, no server — just open `index.html`. Works on GitHub Pages.

## Features (everything included)

- **Tabbed editor** — keep multiple files open and switch between them.
- **Chrome-style tab pinning** — pinned tabs shrink to a dot. Right-click a tab
  for **Rename / Pin / Close**.
- **HTML, CSS and JS panels** per tab with a live **preview** (iframe).
- **Run** (refresh preview) and **Open in new tab** (writes the page to a
  `about:blank` window).
- **Format button** — cleans up and indents HTML, CSS or JavaScript.
- **Console panel** — captures `console.log/info/warn/error`, runtime errors
  and unhandled rejections from your JavaScript.
- **Drag & drop** HTML/CSS/JS files into the editor area to open them in new
  tabs instantly.
- **Open files** from disk via the Open button.
- **File explorer sidebar** — a persistent project tree (folders + files)
  saved in `localStorage`. Create folders/files, rename, delete, and click a
  file to open it. Use **💾 Save** to store the current tab into the explorer.
- **Templates menu** — 14 starters including HTML5 boilerplate, CSS reset,
  navbar, card grid, buttons, and games (Snake, Tic Tac Toe, Memory, Quiz) plus
  a calculator, clock and todo list.
- **4 themes** — Black (dark black, default), Grey, White, and Retro (square,
  green-on-black). All use a rounded, minimal Google-style UI.

## Files

- `index.html` — app shell / layout
- `styles.css` — all styling + the four themes
- `app.js` — editor logic (tabs, explorer, console, preview, drag-drop)
- `templates.js` — the 14 starter templates
- `formatter.js` — the HTML/CSS/JS formatters

## Run locally

Just open `index.html` in any modern browser. ES modules are used, so serve
over HTTP if your browser blocks module loading from `file://`:

```
npx serve .
# or
python3 -m http.server
```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo (e.g. as the repo root or under `/docs`).
2. In the repo: **Settings → Pages → Build and deployment → Branch**, pick the
   branch and folder.
3. Your editor is live at `https://<user>.github.io/<repo>/`.

> The sidebar project tree is stored in the browser's `localStorage`, so it
> persists per device/browser — it is not synced to the repo.
