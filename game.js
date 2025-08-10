import {
  ALL_WORDS, norm, ensureInit,
  loadCoins, saveCoins,
  getSolvedAll, addSolvedAll, getProgressAll
} from './data.js';

ensureInit();

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

  // === NUEVO: agrupar por palabras ===
  // Separamos por espacios y guiones; cada token es una "palabra" visual.
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
}

// ------- Enfoque del input SOLO al tocar un recuadro -------
function focusTyperSync(){
  try {
    EL.typer.focus({ preventScroll:true });
    const len = EL.typer.value.length;
    EL.typer.setSelectionRange(len, len);
  } catch {}
}
EL.slots.addEventListener('click', focusTyperSync, { passive:true });
EL.slots.addEventListener('touchstart', focusTyperSync, { passive:true });

// ------- Validación -------
function maybeAutoCheck(){
  if (boxes.every(b => b.val || b.locked)) check();
  else highlightNext();
}

function typeLetter(L){
  const b = firstEmpty(); if (!b) return;
  b.val = L;
  b.el.textContent = L;
  b.el.classList.add('filled');
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
  setTimeout(()=>{
    EL.gamecard.classList.remove('shake');
    boxes.forEach(b => { if(!b.locked){ b.val=''; b.el.textContent=''; } });
    EL.msg.textContent = '';
    highlightNext();
  }, 220);
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

// ------- Pistas -------
function pay(cost){
  if (coins < cost){
    EL.msg.innerHTML = '<span class="bad">No te alcanzan las monedas.</span>';
    return false;
  }
  coins -= cost; saveCoins(coins); EL.coins.textContent = coins;
  return true;
}

function hintLetter(){
  if(!pay(15)) return;
  const cs = boxes.filter(b => !b.locked && !b.val);
  if(!cs.length){ maybeAutoCheck(); return; }
  const pick = cs[Math.floor(Math.random() * cs.length)];
  pick.val = pick.char.toUpperCase(); pick.el.textContent = pick.val;
  pick.locked = true; pick.el.classList.add('lock');
  maybeAutoCheck();
}

function hintFirst(){
  if(!pay(10)) return;
  const first = boxes.find(b => !b.locked);
  if(!first){ maybeAutoCheck(); return; }
  first.val = first.char.toUpperCase(); first.el.textContent = first.val;
  first.locked = true; first.el.classList.add('lock');
  maybeAutoCheck();
}

function hintSolve(){
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

// ------- Entrada SOLO desde el input (PC y móvil) -------
// Anti-doble de algunos teclados
let lastStamp = 0;

// 1) Letras: llegan por 'input'
EL.typer.addEventListener('input', (e)=>{
  const now = performance.now();
  if (now - lastStamp < 15) return;
  lastStamp = now;

  const v = e.target.value.toUpperCase();
  const ch = v.slice(-1);
  if(/^[A-ZÑ]$/.test(ch)) typeLetter(ch);
  e.target.value = '';
});

// 2) Borrar / Enter (en algunos teclados sí dispara keydown)
EL.typer.addEventListener('keydown', (e)=>{
  if(e.key === 'Backspace'){ e.preventDefault(); backspace(); }
  else if(e.key === 'Enter'){ e.preventDefault(); maybeAutoCheck(); }
});

// 3) iOS/Android: backspace confiable con 'beforeinput'
EL.typer.addEventListener('beforeinput', (e)=>{
  if (e.inputType === 'deleteContentBackward'){
    e.preventDefault();
    backspace();
  }
});

// ------- Fallback contenteditable (iOS muy terco) -------
if (EL.editableHack) {
  EL.editableHack.addEventListener('input', ()=>{
    const ch = EL.editableHack.textContent.slice(-1).toUpperCase();
    if(/^[A-ZÑ]$/.test(ch)) typeLetter(ch);
    EL.editableHack.textContent = '';
  });
  const focusHack = ()=> {
    try { EL.editableHack.focus({ preventScroll:true }); } catch {}
  };
  // Solo cuando tocan los recuadros (mismo comportamiento que el input)
  EL.slots.addEventListener('click', focusHack, { passive:true });
  EL.slots.addEventListener('touchstart', focusHack, { passive:true });
}

// ------- Init -------
updateHud();
newWord();
