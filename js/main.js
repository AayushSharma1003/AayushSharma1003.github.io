/* ============================================================
   Aayush Sharma — portfolio descent  (v2: full sensory mode)

   Hero:     a levitating shell of stone blocks over a moonscape.
             Blocks repel from your cursor. Scroll scatters the
             shell and you fly straight through it.
   World 0:  gravity particles that fall toward your cursor
   World 1:  a torn signal that degrades with cursor speed
   World 2:  a temple whose orb watches your cursor
   Extras:   UnrealBloom, generative ambient audio, loader
   ============================================================ */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TOUCH = window.matchMedia("(hover: none), (pointer: coarse)").matches;

/* ---------------- GSAP availability ---------------- */
const hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
if (hasGSAP) {
  gsap.registerPlugin(ScrollTrigger);
  document.body.classList.remove("no-js");
}

/* ============================================================
   LOADER
   ============================================================ */
const loaderEl = document.getElementById("loader");
const loaderCount = document.getElementById("loaderCount");
const loaderFill = document.getElementById("loaderFill");
let loaderDone = false;

function finishLoading() {
  if (loaderDone) return;
  loaderDone = true;
  document.body.classList.remove("is-loading");
  runHeroEntrance();
}

(function animateLoader() {
  const start = performance.now();
  const DUR = REDUCED ? 200 : 1500;
  function tick(now) {
    const t = Math.min((now - start) / DUR, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const n = Math.floor(eased * 100);
    loaderCount.textContent = String(n).padStart(3, "0");
    loaderFill.style.transform = `scaleX(${eased})`;
    if (t < 1) requestAnimationFrame(tick);
    else Promise.resolve(document.fonts ? document.fonts.ready : null).then(() =>
      setTimeout(finishLoading, 150)
    );
  }
  requestAnimationFrame(tick);
})();

/* ============================================================
   AUDIO — generative ambient, off by default
   ============================================================ */
const audio = {
  ctx: null, master: null, whooshGain: null, on: false,

  build() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // deep drone — two detuned sines + an octave triangle
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 240;
    [["sine", 52], ["sine", 52.7], ["triangle", 104.3]].forEach(([type, f]) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f;
      o.connect(droneGain); o.start();
    });
    droneGain.connect(lp); lp.connect(this.master);

    // airy shimmer — slow-wandering bandpassed noise
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const shimmerSrc = ctx.createBufferSource();
    shimmerSrc.buffer = noiseBuf; shimmerSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1700; bp.Q.value = 0.7;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.012;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 700;
    lfo.connect(lfoGain); lfoGain.connect(bp.frequency); lfo.start();
    shimmerSrc.connect(bp); bp.connect(shimmerGain); shimmerGain.connect(this.master);
    shimmerSrc.start();

    // scroll whoosh — wind that rises with travel speed
    const whooshSrc = ctx.createBufferSource();
    whooshSrc.buffer = noiseBuf; whooshSrc.loop = true;
    const wbp = ctx.createBiquadFilter();
    wbp.type = "bandpass"; wbp.frequency.value = 420; wbp.Q.value = 0.4;
    this.whooshGain = ctx.createGain();
    this.whooshGain.gain.value = 0;
    whooshSrc.connect(wbp); wbp.connect(this.whooshGain);
    this.whooshGain.connect(this.master);
    whooshSrc.start();
  },

  toggle() {
    if (!this.ctx) this.build();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.on = !this.on;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(this.on ? 0.45 : 0, t + 0.8);
    return this.on;
  },

  whoosh(v) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    this.whooshGain.gain.setTargetAtTime(Math.min(v, 1) * 0.3, t, 0.12);
  },

  ping(freq) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq * 0.5, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 1.2);
  },
};

const soundToggle = document.getElementById("soundToggle");
const soundLabel = document.getElementById("soundLabel");
soundToggle.addEventListener("click", () => {
  const on = audio.toggle();
  soundToggle.setAttribute("aria-pressed", String(on));
  soundLabel.textContent = on ? "Sound: On" : "Sound: Off";
});

/* ============================================================
   RENDERER + COMPOSER
   ============================================================ */
