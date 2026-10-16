// CAMERA AI JUDGE v3 (Solo + Duo). Techniques borrowed from well-known pose-tracking projects:
//  - Google MediaPipe PoseLandmarker (multi-person, official CDN build) with TF.js MoveNet as automatic fallback
//  - One Euro filter (the standard jitter filter used in MediaPipe / AR apps) on every joint
//  - Confidence-weighted joint-ANGLE similarity (the idea behind Google's Move Mirror), so body size and camera distance don't matter
//  - Just Dance style feedback: per-limb colours, rating text, hold timer, "step back / can't see legs" guidance
// Everything runs in the browser. Only skeletons are used; video is never stored or uploaded.
const CAM_VERSION = 4;
const THRESH = { easy: 65, medium: 70, hard: 75 }; // % match needed per difficulty (tune in playtests)
const HOLD_MS = 1500;                              // pose must stay accurate this long
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const NAMES = { 11: 'left_shoulder', 12: 'right_shoulder', 13: 'left_elbow', 14: 'right_elbow', 15: 'left_wrist', 16: 'right_wrist',
  23: 'left_hip', 24: 'right_hip', 25: 'left_knee', 26: 'right_knee', 27: 'left_ankle', 28: 'right_ankle' };
const JOINTS = Object.values(NAMES);
const EDGES = [['left_shoulder', 'right_shoulder'], ['left_hip', 'right_hip'], ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']];
const SCORE = { free: 15, zero: 70, worst: .35 };   // no penalty up to `free` degrees off, zero at `zero`; `worst` blends in the two worst limbs
const SEGW = { ua: 1, th: 1, torso: 1, fa: .8, sh: .8 };   // longer bones are tracked more reliably, so they count more
const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('could not load ' + src)); document.head.appendChild(s); });
const timeout = (p, ms, msg) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(msg)), ms))]);
const ang = (a, b, m = 1) => Math.atan2((b[0] - a[0]) * m, b[1] - a[1]) * 180 / Math.PI;   // 0 = down, 90 = screen-right
const diff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const dirv = a => [Math.sin(a * Math.PI / 180), Math.cos(a * Math.PI / 180)];
// good = solid, close = dashed, off = dotted: never colour alone (WCAG 1.4.1). Each line has a dark halo so it reads on the orange silhouette.
const COL = d => d < 22 ? ['#6FE3B0', ''] : d < 40 ? ['#FFD166', '.035 .02'] : ['#FF8FA3', '.012 .02'];
// limb fills on the cream pose card: darker versions of the same three colours so they read against cream (dashes on the lines carry the meaning too)
const TINT = d => d < 22 ? '#2F8A5F' : d < 40 ? '#C08A12' : '#C2445E';

class OneEuro {      // One Euro filter (Casiez et al.): smooth when still, responsive when moving
  constructor(mc = 1.5, beta = .02) { this.mc = mc; this.b = beta; this.x = null; }
  f(x, t) {
    const a = (c, dt) => 1 / (1 + 1 / (2 * Math.PI * c) / dt);
    if (this.x === null) { this.x = x; this.dx = 0; this.t = t; return x; }
    const dt = Math.max((t - this.t) / 1000, .001); this.t = t;
    this.dx += a(1, dt) * ((x - this.x) / dt - this.dx);
    this.x += a(this.mc + this.b * Math.abs(this.dx), dt) * (x - this.x);
    return this.x;
  }
}

function targetAngles(p) {
  const k = keypoints(p), t = { torso: ang(k.hip, k.neck) };
  for (const s of ['l', 'r']) {
    const [sh, el, wr] = k[s].arm, [hp, kn, an] = k[s].leg;
    t[s + 'ua'] = ang(sh, el); t[s + 'fa'] = ang(el, wr); t[s + 'th'] = ang(hp, kn); t[s + 'sh'] = ang(kn, an);
  }
  return t;
}

