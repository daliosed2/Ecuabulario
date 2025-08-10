import {BANKS, norm, ensureInit, loadCoins, saveCoins, getSolved, addSolved, getProgress} from './data.js';

ensureInit();

const params = new URLSearchParams(location.search);
const CAT = params.get('cat') || 'food';
const BANK = BANKS[CAT];

const EL = {
  coins: document.getElementById('coins'),
  level: document.getElementById('level'),
  bar:   document.getElementById('bar'),
  clue:  document.getElementById('clue'),
  slots: document.getElementById('slots'),
  msg:   document.getElementById('msg'),
  kb:    document.getElementById('kb'),
  hintLetter: document.getElementById('hint-letter'),
  hintFirst:  document.getElementById('hint-first'),
  hintSolve:  document.getElementById('hint-solve'),
};

let coins = loadCoins();
EL.coins.textContent = coins;

const solved = getSolved(CAT);
let queue = BANK.filter(x=>!solved.has(x.id));
if(queue.length===0) queue = [...BANK];
shuffle(queue);

let current = null;
let answerClean = '';
let boxes = [];   // {el, char, locked, val}

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; }

function updateHud(){
  const prog = getProgress(CAT);
  EL.level.textContent = `Nivel ${prog.level}`;
  EL.bar.style.width = (prog.ratio*100)+'%';
  EL.coins.textContent = coins;
}

function newWord(){
  current = queue.shift();
  EL.clue.textContent = current.clue;
  EL.msg.textContent = '';
  const text = current.a;
  answerClean = norm(text);
  EL.slots.innerHTML = '';
  boxes = [];

  for(const ch of text){
    if(ch===' ' || ch==='-'){
      const s = document.createElement('div');
      s.className='slot space';
      EL.slots.appendChild(s);
      continue;
    }
    const s = document.createElement('div');
    s.className='slot';
    s.textContent = '';
    EL.slots.appendChild(s);
    boxes.push({el:s, char: ch, locked:false, val:''});
  }

  buildKeyboard();
}

function buildKeyboard(){
  const letters = 'QWERTYUIOPASDFGHJKLÑZXCVBNM'.split('');
  EL.kb.innerHTML = '';
  letters.forEach(L=>{
    const k = document.createElement('div');
    k.className='key'; k.textContent=L;
    k.onclick = ()=>typeLetter(L);
    EL.kb.appendChild(k);
  });
  const back = document.createElement('div');
  back.className='key'; back.textContent='⌫';
  back.onclick = backspace;
  EL.kb.appendChild(back);
}

function firstEmpty(){ return boxes.find(b=>!b.locked && !b.val); }
function lastFilled(){
  for(let i=boxes.length-1;i>=0;i--) if(boxes[i].val && !boxes[i].locked) return i;
  return -1;
}

function maybeAutoCheck(){
  if (boxes.every(b => b.val || b.locked)) check();
}

function typeLetter(L){
  const b = firstEmpty();
  if(!b) return;
  b.val = L;
  b.el.textContent = L;
  maybeAutoCheck();
}

function backspace(){
  const i = lastFilled();
  if(i<0) return;
  boxes[i].val = '';
  boxes[i].el.textContent = '';
  EL.msg.textContent = ''; // limpiar mensaje si corrige
}

function userGuessClean(){
  const txt = boxes.map(b=> b.val || '').join('');
  return norm(txt);
}

function win(){
  EL.msg.innerHTML = '<span class="ok">¡Correcto! +20 🪙</span>';
  coins += 20; saveCoins(coins); EL.coins.textContent = coins;
  addSolved(CAT, current.id);
  setTimeout(()=>{ nextItem(); }, 700);
}

function fail(){
  EL.msg.innerHTML = '<span class="bad">Aún no. Intenta de nuevo.</span>';
}

function check(){
  if(userGuessClean() === answerClean){ win(); }
  else { fail(); }
}

function nextItem(){
  updateHud();
  if(queue.length===0){
    queue = BANK.filter(x=>!getSolved(CAT).has(x.id));
    if(queue.length===0) queue = [...BANK];
    shuffle(queue);
  }
  newWord();
  [...EL.kb.children].forEach(k=>k.classList.remove('used'));
}

// --- Pistas ---
function pay(cost){
  if(coins<cost){ EL.msg.innerHTML = '<span class="bad">No te alcanzan las monedas.</span>'; return false; }
  coins -= cost; saveCoins(coins); EL.coins.textContent = coins; return true;
}

function hintLetter(){
  if(!pay(15)) return;
  const candidates = boxes.filter(b=>!b.locked && !b.val);
  if(!candidates.length) { maybeAutoCheck(); return; }
  const pick = candidates[Math.floor(Math.random()*candidates.length)];
  pick.val = pick.char.toUpperCase();
  pick.el.textContent = pick.val;
  pick.locked = true; pick.el.classList.add('lock');
  maybeAutoCheck();
}

function hintFirst(){
  if(!pay(10)) return;
  const first = boxes.find(b=>!b.locked);
  if(!first) { maybeAutoCheck(); return; }
  first.val = first.char.toUpperCase();
  first.el.textContent = first.val;
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

// Teclado físico
window.addEventListener('keydown', (e)=>{
  const k = e.key.toUpperCase();
  if(/^[A-ZÑ]$/.test(k)) typeLetter(k);
  else if(e.key==='Backspace') backspace();
  else if(e.key==='Enter') maybeAutoCheck(); // opcional
});

updateHud();
newWord();
