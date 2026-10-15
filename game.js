const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Exactly the 10 emojis from the plan. The third value 1 means only the game triggers it.
const EMO = [
  ['🎯', 'Nailed It', 1], ['🔥', 'Getting Hot'], ['❄️', 'Getting Cold'], ['👀', 'Almost'], ['😵', 'Confusion'],
  ['🤣', 'Funny Fail'], ['🤝', 'Teamwork'], ['⏱️', "Time's Up", 1], ['🏆', 'Level Cleared', 1], ['🧘', 'Stretch Break'],
];
const TIERS = ['easy', 'medium', 'hard'];
const STRETCH = ['Reach up high', 'Roll your shoulders', 'Gentle side stretch left', 'Gentle side stretch right'];
let G, timer;

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
  return `<svg viewBox="0 0 1 1" class="sil" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><g opacity=".85">${body}</g><g id="live"></g></svg>`;
}

// ---------- SCREENS ----------
function home() {
  clearInterval(timer); Cam.stop();
  app.innerHTML = `<section class="home"><h1>Pose Relay</h1><p class="sub">Human Tetris meets Charades. Wellness edition.</p>
    <div class="grid2"><div><h3>Players (3 to 7)</h3><div id="plist"></div>
      <div class="row"><button class="ghost" onclick="remP()">− Remove</button><button class="ghost" onclick="addP()">+ Add player</button></div></div>
    <div><label>Mode <select id="mode"><option value="60">Classic (60s)</option><option value="25">Rapid Fire (25s)</option><option value="0">Chill (no timer)</option></select></label>
    <label>Hardest level <select id="diff"><option value="0">Easy</option><option value="1">Medium</option><option value="2" selected>Hard</option></select></label>
    <label class="chk"><input type="checkbox" id="safe" checked> Safe Mode (removes balance and floor-risk poses)</label>
    <label class="chk"><input type="checkbox" id="seat"> Seated poses only</label>
    <label>Play style <select id="style"><option value="1">Solo Poser</option><option value="2">Duo Posers (two pose together)</option></select></label>
    <label class="chk"><input type="checkbox" id="split" checked> Split roles: each Describer controls one body zone</label>
    <label class="chk"><input type="checkbox" id="wl" checked> Word limit: more players, fewer words each</label></div></div>
    <div class="row"><button class="bigbtn" onclick="start(true)">📷 Start with camera</button><button class="bigbtn alt" onclick="start(false)">Start without camera</button></div>
    <p class="sub small">Camera mode reads a skeleton only. Nothing is recorded or uploaded. Camera judging works in Solo mode only.</p>
    <button class="ghost" onclick="rulebook(home)">How to play</button></section>`;
  ['Alex', 'Sam', 'Jo', 'Riley'].forEach(addP);
}
function addP(n) { if (document.querySelectorAll('.pn').length >= 7) return; const i = document.createElement('input'); i.className = 'pn'; i.maxLength = 14; i.placeholder = typeof n === 'string' ? n : 'Player ' + (document.querySelectorAll('.pn').length + 1); i.value = typeof n === 'string' ? n : ''; $('#plist').appendChild(i); }
function remP() { const l = document.querySelectorAll('.pn'); if (l.length > 3) l[l.length - 1].remove(); }

function rulebook(back) {
  app.innerHTML = `<section class="card"><h2>How to play</h2><ol>
    <li>One <b>Poser</b> turns their back to the screen. Everyone else is a <b>Describer</b> and can see the silhouette.</li>
    <li>Describers use <b>words only</b>: body parts and directions. No touching, no mimicking, no pose names.</li>
    <li>The Poser says "Locked!" (or anyone presses Lock). Describers judge: Match or Not yet. With the camera on, the game locks by itself when the pose is held.</li>
    <li>Match: level up, same Poser continues. Time runs out: the next player becomes Poser.</li>
    <li><b>Split roles:</b> each Describer controls one body zone and stays silent about the rest. <b>Word limit:</b> the more Describers, the fewer words each may say per instruction (1 Describer: 12 words, 6 Describers: 3). Anyone can call a foul (−20 points).</li>
    <li><b>Duo mode:</b> two Posers pose together, one on the left and one on the right as the Describers see them.</li>
    <li>Emojis give feedback only, never instructions. 🧘 triggers a 20-second Stretch Break.</li>
    <li>Safety: no jumping, flipping or forced balance on hard floors. Left and right are mirrored on purpose. Good luck!</li></ol>
    <h3>The 10 emojis</h3><p class="emos">${EMO.map(e => `<span>${e[0]} ${e[1]}</span>`).join('')}</p>
    <button onclick="(${back.name})()">Back</button></section>`;
}