// ---- detector adapters: each returns detect(video) -> [ {joint: {x, y, score}} per person ] in video pixels ----
async function makeMediaPipe(n, status) {
  status('Loading pose model (Google MediaPipe)...');
  const mod = await import(MP + '/vision_bundle.mjs');
  const fileset = await mod.FilesetResolver.forVisionTasks(MP + '/wasm');
  const mk = delegate => mod.PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MP_MODEL, delegate }, runningMode: 'VIDEO', numPoses: n });
  let delegate = 'GPU', lm;
  try { lm = await mk('GPU'); } catch (e) { delegate = 'CPU'; lm = await mk('CPU'); }
  let last = 0;
  return {
    name: 'MediaPipe',
    async detect(video) {
      const t = Math.max(performance.now(), last + 1); last = t;
      let r;
      try { r = lm.detectForVideo(video, t); }
      catch (e) { if (delegate !== 'GPU') throw e; delegate = 'CPU'; lm = await mk('CPU'); r = lm.detectForVideo(video, t + 1); last = t + 1; }
      const W = video.videoWidth, H = video.videoHeight;
      // Some tasks-vision builds report visibility as missing or 0 for every landmark; treat that as "unknown" (1), not "hidden".
      // MediaPipe also guesses joints outside the frame, often with high visibility: those count as hidden so made-up legs can't score.
      return r.landmarks.map(L => {
        const hasVis = L.some(q => q && q.visibility > 0), kp = {};
        for (const i in NAMES) if (L[i]) {
          const q = L[i], out = q.x < -.02 || q.x > 1.02 || q.y < -.02 || q.y > 1.02;
          kp[NAMES[i]] = { x: q.x * W, y: q.y * H, score: out ? 0 : hasVis ? q.visibility : 1 };
        }
        return kp;
      });
    },
  };
}
async function makeMoveNet(n, status) {
  status('Loading pose model (TensorFlow MoveNet)...');
  const cdn = 'https://cdn.jsdelivr.net/npm/';
  if (!window.tf) await load(cdn + '@tensorflow/tfjs@4.22.0/dist/tf.min.js');
  if (!window.poseDetection) await load(cdn + '@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js');
  const mt = poseDetection.movenet.modelType;
  const det = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, { modelType: n > 1 ? mt.MULTIPOSE_LIGHTNING : mt.SINGLEPOSE_THUNDER });
  return {
    name: 'MoveNet',
    async detect(video) {
      const ps = await det.estimatePoses(video, { maxPoses: n });
      return ps.map(p => { const kp = {}; p.keypoints.forEach(q => kp[q.name] = { x: q.x, y: q.y, score: q.score }); return kp; });
    },
  };
}

