const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Exactly the 10 emojis from the plan. sys=true means only the game triggers it.
const EMO = [
  ['🎯', 'Nailed It', 1], ['🔥', 'Getting Hot'], ['❄️', 'Getting Cold'], ['👀', 'Almost'], ['😵', 'Confusion'],
  ['🤣', 'Funny Fail'], ['🤝', 'Teamwork'], ['⏱️', "Time's Up", 1], ['🏆', 'Level Cleared', 1], ['🧘', 'Stretch Break'],
];
const TIERS = ['easy', 'medium', 'hard'];
const STRETCH = ['Reach up high', 'Roll your shoulders', 'Gentle side stretch left', 'Gentle side stretch right'];
let G, timer;

// ---------- SILHOUETTE RENDERER (angles -> keypoints -> SVG) ----------
function keypoints(p) {
  const v = a => [Math.sin(a * Math.PI / 180), Math.cos(a * Math.PI / 180)];
  const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const ln = (p.lean || 0) * Math.PI / 180, hip = [.5, .55];
  const up = [Math.sin(ln), -Math.cos(ln)], side = [Math.cos(ln), Math.sin(ln)];
  const neck = add(hip, up, .24), out = { hip, neck, head: add(neck, up, .085) };
  for (const s of ['l', 'r']) {
    const k = s === 'r' ? 1 : -1, arm = (p.a || {})[s] || [k * 8, k * 8], leg = (p.lg || {})[s] || [k * 4, k * 4];
    const sh = add(neck, side, k * .085), el = add(sh, v(arm[0]), .15), wr = add(el, v(arm[1]), .14);
    const hp = add(hip, side, k * .05), kn = add(hp, v(leg[0]), .19), an = add(kn, v(leg[1]), .19);
    out[s] = { arm: [sh, el, wr], leg: [hp, kn, an] };
  }
  return out;
}
function figure(p) {
  const k = keypoints(p), pts = a => a.map(q => q.join(',')).join(' ');
  let s = `<line x1="${k.hip[0]}" y1="${k.hip[1]}" x2="${k.neck[0]}" y2="${k.neck[1]}" stroke-width=".13"/>`;
  s += `<circle cx="${k.head[0]}" cy="${k.head[1]}" r=".055" fill="currentColor" stroke="none"/>`;
  for (const side of ['l', 'r']) {
    s += `<polyline points="${pts(k[side].arm)}" stroke-width=".045"/>`;
    s += `<polyline points="${pts(k[side].leg)}" stroke-width=".06"/>`;
  }
  return `<svg viewBox="0 0 1 1" class="sil" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`;
}

// ---------- SCREENS ----------
function home() {
  clearInterval(timer);
  app.innerHTML = `<section class="card"><h1>Pose Relay</h1><p class="sub">Human Tetris meets Charades. Wellness edition.</p>
    <h3>Players (3 to 7)</h3><div id="plist"></div>
    <div class="row"><button class="ghost" onclick="remP()">− Remove</button><button class="ghost" onclick="addP()">+ Add player</button></div>
    <label>Mode <select id="mode"><option value="60">Classic (60s)</option><option value="25">Rapid Fire (25s)</option><option value="0">Chill (no timer)</option></select></label>
    <label>Hardest level <select id="diff"><option value="0">Easy</option><option value="1" selected>Medium</option><option value="2">Hard</option></select></label>
    <label class="chk"><input type="checkbox" id="safe" checked> Safe Mode (removes balance poses)</label>
    <label class="chk"><input type="checkbox" id="seat"> Seated poses only</label>
    <div class="row"><button onclick="start()">Start game</button><button class="ghost" onclick="rulebook(home)">How to play</button></div></section>`;
  ['Alex', 'Sam', 'Jo', 'Riley'].forEach(addP);
}
function addP(n) { if (document.querySelectorAll('.pn').length >= 7) return; const i = document.createElement('input'); i.className = 'pn'; i.maxLength = 14; i.placeholder = typeof n === 'string' ? n : 'Player ' + (document.querySelectorAll('.pn').length + 1); i.value = typeof n === 'string' ? n : ''; $('#plist').appendChild(i); }
function remP() { const l = document.querySelectorAll('.pn'); if (l.length > 3) l[l.length - 1].remove(); }

function rulebook(back) {
  app.innerHTML = `<section class="card"><h2>How to play</h2><ol>
    <li>One <b>Poser</b> turns their back to the screen. Everyone else is a <b>Describer</b> and can see the silhouette.</li>
    <li>Describers use <b>words only</b>: body parts and directions. No touching, no mimicking, no pose names.</li>
    <li>The Poser says "Locked!" (or anyone presses Lock). Describers judge: Match or No Match.</li>
    <li>Match: level up, same Poser continues. Time runs out: the next player becomes Poser.</li>
    <li>Emojis give feedback only, never instructions. 🧘 triggers a 20-second Stretch Break.</li>
    <li>Safety: no jumping, flipping or forced balance on hard floors. Left and right are mirrored on purpose. Good luck!</li></ol>
    <h3>The 10 emojis</h3><p class="emos">${EMO.map(e => `<span>${e[0]} ${e[1]}</span>`).join('')}</p>
    <button onclick="(${back.name})()">Back</button></section>`;
}

function start() {
  const names = [...document.querySelectorAll('.pn')].map(i => i.value.trim() || i.placeholder);
  G = {
    players: names.map(n => ({ n, wins: 0, fun: 0 })), limit: +$('#mode').value, max: +$('#diff').value, safe: $('#safe').checked,
    seated: $('#seat').checked, poser: 0, level: 1, rounds: 0, score: 0, emo: {}, used: [], stretch: false,
  };
  ready('Get ready!');
}

