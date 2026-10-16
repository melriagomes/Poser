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
function parts(p) {
  const k = keypoints(p), sc = k.sc, pts = a => a.map(q => q.join(',')).join(' ');
  let s = `<line x1="${k.hip[0]}" y1="${k.hip[1]}" x2="${k.neck[0]}" y2="${k.neck[1]}" stroke-width="${(k.w ? .13 : .1) * sc}"/>`;
  s += `<circle cx="${k.head[0]}" cy="${k.head[1]}" r="${.055 * sc}" fill="currentColor" stroke="none"/>`;
  for (const side of ['l', 'r']) {
    s += `<polyline points="${pts(k[side].arm)}" stroke-width="${.045 * sc}"/><polyline points="${pts(k[side].leg)}" stroke-width="${.06 * sc}"/>`;
  }
  return s;
}
function figure(p) {   // duo poses carry p.figs: two figures drawn at 80% size
  const body = p.figs ? p.figs.map(f => parts({ sc: .8, ...f })).join('') : parts(p);
  return `<svg viewBox="0 0 1 1" class="sil" role="img" aria-label="Pose to describe" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><g>${body}</g><g id="live"></g></svg>`;
}

// ---------- WELCOME ----------
function welcome() {
  clearInterval(timer); Cam.stop();
  const still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);   // reduced motion: no autoplay
  render(`<section class="welcome">
    <h1 class="sr">Poser</h1>
    <video id="wv" src="welcome.mp4" poster="poster.jpg" ${still ? '' : 'autoplay'} muted loop playsinline aria-hidden="true" tabindex="-1"></video>
    <button class="btn primary xl start" onclick="home()">Start</button>
    <div class="vctl"><button class="btn" id="pp" onclick="wvPlay()">${still ? 'Play' : 'Pause'}</button><button class="btn" id="snd" onclick="wvSound()">Sound off</button></div></section>`, '');
  $('.welcome').addEventListener('click', e => { if (!e.target.closest('button')) home(); });
  $('.start').focus();
  if (!still) { const p = $('#wv').play(); if (p && p.catch) p.catch(() => { $('#pp').textContent = 'Play'; }); }
}
function wvPlay() { const v = $('#wv'); if (v.paused) { v.play(); $('#pp').textContent = 'Pause'; } else { v.pause(); $('#pp').textContent = 'Play'; } }
function wvSound() { const v = $('#wv'); v.muted = !v.muted; $('#snd').textContent = v.muted ? 'Sound off' : 'Sound on'; }

// ---------- SETUP ----------
function home() {
  clearInterval(timer); Cam.stop();
  render(`<section class="screen"><h1 class="display">Poser</h1>
    <div class="cols">
      <fieldset class="panel"><legend>Players</legend><div id="plist"></div>
        <div class="actions"><button class="btn text" onclick="remP()">− Remove</button><button class="btn text" onclick="addP()">+ Add</button></div></fieldset>
      <fieldset class="panel"><legend>Settings</legend>
        <div class="field"><label for="style">Style</label><select id="style"><option value="1">Solo</option><option value="2">Duo</option></select></div>
        <div class="field"><label for="mode">Timer</label><select id="mode"><option value="60">Classic 60s</option><option value="25">Rapid 25s</option><option value="0">Chill</option></select></div>
        <div class="field"><label for="diff">Difficulty</label><select id="diff"><option value="0">Easy</option><option value="1">Medium</option><option value="2" selected>Hard</option></select></div>
        <label class="check"><input type="checkbox" id="safe" checked><span>Safe mode</span></label>
        <label class="check"><input type="checkbox" id="seat"><span>Seated only</span></label>
        <label class="check"><input type="checkbox" id="split" checked><span>Split roles</span></label>
        <label class="check"><input type="checkbox" id="wl" checked><span>Word limit</span></label></fieldset>
    </div>
    <div class="actions"><button class="btn primary xl" onclick="start(true)">Play with camera</button><button class="btn xl" onclick="start(false)">Play without camera</button></div>
    <button class="btn text" onclick="rulebook()">How to play</button></section>`, 'Setup');
  ['Alex', 'Sam', 'Jo', 'Riley'].forEach(addP);
}
function addP(n) {
  const l = document.querySelectorAll('.pn'); if (l.length >= 7) return;
  const i = document.createElement('input'); i.type = 'text'; i.className = 'pn'; i.maxLength = 14;
  i.setAttribute('aria-label', 'Player ' + (l.length + 1)); i.placeholder = 'Player ' + (l.length + 1); if (typeof n === 'string') i.value = n;
  $('#plist').appendChild(i);
}
function remP() { const l = document.querySelectorAll('.pn'); if (l.length > 3) l[l.length - 1].remove(); }

function rulebook() {
  render(`<section class="screen narrow"><h1 class="headline">How to play</h1>
    <ol class="rules-list"><li>The Poser faces away from the screen.</li><li>Describers see the pose and guide with words only.</li>
      <li>Lock it, then judge: Match or Not yet.</li><li>Split roles: each Describer controls one body zone.</li>
      <li>Word limit: more Describers, fewer words each.</li><li>Duo: two Posers, left and right as the Describers see them.</li><li>A foul costs 20 points.</li></ol>
    <h2 class="label">Emojis</h2><ul class="emos">${EMO.map(e => `<li class="chip">${e[0]} ${e[1]}</li>`).join('')}</ul>
    <button class="btn primary" onclick="home()">Back</button></section>`, 'How to play');
}

