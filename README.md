# aayushsharma1003.github.io

> Three browser experiments where your webcam is the controller.
> No install. No keyboard. Just gestures.

**Live:** [aayushsharma1003.github.io](https://aayushsharma1003.github.io/)

---

<!-- ADD SCREENSHOT: hero shell -->
<!-- ADD SCREENSHOT: scroll transition -->

## What this is

A single-page WebGL descent through three webcam-controlled worlds, stitched together as one continuous portfolio. Built with Three.js + GSAP, no build step, no framework — just markup, copy, and scroll.

You scroll. The camera flies. The worlds change. Your hand becomes the controller.

---

## The three worlds

### 01 · Gravity God
> *Bend ten thousand particles with an open palm.*

A physics sandbox played with bare hands. An open palm drags a gravity well across the field. A closed fist repels. Pure particle physics, no presets — just you and 8,000 floating points.

<!-- ADD SCREENSHOT: gravity god world -->

### 02 · Reality Glitch
> *A broken signal. Your cursor tears it further.*

You're in a basement with a computer terminal that shouldn't be open. It has the power to distort reality. Move your hands and the matrix bends with you — chromatic aberration, RGB tearing, displacement maps reacting to gesture velocity.

<!-- ADD SCREENSHOT: reality glitch world -->

### 03 · Gesture Sorcery
> *Reach toward the core. The stones move for you.*

A temple. An orb of levitating shell fragments. Hold your hands up — the stones respond. Voice-amplified attacks: fire stream, blast, sword and shield. The closest thing to casting a spell in a browser tab.

<!-- ADD SCREENSHOT: gesture sorcery world -->

---

## The experience

1. **Loader** — counter calibrates to 100
2. **Hero** — a shell of stone blocks levitates over a moonscape; blocks repel from your cursor. Scrolling detonates the shell and the camera flies straight through it.
3. **World 01 — Gravity God** — 8,000 particles fall toward your cursor
4. **World 02 — Reality Glitch** — a broken signal; cursor speed tears it further
5. **World 03 — Gesture Sorcery** — temple, embers, an orb that follows your cursor
6. **Threshold rings** mark each world boundary; fog and accent color shift per zone
7. **Sound: Off/On** (bottom-left) — generative ambient drone + scroll wind

Respects `prefers-reduced-motion`, falls back gracefully without WebGL or JS, and drops particle counts on touch devices.

---

## Tech

- **Three.js** — scene, bloom, physics, GSAP reveals
- **GSAP** — scroll-driven camera and timeline orchestration
- **MediaPipe Hands** (worlds 01–03) — webcam-based gesture detection
- **Vanilla JS** — no framework, no bundler
- **No build step** — Three.js + GSAP load from jsDelivr CDN

## File structure

```
index.html     — markup + copy
css/style.css  — editorial type system, loader, cursor, rail
js/main.js     — Three.js scene, bloom, physics, audio, GSAP reveals
```

---

## Run locally

```bash
cd ~/Desktop/portfolio-site
python3 -m http.server 8000
# open http://localhost:8000
```

> Must be served over HTTP — ES modules don't load from `file://`.

---

## Deploy to GitHub Pages

```bash
cd ~/Desktop/portfolio-site
git init
git add .
git commit -m "Portfolio descent v1"
git branch -M main
git remote add origin https://github.com/AayushSharma1003/AayushSharma1003.github.io.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**. Site goes live at [aayushsharma1003.github.io](https://aayushsharma1003.github.io/) within a couple of minutes.

---

## Why I built this

I was unemployed and bored. So I put my engineering knowledge to use for once in my life and made three things to counterattack my boredom. Then I figured I'd stitch them together into one continuous experience instead of separate demos. The result is this — a portfolio you scroll through like a descent, not a CV.

---

## License

MIT — fork it, tweak it, share what you make.

---

**Built by [Aayush Sharma](https://github.com/AayushSharma1003)**  
*Bennett University · CSE · Machine Learning + NLP*
