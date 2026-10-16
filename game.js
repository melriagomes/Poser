const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Exactly the 10 emojis from the plan. The third value 1 means only the game triggers it.
const EMO = [
  ['🎯', 'Nailed it', 1], ['🔥', 'Getting hot'], ['❄️', 'Getting cold'], ['👀', 'Almost'], ['😵', 'Confusion'],
  ['🤣', 'Funny fail'], ['🤝', 'Teamwork'], ['⏱️', "Time's up", 1], ['🏆', 'Level cleared', 1], ['🧘', 'Stretch break'],
];
const TIERS = ['easy', 'medium', 'hard'];
const STRETCH = ['Reach up', 'Roll shoulders', 'Stretch left', 'Stretch right'];
let G, timer;
// Player settings, remembered in this browser. Storage can be blocked (private mode), so fall back to defaults quietly.
const PREFS = (() => { const d = { vol: .8, mute: false, calm: false, emojis: true }; try { return { ...d, ...JSON.parse(localStorage.getItem('poser-prefs') || '{}') }; } catch (e) { return d; } })();

function showErr(m) {
  if (!$('#err')) document.body.insertAdjacentHTML('beforeend', '<div id="err" role="alert"></div>');
  $('#err').textContent = 'Something went wrong: ' + m;
}
window.addEventListener('error', e => showErr(e.message));
window.addEventListener('unhandledrejection', e => showErr((e.reason && e.reason.message) || e.reason));
if (typeof POSES_VERSION === 'undefined' || typeof CAM_VERSION === 'undefined' || POSES_VERSION !== 4 || CAM_VERSION !== 4)
  showErr('some files are out of date. Replace ALL files in the folder, then hard refresh (Ctrl+Shift+R).');

