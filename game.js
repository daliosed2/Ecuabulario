import {
  ALL_WORDS, norm, ensureInit,
  loadPoints, savePoints,
  getSolvedAll, addSolvedAll, getProgressAll
} from './data.js';

try { ensureInit(); } catch {}

const $ = id => document.getElementById(id);
const EL = {
  pointsEl: $('points'),
  level: $('level'),
  bar: $('bar'),
  clue: $('clue'),
  slots: $('slots'),
  msg: $('msg'),
  gamecard: $('gamecard'),
  typer: $('typer'),        // solo desktop
  hintLetter: $('hint-letter'),
  hintFirst:  $('hint-first'),
  gameover: $('gameover'),
  goText:   $('go-text'),
  goRetry:  $('go-retry'),
};

EL.gamecard?.classList.add('kb-fix');

/* ===== detección robusta de móvil ===== */
const IS_TOUCH   = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window || 'ontouchstart' in document.documentElement;
const IS_PRECISE = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const IS_MOBILE  = IS_TOUCH && !IS_PRECISE;

/* ===== persistencia de palabra actual ===== */
const LS_CURRENT = 'ecuabulario_current_id';

/* ===== costos de pistas (ajústalos cuando quieras) ===== */
const COST_HINT_LETTER = 3;
const COST_HINT_FIRST  = 7;

/* ===== modo de juego ===== */
const MODE = new URLSearchParams(location.search).get('mode') === 'time' ? 'time' : 'classic';
let timeLeft = 120;   // segundos
let timerId = null;
let hits = 0;
let timeStarted = false;
let timeEnded = false;

let points = loadPoints();
if (EL.pointsEl) EL.pointsEl.textContent = points;

/* ===== banco y estado ===== */
const solvedSet = getSolvedAll();
let queue = ALL_WORDS.filter(x => !solvedSet.has(x.id));
if (queue.length === 0) queue = [...ALL_WORDS];
shuffle(queue);

let current = null, answerClean = '', boxes = []; // boxes: {el,char,locked,val}

/* ===== helpers básicos ===== */
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; }
const firstEmpty = () => boxes.find(b => !b.locked && !b.val);
function lastFilled(){ for(let i=boxes.length-1;i>=0;i--) if(boxes[i].val && !boxes[i].locked) return i; return -1; }

function updateHud(){
  const p = getProgressAll();
  if (EL.level) EL.level.textContent = `Nivel ${p.level}`;
  if (EL.bar) EL.bar.style.width = (p.ratio * 100) + '%';
  if (EL.pointsEl) EL.pointsEl.textContent = points;
  savePoints(points);
}

function highlightNext(){
  boxes.forEach(b => b.el.classList.remove('focus'));
  const b = firstEmpty();
  if (b){
    b.el.classList.add('focus');
    try { b.el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch {}
  }
}

/* =======================
   Auto-grid: siempre cabe
   ======================= */
const root = document.documentElement;
const cssNum = (name, fallback)=> {
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};
const BASE = {
  size:  cssNum('--slot-size', 62),
  gapL:  cssNum('--gap-letter', 12),
  gapRow:cssNum('--gap-word-row', 14),
};
const cssVarPx = (name)=> {
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const setSize = (px)=> root.style.setProperty('--slot-size', px+'px');
const setGaps = (l,r)=>{
  root.style.setProperty('--gap-letter', l+'px');
  root.style.setProperty('--gap-word-row', r+'px');
};
const debounce = (fn, wait=120)=>{
  let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); };
};