const Cam = {
  ready: false, on: false, busy: false, mirror: false, preview: false, score: 0, since: 0, last: 0, seenAt: 0, n: 1, detN: 0,
  target: null, pose: null, thr: 70, filters: {},
  async init(status, n = 1) {
    if (this.ready && this.n === n) return;
    this.n = n; this.filters = {};
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('open the game at http://localhost or https');
    if (this.detN !== n) this.det = null;
    if (!this.det) {
      const errs = [];
      for (const mk of [makeMediaPipe, makeMoveNet]) {
        try { this.det = await timeout(mk(n, status), 60000, 'timed out'); this.detN = n; break; }
        catch (e) { errs.push(e.message); console.warn(e); }
      }
      if (!this.det) throw new Error('could not load a pose model (' + errs.join('; ') + '). Check your internet connection.');
    }
    status('Starting camera...');
    await this.open();
    this.ready = true;
  },
  async open(deviceId) {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30 }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } });
    if (!this.video) {
      this.video = document.createElement('video'); this.video.muted = true; this.video.playsInline = true;
      this.video.style.cssText = 'position:fixed;left:-9999px;width:320px;height:240px'; document.body.appendChild(this.video);
      this.video.addEventListener('resize', () => this.fit());   // phone rotated, or the camera changed resolution
    }
    this.video.srcObject = this.stream; await this.video.play();
    this.fit();
  },
  fit() {               // detectors that read the element's width/height attributes (TF.js MoveNet) must see the true frame size, not 0 or the CSS box
    const v = this.video; if (!v || !v.videoWidth) return;
    v.width = v.videoWidth; v.height = v.videoHeight; this.filters = {};
  },
  cameras: async () => (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'),
  watch(pose, onHit) {
    const figs = pose.figs ? pose.figs.map(f => ({ sc: .8, ...f })) : [pose];
    this.pose = pose; this.fk = figs.map(keypoints); this.target = figs.map(targetAngles);
    this.thr = THRESH[pose.d]; this.since = 0; this.score = 0; this.onHit = onHit;
  },
  run() { if (!this.on) { this.on = true; this.loop(); } },
  stop() { this.on = false; this.ready = false; this.target = null; if (this.stream) this.stream.getTracks().forEach(t => t.stop()); },

  async loop() {
    if (!this.on) return;
    const now = performance.now();
    if (!this.busy && now - this.last > 40 && this.video.readyState >= 2 && this.det) {
      this.busy = true; this.last = now;
      try {
        const people = this.arrange(await this.det.detect(this.video), now);
        this.update(people, now); this.draw(people);
      } catch (e) { console.warn(e); }
      this.busy = false;
    }
    requestAnimationFrame(() => this.loop());
  },
  arrange(raw, now) {   // keep the best N people, order them left to right, apply mirror, smooth with One Euro
    const W = this.video.videoWidth || 640, good = (k, j) => k[j] && k[j].score > .3;
    const cnt = k => JOINTS.filter(j => good(k, j)).length;
    const mx = k => { const v = ['left_hip', 'right_hip', 'left_shoulder', 'right_shoulder'].filter(j => good(k, j)).map(j => k[j].x); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : W / 2; };
    const ps = raw.filter(k => cnt(k) >= 4).sort((a, b) => cnt(b) - cnt(a)).slice(0, this.n).sort((a, b) => mx(a) - mx(b));
    if (this.mirror) ps.reverse();
    if (now - this.seenAt > 600 || this.mirror !== this.wasMirror) { this.filters = {}; this.wasMirror = this.mirror; }
    if (ps.length) this.seenAt = now;
    return ps.map((k, i) => {
      const o = {};
      for (const j in k) {
        const f = this.filters[i + j] || (this.filters[i + j] = [new OneEuro(), new OneEuro()]);
        o[j] = { x: f[0].f(this.mirror ? W - k[j].x : k[j].x, now), y: f[1].f(k[j].y, now), score: k[j].score };
      }
      return o;
    });
  },
  measure(people) {     // one result per target figure; Duo = average of both Posers
    if (!this.target || people.length < this.target.length) return null;
    const per = this.target.map((t, i) => this.person(people[i], t));
    if (per.some(p => !p)) return null;
    const pen = this.touchPenalty(people);
    return { per, pen, score: pen * per.reduce((s, p) => s + p.score, 0) / per.length, min: pen * Math.min(...per.map(p => p.score)) };
  },
  // Which detector label is the figure's 'r' side? The figure's 'r' is its screen-right when upright, and the Poser faces away from the
  // screen, so the camera sees their back with their own right on screen-right. Detector left/right labels are unreliable from behind
  // (and wrong for a front view), so pick sides from where the shoulders and hips actually sit, measured across the body's own
  // hips-to-shoulders axis so upside-down and tilted poses (headstand, side bends) still work. Falls back to the front-view guess.
  sides(k) {
    const ok = j => k[j] && k[j].score > .3, mid = (a, b) => ok(a) && ok(b) ? [(k[a].x + k[b].x) / 2, (k[a].y + k[b].y) / 2] : null;
    const sm = mid('left_shoulder', 'right_shoulder'), hm = mid('left_hip', 'right_hip');
    const up = sm && hm ? [sm[0] - hm[0], sm[1] - hm[1]] : [0, -1];   // no torso: assume upright
    let lr = 0;   // > 0 when the 'left_' joints sit on the body's right-hand side (as drawn on screen)
    for (const [j, m] of [['shoulder', sm], ['hip', hm]]) if (m && ok('left_' + j)) lr += up[0] * (k['left_' + j].y - m[1]) - up[1] * (k['left_' + j].x - m[0]);
    return lr >= 0 ? { r: 'left_', l: 'right_' } : { r: 'right_', l: 'left_' };
  },
  touchPenalty(people) { // duo poses with touching hands: wrists must be close (relative to torso length)
    let pen = 1;
    for (const [i, si, j, sj] of (this.pose.touch || [])) {
      const a = people[i], b = people[j]; if (!a || !b) continue;
      const w = (k, s) => k[this.sides(k)[s] + 'wrist'], A = w(a, si), B = w(b, sj);
      const tl = k => { const o = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'].map(j => k[j]); return o.every(Boolean) ? Math.hypot((o[0].x + o[1].x - o[2].x - o[3].x) / 2, (o[0].y + o[1].y - o[2].y - o[3].y) / 2) : 0; };
      const L = (tl(a) + tl(b)) / 2;
      if (A && B && A.score > .3 && B.score > .3 && L > 0) { const dd = Math.hypot(A.x - B.x, A.y - B.y) / L; if (dd > .7) pen = Math.min(pen, Math.max(.4, 1 - (dd - .7))); }
    }
    return pen;
  },
  person(kp, tgt) {     // side-on poses try both camera directions, because the Poser may face either way
    const combos = this.pose.prof ? [[1, 0], [-1, 0], [1, 1], [-1, 1]] : [[1, 0]];
    let best = null;
    for (const [m, sw] of combos) { const r = this.try(kp, tgt, m, sw); if (r && (!best || r.score > best.score)) best = r; }
    return best;
  },
  try(kp, tgt, m, sw) { // confidence-weighted joint-angle similarity, 0-100
    const g = n => kp[n] || { score: 0 }, ok = (...n) => n.every(x => g(x).score > .3);
    const pt = n => [g(n).x, g(n).y], mid = (a, b) => [(g(a).x + g(b).x) / 2, (g(a).y + g(b).y) / 2], cur = {}, wt = {};
    const seg = (key, a, b) => { if (ok(a, b)) { cur[key] = ang(pt(a), pt(b), m); wt[key] = Math.min(g(a).score, g(b).score) * SEGW[key === 'torso' ? 'torso' : key.slice(1)]; } };
    const side = this.sides(kp);
    for (const s of ['l', 'r']) {       // 'r' = the chain on screen-right; side-on poses also try the swap (sw)
      const p = side[(s === 'r') !== !!sw ? 'r' : 'l'];
      seg(s + 'ua', p + 'shoulder', p + 'elbow'); seg(s + 'fa', p + 'elbow', p + 'wrist');
      seg(s + 'th', p + 'hip', p + 'knee'); seg(s + 'sh', p + 'knee', p + 'ankle');
    }
    if (ok('left_hip', 'right_hip', 'left_shoulder', 'right_shoulder')) {
      cur.torso = ang(mid('left_hip', 'right_hip'), mid('left_shoulder', 'right_shoulder'), m);
      wt.torso = Math.min(g('left_hip').score, g('right_hip').score, g('left_shoulder').score, g('right_shoulder').score);
    }
    const keys = Object.keys(cur);
    if (keys.length < 4) return null;
    const d = {}, s = []; let num = 0, den = 0;
    for (const k of keys) { d[k] = diff(cur[k], tgt[k]); const v = Math.max(0, Math.min(1, 1 - (d[k] - SCORE.free) / (SCORE.zero - SCORE.free))); s.push(v); num += wt[k] * v; den += wt[k]; }
    s.sort((a, b) => a - b);   // a pose with one badly wrong limb can't hide behind five good ones
    return { cur, d, score: 100 * ((1 - SCORE.worst) * num / den + SCORE.worst * (s[0] + s[1]) / 2) };
  },
  guide(people) {       // Just Dance style framing help
    if (people.length < this.n) return `✖ Step into frame (${people.length}/${this.n})`;
    const miss = new Set();
    for (const k of people) {
      if (!['left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'].every(j => k[j] && k[j].score > .3)) miss.add('arms');
      if (!['left_knee', 'right_knee', 'left_ankle', 'right_ankle'].every(j => k[j] && k[j].score > .3)) miss.add('legs');
    }
    return miss.size ? `! Step back: ${[...miss].join(' + ')} hidden` : '✔ Tracking';
  },
  update(people, now) {
    const best = this.measure(people);
    this.score = best ? this.score * .6 + best.score * .4 : 0;
    this.paintLive(best);
    const good = !!best && this.score >= this.thr && best.min >= this.thr - 15;
    if (this.target) {
      if (good) { this.since = this.since || now; if (now - this.since >= HOLD_MS) { const f = this.onHit; this.target = null; if (f) f(); } }
      else this.since = 0;
    }
    const fill = $('#meter-fill'), tr = $('#track'), rate = $('#rate');
    if (fill) { fill.style.width = this.score + '%'; fill.classList.toggle('hit', good); }
    if (tr) { const t = this.guide(people); if (tr.textContent !== t) tr.textContent = t; }
    if (rate) rate.textContent = !best || !this.target ? '' : best.pen < 1 ? 'HANDS TOGETHER!' : this.since ? 'HOLD IT... ' + Math.max(0, (HOLD_MS - (now - this.since)) / 1000).toFixed(1) + 's'
      : this.score >= 85 ? 'PERFECT!' : good ? 'GREAT!' : this.score >= 50 ? 'OK' : 'KEEP GOING';
  },
  paintLive(best) {     // tints each silhouette limb by how close the player's matching limb is, and draws their real limbs on top
    const g = $('#live'); if (!g) return;
    const svg = g.ownerSVGElement;
    svg.querySelectorAll('[data-seg]').forEach(el => {   // id = figure index + limb key, e.g. "0lua"
      const r = best && best.per[+el.dataset.seg[0]], d = r && r.d[el.dataset.seg.slice(1)];
      el.style.fill = d == null ? '' : TINT(d);
    });
    if (!best || !this.fk) { g.innerHTML = ''; return; }
    const line = (a, b, d) => { const [col, dash] = COL(d), xy = `x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"`;
      return `<line ${xy} stroke="#1E0C08" stroke-width=".04"/><line ${xy} stroke="${col}" stroke-width=".022" stroke-linecap="butt"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`; };
    let s = '';
    this.fk.forEach((k, i) => {
      const r = best.per[i];
      for (const sd of ['l', 'r']) for (const [grp, [u, f], [lu, lf]] of [['arm', ['ua', 'fa'], [.15, .14]], ['leg', ['th', 'sh'], [.19, .19]]]) {
        const p0 = k[sd][grp][0];
        if (r.cur[sd + u] == null) continue;
        const v1 = dirv(r.cur[sd + u]), p1 = [p0[0] + v1[0] * lu * k.sc, p0[1] + v1[1] * lu * k.sc];
        s += line(p0, p1, r.d[sd + u]);
        if (r.cur[sd + f] != null) { const v2 = dirv(r.cur[sd + f]); s += line(p1, [p1[0] + v2[0] * lf * k.sc, p1[1] + v2[1] * lf * k.sc], r.d[sd + f]); }
      }
    });
    g.innerHTML = s;
  },
  draw(people) {        // skeleton window (video is shown only on the setup screen)
    const c = $('#skel'); if (!c) return;
    const vw = this.video.videoWidth, vh = this.video.videoHeight; if (!vw || !vh) return;
    // match the canvas's pixel buffer to its on-screen size so it isn't blurry; keep the aspect ratio its markup gave it
    const dpr = window.devicePixelRatio || 1, box = c.getBoundingClientRect();
    c.dataset.ar = c.dataset.ar || c.height / c.width;
    if (box.width) { const w = Math.round(box.width * dpr), h = Math.round(w * c.dataset.ar); if (Math.abs(c.width - w) > 2) { c.width = w; c.height = h; } }
    const x = c.getContext('2d'), W = c.width, H = c.height;
    // fit the whole frame without stretching ("contain"), so players can see exactly where the camera's edges are
    const s = Math.min(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
    x.fillStyle = '#3A1A0E'; x.fillRect(0, 0, W, H);
    if (this.preview) { x.save(); if (this.mirror) { x.translate(W, 0); x.scale(-1, 1); } x.drawImage(this.video, ox, oy, vw * s, vh * s); x.restore(); }
    else { x.strokeStyle = 'rgb(247 215 181 / .35)'; x.lineWidth = Math.max(1, dpr); x.strokeRect(ox + .5, oy + .5, vw * s - 1, vh * s - 1); }
    x.lineWidth = Math.max(2.5, W / 120); x.lineCap = 'round';
    people.forEach((k, i) => {   // keypoints are already mirrored in arrange(), so they only need scaling and offsetting
      x.strokeStyle = ['#6FE3B0', '#FFD166'][i % 2]; x.beginPath();
      for (const [a, b] of EDGES) if (k[a] && k[b] && k[a].score > .3 && k[b].score > .3) { x.moveTo(ox + k[a].x * s, oy + k[a].y * s); x.lineTo(ox + k[b].x * s, oy + k[b].y * s); }
      x.stroke();
    });
  },
};
