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
  typer: $('typer'),       // solo desktop
  hintLetter: $('hint-letter'),
  hintFirst:  $('hint-first'),
  gameover: $('gameover'),
  goText:   $('go-text'),
  goRetry:  $('go-retry'),
};

EL.gamecard?.classList.add('kb-fix');

let points = loadPoints();
EL.pointsEl && (EL.pointsEl.textContent = points);

/* ===== Detección robusta de móvil/touch ===== */
const IS_TOUCH   = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window || 'ontouchstart' in document.documentElement;
const IS_PRECISE = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const IS_MOBILE  = IS_TOUCH && !IS_PRECISE; // teléfonos/tablets incluso con “sitio de escritorio”

/* ===== Banco y estado ===== */
const solved = getSolvedAll();
let queue = ALL_WORDS.filter(x => !solved.has(x.id));
if (queue.length === 0) queue = [...ALL_WORDS];
shuffle(queue);

let current = null, answerClean = '', boxes = []; // boxes: {el,char,locked,val}

function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; }
const firstEmpty = () => boxes.find(b => !b.locked && !b.val);
function lastFilled(){ for(let i=boxes.length-1;i>=0;i--) if(boxes[i].val && !boxes[i].locked) return i; return -1; }

function updateHud(){
  const p = getProgressAll();
  EL.level && (EL.level.textContent = `Nivel ${p.level}`);
  EL.bar && (EL.bar.style.width = (p.ratio * 100) + '%');
  EL.pointsEl && (EL.pointsEl.textContent = points);
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
  setSize(size);

  // Reserva mayor si hay teclado virtual
  let tries = 0;
  while (tries < 4){
    const rect = EL.slots.getBoundingClientRect();
    const reserve = IS_MOBILE ? 220 : 160;
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
  current = queue.shift();
  if (!current) {
    queue = ALL_WORDS.filter(x => !getSolvedAll().has(x.id));
    if (queue.length === 0) queue = [...ALL_WORDS];
    shuffle(queue);
    current = queue.shift();
  }

  EL.clue && (EL.clue.textContent = current.clue);
  EL.msg && (EL.msg.textContent = '');
  const text = current.a;
  answerClean = norm(text);
  EL.slots.innerHTML = '';
  boxes = [];

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
  newWord();
}, {passive:false});

function win(){
  points += 50; updateHud();
  EL.msg && (EL.msg.innerHTML = '<span class="ok">¡Correcto! +50 ⭐️</span>');
  EL.gamecard.classList.add('winflash');
  addSolvedAll(current.id);
  setTimeout(()=>{ EL.gamecard.classList.remove('winflash'); newWord(); }, 700);
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
  if(!pay(35)) return;
  const cs = boxes.filter(b => !b.locked && !b.val);
  if(!cs.length){ maybeAutoCheck(); return; }
  const pick = cs[Math.floor(Math.random()*cs.length)];
  pick.val = pick.char.toUpperCase(); pick.el.textContent = pick.val;
  pick.locked = true; pick.el.classList.add('lock'); maybeAutoCheck();
}
function hintFirst(){
  if(!boxes.length) return;
  if(!pay(50)) return;
  const first = boxes.find(b => !b.locked);
  if(!first){ maybeAutoCheck(); return; }
  first.val = first.char.toUpperCase(); first.el.textContent = first.val;
  first.locked = true; first.el.classList.add('lock'); maybeAutoCheck();
}
['pointerup'].forEach(e=>{
  EL.hintLetter?.addEventListener(e, (ev)=>{ ev.preventDefault(); hintLetter(); }, {passive:false});
  EL.hintFirst ?.addEventListener(e, (ev)=>{ ev.preventDefault(); hintFirst (); }, {passive:false});
});

