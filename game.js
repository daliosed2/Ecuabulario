import {BANKS, norm, ensureInit, loadCoins, saveCoins, getSolved, addSolved, getProgress} from './data.js';

ensureInit();

const $ = id => document.getElementById(id);
const EL = {
  coins:$('coins'), level:$('level'), bar:$('bar'),
  clue:$('clue'), slots:$('slots'), msg:$('msg'),
  gamecard:$('gamecard'), typer:$('typer'),
  hintLetter:$('hint-letter'), hintFirst:$('hint-first'), hintSolve:$('hint-solve')
};

// Única categoría: food
const CAT = 'food';
const BANK = BANKS[CAT];

let coins = loadCoins(); EL.coins.textContent = coins;

const solved = getSolved(CAT);
let queue = BANK.filter(x=>!solved.has(x.id));
if(queue.length===0) queue = [...BANK];
shuffle(queue);

let current=null, answerClean='', boxes=[];

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; }
const firstEmpty = () => boxes.find(b=>!b.locked && !b.val);
function lastFilled(){ for(let i=boxes.length-1;i>=0;i--) if(boxes[i].val && !boxes[i].locked) return i; return -1; }

function updateHud(){
  const p = getProgress(CAT);
  EL.level.textContent = `Nivel ${p.level}`;
  EL.bar.style.width = (p.ratio*100)+'%';
  EL.coins.textContent = coins;
}

function highlightNext(){
  boxes.forEach(b=>b.el.classList.remove('focus'));
  const b = firstEmpty();
  if(b) b.el.classList.add('focus');
}

function newWord(){
  current = queue.shift();
  if(!current){
    queue = BANK.filter(x=>!getSolved(CAT).has(x.id));
    if(queue.length===0) queue = [...BANK];
    shuffle(queue); current = queue.shift();
  }
  EL.clue.textContent = current.clue;
  EL.msg.textContent = '';
  const text = current.a;
  answerClean = norm(text);
  EL.slots.innerHTML = '';
  boxes = [];

  for(const ch of text){
    if(ch===' ' || ch==='-'){
      const s = document.createElement('div'); s.className='slot space';
      EL.slots.appendChild(s); continue;
    }
    const s = document.createElement('div'); s.className='slot';
    EL.slots.appendChild(s);
    boxes.push({el:s, char: ch, locked:false, val:''});
  }
  focusTyper();
  highlightNext();
}

function focusTyper(){ setTimeout(()=>EL.typer.focus(), 50); }
document.body.addEventListener('pointerdown', focusTyper);
document.body.addEventListener('pointerup',   focusTyper);

// Validación auto al completar
function maybeAutoCheck(){
  if (boxes.every(b => b.val || b.locked)) check();
  else highlightNext();
}

function typeLetter(L){
  const b = firstEmpty(); if(!b) return;
  b.val = L; b.el.textContent = L; b.el.classList.add('filled');
  maybeAutoCheck();
}

function backspace(){
  const i = lastFilled(); if(i<0) return;
  boxes[i].val=''; boxes[i].el.textContent='';
  EL.msg.textContent='';
  highlightNext();
}

function userGuessClean(){ return norm(boxes.map(b=>b.val||'').join('')); }

// Borrado automático si la palabra está mal
function autoClear(){
  EL.gamecard.classList.add('shake');
  setTimeout(()=>{
    EL.gamecard.classList.remove('shake');
    boxes.forEach(b=>{ if(!b.locked){ b.val=''; b.el.textContent=''; } });
    EL.msg.textContent='';
    highlightNext();
    focusTyper();
  }, 220);
}

function win(){
  EL.msg.innerHTML = '<span class="ok">¡Correcto! +20 🪙</span>';
  EL.gamecard.classList.add('winflash');
  coins += 20; saveCoins(coins); EL.coins.textContent = coins;
  addSolved(CAT, current.id);
  setTimeout(()=>{
    EL.gamecard.classList.remove('winflash');
    updateHud(); newWord();
  }, 700);
}

function fail(){
  EL.msg.innerHTML = '<span class="bad">Ups, intenta de nuevo.</span>';
  autoClear();
}

function check(){
  if(userGuessClean() === answerClean){ win(); }
  else { fail(); }
}

/* --------- Pistas ---------- */
function pay(cost){
  if(coins<cost){ EL.msg.innerHTML = '<span class="bad">No te alcanzan las monedas.</span>'; return false; }
  coins -= cost; saveCoins(coins); EL.coins.textContent = coins; return true;
}
function hintLetter(){
  if(!pay(15)) return;
  const cs = boxes.filter(b=>!b.locked && !b.val);
  if(!cs.length){ maybeAutoCheck(); return; }
  const pick = cs[Math.floor(Math.random()*cs.length)];
  pick.val = pick.char.toUpperCase(); pick.el.textContent = pick.val;
  pick.locked = true; pick.el.classList.add('lock'); maybeAutoCheck();
}
function hintFirst(){
  if(!pay(10)) return;
  const first = boxes.find(b=>!b.locked);
  if(!first){ maybeAutoCheck(); return; }
  first.val = first.char.toUpperCase(); first.el.textContent = first.val;
  first.locked = true; first.el.classList.add('lock'); maybeAutoCheck();
}
function hintSolve(){
  if(!pay(50)) return;
  boxes.forEach(b=>{ if(!b.locked){ b.val=b.char.toUpperCase(); b.el.textContent=b.val; b.locked=true; b.el.classList.add('lock'); }});
  maybeAutoCheck();
}

/* --- Entrada desde teclado del dispositivo (SOLO input) --- */
// Evitar duplicados por ráfagas de algunos teclados
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

// Especiales
EL.typer.addEventListener('keydown', (e)=>{
  if(e.key === 'Backspace'){ e.preventDefault(); backspace(); }
  else if(e.key === 'Enter'){ e.preventDefault(); maybeAutoCheck(); }
});

/* --- Init --- */
updateHud();
newWord();

/* Botones de pistas */
EL.hintLetter.addEventListener('click', hintLetter);
EL.hintFirst.addEventListener('click', hintFirst);
EL.hintSolve.addEventListener('click', hintSolve);
