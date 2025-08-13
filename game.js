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

let points = loadPoints();
if (EL.pointsEl) EL.pointsEl.textContent = points;

/* ===== banco y estado ===== */
const solvedSet = getSolvedAll();
let queue = ALL_WORDS.filter(x => !solvedSet.has(x.id));
if (queue.length === 0) queue = [...ALL_WORDS];
shuffle(queue);

let current = null, answerClean = '', boxes = []; // boxes: {el,char,locked,val}

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
   Auto-ajuste sin scroll
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
  gapCol:cssNum('--gap-word-col', 18),
};
const cssVarPx = (name)=> {
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const setSize = (px)=> root.style.setProperty('--slot-size', px+'px');
const setGaps = (l,r,c)=>{
  root.style.setProperty('--gap-letter', l+'px');
  root.style.setProperty('--gap-word-row', r+'px');
  root.style.setProperty('--gap-word-col', c+'px');
};
const debounce = (fn, wait=120)=>{
  let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); };
};

function fitSlots(){
  if(!current) return;

  setSize(BASE.size);
  setGaps(BASE.gapL, BASE.gapRow, BASE.gapCol);

  const containerW = EL.slots.clientWidth || EL.slots.getBoundingClientRect().width || (window.innerWidth - 40);
  const words = current.a.split(/[\s-]+/).filter(Boolean);
  const longest = words.reduce((m,w)=>Math.max(m,w.length), 1);
  const gapL = cssNum('--gap-letter', BASE.gapL);

  let size = Math.floor( (containerW - gapL*(longest-1)) / longest );
  size = Math.min(size, 80);
  size = Math.max(size, 26);

  // Palabras MUY largas (p.ej., "Encebollado"): permite 2 filas y evita que el slot sea diminuto
  if (longest >= 11 && size < 26) {
    size = 26;
  }
  setSize(size);

  // Ajuste por altura disponible (reserva extra si hay teclado virtual)
  let tries = 0;
  while (tries < 4){
    const rect = EL.slots.getBoundingClientRect();
    const reserve = IS_MOBILE ? Math.max(180, cssVarPx('--vk-h') + 40) : 160;
    const availH = Math.max(120, window.innerHeight - rect.top - reserve);
    const needH  = EL.slots.scrollHeight;
    if (needH <= availH) break;

    const ratio = Math.max(0.6, Math.min(0.98, availH / needH));
    size = Math.max(22, Math.floor(size * ratio));
    setSize(size);

    const gL2  = Math.max(6,  Math.floor(BASE.gapL   * ratio));
    const gR2  = Math.max(6,  Math.floor(BASE.gapRow * ratio));
    const gC2  = Math.max(8,  Math.floor(BASE.gapCol * ratio));
    setGaps(gL2, gR2, gC2);

    tries++;
  }
}

/* =======================
        Render palabra
   ======================= */
function newWord(){
  // 1) Si hay palabra pendiente y no está resuelta, úsala
  const savedId = localStorage.getItem(LS_CURRENT);
  if (savedId) {
    const alreadySolved = getSolvedAll().has(savedId);
    const found = ALL_WORDS.find(w => w.id === savedId);
    if (!alreadySolved && found) current = found;
  }

  // 2) Si no había pendiente, toma de la cola
  if (!current) {
    current = queue.shift();
    if (!current) {
      queue = ALL_WORDS.filter(x => !getSolvedAll().has(x.id));
      if (queue.length === 0) queue = [...ALL_WORDS];
      shuffle(queue);
      current = queue.shift();
    }
  }

  // Guardar como pendiente hasta acertar
  localStorage.setItem(LS_CURRENT, current.id);

  // Render
  if (EL.clue) EL.clue.textContent = current.clue;
  if (EL.msg) EL.msg.textContent = '';
  const text = current.a;
  answerClean = norm(text);
  EL.slots.innerHTML = '';
  boxes = [];

  // Agrupar por PALABRAS; CSS de .word ahora permite wrap en 2 filas
  const tokens = text.split(/[\s-]+/).filter(t => t.length);
  tokens.forEach(token => {
    const w = document.createElement('div');
    w.className = 'word';
    for (const ch of token){
      const s = document.createElement('div');
      s.className = 'slot';
      w.appendChild(s);
      boxes.push({ el:s, char: ch, locked:false, val:'' });
    }
    EL.slots.appendChild(w);
  });

  highlightNext();
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
  const b = firstEmpty(); if (!b) return;
  b.val = L; b.el.textContent = L; b.el.classList.add('filled');
  maybeAutoCheck();
}
function backspace(){
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
  points = 100; updateHud();
  EL.gameover && (EL.gameover.style.display = 'none');
  // limpiar casillas, mantener palabra
  boxes.forEach(b => { if(!b.locked){ b.val=''; b.el.textContent=''; } });
  EL.msg && (EL.msg.textContent = '');
  highlightNext();
}, {passive:false});

