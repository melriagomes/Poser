// CAMERA AI JUDGE (Just Dance style): live skeleton tracking, per-limb colour feedback, rating and a hold timer.
// MoveNet runs in the browser. Only a skeleton is used; video is never stored or uploaded.
const THRESH = { easy: 65, medium: 70, hard: 75 }; // % match needed per difficulty (tune in playtests)
const HOLD_MS = 1500;                              // pose must stay accurate this long
const EDGES = [['left_shoulder', 'right_shoulder'], ['left_hip', 'right_hip'], ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']];
const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('could not load AI library, check internet')); document.head.appendChild(s); });
const ang = (a, b, m = 1) => Math.atan2((b[0] - a[0]) * m, b[1] - a[1]) * 180 / Math.PI;   // 0 = down, 90 = screen-right
const diff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const dirv = a => [Math.sin(a * Math.PI / 180), Math.cos(a * Math.PI / 180)];
const COL = d => d < 22 ? '#009E73' : d < 40 ? '#E69F00' : '#D55E00';   // good / close / off (colour-blind safe)

function targetAngles(p) {
  const k = keypoints(p), t = { torso: ang(k.hip, k.neck) };
  for (const s of ['l', 'r']) {
    const [sh, el, wr] = k[s].arm, [hp, kn, an] = k[s].leg;
    t[s + 'ua'] = ang(sh, el); t[s + 'fa'] = ang(el, wr); t[s + 'th'] = ang(hp, kn); t[s + 'sh'] = ang(kn, an);
  }
  return t;
}