// Every screen goes through render(): sets the page title and moves focus to the heading so keyboard and screen-reader users know where they are.
function render(html, title) {
  tickSound(false);   // a new screen always ends the countdown ticking
  app.innerHTML = html;
  document.title = title ? 'Poser · ' + title : 'Poser';
  const h = app.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
}
function goFull() { try { const r = document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
function toggleFull() { document.fullscreenElement ? document.exitFullscreen() : goFull(); }

// ---------- SILHOUETTE RENDERER (angles -> keypoints -> SVG) ----------
function keypoints(p) {
  const sc = p.sc || 1, v = a => [Math.sin(a * Math.PI / 180), Math.cos(a * Math.PI / 180)];
  const add = (a, b, k) => [a[0] + b[0] * k * sc, a[1] + b[1] * k * sc];
  const ln = (p.lean || 0) * Math.PI / 180, hip = p.at || [.5, .55], w = p.prof ? 0 : 1;
  const up = [Math.sin(ln), -Math.cos(ln)], side = [Math.cos(ln), Math.sin(ln)];
  const neck = add(hip, up, .24), out = { hip, neck, head: add(neck, up, .085), w, sc };
  for (const s of ['l', 'r']) {
    const k = s === 'r' ? 1 : -1, arm = (p.a || {})[s] || [k * 8, k * 8], leg = (p.lg || {})[s] || [k * 4, k * 4];
    const sh = add(neck, side, k * .085 * w), el = add(sh, v(arm[0]), .15), wr = add(el, v(arm[1]), .14);
    const hp = add(hip, side, k * .05 * w), kn = add(hp, v(leg[0]), .19), an = add(kn, v(leg[1]), .19);
    out[s] = { arm: [sh, el, wr], leg: [hp, kn, an] };
  }
  return out;
}
// Pose silhouettes: a filled body built on the same joints the camera judge compares against (keypoints above),
// so what players copy and what the AI checks can never disagree. Each limb is a tapered capsule (thick at the body,
// thin at the hand or foot); the torso is a smooth outline in the body's own up/side frame, so leans and inversions just work.
// Limb paths carry data-seg (figure index + limb key, e.g. "0lua") so the camera can tint each limb by accuracy.
function parts(p, fi = 0) {
  const k = keypoints(p), sc = k.sc, ln = (p.lean || 0) * Math.PI / 180, f = n => +n.toFixed(4);
  const up = [Math.sin(ln), -Math.cos(ln)], side = [Math.cos(ln), Math.sin(ln)];
  const P = (u, v) => [k.hip[0] + (up[0] * u + side[0] * v) * sc, k.hip[1] + (up[1] * u + side[1] * v) * sc];
  const along = (a, b, d) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [b[0] + (b[0] - a[0]) / L * d * sc, b[1] + (b[1] - a[1]) / L * d * sc]; };
  const smooth = pts => {   // closed Catmull-Rom spline through the points, as cubic Béziers
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    pts.forEach((p1, i) => { const n = pts.length, p0 = pts[(i - 1 + n) % n], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`; });
    return d + 'Z';
  };
  const limb = (a, b, ra, rb) => {   // tapered capsule from a (radius ra) to b (radius rb)
    ra *= sc; rb *= sc;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6, th = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / L))), base = Math.atan2(b[1] - a[1], b[0] - a[0]), pts = [];
    for (let i = 0; i <= 8; i++) { const t = base + th - 2 * th * i / 8; pts.push([b[0] + rb * Math.cos(t), b[1] + rb * Math.sin(t)]); }
    for (let i = 0; i <= 12; i++) { const t = base - th - (2 * Math.PI - 2 * th) * i / 12; pts.push([a[0] + ra * Math.cos(t), a[1] + ra * Math.sin(t)]); }
    return 'M' + pts.map(q => f(q[0]) + ' ' + f(q[1])).join('L') + 'Z';
  };
  const seg = (id, ...d) => `<path data-seg="${fi}${id}" d="${d.join('')}"/>`;
  // torso outline as (up, side) pairs from neck to hips; side-on poses use a slimmer profile
  const T = k.w ? [[.252, -.028], [.248, -.088], [.205, -.1], [.16, -.074], [.1, -.056], [.04, -.07], [0, -.08], [-.045, -.06], [-.065, 0], [-.045, .06], [0, .08], [.04, .07], [.1, .056], [.16, .074], [.205, .1], [.248, .088], [.252, .028]]
                : [[.252, -.03], [.21, -.062], [.13, -.05], [.05, -.056], [-.03, -.054], [-.06, 0], [-.03, .054], [.05, .056], [.13, .05], [.21, .062], [.252, .03]];
  let legs = '', arms = '';
  for (const s of ['l', 'r']) {
    const [sh, el, wr] = k[s].arm, [hp, kn, an] = k[s].leg, out = s === 'r' ? 1 : -1;
    const t0 = along(kn, an, .02), toe = [t0[0] + side[0] * out * .024 * sc, t0[1] + side[1] * out * .024 * sc];   // feet point down and slightly out
    legs += seg(s + 'th', limb(hp, kn, .054, .032)) + seg(s + 'sh', limb(kn, an, .032, .019), limb(an, toe, .019, .012));
    arms += seg(s + 'ua', limb(sh, el, .034, .024)) + seg(s + 'fa', limb(el, wr, .024, .016), limb(wr, along(el, wr, .036), .018, .011));
  }
  const hd = k.head, bun = [hd[0] + up[0] * .052 * sc, hd[1] + up[1] * .052 * sc];
  return legs + `<path d="${smooth(T.map(([u, v]) => P(u, v)))}"/>` + arms
    + `<path d="${limb(P(.23, 0), hd, .022, .021)}"/>`
    + `<ellipse cx="${f(hd[0])}" cy="${f(hd[1])}" rx="${f(.048 * sc)}" ry="${f(.058 * sc)}" transform="rotate(${f(p.lean || 0)} ${f(hd[0])} ${f(hd[1])})"/>`
    + `<circle cx="${f(bun[0])}" cy="${f(bun[1])}" r="${f(.026 * sc)}"/>`;
}
function figure(p) {   // duo poses carry p.figs: two figures drawn at 80% size
  const body = p.figs ? p.figs.map((f, i) => parts({ sc: .8, ...f }, i)).join('') : parts(p);
  return `<svg viewBox="0 0 1 1" class="sil" role="img" aria-label="Pose to describe" stroke-linecap="round" stroke-linejoin="round"><g class="body" fill="currentColor">${body}</g><g id="live"></g></svg>`;
}

// ---------- WELCOME ----------
function welcome() {
  clearInterval(timer); Cam.stop(); music('bg');
  const still = PREFS.calm || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);   // reduced motion: no autoplay
  render(`<section class="welcome">
    <h1 class="sr">Poser</h1>
    <video id="wv" src="welcome.mp4" poster="poster.jpg" ${still ? '' : 'autoplay'} muted loop playsinline aria-hidden="true" tabindex="-1"></video>
    <button class="btn primary xl start" onclick="home()">Start</button>
    <div class="vctl"><button class="btn" id="snd" onclick="wvSound()">${PREFS.mute ? 'Sound off' : 'Sound on'}</button></div></section>`, '');
  // the first tap is what lets the browser play sound: if it just started the music, stay here so the song is heard on this screen
  // (only once, so a song that can't play never traps anyone here)
  let held = false;
  $('.welcome').addEventListener('click', e => {
    if (e.target.closest('button')) return;
    if (!held && performance.now() - musicStartedAt < 1000) { held = true; return; }
    home();
  });
  $('.start').focus(); applyPrefs();
  if (!still) { $('#wv').addEventListener('canplay', wvKick); wvKick(); }
}
// The welcome video is silent, so browsers normally let it autoplay. Safari in Low Power Mode still blocks it,
// so try again once it has loaded, when the tab comes back into view, and on the first tap or key press.
function wvKick() {
  const v = $('#wv'); if (!v || !v.paused || PREFS.calm || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  v.muted = true; const p = v.play(); if (p && p.catch) p.catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) wvKick(); });
function wvSound() { PREFS.mute = !PREFS.mute; savePrefs(); resumeMusic(); }   // same switch as "Mute all sound" in Settings

// ---------- SETTINGS ----------
// Soundtrack: one looping track at a time. Background plays everywhere except Rapid 25s and Chill games, which have their own.
// Browsers only allow sound after the player clicks or presses a key, so a blocked start is retried on the next one.
const TRACKS = { bg: 'background.mp3', rapid: 'rapid.mp3', chill: 'chill.mp3' };
let track = null, musicStartedAt = -1e9;
function music(name) {
  track = name;
  let a = $('#music');
  if (!a) { a = new Audio(); a.id = 'music'; a.loop = true; a.preload = 'auto'; document.body.appendChild(a); }
  if (a.dataset.track !== name) { a.pause(); a.src = TRACKS[name]; a.dataset.track = name; }   // a new track starts from the top
  applyPrefs(); resumeMusic();
}
function resumeMusic() {
  const a = $('#music');
  if (!a || !track || !a.paused) return;
  musicStartedAt = performance.now();
  const p = a.play(); if (p && p.catch) p.catch(() => {});
}
// touch screens only allow sound from the end of a tap, so listen for that too
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(ev => addEventListener(ev, () => { resumeMusic(); wvKick(); }, true));
// Button click sound. Web Audio plays it instantly and lets fast clicks overlap; it follows Volume and Mute.
// The audio engine can only start after a click, which is always how the first sound gets triggered.
const SFX = { click: 'click.wav', tick: 'tick.wav' };
let sfx = null;
function playSfx(name, loop) {   // returns the playing source (or a promise of it) so loops can be stopped
  if (PREFS.mute || !PREFS.vol) return null;
  try {
    if (!sfx) { const ctx = new (window.AudioContext || window.webkitAudioContext)(); sfx = { ctx, bufs: {} }; }
    if (sfx.ctx.state === 'suspended') sfx.ctx.resume();
    const b = sfx.bufs[name] || (sfx.bufs[name] = fetch(SFX[name]).then(r => r.arrayBuffer()).then(a => sfx.ctx.decodeAudioData(a)));
    return b.then(buf => { const s = sfx.ctx.createBufferSource(), g = sfx.ctx.createGain(); g.gain.value = PREFS.vol; s.buffer = buf; s.loop = !!loop; s.connect(g).connect(sfx.ctx.destination); s.start(); return s; }).catch(() => null);
  } catch (e) { return null; }
}
// Clock ticking for the last 10 seconds of a timed round. tick.wav is cut to whole tick-tock pairs so it loops without a gap.
let ticking = null;
function tickSound(on) {
  const t = ticking; ticking = null;
  if (t) t.then(s => { if (s) try { s.stop(); } catch (e) {} });
  if (on) ticking = playSfx('tick', true);
}
// Crowd cheer for a won round, played like the music (a short delay doesn't matter here); the music dips underneath it.
const cheerAudio = new Audio('cheer.mp3'); cheerAudio.preload = 'auto';
function cheer() {
  if (PREFS.mute || !PREFS.vol) return;
  cheerAudio.volume = PREFS.vol; cheerAudio.currentTime = 0; const p = cheerAudio.play(); if (p && p.catch) p.catch(() => {});
  const a = $('#music'); if (!a) return;
  clearTimeout(cheer.t); a.volume = PREFS.vol * .35; cheer.t = setTimeout(() => { a.volume = PREFS.vol; }, 4000);
}
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) playSfx('click'); }, true);
function savePrefs() { try { localStorage.setItem('poser-prefs', JSON.stringify(PREFS)); } catch (e) {} applyPrefs(); }
function applyPrefs() {
  document.documentElement.classList.toggle('calm', PREFS.calm);
  if (PREFS.mute && ticking) tickSound(false);
  // the soundtrack follows "Mute all sound" both ways; the welcome video keeps its own sound button, so mute only silences it
  document.querySelectorAll('video, audio').forEach(m => { m.volume = PREFS.vol; if (m.id === 'music') m.muted = PREFS.mute; else if (PREFS.mute) m.muted = true; });
  const snd = $('#snd'); if (snd) snd.textContent = PREFS.mute ? 'Sound off' : 'Sound on';
}
function openPrefs() {
  $('#p-vol').value = Math.round(PREFS.vol * 100); $('#p-volv').textContent = Math.round(PREFS.vol * 100) + '%';
  $('#p-mute').checked = PREFS.mute; $('#p-calm').checked = PREFS.calm; $('#p-emo').checked = PREFS.emojis;
  $('#prefs').hidden = false; app.setAttribute('inert', ''); $('#p-vol').focus();
}
function closePrefs() { $('#prefs').hidden = true; app.removeAttribute('inert'); $('#gear').focus(); }
function prefsUI() {
  document.body.insertAdjacentHTML('beforeend', `<div id="prefs" class="scrim prefs" hidden><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="pt" onkeydown="if(event.key==='Escape')closePrefs()">
    <h2 class="headline orn" id="pt">Settings</h2>
    <div class="field"><label for="p-vol">Volume <output id="p-volv" for="p-vol"></output></label><input type="range" id="p-vol" min="0" max="100" step="5"></div>
    <label class="check"><input type="checkbox" id="p-mute"><span>Mute all sound</span></label>
    <label class="check"><input type="checkbox" id="p-calm"><span>Reduce motion</span></label>
    <label class="check"><input type="checkbox" id="p-emo"><span>Floating emojis</span></label>
    <button class="btn primary" onclick="closePrefs()">Done</button></div></div>`);
  $('#p-vol').oninput = e => { PREFS.vol = e.target.value / 100; $('#p-volv').textContent = e.target.value + '%'; savePrefs(); };
  $('#p-mute').onchange = e => { PREFS.mute = e.target.checked; savePrefs(); };
  $('#p-calm').onchange = e => { PREFS.calm = e.target.checked; savePrefs(); };
  $('#p-emo').onchange = e => { PREFS.emojis = e.target.checked; savePrefs(); };
  $('#prefs').addEventListener('click', e => { if (e.target.id === 'prefs') closePrefs(); });   // click outside the card closes it
}

// ---------- SETUP ----------
function home() {
  clearInterval(timer); Cam.stop(); music('bg');
  render(`<section class="screen"><h1 class="display">Poser</h1>
    <button class="btn corner" onclick="rulebook()">How to play</button>
    <div class="cols">
      <fieldset class="panel"><legend>Players</legend><div id="plist"></div>
        <div class="actions"><button class="btn text" onclick="remP()">− Remove</button><button class="btn text" onclick="addP()">+ Add</button></div></fieldset>
      <fieldset class="panel"><legend>Settings</legend>
        <div class="field"><label for="style">Style</label><select id="style"><option value="1">Solo</option><option value="2">Duo</option></select></div>
        <div class="field"><label for="mode">Mode</label><select id="mode"><option value="60">Classic 60s</option><option value="25">Rapid 25s</option><option value="0">Chill</option></select></div>
        <div class="field"><label for="diff">Difficulty</label><select id="diff"><option value="0">Easy</option><option value="1" selected>Medium</option><option value="2">Hard</option></select></div>
        <div class="checks"><label class="check"><input type="checkbox" id="safe" checked><span>Safe mode</span></label>
        <label class="check"><input type="checkbox" id="split" checked><span>Split roles</span></label>
        <label class="check"><input type="checkbox" id="wl" checked><span>Word limit</span></label></div></fieldset>
    </div>
    <div class="actions"><button class="btn primary xl" onclick="start(true)">Play with camera</button></div>
</section>`, 'Setup');
  ['Alex', 'Sam', 'Jo', 'Riley'].forEach(addP);
  $('#style').onchange = $('#safe').onchange = syncDiff; syncDiff();
}
function addP(n) {
  const l = document.querySelectorAll('.pn'); if (l.length >= 7) return;
  const i = document.createElement('input'); i.type = 'text'; i.className = 'pn'; i.maxLength = 14;
  i.setAttribute('aria-label', 'Player ' + (l.length + 1)); i.placeholder = 'Player ' + (l.length + 1); if (typeof n === 'string') i.value = n;
  $('#plist').appendChild(i);
}
function remP() { const l = document.querySelectorAll('.pn'); if (l.length > 3) l[l.length - 1].remove(); }

function rulebook() {
  const steps = [['Face away', 'The Poser faces away from the screen.'], ['Describe', 'Describers see the pose and guide with words only.'],
    ['Lock & judge', 'Lock it, then judge: Match or Not yet.'], ['Split roles', 'Each Describer controls one body zone.'],
    ['Word limit', 'More Describers, fewer words each.'], ['Duo', 'Two Posers, left and right as the Describers see them.'], ['Fouls', 'A foul costs 20 points.']];
  render(`<section class="screen book-screen"><h1 class="book-title">How to play</h1>
    <div class="book">
      <div class="page"><h2 class="page-head">The rules</h2>
        <ol class="steps">${steps.map((t, i) => `<li><span class="step-no" aria-hidden="true"><i>step</i> ${i + 1}</span><b>${t[0]}</b><span>${t[1]}</span></li>`).join('')}</ol></div>
      <div class="rings" aria-hidden="true"></div>
      <div class="page"><h2 class="page-head">Emojis</h2>
        <ul class="stickers">${EMO.map(e => `<li><span aria-hidden="true">${e[0]}</span>${e[1]}</li>`).join('')}</ul>
        <button class="btn primary" onclick="home()">Back</button></div>
    </div></section>`, 'How to play');
}

function start(cam) {
  const names = [...document.querySelectorAll('.pn')].map(i => i.value.trim() || i.placeholder), duo = $('#style').value === '2';
  G = {
    players: names.map(n => ({ n })), limit: +$('#mode').value, max: +$('#diff').value, safe: $('#safe').checked,
    cam, duo, split: $('#split').checked, wl: $('#wl').checked,
    poser: 0, level: 1, rounds: 0, score: 0, used: [], stretch: false,
  };
  goFull(); music(G.limit === 25 ? 'rapid' : G.limit === 0 ? 'chill' : 'bg');   // Rapid 25s and Chill have their own soundtracks for the whole game
  if (G.cam) camSetup(); else ready('');
}

async function camSetup() {
  const n = G.duo ? 2 : 1;
  render(`<section class="screen narrow"><div class="panel card"><h1 class="headline orn">Camera</h1>
    <canvas id="skel" width="480" height="360" class="camprev" role="img" aria-label="Camera preview"></canvas>
    <p id="track" class="rules" role="status"></p><p id="camstatus" class="muted" role="status">Loading...</p>
    <div class="field"><label for="camsel">Camera</label><select id="camsel"></select></div>
    <label class="check"><input type="checkbox" id="mirror"><span>Flip left/right</span></label>
    <div class="actions"><button class="btn primary" id="go" disabled onclick="ready('')">Start</button><button class="btn text" onclick="home()">Back</button></div></div></section>`, 'Camera');
  try {
    await Cam.init(t => { const s = $('#camstatus'); if (s) s.textContent = t; }, n);
    if (!$('#camstatus')) { Cam.stop(); return; }
    Cam.preview = true; Cam.run();
    $('#camstatus').textContent = `Ready (${Cam.det.name}). Show everyone head to toe.`;
    $('#go').disabled = false;
    const cams = await Cam.cameras();
    $('#camsel').innerHTML = cams.map((c, i) => `<option value="${c.deviceId}">${esc(c.label || 'Camera ' + (i + 1))}</option>`).join('');
    $('#camsel').onchange = e => Cam.open(e.target.value);
    $('#mirror').checked = Cam.mirror; $('#mirror').onchange = e => Cam.mirror = e.target.checked;
  } catch (e) { G.cam = false; Cam.stop(); const s = $('#camstatus'); if (s) s.textContent = 'Camera unavailable: ' + e.message + ' Check camera permission, then press Back and try again.'; }
}

// Each difficulty only ever uses its own poses (no ramp from easy, no borrowing from other levels).
// Every pose in the tier is shown once before any repeats, and the last pose never comes straight back.
const tierPoses = (tier, duo, safe) => POSES.filter(p => p.d === TIERS[tier] && (!safe || p.safe) && (duo ? p.n === 2 : !p.n));
function pick() {
  const all = tierPoses(G.max, G.duo, G.safe);
  let pool = all.filter(p => !G.used.includes(p.id));
  if (!pool.length) { const last = G.used[G.used.length - 1]; G.used = []; pool = all.length > 1 ? all.filter(p => p.id !== last) : all; }
  const p = pool[Math.floor(Math.random() * pool.length)];
  G.used.push(p.id); return p;
}
// Difficulty options with no poses for the current Style + Safe mode are disabled (all Hard poses need Safe mode off).
function syncDiff() {
  const sel = $('#diff'), duo = $('#style').value === '2', safe = $('#safe').checked;
  [...sel.options].forEach((o, i) => {
    const none = !tierPoses(i, duo, safe).length;
    o.disabled = none; o.textContent = ['Easy', 'Medium', 'Hard'][i] + (none ? (safe ? ' (turn off Safe mode)' : ' (no poses)') : '');
  });
  if (sel.selectedOptions[0].disabled) sel.value = [...sel.options].filter(o => !o.disabled).pop().value;   // fall back to the hardest level that has poses
}

// ---------- CONFLICT RULES: split roles + word limits ----------
// Body zones by number of Describers (shuffled every round). Left/Right = the Poser's own left/right (= the screen's right/left).
const ZONES = {
  1: ['Everything'], 2: ['Arms', 'Legs, torso, head'], 3: ['Arms', 'Legs', 'Torso, head'],
  4: ['Left arm', 'Right arm', 'Legs', 'Torso, head'], 5: ['Left arm', 'Right arm', 'Left leg', 'Right leg', 'Torso, head'],
  6: ['Left arm', 'Right arm', 'Left leg', 'Right leg', 'Torso', 'Head'],
};
const WORDS = [0, 12, 8, 6, 5, 4, 3];   // max words per instruction, indexed by number of Describers
const posers = () => G.duo ? [G.poser, (G.poser + 1) % G.players.length] : [G.poser];
const posNames = () => posers().map(i => esc(G.players[i].n)).join(' + ');
function makeRoster() {
  const ps = posers(), ds = G.players.filter((_, i) => !ps.includes(i)), zones = ZONES[ds.length].slice().sort(() => Math.random() - .5);
  G.roster = ds.map((p, k) => ({ n: p.n, z: G.split ? zones[k] : '' })); G.W = G.wl ? WORDS[ds.length] : 0;
}
const rulesLine = () => ((G.split ? 'Stay in your zone. ' : '') + (G.W ? `${G.W} words max.` : '')) || 'Free talk.';
const chips = () => `<ul class="chips">${G.roster.map(r => `<li class="chip"><b>${esc(r.n)}</b>${r.z ? ' · ' + r.z : ''}</li>`).join('')}</ul>`;

// ---------- ROUND ----------
function ready(msg) {
  clearInterval(timer); if (G.cam) Cam.preview = false; makeRoster();
  const ps = posers(), nm = i => esc(G.players[i].n);
  const who = G.duo ? `${nm(ps[0])} <small>left</small> + ${nm(ps[1])} <small>right</small>` : nm(ps[0]);
  render(`<section class="screen center"><div class="panel card">${msg ? `<p class="banner" role="status">${msg}</p>` : ''}
    <p class="label">${G.duo ? 'Posers' : 'Poser'}</p><h1 class="headline">${who}</h1>
    <h2 class="label">Describers</h2>${chips()}
    <p class="rules">${rulesLine()}</p>${G.split ? "<p class=\"hint\">Left and right are the Poser's own.</p>" : ''}
    <p class="level">Level ${G.level}</p>
    <div class="actions"><button class="btn primary xl" onclick="play()">Show pose</button><button class="btn text" onclick="home()">End game</button></div></div></section>`, 'Ready');
}

function play() {
  G.pose = pick(); G.t = G.limit;
  render(`<section class="stage"><h1 class="sr">Level ${G.level}</h1>
    <header class="hud"><div class="stat"><span class="label">${G.duo ? 'Posers' : 'Poser'}</span><span class="val">${posNames()}</span></div>
      <div class="stat"><span class="label">Level</span><span class="val">${G.level}</span></div>
      <div class="stat"><span class="label">Score</span><span class="val" id="score">${G.score}</span></div>
      <div class="stat"><span class="label">Time</span><span class="time" id="time" role="timer">${G.limit ? G.t : '∞'}</span></div></header>
    <div class="strip">${chips()}<p class="rules">${rulesLine()}</p></div>
    <div class="mid">${figure(G.pose)}</div>
    ${G.cam ? '<div class="ai"><canvas id="skel" width="200" height="150" role="img" aria-label="Camera skeleton"></canvas><p id="track" class="label"></p><div class="meter" aria-hidden="true"><i id="meter-fill"></i></div><p id="rate"></p></div>' : ''}
    <div class="bar" role="group" aria-label="Reactions">${EMO.map((e, i) => `<button class="btn emo" aria-label="${e[1]}" ${e[2] ? 'disabled' : ''} onclick="react(${i})">${e[0]}</button>`).join('')}</div>
    <div class="actions"><button class="btn primary" id="lockbtn" onclick="lock()">Lock</button><button class="btn" onclick="foul()">Foul −20</button><button class="btn text" onclick="home()">End game</button></div>
    <div id="judge" class="scrim" hidden><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="jt" onkeydown="if(event.key==='Escape')noMatch()">
      <h2 class="headline" id="jt">Match?</h2><p id="judge-msg" class="rules"></p>
      <div class="actions"><button class="btn primary xl" onclick="match()">Match</button><button class="btn xl" onclick="noMatch()">Not yet</button></div></div></div></section>`, 'Round');
  if (G.limit) timer = setInterval(tick, 1000);
  if (G.cam) { Cam.preview = false; Cam.watch(G.pose, lock); Cam.run(); }
}
function tick() { G.t--; $('#time').textContent = G.t; $('#time').classList.toggle('low', G.t <= 10); if (G.t === 10) tickSound(true); if (G.t <= 0) timeUp(); }

function float(e, x, always) {   // reactions respect the "Floating emojis" setting; score changes always show
  if (!always && !PREFS.emojis) return;
  const f = document.createElement('div'); f.className = 'float'; f.textContent = e; f.style.left = x + '%'; f.setAttribute('aria-hidden', 'true');
  document.body.appendChild(f); setTimeout(() => f.remove(), 2000);
}
function react(i) { if (EMO[i][0] === '🧘') G.stretch = true; float(EMO[i][0], 10 + Math.random() * 80); }
function fire(e) { float(e, 45); }
function foul() { G.score = Math.max(0, G.score - 20); $('#score').textContent = G.score; float('−20', 45, true); }

function lock() {
  clearInterval(timer); tickSound(false); const j = $('#judge'); j.hidden = false;
  [...$('.stage').children].forEach(c => { if (c !== j) c.setAttribute('inert', ''); });   // modal: nothing behind the dialog is reachable
  if (G.cam) { $('#judge-msg').textContent = `AI ${Math.round(Cam.score)}% · needs ${Cam.thr}%`; Cam.target = null; }
  j.querySelector('.primary').focus();
}
function noMatch() {
  $('#judge').hidden = true; [...$('.stage').children].forEach(c => c.removeAttribute('inert'));
  if (G.limit) { timer = setInterval(tick, 1000); if (G.t <= 10) tickSound(true); }   // back to the countdown: keep ticking if under 10 s
  if (G.cam) Cam.watch(G.pose, lock);
  $('#lockbtn').focus();
}
function match() {
  Cam.target = null; G.score += 100 * G.level + (G.limit ? G.t * 2 : 0); G.rounds++;
  cheer(); fire('🎯'); fire('🏆'); G.level++; next('Level cleared');
}
function timeUp() {
  clearInterval(timer); Cam.target = null; fire('⏱️'); G.rounds++; G.poser = (G.poser + (G.duo ? 2 : 1)) % G.players.length; next("Time's up");
}
function next(msg) { if (G.stretch || G.rounds % 4 === 0) stretchBreak(msg); else ready(msg); }

function stretchBreak(msg) {
  G.stretch = false; fire('🧘'); let t = 20;
  render(`<section class="screen center"><div class="panel card"><h1 class="headline orn">Stretch</h1><p class="display" id="st-n">20</p><p class="title" id="st-t" aria-live="polite">${STRETCH[0]}</p></div></section>`, 'Stretch');
  timer = setInterval(() => {
    t--; if (t <= 0) { clearInterval(timer); ready(msg); return; }
    $('#st-n').textContent = t; $('#st-t').textContent = STRETCH[Math.min(3, Math.floor((20 - t) / 5))];
  }, 1000);
}

document.body.insertAdjacentHTML('beforeend', '<button id="fs" class="btn" aria-label="Toggle full screen" onclick="toggleFull()"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/></svg></button>');
document.body.insertAdjacentHTML('beforeend', '<button id="gear" class="btn" aria-label="Settings" onclick="openPrefs()"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>');
prefsUI(); applyPrefs();
welcome();
