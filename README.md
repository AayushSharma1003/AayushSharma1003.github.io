# aayushsharma1003.github.io

Portfolio descent — one continuous WebGL tunnel through three webcam experiments.

**Live (after deploy):** https://aayushsharma1003.github.io/

## Structure

```
index.html      — markup + copy
css/style.css   — editorial type system, loader, cursor, rail
js/main.js      — Three.js scene, bloom, physics, audio, GSAP reveals
```

No build step. Three.js + GSAP load from jsDelivr CDN.

## Run locally

```bash
cd ~/Desktop/portfolio-site
python3 -m http.server 8000
# open http://localhost:8000
```

(Must be served over http — ES modules don't load from file://)

## Deploy to GitHub Pages (root user site)

```bash
cd ~/Desktop/portfolio-site
git init
git add .
git commit -m "Portfolio descent v1"
git branch -M main
git remote add origin https://github.com/AayushSharma1003/AayushSharma1003.github.io.git
git push -u origin main
```

Then on GitHub: repo **Settings → Pages → Source: Deploy from a branch → main / (root)**.
Site goes live at https://aayushsharma1003.github.io/ within a couple of minutes.

## The experience

1. **Loader** — counter calibrates to 100
2. **Hero** — a shell of stone blocks levitating over a moonscape; blocks repel
   from your cursor (move your mouse across it). Scrolling detonates the shell
   and the camera flies straight through it.
3. **World 01 — Gravity God** — 8,000 particles fall toward your cursor
4. **World 02 — Reality Glitch** — a broken signal; cursor speed tears it further
5. **World 03 — Gesture Sorcery** — temple, embers, an orb that follows your cursor
6. Threshold rings mark each world boundary; fog and accent color shift per zone
7. **Sound: Off/On** (bottom-left) — generative ambient drone + scroll wind

Respects `prefers-reduced-motion`, falls back gracefully without WebGL or JS,
and drops particle counts on touch devices.
