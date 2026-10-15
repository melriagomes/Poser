// CAMERA AI JUDGE. Runs MoveNet in the browser. Only a skeleton is used; video is never stored or uploaded.
const THRESH = { easy: 70, medium: 75, hard: 80 }; // % match needed per difficulty (tune in playtests)
const HOLD_MS = 1500;                              // pose must stay accurate this long to count
const EDGES = [['left_shoulder', 'right_shoulder'], ['left_hip', 'right_hip'], ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']];
const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('could not load AI library, check internet')); document.head.appendChild(s); });
const ang = (a, b, m = 1) => Math.atan2((b[0] - a[0]) * m, b[1] - a[1]) * 180 / Math.PI;   // 0 = down, 90 = screen-right
const diff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

function targetAngles(p) {            // segment angles of the target silhouette
  const k = keypoints(p), t = { torso: ang(k.hip, k.neck) };
  for (const s of ['l', 'r']) {
    const [sh, el, wr] = k[s].arm, [hp, kn, an] = k[s].leg;
    t[s + 'ua'] = ang(sh, el); t[s + 'fa'] = ang(el, wr); t[s + 'th'] = ang(hp, kn); t[s + 'sh'] = ang(kn, an);
  }
  return t;
}

const Cam = {
  ready: false, on: false, mirror: false, preview: false, score: 0, since: 0, last: 0, target: null, thr: 75,
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
  watch(pose, onHit) { this.target = targetAngles(pose); this.thr = THRESH[pose.d]; this.since = 0; this.score = 0; this.onHit = onHit; },
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
        this.update(p ? this.measure(kp) : null, now); this.draw(kp);
      } catch (e) { console.warn(e); }
    }
    requestAnimationFrame(() => this.loop());
  },
  measure(kp) {                       // accuracy 0-100 from joint ANGLES, so body size and distance don't matter
    const m = this.mirror ? -1 : 1, g = n => kp[n] || { score: 0 }, ok = (...n) => n.every(x => g(x).score > .3);
    const pt = n => [g(n).x, g(n).y], mid = (a, b) => [(g(a).x + g(b).x) / 2, (g(a).y + g(b).y) / 2], cur = {};
    const seg = (key, a, b) => { if (ok(a, b)) cur[key] = ang(pt(a), pt(b), m); };
    for (const s of ['l', 'r']) {     // the person's LEFT appears on screen-right for a camera facing them
      const p = s === 'r' ? 'left_' : 'right_';
      seg(s + 'ua', p + 'shoulder', p + 'elbow'); seg(s + 'fa', p + 'elbow', p + 'wrist');
      seg(s + 'th', p + 'hip', p + 'knee'); seg(s + 'sh', p + 'knee', p + 'ankle');
    }
    if (ok('left_hip', 'right_hip', 'left_shoulder', 'right_shoulder')) cur.torso = ang(mid('left_hip', 'right_hip'), mid('left_shoulder', 'right_shoulder'), m);
    const keys = Object.keys(cur);
    if (keys.length < 4 || !this.target) return null;
    return 100 * keys.reduce((s, k) => s + Math.max(0, Math.min(1, 1 - (diff(cur[k], this.target[k]) - 10) / 50)), 0) / keys.length;
  },
  update(raw, now) {
    this.score = raw == null ? 0 : this.score * .6 + raw * .4;
    const fill = $('#meter-fill'), txt = $('#meter-txt');
    if (fill) { fill.style.width = this.score + '%'; fill.classList.toggle('hit', this.score >= this.thr); }
    if (txt) txt.textContent = raw == null ? "Can't see the Poser" : Math.round(this.score) + '%';
    if (!this.target) return;
    if (this.score >= this.thr) {
      this.since = this.since || now;
      if (now - this.since >= HOLD_MS) { const f = this.onHit; this.target = null; if (f) f(); }
    } else this.since = 0;
  },
  draw(kp) {                          // skeleton only (video is shown just on the setup screen)
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