function pick() {
  const tier = Math.min(G.max, Math.floor((G.level - 1) / 2));
  const ok = p => (!G.safe || p.safe) && (!G.seated || p.seated);
  let pool = POSES.filter(p => ok(p) && p.d === TIERS[tier] && !G.used.includes(p.id));
  if (!pool.length) pool = POSES.filter(p => ok(p) && TIERS.indexOf(p.d) <= tier && !G.used.includes(p.id));
  if (!pool.length) { G.used = []; pool = POSES.filter(p => ok(p) && TIERS.indexOf(p.d) <= tier); }
  const p = pool[Math.floor(Math.random() * pool.length)];
  G.used.push(p.id); return p;
}

function ready(msg) {
  clearInterval(timer);
  const who = esc(G.players[G.poser].n);
  app.innerHTML = `<section class="card center"><p class="sub">${msg}</p><h2>${who} is the Poser</h2>
    <p>${who}: turn your back to the screen.<br>Describers: get ready to talk!</p><p class="big">Level ${G.level}</p>
    <button onclick="play()">Show pose and start</button><button class="ghost" onclick="result()">End game</button></section>`;
}

function play() {
  G.pose = pick(); G.t = G.limit; G.locked = false;
  app.innerHTML = `<section class="stage"><div class="top"><span>Poser: <b>${esc(G.players[G.poser].n)}</b></span><span>Level ${G.level}</span>
    <span>Score ${G.score}</span><span id="time" class="time">${G.limit ? G.t : '∞'}</span></div>
    ${figure(G.pose)}
    <div class="bar">${EMO.map((e, i) => `<button class="emo" ${e[2] ? 'disabled' : ''} title="${e[1]}" onclick="react(${i})">${e[0]}</button>`).join('')}</div>
    <div class="row"><button onclick="lock()">🔒 Locked!</button></div>
    <div id="judge" class="judge" hidden><h2>Does it match?</h2><div class="row"><button onclick="match()">🎯 Match</button><button class="ghost" onclick="noMatch()">Not yet</button></div></div></section>`;
  if (G.limit) timer = setInterval(tick, 1000);
}
function tick() { G.t--; $('#time').textContent = G.t; $('#time').classList.toggle('low', G.t <= 10); if (G.t <= 0) timeUp(); }

function react(i) {
  const [e] = EMO[i]; G.emo[e] = (G.emo[e] || 0) + 1;
  if (e === '🤣') G.players[G.poser].fun++;
  if (e === '🧘') G.stretch = true;
  const f = document.createElement('div'); f.className = 'float'; f.textContent = e; f.style.left = 10 + Math.random() * 80 + '%';
  document.body.appendChild(f); setTimeout(() => f.remove(), 2000);
}
function fire(e) { const i = EMO.findIndex(x => x[0] === e); G.emo[e] = (G.emo[e] || 0) + 1; const f = document.createElement('div'); f.className = 'float'; f.textContent = e; f.style.left = '45%'; document.body.appendChild(f); setTimeout(() => f.remove(), 2000); }

function lock() { clearInterval(timer); $('#judge').hidden = false; }
function noMatch() { $('#judge').hidden = true; if (G.limit) timer = setInterval(tick, 1000); }
function match() {
  G.score += 100 * G.level + (G.limit ? G.t * 2 : 0); G.players[G.poser].wins++; G.rounds++;
  fire('🎯'); fire('🏆'); G.level++; next('Level cleared!');
}
function timeUp() {
  clearInterval(timer); fire('⏱️'); G.rounds++; G.poser = (G.poser + 1) % G.players.length; next("Time's up! Next Poser.");
}
function next(msg) { if (G.stretch || G.rounds % 4 === 0) stretchBreak(msg); else ready(msg); }

function stretchBreak(msg) {
  G.stretch = false; fire('🧘'); let t = 20;
  const draw = () => app.innerHTML = `<section class="card center"><h2>🧘 Stretch Break</h2><p class="big">${t}</p><p>${STRETCH[Math.min(3, Math.floor((20 - t) / 5))]}</p></section>`;
  draw(); timer = setInterval(() => { t--; if (t <= 0) { clearInterval(timer); ready(msg); } else draw(); }, 1000);
}

function result() {
  clearInterval(timer);
  const best = [...G.players].sort((a, b) => b.wins - a.wins)[0], fun = [...G.players].sort((a, b) => b.fun - a.fun)[0];
  const emo = EMO.map(e => `${e[0]} ${G.emo[e[0]] || 0}`).join('  ');
  const text = `Pose Relay: score ${G.score}, levels cleared ${G.level - 1}\n${emo}`;
  app.innerHTML = `<section class="card center"><h2>Result card</h2><p class="big">${G.score} pts</p><p>Levels cleared: <b>${G.level - 1}</b> in ${G.rounds} rounds</p>
    <p class="emos">${EMO.map(e => `<span>${e[0]} ${G.emo[e[0]] || 0}</span>`).join('')}</p>
    ${best.wins ? `<p>🥇 Most Flexible: <b>${esc(best.n)}</b> (${best.wins} cleared)</p>` : ''}
    ${fun.fun ? `<p>🤣 Funniest Fail: <b>${esc(fun.n)}</b></p>` : ''}
    <div class="row"><button onclick="navigator.clipboard.writeText(${JSON.stringify(text).replace(/"/g, '&quot;')});this.textContent='Copied!'">Copy result</button><button class="ghost" onclick="home()">Play again</button></div></section>`;
}

home();