function start(cam) {
  const names = [...document.querySelectorAll('.pn')].map(i => i.value.trim() || i.placeholder), duo = $('#style').value === '2';
  G = {
    players: names.map(n => ({ n })), limit: +$('#mode').value, max: +$('#diff').value, safe: $('#safe').checked,
    seated: $('#seat').checked, cam, duo, split: $('#split').checked, wl: $('#wl').checked,
    poser: 0, level: 1, rounds: 0, score: 0, used: [], stretch: false,
  };
  goFull();
  if (G.cam) camSetup(); else ready('');
}

async function camSetup() {
  const n = G.duo ? 2 : 1;
  render(`<section class="screen narrow"><h1 class="headline">Camera</h1>
    <canvas id="skel" width="480" height="360" class="camprev" role="img" aria-label="Camera preview"></canvas>
    <p id="track" class="rules" role="status"></p><p id="camstatus" class="muted" role="status">Loading...</p>
    <div class="field" style="width:100%"><label for="camsel">Camera</label><select id="camsel"></select></div>
    <label class="check"><input type="checkbox" id="mirror"><span>Flip left/right</span></label>
    <div class="actions"><button class="btn primary" id="go" disabled onclick="ready('')">Start</button><button class="btn" onclick="G.cam=false;Cam.stop();ready('')">No camera</button></div></section>`, 'Camera');
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
  } catch (e) { G.cam = false; Cam.stop(); const s = $('#camstatus'); if (s) s.textContent = 'Camera unavailable: ' + e.message + ' You can play without it.'; }
}

function pick() {
  const tier = Math.min(G.max, Math.floor((G.level - 1) / 2));
  const ok = p => (!G.safe || p.safe) && (!G.seated || p.seated) && (G.duo ? p.n === 2 : !p.n);
  let pool = POSES.filter(p => ok(p) && p.d === TIERS[tier] && !G.used.includes(p.id));
  if (!pool.length) pool = POSES.filter(p => ok(p) && TIERS.indexOf(p.d) <= tier && !G.used.includes(p.id));
  if (!pool.length) { G.used = []; pool = POSES.filter(p => ok(p) && TIERS.indexOf(p.d) <= tier); }
  if (!pool.length) pool = POSES;
  const p = pool[Math.floor(Math.random() * pool.length)];
  G.used.push(p.id); return p;
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
  render(`<section class="screen center">${msg ? `<p class="banner" role="status">${msg}</p>` : ''}
    <p class="label">${G.duo ? 'Posers' : 'Poser'}</p><h1 class="headline">${who}</h1>
    <h2 class="label">Describers</h2>${chips()}
    <p class="rules">${rulesLine()}</p>${G.split ? "<p class=\"hint\">Left and right are the Poser's own.</p>" : ''}
    <p class="level">Level ${G.level}</p>
    <div class="actions"><button class="btn primary xl" onclick="play()">Show pose</button><button class="btn text" onclick="home()">End game</button></div></section>`, 'Ready');
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
function tick() { G.t--; $('#time').textContent = G.t; $('#time').classList.toggle('low', G.t <= 10); if (G.t <= 0) timeUp(); }

function float(e, x) {
  const f = document.createElement('div'); f.className = 'float'; f.textContent = e; f.style.left = x + '%'; f.setAttribute('aria-hidden', 'true');
  document.body.appendChild(f); setTimeout(() => f.remove(), 2000);
}
function react(i) { if (EMO[i][0] === '🧘') G.stretch = true; float(EMO[i][0], 10 + Math.random() * 80); }
function fire(e) { float(e, 45); }
function foul() { G.score = Math.max(0, G.score - 20); $('#score').textContent = G.score; float('−20', 45); }

function lock() {
  clearInterval(timer); const j = $('#judge'); j.hidden = false;
  [...$('.stage').children].forEach(c => { if (c !== j) c.setAttribute('inert', ''); });   // modal: nothing behind the dialog is reachable
  if (G.cam) { $('#judge-msg').textContent = `AI ${Math.round(Cam.score)}% · needs ${Cam.thr}%`; Cam.target = null; }
  j.querySelector('.primary').focus();
}
function noMatch() {
  $('#judge').hidden = true; [...$('.stage').children].forEach(c => c.removeAttribute('inert'));
  if (G.limit) timer = setInterval(tick, 1000);
  if (G.cam) Cam.watch(G.pose, lock);
  $('#lockbtn').focus();
}
function match() {
  Cam.target = null; G.score += 100 * G.level + (G.limit ? G.t * 2 : 0); G.rounds++;
  fire('🎯'); fire('🏆'); G.level++; next('Level cleared');
}
function timeUp() {
  clearInterval(timer); Cam.target = null; fire('⏱️'); G.rounds++; G.poser = (G.poser + (G.duo ? 2 : 1)) % G.players.length; next("Time's up");
}
function next(msg) { if (G.stretch || G.rounds % 4 === 0) stretchBreak(msg); else ready(msg); }

function stretchBreak(msg) {
  G.stretch = false; fire('🧘'); let t = 20;
  render(`<section class="screen center"><h1 class="headline">Stretch</h1><p class="display" id="st-n">20</p><p class="title" id="st-t" aria-live="polite">${STRETCH[0]}</p></section>`, 'Stretch');
  timer = setInterval(() => {
    t--; if (t <= 0) { clearInterval(timer); ready(msg); return; }
    $('#st-n').textContent = t; $('#st-t').textContent = STRETCH[Math.min(3, Math.floor((20 - t) / 5))];
  }, 1000);
}

document.body.insertAdjacentHTML('beforeend', '<button id="fs" class="btn" aria-label="Toggle full screen" onclick="toggleFull()"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/></svg></button>');
welcome();