function start(cam) {
  const names = [...document.querySelectorAll('.pn')].map(i => i.value.trim() || i.placeholder), duo = $('#style').value === '2';
  G = {
    players: names.map(n => ({ n })), limit: +$('#mode').value, max: +$('#diff').value, safe: $('#safe').checked,
    seated: $('#seat').checked, cam: cam && !duo, duo, split: $('#split').checked, wl: $('#wl').checked,
    poser: 0, level: 1, rounds: 0, score: 0, used: [], stretch: false,
  };
  goFull();
  if (G.cam) camSetup(); else ready(cam && duo ? 'Camera judging is Solo-only, so the Describers judge.' : 'Get ready!');
}

async function camSetup() {
  app.innerHTML = `<section class="card"><h2>Camera setup</h2>
    <p>Point the camera at the Poser so their whole body, head to feet, is in view. Only a skeleton is read; nothing is recorded or uploaded.</p>
    <canvas id="skel" width="480" height="360" class="camprev"></canvas>
    <p id="camstatus" class="sub">Starting...</p>
    <label>Camera <select id="camsel"></select></label>
    <label class="chk"><input type="checkbox" id="mirror"> Camera sees the Poser's back (flip left/right)</label>
    <div class="row"><button onclick="ready('Get ready!')">Start game</button><button class="ghost" onclick="G.cam=false;ready('Get ready!')">Play without camera</button></div></section>`;
  try {
    await Cam.init(t => $('#camstatus').textContent = t);
    Cam.preview = true; Cam.run();
    $('#camstatus').textContent = 'Camera on. Step back until the blue skeleton covers the whole body.';
    const cams = await Cam.cameras();
    $('#camsel').innerHTML = cams.map((c, i) => `<option value="${c.deviceId}">${esc(c.label || 'Camera ' + (i + 1))}</option>`).join('');
    $('#camsel').onchange = e => Cam.open(e.target.value);
    $('#mirror').onchange = e => Cam.mirror = e.target.checked;
  } catch (e) { G.cam = false; $('#camstatus').textContent = 'Camera unavailable (' + e.message + '). You can still play with human judging.'; }
}

function pick() {
  const tier = Math.min(G.max, Math.floor((G.level - 1) / 2));
  const ok = p => (!G.safe || p.safe) && (!G.seated || p.seated) && (G.duo ? p.n === 2 : !p.n);
  let pool = POSES.filter(p => ok(p) && p.d === TIERS[tier] && !G.used.includes(p.id));
  if (!pool.length) pool = POSES.filter(p => ok(p) && TIERS.indexOf(p.d) <= tier && !G.used.includes(p.id));
  if (!pool.length) { G.used = []; pool = POSES.filter(p => ok(p) && TIERS.indexOf(p.d) <= tier); }
  const p = pool[Math.floor(Math.random() * pool.length)];
  G.used.push(p.id); return p;
}

// ---------- CONFLICT RULES: split roles + word limits ----------
// Body zones by number of Describers (shuffled every round). Left/Right = the Poser's own left/right (= the screen's right/left).
const ZONES = {
  1: ['Everything'], 2: ['Arms', 'Legs, torso and head'], 3: ['Arms', 'Legs', 'Torso and head'],
  4: ['Left arm', 'Right arm', 'Legs', 'Torso and head'], 5: ['Left arm', 'Right arm', 'Left leg', 'Right leg', 'Torso and head'],
  6: ['Left arm', 'Right arm', 'Left leg', 'Right leg', 'Torso', 'Head'],
};
const WORDS = [0, 12, 8, 6, 5, 4, 3];   // max words per instruction, indexed by number of Describers
const posers = () => G.duo ? [G.poser, (G.poser + 1) % G.players.length] : [G.poser];
const posNames = () => posers().map(i => esc(G.players[i].n)).join(' + ');
function makeRoster() {
  const ps = posers(), ds = G.players.filter((_, i) => !ps.includes(i)), zones = ZONES[ds.length].slice().sort(() => Math.random() - .5);
  G.roster = ds.map((p, k) => ({ n: p.n, z: G.split ? zones[k] : 'Anything' }));
  G.W = G.wl ? WORDS[ds.length] : 0;
}
const rulesLine = () => ((G.split ? 'Only talk about your own body zone. ' : '') + (G.W ? `Max ${G.W} words each time you speak.` : '')) || 'Describe freely.';
const chips = () => G.roster.map(r => `<span class="chip"><b>${esc(r.n)}</b>${G.split ? ' controls: ' + r.z : ''}</span>`).join('');