function win(){
  points += 50; updateHud();
  EL.msg && (EL.msg.innerHTML = '<span class="ok">¡Correcto! +50 ⭐️</span>');
  EL.gamecard.classList.add('winflash');
  addSolvedAll(current.id);
  localStorage.removeItem(LS_CURRENT); // ya no está pendiente
  setTimeout(()=>{
    EL.gamecard.classList.remove('winflash');
    current = null;      // fuerza elegir nueva
    newWord();
  }, 700);
}
function fail(){
  points -= 20; updateHud();
  EL.msg && (EL.msg.innerHTML = '<span class="bad">Incorrecto (-20 ⭐️)</span>');
  if (navigator.vibrate) navigator.vibrate(20);
  if (points <= 0){ showGameOver(); return; }
  autoClear();
}
function check(){ (userGuessClean() === answerClean) ? win() : fail(); }

/* =======================
           Ayudas
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
  if(!pay(35)) return; // ⭐️35
  const cs = boxes.filter(b => !b.locked && !b.val);
  if(!cs.length){ maybeAutoCheck(); return; }
  const pick = cs[Math.floor(Math.random()*cs.length)];
  pick.val = pick.char.toUpperCase(); pick.el.textContent = pick.val;
  pick.locked = true; pick.el.classList.add('lock'); maybeAutoCheck();
}
function hintFirst(){
  if(!boxes.length) return;
  if(!pay(50)) return; // ⭐️50
  const first = boxes.find(b => !b.locked);
  if(!first){ maybeAutoCheck(); return; }
  first.val = first.char.toUpperCase(); first.el.textContent = first.val;
  first.locked = true; first.el.classList.add('lock'); maybeAutoCheck();
}
['pointerup'].forEach(e=>{
  EL.hintLetter?.addEventListener(e, (ev)=>{ ev.preventDefault(); hintLetter(); }, {passive:false});
  EL.hintFirst?.addEventListener(e, (ev)=>{ ev.preventDefault(); hintFirst (); }, {passive:false});
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
    font-size: clamp(16px, 2.8svh, 20px);  /* 👈 mínimo 16px para que iOS no haga zoom */
    padding: 0 clamp(2px, 1vw, 4px);
    box-shadow: 0 2px 6px rgba(0,0,0,.2);
    touch-action: manipulation;             /* 👈 gestos de toque, sin zoom */
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
// --- Anti-zoom por doble tap y gestos en iOS ---
let lastTap = 0;
const stopZoom = (e)=>{ e.preventDefault(); };
vk.addEventListener('gesturestart', stopZoom, {passive:false});  // pinza
vk.addEventListener('dblclick',    stopZoom, {passive:false});   // doble click
vk.addEventListener('touchend', (e)=>{
  const now = Date.now();
  if (now - lastTap < 350) { e.preventDefault(); } // bloquea doble-tap zoom
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