const canvas = document.getElementById("gl");
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (e) {
  document.body.classList.add("no-webgl", "no-js");
  document.querySelector(".no-webgl-note").hidden = false;
}

if (renderer) {
  const DPR = Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x07070f);
  scene.fog = new THREE.FogExp2(fogColor, 0.024);
  scene.background = fogColor;

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(0, 0, 12);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(DPR);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    TOUCH ? 0.55 : 0.8,   // strength
    0.55,                 // radius
    0.25                  // threshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------------- constants ---------------- */
  const Z = { shell: -14, gravity: -55, glitch: -100, temple: -145 };
  const RING_Z = [-32, -72, -118];

  const ACCENTS = {
    hero:    { hex: "#e8e4da", fog: 0x07070f, ping: 392 },
    gravity: { hex: "#8b7bff", fog: 0x0a0718, ping: 440 },
    glitch:  { hex: "#ff3b5c", fog: 0x120409, ping: 494 },
    temple:  { hex: "#ffb347", fog: 0x0f0a03, ping: 330 },
  };

  const WAYPOINTS = [
    [0.0, 12], [0.285, -41], [0.559, -86], [0.833, -131], [1.0, -140],
  ];

  function cameraZ(p) {
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const [p0, z0] = WAYPOINTS[i];
      const [p1, z1] = WAYPOINTS[i + 1];
      if (p <= p1 || i === WAYPOINTS.length - 2) {
        let t = THREE.MathUtils.clamp((p - p0) / (p1 - p0), 0, 1);
        t = t * t * (3 - 2 * t);
        return z0 + (z1 - z0) * t;
      }
    }
    return WAYPOINTS[WAYPOINTS.length - 1][1];
  }

  /* ---------------- shared textures ---------------- */
  function glowTexture(r, g, b) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function softDotTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.4)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const dotTex = softDotTexture();

  /* ============================================================
     HERO ZONE — moonscape terrain
     ============================================================ */
  function hash2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let xf = x - xi, yf = y - yi;
    xf = xf * xf * (3 - 2 * xf);
    yf = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  function fbm(x, y) {
    let v = 0, amp = 0.5, f = 1;
    for (let o = 0; o < 4; o++) {
      v += amp * vnoise(x * f, y * f);
      amp *= 0.5; f *= 2.1;
    }
    return v;
  }

  {
    const W = 170, D = 150;
    const segX = TOUCH ? 110 : 170, segY = TOUCH ? 90 : 150;
    const terrainGeo = new THREE.PlaneGeometry(W, D, segX, segY);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const zWorld = pos.getZ(i) - 30; // plane centered, we shift below
      let h = fbm(x * 0.045, zWorld * 0.045) * 6.0;
      // valley down the middle so the camera path stays clear,
      // mountains rising at the flanks — igloo-style horizon
      const flank = Math.min(Math.abs(x) / 28, 1);
      h = h * (0.25 + flank * 1.5) + flank * flank * 7.0;
      pos.setY(i, h);
    }
    terrainGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({
      color: 0x4d4a5c, roughness: 0.96, metalness: 0,
    }));
    terrain.position.set(0, -8.5, -30);
    scene.add(terrain);
  }

  // hero lighting
  scene.add(new THREE.HemisphereLight(0x3a3658, 0x0a0a12, 0.7));
  const moonKey = new THREE.DirectionalLight(0x8a86b8, 0.6);
  moonKey.position.set(-18, 26, 10);
  scene.add(moonKey);

  /* ============================================================
     HERO ZONE — the block shell + core (the igloo move)
     ============================================================ */
  const SHELL_CENTER = new THREE.Vector3(2.2, 0.4, Z.shell);
  const BLOCK_COUNT = TOUCH ? 52 : 88;
  const SHELL_R = 4.2;

  const blockGeo = new RoundedBoxGeometry(1.5, 1.0, 0.62, 2, 0.16);
  const blockMat = new THREE.MeshStandardMaterial({
    color: 0x8e8a9e, roughness: 0.82, metalness: 0.05,
  });

  const shell = new THREE.Group();
  const blocks = [];

  for (let i = 0; i < BLOCK_COUNT; i++) {
    // fibonacci sphere distribution
    const phi = Math.acos(1 - 2 * (i + 0.5) / BLOCK_COUNT);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const normal = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    );
    const mesh = new THREE.Mesh(blockGeo, blockMat);
    const home = normal.clone().multiplyScalar(SHELL_R);
    mesh.position.copy(home);
    mesh.lookAt(0, 0, 0);
    const s = 0.72 + Math.random() * 0.62;
    mesh.scale.set(s, s * (0.8 + Math.random() * 0.4), s);
    shell.add(mesh);
    blocks.push({
      mesh, home, normal,
      offset: 0, offsetTarget: 0,
      phase: Math.random() * Math.PI * 2,
      bobSpeed: 0.5 + Math.random() * 0.7,
      scatterDir: normal.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.7,
        Math.random() * 0.5,
        (Math.random() - 0.5) * 0.7
      )).normalize(),
      spin: (Math.random() - 0.5) * 1.4,
    });
  }
  shell.position.copy(SHELL_CENTER);
  scene.add(shell);

  // the core — white-hot heart of the shell
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.05, 3),
    new THREE.MeshBasicMaterial({ color: 0xfff6e8 })
  );
  core.position.copy(SHELL_CENTER);
  scene.add(core);

  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(255, 244, 224), transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  coreGlow.scale.setScalar(11);
  coreGlow.position.copy(SHELL_CENTER);
  scene.add(coreGlow);

  const coreLight = new THREE.PointLight(0xfff0d8, 140, 60, 2);
  coreLight.position.copy(SHELL_CENTER);
  scene.add(coreLight);

  // invisible proxy sphere for cursor raycasting
  const shellProxy = new THREE.Mesh(
    new THREE.SphereGeometry(SHELL_R + 0.7, 16, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  shellProxy.position.copy(SHELL_CENTER);
  scene.add(shellProxy);

  /* ---------------- ambient dust (whole tunnel) ---------------- */
  {
    const N = TOUCH ? 800 : 1600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 64;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 38;
      pos[i * 3 + 2] = 24 - Math.random() * 190;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.07, map: dotTex, color: 0x6a6580, transparent: true,
      opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
    })));
  }

  /* ---------------- threshold rings ---------------- */
  const rings = [];
  const ringColors = [0x8b7bff, 0xff3b5c, 0xffb347];
  RING_Z.forEach((z, i) => {
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: ringColors[i], transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const inner = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.05, 8, 90), mat);
    const outer = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.018, 8, 90), mat.clone());
    outer.material.opacity = 0.2;
    grp.add(inner, outer);
    grp.position.z = z;
    scene.add(grp);
    rings.push(grp);
  });

  /* ============================================================
     WORLD 0 — GRAVITY GOD
     ============================================================ */
  const G_COUNT = TOUCH ? 3000 : 8000;
  const gPos = new Float32Array(G_COUNT * 3);
  const gHome = new Float32Array(G_COUNT * 3);
  const gVel = new Float32Array(G_COUNT * 3);

  for (let i = 0; i < G_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.55) * 16;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.6;
    const z = Z.gravity + (Math.random() - 0.5) * 8;
    gPos.set([x, y, z], i * 3);
    gHome.set([x, y, z], i * 3);
  }

  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3));
  const gravityPoints = new THREE.Points(gGeo, new THREE.PointsMaterial({
    size: 0.1, map: dotTex, color: 0x8b7bff, transparent: true,
    opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(gravityPoints);

  {
    const N = Math.floor(G_COUNT / 5);
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = gPos[i * 15];
      pos[i * 3 + 1] = gPos[i * 15 + 1];
      pos[i * 3 + 2] = gPos[i * 15 + 2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.05, map: dotTex, color: 0xe8e4da, transparent: true,
      opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
    })));
  }

  /* ============================================================
     WORLD 1 — REALITY GLITCH
     ============================================================ */
  const glitchUniforms = {
    uTime: { value: 0 },
    uGlitch: { value: 0.06 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uFade: { value: 1 },
  };

  const glitchPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 15.8),
    new THREE.ShaderMaterial({
      uniforms: glitchUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform float uGlitch;
        uniform vec2 uMouse;
        uniform float uFade;
        varying vec2 vUv;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                     mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }

        float pattern(vec2 uv) {
          float n = noise(vec2(uv.y * 7.0, uTime * 0.35));
          float bands = 0.5 + 0.5 * sin(uv.y * 42.0 + n * 9.0 + uTime * 1.1);
          float st = hash(floor(uv * vec2(170.0, 96.0)) + floor(uTime * 22.0)) * 0.32;
          float beam = exp(-pow((uv.y - fract(uTime * 0.11)) * 9.0, 2.0));
          return bands * 0.30 + st + beam * 0.55;
        }

        void main() {
          vec2 uv = vUv;

          vec2 d = uv - uMouse;
          float r = length(d);
          float twist = uGlitch * 3.4 * exp(-r * r * 8.0);
          float a = atan(d.y, d.x) + twist;
          uv = uMouse + vec2(cos(a), sin(a)) * r;

          float step8 = floor(uTime * 8.0);
          vec2 block = floor(uv * vec2(18.0, 10.0));
          float rnd = hash(block + step8);
          if (rnd > 1.0 - uGlitch * 0.65) {
            uv.x += (hash(block + step8 + 7.0) - 0.5) * uGlitch * 0.55;
            uv.y += (hash(block + step8 + 13.0) - 0.5) * uGlitch * 0.14;
          }

          float sh = uGlitch * 0.032 + 0.002;
          float rC = pattern(uv + vec2(sh, 0.0));
          float gC = pattern(uv);
          float bC = pattern(uv - vec2(sh, 0.0));

          vec3 col = rC * vec3(1.0, 0.18, 0.30)
                   + bC * vec3(0.20, 0.80, 1.00)
                   + gC * vec3(0.10, 0.10, 0.12);

          col *= 0.86 + 0.14 * sin(vUv.y * 620.0);
          col *= smoothstep(1.05, 0.35, length(vUv - 0.5) * 1.5);

          gl_FragColor = vec4(col * 0.9, uFade);
        }
      `,
    })
  );
  glitchPlane.position.z = Z.glitch;
  scene.add(glitchPlane);

  const shards = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const w = 0.6 + Math.random() * 2.6;
    const shard = new THREE.Mesh(
      new THREE.BoxGeometry(w, w * 0.6, 0.05),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xff3b5c : 0x41e6ff, wireframe: true,
        transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending,
      })
    );
    shard.position.set(
      (Math.random() - 0.5) * 28,
      (Math.random() - 0.5) * 16,
      Z.glitch + 2 + Math.random() * 8
    );
    shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    shard.userData.spin = (Math.random() - 0.5) * 0.45;
    shards.add(shard);
  }
  scene.add(shards);

  /* ============================================================
     WORLD 2 — GESTURE SORCERY
     ============================================================ */
  const stone = new THREE.MeshStandardMaterial({ color: 0x2c2218, roughness: 0.95, metalness: 0 });
  const colGeo = new THREE.CylinderGeometry(0.62, 0.8, 11, 10);
  const capGeo = new THREE.BoxGeometry(2.1, 0.55, 2.1);

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 6; i++) {
      const grp = new THREE.Group();
      const col = new THREE.Mesh(colGeo, stone);
      const cap = new THREE.Mesh(capGeo, stone);
      const base = new THREE.Mesh(capGeo, stone);
      cap.position.y = 5.75;
      base.position.y = -5.75;
      grp.add(col, cap, base);
      grp.position.set(side * 6.8, -0.4, Z.temple + 20 - i * 7);
      scene.add(grp);
    }
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 80),
    new THREE.MeshStandardMaterial({ color: 0x0c0a07, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -6.1, Z.temple);
  scene.add(floor);

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0x2a1300, emissive: 0xff9933, emissiveIntensity: 2.4, roughness: 0.35,
    })
  );
  orb.position.set(0, 0.3, Z.temple);
  scene.add(orb);

  const orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(255, 165, 70), transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  orbGlow.scale.setScalar(9.5);
  orbGlow.position.copy(orb.position);
  scene.add(orbGlow);

  const orbLight = new THREE.PointLight(0xffaa44, 70, 55, 2);
  orbLight.position.copy(orb.position);
  scene.add(orbLight);

  const E_COUNT = TOUCH ? 140 : 300;
  const ePos = new Float32Array(E_COUNT * 3);
  const eSpeed = new Float32Array(E_COUNT);
  for (let i = 0; i < E_COUNT; i++) {
    ePos[i * 3] = (Math.random() - 0.5) * 18;
    ePos[i * 3 + 1] = -6 + Math.random() * 15;
    ePos[i * 3 + 2] = Z.temple + (Math.random() - 0.5) * 36;
    eSpeed[i] = 0.3 + Math.random() * 0.9;
  }
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
  scene.add(new THREE.Points(eGeo, new THREE.PointsMaterial({
    size: 0.09, map: dotTex, color: 0xffb347, transparent: true,
    opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
  })));

  /* ============================================================
     POINTER + SCROLL
     ============================================================ */
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, speed: 0, lastT: performance.now(), idleT: 0 };

  function onPointer(x, y) {
    const nx = (x / window.innerWidth) * 2 - 1;
    const ny = -((y / window.innerHeight) * 2 - 1);
    const now = performance.now();
    const dt = Math.max(now - mouse.lastT, 8) / 1000;
    const d = Math.hypot(nx - mouse.x, ny - mouse.y);
    mouse.speed = Math.min(mouse.speed * 0.6 + (d / dt) * 0.4, 8);
    mouse.x = nx; mouse.y = ny;
    mouse.lastT = now;
    mouse.idleT = 0;
  }

  window.addEventListener("pointermove", (e) => onPointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (e.touches[0]) onPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  let targetP = 0, p = 0;
  function readScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    targetP = max > 0 ? window.scrollY / max : 0;
  }
  window.addEventListener("scroll", readScroll, { passive: true });
  readScroll();

  /* ---------------- zones ---------------- */
  const railFill = document.getElementById("railFill");
  const railDots = [...document.querySelectorAll(".rail-dot")];
  const fogTarget = new THREE.Color(ACCENTS.hero.fog);
  let zone = "hero";

  function zoneFor(z) {
    if (z > -28) return "hero";
    if (z > -70) return "gravity";
    if (z > -116) return "glitch";
    return "temple";
  }

  function applyZone(next) {
    if (next === zone) return;
    zone = next;
    fogTarget.set(ACCENTS[next].fog);
    document.body.style.setProperty("--accent", ACCENTS[next].hex);
    audio.ping(ACCENTS[next].ping);
    const idx = ["gravity", "glitch", "temple"].indexOf(next);
    railDots.forEach((d, i) => d.classList.toggle("active", i === idx));
  }

  /* ---------------- frame loop ---------------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmpA = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const attractor = new THREE.Vector3();
  const clock = new THREE.Clock();
  let firstFrame = true;

  function attractorAt(zPlane, out) {
    tmpA.set(mouse.sx, mouse.sy, 0.5).unproject(camera);
    tmpDir.copy(tmpA).sub(camera.position).normalize();
    const t = (zPlane - camera.position.z) / tmpDir.z;
    out.copy(camera.position).addScaledVector(tmpDir, t);
    return out;
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    mouse.idleT += dt;
    if (TOUCH || mouse.idleT > 4) {
      mouse.x = Math.sin(t * 0.45) * 0.45;
      mouse.y = Math.cos(t * 0.32) * 0.35;
      mouse.speed *= 0.97;
    }

    const ease = REDUCED ? 1 : 0.08;
    mouse.sx += (mouse.x - mouse.sx) * ease;
    mouse.sy += (mouse.y - mouse.sy) * ease;
    mouse.speed *= 0.95;

    const prevP = p;
    p += (targetP - p) * (REDUCED ? 1 : 0.07);
    audio.whoosh(Math.abs(p - prevP) * 220);

    const camZ = cameraZ(p);
    camera.position.z = camZ;
    camera.position.x += (mouse.sx * 1.0 - camera.position.x) * 0.06;
    camera.position.y += (mouse.sy * 0.6 - camera.position.y) * 0.06;
    camera.lookAt(camera.position.x * 0.4, camera.position.y * 0.4, camZ - 12);
    camera.rotation.z = mouse.sx * -0.018;

    applyZone(zoneFor(camZ));
    scene.fog.color.lerp(fogTarget, 0.04);
    scene.background = scene.fog.color;
    if (railFill) railFill.style.transform = `scaleY(${p})`;

    /* ---- hero shell ---- */
    if (camZ > -45) {
      // scatter as the descent begins
      const scatter = THREE.MathUtils.smoothstep(p, 0.025, 0.13);

      // cursor raycast against the shell
      let hit = null;
      if (scatter < 0.5) {
        ndc.set(mouse.sx, mouse.sy);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObject(shellProxy);
        if (hits.length) hit = hits[0].point;
      }

      shell.rotation.y += dt * 0.07;

      for (const b of blocks) {
        // repulsion from cursor
        let target = 0;
        if (hit) {
          tmpV.copy(b.home).applyMatrix4(shell.matrixWorld);
          const d = tmpV.distanceTo(hit);
          if (d < 3.0) {
            const k = 1 - d / 3.0;
            target = k * k * 2.1;
          }
        }
        b.offsetTarget = target;
        b.offset += (b.offsetTarget - b.offset) * 0.09;

        const bob = Math.sin(t * b.bobSpeed + b.phase) * 0.07;
        const lift = b.offset + bob;
        const burst = scatter * 26;

        b.mesh.position.copy(b.home)
          .addScaledVector(b.normal, lift)
          .addScaledVector(b.scatterDir, burst);
        b.mesh.rotation.z += dt * b.spin * scatter * 3;
      }

      // core: breathe, then recede into a star as you approach
      const approach = THREE.MathUtils.clamp((camZ - Z.shell) / 6, 0, 1);
      const breathe = 1 + Math.sin(t * 1.7) * 0.05;
      core.scale.setScalar(Math.max(breathe * approach, 0.12));
      coreGlow.scale.setScalar(11 * breathe * Math.max(approach, 0.25));
      coreLight.intensity = 140 * breathe;
      coreGlow.material.opacity = 0.55 + Math.sin(t * 1.7) * 0.15;
    }

    /* ---- rings ---- */
    rings.forEach((rg) => {
      rg.rotation.z += dt * 0.12;
      const d = Math.abs(camZ - rg.position.z);
      const boost = THREE.MathUtils.clamp(1.6 - d * 0.12, 0, 1.4);
      rg.children[0].material.opacity = 0.32 + boost * 0.55;
      rg.scale.setScalar(1 + Math.sin(t * 0.8 + rg.position.z) * 0.015);
    });

    /* ---- world 0: gravity ---- */
    if (Math.abs(camZ - Z.gravity) < 52) {
      attractorAt(Z.gravity, attractor);
      const pull = 32 * dt;
      for (let i = 0; i < G_COUNT; i++) {
        const ix = i * 3;
        const dx = attractor.x - gPos[ix];
        const dy = attractor.y - gPos[ix + 1];
        const dz = attractor.z - gPos[ix + 2];
        const r2 = dx * dx + dy * dy + dz * dz + 6;
        const f = pull / r2;
        gVel[ix] += dx * f + (gHome[ix] - gPos[ix]) * 0.22 * dt;
        gVel[ix + 1] += dy * f + (gHome[ix + 1] - gPos[ix + 1]) * 0.22 * dt;
        gVel[ix + 2] += dz * f + (gHome[ix + 2] - gPos[ix + 2]) * 0.22 * dt;
        gVel[ix] *= 0.965; gVel[ix + 1] *= 0.965; gVel[ix + 2] *= 0.965;
        gPos[ix] += gVel[ix];
        gPos[ix + 1] += gVel[ix + 1];
        gPos[ix + 2] += gVel[ix + 2];
      }
      gGeo.attributes.position.needsUpdate = true;
      gravityPoints.rotation.z += dt * 0.02;
    }

    /* ---- world 1: glitch ---- */
    if (Math.abs(camZ - Z.glitch) < 58) {
      glitchUniforms.uTime.value = t;
      const targetGlitch = 0.05 + Math.min(mouse.speed * 0.16, 0.92);
      glitchUniforms.uGlitch.value += (targetGlitch - glitchUniforms.uGlitch.value) * 0.08;
      glitchUniforms.uMouse.value.set(mouse.sx * 0.5 + 0.5, mouse.sy * 0.5 + 0.5);
      const ahead = camZ - Z.glitch;
      glitchUniforms.uFade.value = THREE.MathUtils.clamp((ahead - 3) / 5, 0, 1);
      shards.children.forEach((s) => {
        s.rotation.x += dt * s.userData.spin;
        s.rotation.y += dt * s.userData.spin * 1.4;
        s.material.opacity = 0.32 * glitchUniforms.uFade.value;
      });
    }

    /* ---- world 2: temple ---- */
    if (Math.abs(camZ - Z.temple) < 64) {
      const pulse = 1 + Math.sin(t * 2.1) * 0.06 + mouse.speed * 0.01;
      orb.scale.setScalar(pulse);
      orb.position.x += (mouse.sx * 2.8 - orb.position.x) * 0.05;
      orb.position.y += (0.3 + mouse.sy * 1.5 - orb.position.y) * 0.05;
      orbGlow.position.copy(orb.position);
      orbGlow.scale.setScalar(9 * pulse + Math.sin(t * 3.7) * 0.4);
      orbLight.position.copy(orb.position);
      orbLight.intensity = 65 + Math.sin(t * 2.1) * 16 + mouse.speed * 7;
      orb.material.emissiveIntensity = 2.2 + Math.sin(t * 2.1) * 0.5;

      const arr = eGeo.attributes.position.array;
      for (let i = 0; i < E_COUNT; i++) {
        arr[i * 3 + 1] += eSpeed[i] * dt;
        arr[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.18;
        if (arr[i * 3 + 1] > 9.5) arr[i * 3 + 1] = -6;
      }
      eGeo.attributes.position.needsUpdate = true;
    }

    composer.render();

    if (firstFrame) { firstFrame = false; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------------- resize ---------------- */
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    readScroll();
  });
}

/* ============================================================
   DOM — reveals, cursor, magnetic buttons
   ============================================================ */
function runHeroEntrance() {
  if (hasGSAP && !REDUCED) {
    const tl = gsap.timeline({ delay: 0.15 });
    tl.to(".hero-title .line > span", {
      y: 0, duration: 1.15, ease: "power4.out", stagger: 0.12,
    });
    tl.to(".hero .reveal, .scroll-cue", {
      opacity: 1, duration: 1.0, ease: "power2.out", stagger: 0.1,
    }, "-=0.55");
  } else {
    document.querySelectorAll(".reveal, .hero-title .line > span").forEach((el) => {
      el.style.opacity = 1;
      el.style.transform = "none";
    });
  }
}

if (hasGSAP && !REDUCED) {
  document.querySelectorAll(".project, .outro").forEach((sec) => {
    gsap.to(sec.querySelectorAll(".inner > *"), {
      opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.09,
      scrollTrigger: { trigger: sec, start: "top 62%" },
    });
  });
} else {
  document.querySelectorAll(".inner > *").forEach((el) => {
    el.style.opacity = 1;
    el.style.transform = "none";
  });
}

/* ---------------- custom cursor ---------------- */
if (!TOUCH && !REDUCED) {
  const dot = document.querySelector(".cursor-dot");
  const ring = document.querySelector(".cursor-ring");
  let rx = innerWidth / 2, ry = innerHeight / 2;
  let mx = rx, my = ry;

  window.addEventListener("pointermove", (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
  }, { passive: true });

  (function cursorLoop() {
    rx += (mx - rx) * 0.14;
    ry += (my - ry) * 0.14;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(cursorLoop);
  })();

  document.querySelectorAll("[data-hover]").forEach((el) => {
    el.addEventListener("mouseenter", () => document.body.classList.add("cursor-hover"));
    el.addEventListener("mouseleave", () => document.body.classList.remove("cursor-hover"));
  });
}

/* ---------------- magnetic buttons ---------------- */
if (!TOUCH && !REDUCED) {
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("mousemove", (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px)`;
    });
    btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
  });
}
