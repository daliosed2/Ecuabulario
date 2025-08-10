import {
  ALL_WORDS, norm, ensureInit,
  loadCoins, saveCoins,
  getSolvedAll, addSolvedAll, getProgressAll
} from './data.js';

try { ensureInit(); } catch {}

const $ = id => document.getElementById(id);
const EL = {
  coins: $('coins'),
  level: $('level'),
  bar: $('bar'),
  clue: $('clue'),
  slots: $('slots'),
  msg: $('msg'),
  gamecard: $('gamecard'),
  typer: $('typer'),
  hintLetter: $('hint-letter'),
  hintFirst: $('hint-first'),
  hintSolve: $('hint-solve'),
  editableHack: $('editableHack'),
};

let coins = loadCoins();
EL.coins.textContent = coins;

// ------- Banco global (sin categorías) -------
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
  EL.level.textContent = `Nivel ${p.level}`;
  EL.bar.style.width = (p.ratio * 100) + '%';
  EL.coins.textContent = coins;
}

function highlightNext(){
  boxes.forEach(b => b.el.classList.remove('focus'));
  const b = firstEmpty();
  if (b) b.el.classList.add('focus');
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
  size: cssNum('--slot-size', 62),
  gapL: cssNum('--gap-letter', 12),
  gapRow: cssNum('--gap-word-row', 14),
  gapCol: cssNum('--gap-word-col', 18),
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

  // 1) Reset a base para medir
  setSize(BASE.size);
  setGaps(BASE.gapL, BASE.gapRow, BASE.gapCol);

  // 2) Calcular tamaño por palabra más larga para entrar en ancho
  const containerW = EL.slots.clientWidth || EL.slots.getBoundingClientRect().width || (window.innerWidth - 40);
  const words = current.a.split(/[\s-]+/).filter(Boolean);
  const longest = words.reduce((m,w)=>Math.max(m,w.length), 1);
  const gapL = cssNum('--gap-letter', BASE.gapL);

  let size = Math.floor( (containerW - gapL*(longest-1)) / longest );
  size = Math.min(size, 80);   // techo
  size = Math.max(size, 26);   // piso
  setSize(size);

  // 3) Verificar alto disponible y reescalar si hiciera falta
  // Reservamos espacio para pistas y mensaje (~160px)
  let tries = 0;
  while (tries < 4){
    const rect = EL.slots.getBoundingClientRect();
    const reserve = 160;
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

  EL.clue.textContent = current.clue;
  EL.msg.textContent = '';
  const text = current.a;
  answerClean = norm(text);
  EL.slots.innerHTML = '';
  boxes = [];

  // Agrupar por PALABRAS (sin “slot space”)
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
  // Ajustar tamaño sin scroll en el siguiente frame
  requestAnimationFrame(fitSlots);
}

/* =======================
     Teclado / enfoque
   ======================= */
// Abrir teclado SOLO al tocar un recuadro (o palabra)
function focusTyperSync(){
  try {
    EL.typer.focus({ preventScroll:true });
    const len = EL.typer.value.length;
    EL.typer.setSelectionRange(len, len);
  } catch {}
}
const focusHack = ()=>{ try{ EL.editableHack?.focus({preventScroll:true}); }catch{} };

// Delegación: tocar el contenedor de slots
['click','touchstart'].forEach(evt=>{
  EL.slots.addEventListener(evt, ()=>{ focusTyperSync(); focusHack(); }, { passive:true });
});

// Recalcular al rotar o redimensionar (con debounce)
window.addEventListener('resize', debounce(fitSlots, 120));
window.addEventListener('orientationchange', debounce(fitSlots, 120));

/* =======================
        Validación
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
  EL.msg.textContent = '';
  highlightNext();
}

function userGuessClean(){
  return norm(boxes.map(b => b.val || '').join(''));
}

function autoClear(){
  EL.gamecard.classList.add('shake');
  requestAnimationFrame(()=>setTimeout(()=>{
    EL.gamecard.classList.remove('shake');
    boxes.forEach(b => { if(!b.locked){ b.val=''; b.el.textContent=''; } });
    EL.msg.textContent = '';
    highlightNext();
  }, 220));
}

function win(){
  EL.msg.innerHTML = '<span class="ok">¡Correcto! +20 🪙</span>';
  EL.gamecard.classList.add('winflash');
  coins += 20; saveCoins(coins); EL.coins.textContent = coins;
  addSolvedAll(current.id);
  setTimeout(()=>{
    EL.gamecard.classList.remove('winflash');
    updateHud();
    newWord();
  }, 700);
}

function fail(){
  EL.msg.innerHTML = '<span class="bad">Ups, intenta de nuevo.</span>';
  autoClear();
}

function check(){
  if (userGuessClean() === answerClean) win();
  else fail();
}

/* =======================
           Pistas
   ======================= */
function pay(cost){
  if (coins < cost){
    EL.msg.innerHTML = '<span class="bad">No te alcanzan las monedas.</span>';
    return false;
  }
  coins -= cost; saveCoins(coins); EL.coins.textContent = coins;
  return true;
}

function hintLetter(){
  if(!boxes.length) return;
  if(!pay(15)) return;
  const cs = boxes.filter(b => !b.locked && !b.val);
  if(!cs.length){ maybeAutoCheck(); return; }
  const pick = cs[Math.floor(Math.random() * cs.length)];
  pick.val = pick.char.toUpperCase(); pick.el.textContent = pick.val;
  pick.locked = true; pick.el.classList.add('lock');
  maybeAutoCheck();
}
function hintFirst(){
  if(!boxes.length) return;
  if(!pay(10)) return;
  const first = boxes.find(b => !b.locked);
  if(!first){ maybeAutoCheck(); return; }
  first.val = first.char.toUpperCase(); first.el.textContent = first.val;
  first.locked = true; first.el.classList.add('lock');
  maybeAutoCheck();
}
function hintSolve(){
  if(!boxes.length) return;
  if(!pay(50)) return;
  boxes.forEach(b=>{
    if(!b.locked){
      b.val = b.char.toUpperCase();
      b.el.textContent = b.val;
      b.locked = true; b.el.classList.add('lock');
    }
  });
  maybeAutoCheck();
}

// Helpers de eventos múltiples (para móvil y desktop)
function onMany(el, evts, fn, opts={passive:true}){ evts.forEach(e=>el?.addEventListener(e, fn, opts)); }
onMany(EL.hintLetter, ['pointerup','touchend','click'], hintLetter);
onMany(EL.hintFirst,  ['pointerup','touchend','click'], hintFirst);
onMany(EL.hintSolve,  ['pointerup','touchend','click'], hintSolve);

/* =======================
  Entrada SOLO desde input
   ======================= */
// Anti-doble de algunos teclados
let lastStamp = 0;

// Letras
EL.typer.addEventListener('input', (e)=>{
  const now = performance.now();
  if (now - lastStamp < 15) return;
  lastStamp = now;

  const v = e.target.value.toUpperCase();
  const ch = v.slice(-1);
  if(/^[A-ZÑ]$/.test(ch)) typeLetter(ch);
  e.target.value = '';
});

// Borrar / Enter (algunos teclados)
EL.typer.addEventListener('keydown', (e)=>{
  if(e.key === 'Backspace'){ e.preventDefault(); backspace(); }
  else if(e.key === 'Enter'){ e.preventDefault(); maybeAutoCheck(); }
});

// Backspace confiable en iOS/Android
EL.typer.addEventListener('beforeinput', (e)=>{
  if (e.inputType === 'deleteContentBackward'){
    e.preventDefault();
    backspace();
  }
});

// Fallback contenteditable (iOS MUY terco) — no intercepta taps (pointer-events:none en CSS)
if (EL.editableHack) {
  EL.editableHack.addEventListener('input', ()=>{
    const ch = EL.editableHack.textContent.slice(-1).toUpperCase();
    if(/^[A-ZÑ]$/.test(ch)) typeLetter(ch);
    EL.editableHack.textContent = '';
  });
}

/* =======================
           Init
   ======================= */
updateHud();
newWord();