const Cam = {
  ready: false, on: false, mirror: false, preview: false, score: 0, since: 0, last: 0, target: null, pose: null, thr: 70,
  async init(status) {
    if (this.ready) return;
    if (!navigator.mediaDevices) throw new Error('open the game from localhost or https');
    if (!this.detector) {
      status('Loading AI model (needs internet the first time)...');
      if (!window.tf) await load('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      if (!window.poseDetection) await load('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js');
      this.detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING });
    }
    status('Starting camera...');
    await this.open();
    this.ready = true;
  },
  async open(deviceId) {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: 640, height: 480, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } });
    if (!this.video) {
      this.video = document.createElement('video'); this.video.muted = true; this.video.playsInline = true;
      this.video.style.cssText = 'position:fixed;left:-9999px;width:320px;height:240px'; document.body.appendChild(this.video);
    }
    this.video.srcObject = this.stream; await this.video.play();
  },
  cameras: async () => (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'),
  watch(pose, onHit) { this.pose = pose; this.target = targetAngles(pose); this.thr = THRESH[pose.d]; this.since = 0; this.score = 0; this.onHit = onHit; },
  run() { if (!this.on) { this.on = true; this.loop(); } },
  stop() { this.on = false; this.ready = false; this.target = null; if (this.stream) this.stream.getTracks().forEach(t => t.stop()); },

  async loop() {
    if (!this.on) return;
    const now = performance.now();
    if (now - this.last > 100 && this.video.readyState >= 2) {
      this.last = now;
      try {
        const [p] = await this.detector.estimatePoses(this.video), kp = {};
        (p ? p.keypoints : []).forEach(q => kp[q.name] = q);
        const seen = Object.values(kp).filter(q => q.score > .3).length >= 5, best = this.measure(kp);
        this.update(best, seen, now); this.draw(kp);
      } catch (e) { console.warn(e); }
    }
    requestAnimationFrame(() => this.loop());
  },
  measure(kp) {      // side-on poses try both camera directions, because the Poser may face either way
    if (!this.target) return null;
    const combos = this.pose.prof ? [[1, 0], [-1, 0], [1, 1], [-1, 1]] : [[this.mirror ? -1 : 1, 0]];
    let best = null;
    for (const [m, sw] of combos) { const r = this.try(kp, m, sw); if (r && (!best || r.score > best.score)) best = r; }
    return best;
  },
  try(kp, m, sw) {   // compares joint ANGLES, so body size and camera distance don't matter
    const g = n => kp[n] || { score: 0 }, ok = (...n) => n.every(x => g(x).score > .3);
    const pt = n => [g(n).x, g(n).y], mid = (a, b) => [(g(a).x + g(b).x) / 2, (g(a).y + g(b).y) / 2], cur = {};
    const seg = (key, a, b) => { if (ok(a, b)) cur[key] = ang(pt(a), pt(b), m); };
    for (const s of ['l', 'r']) {       // for a camera facing the Poser, their LEFT appears on screen-right
      const p = (s === 'r') !== !!sw ? 'left_' : 'right_';
      seg(s + 'ua', p + 'shoulder', p + 'elbow'); seg(s + 'fa', p + 'elbow', p + 'wrist');
      seg(s + 'th', p + 'hip', p + 'knee'); seg(s + 'sh', p + 'knee', p + 'ankle');
    }
    if (ok('left_hip', 'right_hip', 'left_shoulder', 'right_shoulder')) cur.torso = ang(mid('left_hip', 'right_hip'), mid('left_shoulder', 'right_shoulder'), m);
    const keys = Object.keys(cur);
    if (keys.length < 4) return null;
    const d = {}; keys.forEach(k => d[k] = diff(cur[k], this.target[k]));
    return { cur, d, score: 100 * keys.reduce((s, k) => s + Math.max(0, Math.min(1, 1 - (d[k] - 15) / 55)), 0) / keys.length };
  },
  update(best, seen, now) {
    this.score = best ? this.score * .6 + best.score * .4 : 0;
    this.paintLive(best);
    if (this.target) {
      if (this.score >= this.thr) {
        this.since = this.since || now;
        if (now - this.since >= HOLD_MS) { const f = this.onHit; this.target = null; if (f) f(); }
      } else this.since = 0;
    }
    const fill = $('#meter-fill'), tr = $('#track'), rate = $('#rate');
    if (fill) { fill.style.width = this.score + '%'; fill.classList.toggle('hit', this.score >= this.thr); }
    if (tr) tr.textContent = seen ? '🟢 Camera is tracking the Poser' : "🔴 Can't see the Poser";
    if (rate) rate.textContent = !seen || !this.target ? '' : this.since ? 'HOLD IT... ' + Math.max(0, (HOLD_MS - (now - this.since)) / 1000).toFixed(1) + 's'
      : this.score >= 85 ? 'PERFECT!' : this.score >= this.thr ? 'GREAT!' : this.score >= 50 ? 'OK' : 'KEEP GOING';
  },
  paintLive(best) {  // draws the Poser's real limb angles on top of the silhouette, coloured by accuracy
    const g = $('#live'); if (!g) return;
    if (!best || !this.pose) { g.innerHTML = ''; return; }
    const k = keypoints(this.pose), line = (a, b, d) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${COL(d)}" stroke-width=".026"/>`;
    let s = '';
    for (const sd of ['l', 'r']) for (const [grp, [u, f], [lu, lf]] of [['arm', ['ua', 'fa'], [.15, .14]], ['leg', ['th', 'sh'], [.19, .19]]]) {
      const p0 = k[sd][grp][0];
      if (best.cur[sd + u] == null) continue;
      const v1 = dirv(best.cur[sd + u]), p1 = [p0[0] + v1[0] * lu, p0[1] + v1[1] * lu];
      s += line(p0, p1, best.d[sd + u]);
      if (best.cur[sd + f] != null) { const v2 = dirv(best.cur[sd + f]); s += line(p1, [p1[0] + v2[0] * lf, p1[1] + v2[1] * lf], best.d[sd + f]); }
    }
    g.innerHTML = s;
  },
  draw(kp) {         // small skeleton window (video is shown only on the setup screen)
    const c = $('#skel'); if (!c) return;
    const x = c.getContext('2d'), W = c.width, H = c.height, vw = this.video.videoWidth, vh = this.video.videoHeight;
    x.fillStyle = '#211e46'; x.fillRect(0, 0, W, H);
    if (this.preview) { x.save(); if (this.mirror) { x.translate(W, 0); x.scale(-1, 1); } x.drawImage(this.video, 0, 0, W, H); x.restore(); }
    const P = n => kp[n] && kp[n].score > .3 ? [(this.mirror ? vw - kp[n].x : kp[n].x) / vw * W, kp[n].y / vh * H] : null;
    x.strokeStyle = '#56B4E9'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath();
    for (const [a, b] of EDGES) { const A = P(a), B = P(b); if (A && B) { x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); } }
    x.stroke();
  },
};