function ready(msg) {
  clearInterval(timer); if (G.cam) Cam.preview = false; makeRoster();
  const ps = posers();
  app.innerHTML = `<section class="card center"><p class="sub">${msg}</p>
    <h2>${posNames()} ${G.duo ? 'are the Posers' : 'is the Poser'}</h2>
    <p>${G.duo ? `${esc(G.players[ps[0]].n)} stands on the LEFT and ${esc(G.players[ps[1]].n)} on the RIGHT, as the Describers see them.<br>` : ''}${G.duo ? 'Posers' : 'Poser'}: turn your back to the screen.</p>
    <h3>Describers</h3><div class="chips">${chips()}</div>
    <p class="rules">${rulesLine()}${G.split ? "<br><small>Left and right mean the Poser's own left and right (the screen's right is the Poser's left).</small>" : ''}</p>
    <p class="big">Level ${G.level}</p>
    <div class="row"><button class="bigbtn" onclick="play()">Show pose and start</button><button class="ghost" onclick="home()">End game</button></div></section>`;
}

function play() {
  G.pose = pick(); G.t = G.limit;
  app.innerHTML = `<section class="stage"><div class="top"><span>${G.duo ? 'Posers' : 'Poser'}: <b>${posNames()}</b></span><span>Level ${G.level}</span>
    <span id="score">Score ${G.score}</span><span id="time" class="time">${G.limit ? G.t : '∞'}</span></div>
    <div class="strip"><div class="chips">${chips()}</div><div class="rules">${rulesLine()}</div></div>
    <div class="mid">${figure(G.pose)}</div>
    ${G.cam ? '<div class="ai"><canvas id="skel" width="200" height="150"></canvas><div id="track"></div><div class="meter"><i id="meter-fill"></i></div><div id="rate"></div></div>' : ''}
    <div class="bar">${EMO.map((e, i) => `<button class="emo" ${e[2] ? 'disabled' : ''} title="${e[1]}" onclick="react(${i})">${e[0]}</button>`).join('')}</div>
    <div class="row"><button onclick="lock()">🔒 Locked!</button><button class="ghost" onclick="foul()">Call foul (−20)</button><button class="ghost" onclick="home()">End game</button></div>
    <div id="judge" class="judge" hidden><h2>Does it match?</h2><p id="judge-msg"></p><div class="row"><button class="bigbtn" onclick="match()">🎯 Match</button><button class="ghost" onclick="noMatch()">Not yet</button></div></div></section>`;
  if (G.limit) timer = setInterval(tick, 1000);
  if (G.cam) { Cam.preview = false; Cam.watch(G.pose, lock); Cam.run(); }
}
function foul() { G.score = Math.max(0, G.score - 20); $('#score').textContent = 'Score ' + G.score; float('FOUL −20', 40); }
function tick() { G.t--; $('#time').textContent = G.t; $('#time').classList.toggle('low', G.t <= 10); if (G.t <= 0) timeUp(); }

function float(e, x) {
  const f = document.createElement('div'); f.className = 'float'; f.textContent = e; f.style.left = x + '%';
  document.body.appendChild(f); setTimeout(() => f.remove(), 2000);
}
function react(i) { if (EMO[i][0] === '🧘') G.stretch = true; float(EMO[i][0], 10 + Math.random() * 80); }
function fire(e) { float(e, 45); }

function lock() {
  clearInterval(timer); $('#judge').hidden = false;
  if (G.cam) { $('#judge-msg').textContent = `AI score: ${Math.round(Cam.score)}% (needs ${Cam.thr}%). You have the final say.`; Cam.target = null; }
}
function noMatch() { $('#judge').hidden = true; if (G.limit) timer = setInterval(tick, 1000); if (G.cam) Cam.watch(G.pose, lock); }
function match() {
  Cam.target = null; G.score += 100 * G.level + (G.limit ? G.t * 2 : 0); G.rounds++;
  fire('🎯'); fire('🏆'); G.level++; next('Level cleared!');
}
function timeUp() {
  clearInterval(timer); Cam.target = null; fire('⏱️'); G.rounds++; G.poser = (G.poser + (G.duo ? 2 : 1)) % G.players.length; next("Time's up! Next Poser.");
}
function next(msg) { if (G.stretch || G.rounds % 4 === 0) stretchBreak(msg); else ready(msg); }

function stretchBreak(msg) {
  G.stretch = false; fire('🧘'); let t = 20;
  const draw = () => app.innerHTML = `<section class="card center"><h2>🧘 Stretch Break</h2><p class="big">${t}</p><p>${STRETCH[Math.min(3, Math.floor((20 - t) / 5))]}</p></section>`;
  draw(); timer = setInterval(() => { t--; if (t <= 0) { clearInterval(timer); ready(msg); } else draw(); }, 1000);
}

document.body.insertAdjacentHTML('beforeend', '<button id="fs" title="Full screen" onclick="toggleFull()">⛶</button>');
home();