// Calcula la mejor distribución (filas/columnas) y tamaño de slot
function bestLayout(n){
  // límites por dispositivo/orientación
  const isPortrait = window.innerHeight >= window.innerWidth;
  const maxRows = IS_MOBILE ? (isPortrait ? 3 : 2) : 2; // desktop: máx 2 filas
  const minCols = (!IS_MOBILE && n >= 4) ? 3 : 2;       // en desktop intenta ≥3 columnas

  const containerW = EL.slots.clientWidth || (window.innerWidth - 32);
  const gapL  = cssNum('--gap-letter', BASE.gapL);
  const gapR  = cssNum('--gap-word-row', BASE.gapRow);
  const kH    = 1.18; // altura del slot = size * kH

  const reserve = IS_MOBILE
    ? Math.max(160, (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vk-h')) || 0) + 40)
    : 160;

  const top = EL.slots.getBoundingClientRect().top || 0;
  const availH = Math.max(120, window.innerHeight - top - reserve);

  let best = null;

  for (let r = 1; r <= maxRows; r++) {
    const cols = Math.ceil(n / r);
    if (cols < minCols && n >= minCols) continue; // evita muy pocas columnas en desktop

    let size = Math.floor((containerW - gapL * (cols - 1)) / cols);
    size = Math.max(20, Math.min(88, size));
    const totalH = r * (size * kH) + (r - 1) * gapR;

    if (totalH <= availH) {
      const score = size - r * 1.2; // favorece slot grande y menos filas
      if (!best || score > best.score) best = { rows: r, cols, size, score };
    }
  }

  if (!best) {
    const r = Math.min(maxRows, Math.max(1, Math.ceil(n / 10)));
    const cols = Math.ceil(n / r);
    let size = Math.floor((containerW - gapL * (cols - 1)) / cols);
    size = Math.max(18, Math.min(80, size));
    best = { rows: r, cols, size, score: size - r * 1.2 };
  }

  const counts = Array(best.rows).fill(0);
  const base = Math.floor(n / best.rows);
  const extra = n % best.rows;
  for (let i = 0; i < best.rows; i++) counts[i] = base + (i < extra ? 1 : 0);

  return { counts, size: best.size };
}

// Renderiza el grid a partir de "boxes" existentes (no se pierden letras)
function renderFromBoxes(layout){
  EL.slots.innerHTML = '';
  let idx = 0;
  layout.counts.forEach(cols=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.style.gridTemplateColumns = `repeat(${cols}, var(--slot-size))`;
    for(let c=0;c<cols;c++){
      const b = boxes[idx++];
      const s = document.createElement('div');
      s.className = 'slot' + (b.locked ? ' lock' : '');
      s.textContent = b.val || '';
      row.appendChild(s);
      b.el = s; // re-bind
    }
    EL.slots.appendChild(row);
  });
  highlightNext();
}

function fitSlots(){
  if(!current || !boxes.length) return;
  const layout = bestLayout(boxes.length);
  setSize(layout.size);
  // Ajuste suave de gaps según tamaño
  const gapScale = Math.max(0.65, Math.min(1, layout.size / BASE.size));
  setGaps(Math.max(6, Math.floor(BASE.gapL * gapScale)),
          Math.max(6, Math.floor(BASE.gapRow * gapScale)));
  renderFromBoxes(layout);
}

/* =======================
        Modo Contrarreloj
   ======================= */
function ensureTimeUI(){
  if (MODE !== 'time') return;
  if (!document.getElementById('modebar')){
    const mb = document.createElement('div');
    mb.id = 'modebar';
    mb.className = 'modebar';
    mb.innerHTML = `
      <span id="timerBadge" class="badge">2:00</span>
      <span id="hitsBadge"  class="badge">Aciertos 0</span>
    `;
    const wrap = document.querySelector('.wrap') || document.body;
    wrap.insertBefore(mb, wrap.firstChild.nextSibling || wrap.firstChild);
  }
  EL.timerBadge = document.getElementById('timerBadge');
  EL.hitsBadge  = document.getElementById('hitsBadge');
  updateBadges();
}
function fmtTime(s){ const m = Math.floor(s/60); const ss = String(s%60).padStart(2,'0'); return `${m}:${ss}`; }
function updateBadges(){
  if (MODE !== 'time') return;
  if (EL.timerBadge) EL.timerBadge.textContent = fmtTime(Math.max(0, timeLeft));
  if (EL.hitsBadge)  EL.hitsBadge.textContent  = `Aciertos ${hits}`;
}
function startTimerIfNeeded(){
  if (MODE !== 'time' || timeStarted) return;
  timeStarted = true;
  timerId = setInterval(()=>{
    if (timeEnded) { clearInterval(timerId); timerId=null; return; }
    timeLeft--;
    updateBadges();
    if (timeLeft <= 0) finishTimeAttack();
  }, 1000);
  updateBadges();
}
function finishTimeAttack(){
  if (timeEnded) return;
  timeEnded = true;
  if (timerId){ clearInterval(timerId); timerId = null; }
  if (EL.goText)   EL.goText.textContent = `¡Tiempo! Aciertos: ${hits}`;
  if (EL.gameover) EL.gameover.style.display = 'flex';
}

/* =======================
        Render palabra
   ======================= */
function newWord(){
  // Reusar palabra pendiente si existe
  const savedId = localStorage.getItem(LS_CURRENT);
  if (savedId) {
    const alreadySolved = getSolvedAll().has(savedId);
    const found = ALL_WORDS.find(w => w.id === savedId);
    if (!alreadySolved && found) current = found;
  }

  // O tomar nueva de la cola
  if (!current) {
    current = queue.shift();
    if (!current) {
      const set = getSolvedAll();
      queue = ALL_WORDS.filter(x => !set.has(x.id));
      if (queue.length === 0) queue = [...ALL_WORDS];
      shuffle(queue);
      current = queue.shift();
    }
  }

  localStorage.setItem(LS_CURRENT, current.id);

  if (EL.clue) EL.clue.textContent = current.clue;
  if (EL.msg)  EL.msg.textContent  = '';

  // UI contrarreloj
  ensureTimeUI();
  updateBadges();

  // Construir boxes SOLO con letras (espacios/guiones fuera del grid)
  const letters = Array.from(current.a).filter(ch => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(ch));
  boxes = letters.map(ch => ({ el:null, char: ch, locked:false, val:'' }));

  answerClean = norm(current.a);

  // Render inicial según mejor distribución
  const layout = bestLayout(boxes.length);
  setSize(layout.size);
  renderFromBoxes(layout);

  // Ajuste fino
  requestAnimationFrame(fitSlots);
}

/* =======================
        Lógica de juego
   ======================= */
function maybeAutoCheck(){
  if (boxes.every(b => b.val || b.locked)) check();
  else highlightNext();
}
function typeLetter(L){
  if (MODE === 'time'){ if (timeEnded) return; startTimerIfNeeded(); }
  const b = firstEmpty(); if (!b) return;
  b.val = L; b.el.textContent = L; b.el.classList.add('filled');
  maybeAutoCheck();
}
function backspace(){
  if (MODE === 'time' && timeEnded) return;
  const i = lastFilled(); if (i < 0) return;
  boxes[i].val = '';
  boxes[i].el.textContent = '';
  EL.msg && (EL.msg.textContent = '');
  highlightNext();
}
function userGuessClean(){ return norm(boxes.map(b => b.val || '').join('')); }

function showGameOver(){
  const figures = ['Eloy Alfaro','Manuela Sáenz','Rumiñahui','Dolores Cacuango','Oswaldo Guayasamín','Eugenio Espejo','Abdón Calderón','José Joaquín de Olmedo'];
  const name = figures[Math.floor(Math.random()*figures.length)];
  EL.goText && (EL.goText.textContent = `Has decepcionado a ${name}`);
  EL.gameover && (EL.gameover.style.display = 'flex');
}

EL.goRetry?.addEventListener('pointerup', (e)=>{
  e.preventDefault();
  if (MODE === 'time'){
    timeLeft = 120; hits = 0; timeStarted = false; timeEnded = false;
    updateBadges();
    if (EL.gameover) EL.gameover.style.display = 'none';
    current = null; newWord();
  } else {
    points = 100; updateHud();
    if (EL.gameover) EL.gameover.style.display = 'none';
    // limpiar casillas pero mantener palabra
    boxes.forEach(b => { if(!b.locked){ b.val=''; b.el.textContent=''; } });
    EL.msg && (EL.msg.textContent = '');
    highlightNext();
  }
}, {passive:false});

function win(){
  // +10 por acierto (ajustado)
  points += 10; updateHud();

  if (MODE === 'time'){ hits++; updateBadges(); }

  EL.msg && (EL.msg.innerHTML = '<span class="ok">¡Correcto! +10 ⭐️</span>');
  EL.gamecard.classList.add('winflash');
  addSolvedAll(current.id);
  localStorage.removeItem(LS_CURRENT); // ya no está pendiente
  setTimeout(()=>{
    EL.gamecard.classList.remove('winflash');
    current = null;      // fuerza elegir nueva
    if (!timeEnded) newWord();
  }, 300);
}
function fail(){
  if (MODE !== 'time'){ points -= 5; updateHud(); }
  EL.msg && (EL.msg.innerHTML = MODE==='time'
    ? '<span class="bad">Incorrecto</span>'
    : '<span class="bad">Incorrecto (-5 ⭐️)</span>');
  if (navigator.vibrate) navigator.vibrate(15);
  if (MODE !== 'time' && points <= 0){ showGameOver(); return; }
  autoClear();
}
function check(){ (userGuessClean() === answerClean) ? win() : fail(); }

/* =======================
           Pistas
   ======================= */
function pay(cost){
  if (points < cost){
    EL.msg && (EL.msg.innerHTML = '<span class="bad">No te alcanzan los puntos.</span>');
    return false;
  }
  points -= cost; updateHud(); return true;
}
function hintLetter(){
  if(!boxes.length) return;
  if(!pay(COST_HINT_LETTER)) return;
  const cs = boxes.filter(b => !b.locked && !b.val);
  if(!cs.length){ maybeAutoCheck(); return; }
  const pick = cs[Math.floor(Math.random()*cs.length)];
  pick.val = pick.char.toUpperCase(); pick.el.textContent = pick.val;
  pick.locked = true; pick.el.classList.add('lock'); maybeAutoCheck();
}
function hintFirst(){
  if(!boxes.length) return;
  if(!pay(COST_HINT_FIRST)) return;
  const first = boxes.find(b => !b.locked);
  if(!first){ maybeAutoCheck(); return; }
  first.val = first.char.toUpperCase(); first.el.textContent = first.val;
  first.locked = true; first.el.classList.add('lock'); maybeAutoCheck();
}
['pointerup'].forEach(e=>{
  EL.hintLetter?.addEventListener(e, (ev)=>{ ev.preventDefault(); hintLetter(); }, {passive:false});
  EL.hintFirst?.addEventListener(e,  (ev)=>{ ev.preventDefault(); hintFirst();  }, {passive:false});
});

/* =========================================================
   ENTRADA DE TEXTO
   - Desktop: input oculto + teclado físico
   - Móvil:  teclado virtual adaptativo (sin teclado nativo)
   ========================================================= */

// ---- Desktop / hardware keyboard ----
if (!IS_MOBILE) {
  const SENTINEL = '•';
  let lastStamp = 0;

  function setTyperSentinel(){
    EL.typer.value = SENTINEL;
    try { EL.typer.setSelectionRange(EL.typer.value.length, EL.typer.value.length); } catch {}
  }
  function focusTyperSync(){
    try { EL.typer.focus({ preventScroll:true }); setTyperSentinel(); } catch {}
  }
  EL.slots.addEventListener('pointerup', (e)=>{ e.preventDefault(); focusTyperSync(); }, { passive:false });

  EL.typer.addEventListener('input', (e)=>{
    const now = performance.now();
    if (now - lastStamp < 15) { setTyperSentinel(); return; }
    lastStamp = now;
    const v = e.target.value;
    for (let i = 0; i < v.length; i++){
      const ch = v[i].toUpperCase();
      if (ch !== SENTINEL && /^[A-ZÑ]$/.test(ch)) typeLetter(ch);
    }
    setTyperSentinel();
  });
  EL.typer.addEventListener('beforeinput', (e)=>{
    if (e.inputType === 'deleteContentBackward'){ e.preventDefault(); backspace(); setTyperSentinel(); }
  });
  EL.typer.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); maybeAutoCheck(); }
    if(e.key === 'Backspace'){ e.preventDefault(); backspace(); setTyperSentinel(); }
  });
  document.addEventListener('keydown', (e)=>{
    if (document.activeElement === EL.typer) return;
    if (e.key === 'Backspace' || e.key === 'Enter') e.preventDefault();
    if (e.key === 'Backspace') backspace();
    if (e.key === 'Enter') maybeAutoCheck();
  }, {passive:false});
}

