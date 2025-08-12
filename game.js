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
  typer: $('typer'),
  hintLetter: $('hint-letter'),
  hintFirst:  $('hint-first'),
  gameover: $('gameover'),
  goText:   $('go-text'),
  goRetry:  $('go-retry'),
};

// Mover la tarjeta cuando sube el teclado (clase definida en CSS)
EL.gamecard?.classList.add('kb-fix');

let points = loadPoints();
EL.pointsEl && (EL.pointsEl.textContent = points);

// ------- Banco global -------
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

  let tries = 0;
  while (tries < 4){
    const rect = EL.slots.getBoundingClientRect();
    const reserve = 160; // espacio para pistas+mensaje
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
     Teclado / enfoque
   ======================= */
// Declaración ÚNICA del centinela (arregla tu error)
const SENTINEL = '•';

function setTyperSentinel(){
  EL.typer.value = SENTINEL;
  try { EL.typer.setSelectionRange(EL.typer.value.length, EL.typer.value.length); } catch {}
}

// Altura base y corrección cuando sube el teclado
let BASE_H = window.innerHeight;
function kbHeight(){
  if (window.visualViewport){
    const vv = window.visualViewport;
    return Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  }
  return Math.max(0, BASE_H - window.innerHeight);
}
function applyKbFix(){
  const h = kbHeight();
  document.documentElement.style.setProperty('--kb-offset', h + 'px');
}
function resetKbFix(){
  document.documentElement.style.setProperty('--kb-offset', '0px');
  BASE_H = window.innerHeight;
}

function focusTyperSync(){
  try {
    EL.typer.focus({ preventScroll:true });
    setTyperSentinel();   // backspace fiable
    applyKbFix();         // sube la tarjeta mientras el teclado esté visible
  } catch {}
}
// Abrir teclado SOLO al tocar un recuadro o palabra
;['click','touchstart'].forEach(evt=>{
  EL.slots.addEventListener(evt, focusTyperSync, { passive:true });
});

// Recalcular tamaño y offset al cambiar tamaño/orientación
window.addEventListener('resize', debounce(()=>{ fitSlots(); applyKbFix(); }, 120));
window.addEventListener('orientationchange', debounce(()=>{ fitSlots(); applyKbFix(); }, 120));
// Con visualViewport reaccionamos también a apertura/cierre real del teclado
;['resize','scroll'].forEach(ev=>{
  window.visualViewport?.addEventListener(ev, applyKbFix);
});
// Cuando el input gana/pierde foco
document.addEventListener('focusin', applyKbFix);
document.addEventListener('focusout', ()=>{ resetKbFix(); requestAnimationFrame(fitSlots); });

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
EL.goRetry?.addEventListener('click', ()=>{
  points = 100; updateHud();
  EL.gameover && (EL.gameover.style.display = 'none');
  newWord();
});

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
;['pointerup','touchend','click'].forEach(e=>{
  EL.hintLetter?.addEventListener(e, hintLetter, {passive:true});
  EL.hintFirst ?.addEventListener(e, hintFirst , {passive:true});
});

/* =======================
  Entrada SOLO desde input
   ======================= */
// Anti-doble de algunos teclados
let lastStamp = 0;

// Letras: por 'input'. Consumimos todo lo distinto al centinela
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

// Backspace confiable en iOS/Android
EL.typer.addEventListener('beforeinput', (e)=>{
  if (e.inputType === 'deleteContentBackward'){
    e.preventDefault(); backspace(); setTyperSentinel();
  }
});

// Fallback: Enter/Backspace en el propio input
EL.typer.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){ e.preventDefault(); maybeAutoCheck(); }
  if(e.key === 'Backspace'){ e.preventDefault(); backspace(); setTyperSentinel(); }
});

// Fallback global si el input perdió foco (evita ir atrás con Backspace)
document.addEventListener('keydown', (e)=>{
  if (document.activeElement === EL.typer) return;
  if (e.key === 'Backspace' || e.key === 'Enter') e.preventDefault();
  if (e.key === 'Backspace') backspace();
  if (e.key === 'Enter') maybeAutoCheck();
},{passive:false});

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
