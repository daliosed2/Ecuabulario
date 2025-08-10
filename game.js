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
  check: document.getElementById('check'),
  skip:  document.getElementById('skip'),
  hintLetter: document.getElementById('hint-letter'),
  hintFirst:  document.getElementById('hint-first'),
  hintSolve:  document.getElementById('hint-solve'),
};

let coins = loadCoins();
EL.coins.textContent = coins;

const solved = getSolved(CAT);
let queue = BANK.filter(x=>!solved.has(x.id));             // pendientes
if(queue.length===0) queue = [...BANK];                     // resetea si todo resuelto
shuffle(queue);

let current = null;
let answerClean = '';
let boxes = [];   // {el, char, locked}

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

  // construir casillas
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

  // teclado
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

function firstEmpty(){
  return boxes.find(b=>!b.locked && !b.val);
}
function lastFilled(){
  for(let i=boxes.length-1;i>=0;i--) if(boxes[i].val && !boxes[i].locked) return i;
  return -1;
}

function typeLetter(L){
  const b = firstEmpty();
  if(!b) return;
  b.val = L;
  b.el.textContent = L;
}

function backspace(){
  const i = lastFilled();
  if(i<0) return;
  boxes[i].val = '';
  boxes[i].el.textContent = '';
}

function userGuessClean(){
  const txt = boxes.map(b=> b.val || '').join('');
  return norm(txt);
}

function win(){
  EL.msg.innerHTML = '<span class="ok">¡Correcto! +20 🪙</span>';
  coins += 20; saveCoins(coins); EL.coins.textContent = coins;
  addSolved(current.id);
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
  if(queue.length===0){ queue = BANK.filter(x=>!getSolved().has(x.id)); shuffle(queue); }
  newWord();
  // limpiar teclado usado
  [...EL.kb.children].forEach(k=>k.classList.remove('used'));
}

// Hints
function pay(cost){
  if(coins<cost){ EL.msg.innerHTML = '<span class="bad">No te alcanzan las monedas.</span>'; return false; }
  coins -= cost; saveCoins(coins); EL.coins.textContent = coins; return true;
}
function hintLetter(){
  if(!pay(15)) return;
  const candidates = boxes
    .map((b,i)=>({b,i}))
    .filter(x=>!x.b.locked && !x.b.val);            // vacías
  if(!candidates.length) return;
  const pick = candidates[Math.floor(Math.random()*candidates.length)];
  pick.b.val = pick.b.char.toUpperCase();
  pick.b.el.textContent = pick.b.val;
  pick.b.locked = true; pick.b.el.classList.add('lock');
}
function hintFirst(){
  if(!pay(10)) return;
  const first = boxes.find(b=>!b.locked);
  if(!first) return;
  first.val = first.char.toUpperCase();
  first.el.textContent = first.val;
  first.locked = true; first.el.classList.add('lock');
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
  check();
}

// Eventos
EL.check.onclick = check;
EL.skip.onclick  = nextItem;
EL.hintLetter.onclick = hintLetter;
EL.hintFirst.onclick  = hintFirst;
EL.hintSolve.onclick  = hintSolve;

// Teclado físico
window.addEventListener('keydown', (e)=>{
  const k = e.key.toUpperCase();
  if(/^[A-ZÑ]$/.test(k)) typeLetter(k);
  else if(e.key==='Backspace') backspace();
  else if(e.key==='Enter') check();
});

updateHud();
newWord();