// ---- Móvil: teclado virtual adaptativo ----
if (IS_MOBILE) ensureVirtualKeyboard();

function ensureVirtualKeyboard(){
  // Evitar teclado nativo
  if (EL.typer){
    EL.typer.blur();
    EL.typer.setAttribute('readonly','true');
    EL.typer.setAttribute('inputmode','none');
  }

  let vk = document.getElementById('vk');
  if (!vk){
    vk = document.createElement('div');
    vk.id = 'vk';
    vk.className = 'vk';
    const style = document.createElement('style');
    style.id = 'vk-style';
    style.textContent = `
  :root{ --vk-h: clamp(180px, 38svh, 300px); --vk-gap: clamp(4px, 1.8vw, 8px); }
  /* Evita escalado y zoom por doble tap */
  html, body{ -webkit-text-size-adjust: 100%; }
  .vk{
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 999;
    height: var(--vk-h);
    background: #0f172a;
    padding: 8px clamp(8px, 3vw, 12px) calc(10px + env(safe-area-inset-bottom));
    box-shadow: 0 -12px 30px rgba(0,0,0,.25);
    display: flex; flex-direction: column; justify-content: flex-end;
    max-width: 100vw; overflow: hidden;
    -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .vk-row{
    display: grid;
    gap: var(--vk-gap);
    margin: clamp(2px, 0.8vh, 6px) 0;
    padding: 0 clamp(4px, 2vw, 10px);
  }
  .vk-row.r1, .vk-row.r2{ grid-template-columns: repeat(10, minmax(0, 1fr)); }
  .vk-row.r3{ grid-template-columns: repeat(9,  minmax(0, 1fr)); }
  .vk-key{
    border-radius: 12px;
    background:#1f2937; color:#fff; font-weight:800;
    display:grid; place-items:center;
    user-select:none; -webkit-user-select:none; -webkit-touch-callout:none;
    min-width: 0;
    height: clamp(40px, 9svh, 52px);
    font-size: clamp(16px, 2.8svh, 20px);
    padding: 0 clamp(2px, 1vw, 4px);
    box-shadow: 0 2px 6px rgba(0,0,0,.2);
    touch-action: manipulation;
  }
  .vk-key:active{ transform: scale(.98); }
`;
    document.head.appendChild(style);
    document.body.appendChild(vk);
  }

  const rows = [
    ['Q','W','E','R','T','Y','U','I','O','P'],   // 10
    ['A','S','D','F','G','H','J','K','L','Ñ'],   // 10
    ['Z','X','C','V','B','N','M','⌫','OK']      // 9 (compacta)
  ];

  // Anti-zoom por doble tap y gestos en iOS
  let lastTap = 0;
  const stopZoom = (e)=>{ e.preventDefault(); };
  vk.addEventListener('gesturestart', stopZoom, {passive:false});
  vk.addEventListener('dblclick',    stopZoom, {passive:false});
  vk.addEventListener('touchend', (e)=>{
    const now = Date.now();
    if (now - lastTap < 350) { e.preventDefault(); }
    lastTap = now;
  }, {passive:false});

  vk.innerHTML = '';
  rows.forEach((r, idx)=>{
    const row = document.createElement('div');
    row.className = `vk-row r${idx+1}`;
    r.forEach(label=>{
      const btn = document.createElement('div');
      btn.className = 'vk-key';
      btn.textContent = label;
      btn.addEventListener('pointerup', (e)=>{ e.preventDefault(); handleVK(label); }, {passive:false});
      row.appendChild(btn);
    });
    vk.appendChild(row);
  });

  const setVKHeight = ()=>{
    const vv = window.visualViewport;
    const base = vv ? vv.height : window.innerHeight;
    const h = Math.min(Math.max(base * 0.38, 180), 300); // 180–300px
    root.style.setProperty('--vk-h', h + 'px');
    const wrap = document.querySelector('.wrap');
    if (wrap) wrap.style.paddingBottom = `calc(${h}px + env(safe-area-inset-bottom))`;
    requestAnimationFrame(fitSlots);
  };
  setVKHeight();

  window.addEventListener('resize', setVKHeight, {passive:true});
  window.addEventListener('orientationchange', setVKHeight, {passive:true});
  window.visualViewport?.addEventListener('resize', setVKHeight, {passive:true});
  window.visualViewport?.addEventListener('scroll', setVKHeight, {passive:true});
}

function handleVK(k){
  if (k === '⌫') { backspace(); return; }
  if (k === 'OK') { maybeAutoCheck(); return; }
  if (/^[A-ZÑ]$/.test(k)) typeLetter(k);
}

/* =======================
           Util
   ======================= */
function autoClear(){
  EL.gamecard.classList.add('shake');
  requestAnimationFrame(()=>setTimeout(()=>{
    EL.gamecard.classList.remove('shake');
    boxes.forEach(b => { if(!b.locked){ b.val=''; b.el.textContent=''; } });
    EL.msg && (EL.msg.textContent = '');
    highlightNext();
  }, 220));
}

/* =======================
           Init
   ======================= */
updateHud();
newWord();

window.addEventListener('resize', debounce(fitSlots, 120));
window.addEventListener('orientationchange', debounce(fitSlots, 120));