/* =========================================================
   ENTRADA DE TEXTO
   - Desktop: input oculto + teclado físico
   - Móvil:  teclado virtual (sin abrir el nativo)
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
  ['pointerup'].forEach(evt=>{
    EL.slots.addEventListener(evt, (e)=>{ e.preventDefault(); focusTyperSync(); }, { passive:false });
  });

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

// ---- Móvil: Teclado virtual propio ----
// ---- Móvil: Teclado virtual adaptativo (iOS/Android) ----
if (IS_MOBILE) ensureVirtualKeyboard();

function ensureVirtualKeyboard(){
  // 1) Evitar teclado nativo en móvil
  if (EL.typer){
    EL.typer.blur();
    EL.typer.setAttribute('readonly','true');
    EL.typer.setAttribute('inputmode','none');
  }

  // 2) Crear contenedor y estilos (con variables para altura)
  let vk = document.getElementById('vk');
  if (!vk){
    vk = document.createElement('div');
    vk.id = 'vk';
    vk.className = 'vk';
    const style = document.createElement('style');
    style.id = 'vk-style';
  style.textContent = `
  :root{ --vk-h: clamp(180px, 38svh, 300px); --vk-gap: clamp(4px, 1.8vw, 8px); }
  .vk{
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 999;
    height: var(--vk-h);
    background: #0f172a;
    padding: 8px clamp(8px, 3vw, 12px) calc(10px + env(safe-area-inset-bottom));
    box-shadow: 0 -12px 30px rgba(0,0,0,.25);
    display: flex; flex-direction: column; justify-content: flex-end;
    max-width: 100vw; overflow: hidden;
  }
  .vk-row{
    display: grid;
    gap: var(--vk-gap);
    margin: clamp(2px, 0.8vh, 6px) 0;
    padding: 0 clamp(4px, 2vw, 10px);
  }
  /* 10 columnas para R1 y R2, 9 para R3 (más compacta) */
  .vk-row.r1, .vk-row.r2{ grid-template-columns: repeat(10, minmax(0, 1fr)); }
  .vk-row.r3{ grid-template-columns: repeat(9,  minmax(0, 1fr)); }

  .vk-key{
    border-radius: 12px;
    background:#1f2937; color:#fff; font-weight:800;
    display:grid; place-items:center;
    user-select:none; -webkit-user-select:none;
    min-width: 0;                 /* permite encoger en pantallas estrechas */
    height: clamp(40px, 9svh, 52px);
    font-size: clamp(14px, 2.6svh, 18px);
    padding: 0 clamp(2px, 1vw, 4px);
    box-shadow: 0 2px 6px rgba(0,0,0,.2);
  }
  .vk-key:active{ transform: scale(.98); }
`;
    document.head.appendChild(style);
    document.body.appendChild(vk);
  }

  // 3) Construir filas (OK y ⌫ ocupan 2 columnas)
const rows = [
  ['Q','W','E','R','T','Y','U','I','O','P'],      // 10
  ['A','S','D','F','G','H','J','K','L','Ñ'],      // 10
  ['Z','X','C','V','B','N','M','⌫','OK']         // 9 (más compacta)
];
  vk.innerHTML = '';
  rows.forEach((r, idx)=>{
    const row = document.createElement('div');
    row.className = `vk-row r${idx+1}`;
    r.forEach(k=>{
      const label = typeof k === 'string' ? k : k.t;
      const span  = typeof k === 'string' ? 1 : (k.span||1);
      const btn = document.createElement('div');
      btn.className = 'vk-key'; if (span>1) btn.dataset.span = String(span);
      btn.textContent = label;
      // SOLO pointerup para evitar doble letra en Android/iOS
      btn.addEventListener('pointerup', (e)=>{ e.preventDefault(); handleVK(label); }, {passive:false});
      row.appendChild(btn);
    });
    vk.appendChild(row);
  });

  // 4) Calcular ALTURA real con visualViewport y reservar espacio
  const setVKHeight = ()=>{
    const vv = window.visualViewport;
    const base = vv ? vv.height : window.innerHeight;
    const h = Math.min(Math.max(base * 0.38, 180), 320); // entre 180 y 320 px
    document.documentElement.style.setProperty('--vk-h', h + 'px');

    const wrap = document.querySelector('.wrap');
    if (wrap) wrap.style.paddingBottom = `calc(${h}px + env(safe-area-inset-bottom))`;
  };
  setVKHeight();

  // Recalcular en cambios de tamaño/orientación
  const onVV = () => setVKHeight();
  window.addEventListener('resize', onVV, {passive:true});
  window.addEventListener('orientationchange', onVV, {passive:true});
  window.visualViewport?.addEventListener('resize', onVV, {passive:true});
  window.visualViewport?.addEventListener('scroll', onVV, {passive:true});
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
