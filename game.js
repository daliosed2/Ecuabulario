import {BANKS, norm, ensureInit, loadCoins, saveCoins, getSolved, addSolved, getProgress} from './data.js';

ensureInit();

/* --------- Helpers de UI --------- */
const $ = (id)=>document.getElementById(id);
const EL = {
  coins: $('coins'), level: $('level'), bar: $('bar'),
  clue: $('clue'), slots: $('slots'), msg: $('msg'),
  kb: $('kb'), badge: $('badge'), gamecard: $('gamecard'),
  sound: $('sound'), coinFx: $('coin-fx')
};

// Sonidos (opcional, súper cortos)
let soundOn = localStorage.getItem('ecuabulario_sound') !== 'off';
const play = (freq=880, ms=90) => {
  if(!soundOn) return;
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type='sine'; o.frequency.value=freq; g.gain.value=0.05;
    o.start(); setTimeout(()=>{o.stop();ctx.close()}, ms);
  }catch{}
};
EL.sound.textContent = soundOn ? '🔊' : '🔈';
EL.sound.onclick = ()=>{
  soundOn = !soundOn;
  localStorage.setItem('ecuabulario_sound', soundOn?'on':'off');
  EL.sound.textContent = soundOn ? '🔊' : '🔈';
};

/* --------- Racha diaria --------- */
function bumpStreakOnFirstWinToday(){
  const k = 'ecuabulario_streak';
  const kdate = 'ecuabulario_streak_date';
  const last = localStorage.getItem(kdate);
  const today = new Date().toISOString().slice(0,10);
  if(last === today) return; // ya se contó hoy
  const prev = parseInt(localStorage.getItem(k)||'0',10);
  localStorage.setItem(k, String(prev+1));
  localStorage.setItem(kdate, today);
}

/* --------- Estado --------- */
const params = new URLSearchParams(location.search);
const CAT = params.get('cat') || 'food';
const BANK = BANKS[CAT];
if(!BANK){ alert(`Categoría "${CAT}" no existe`); throw new Error('BANK undefined'); }

let coins = loadCoins(); EL.coins.textContent = coins;

const solved = getSolved(CAT);
let queue = BANK.filter(x=>!solved.has(x.id));
if(queue.length===0) queue = [...BANK];
shuffle(queue);

let current=null, answerClean='', boxes=[]; // boxes: {el,char,locked,val}

function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; }
const firstEmpty = () => boxes.find(b=>!b.locked && !b.val);
function lastFilled(){ for(let i=boxes.length-1;i>=0;i--) if(boxes[i].val && !boxes[i].locked) return i; return -1; }

function updateHud(){
  const p = getProgress(CAT);
  EL.level.textContent = `Nivel ${p.level}`;
  EL.bar.style.width = (p.ratio*100)+'%';
  EL.coins.textContent = coins;
}

/* --------- Render palabra --------- */
function newWord(){
  current = queue.shift();
  if(!current){ // repoblar si vacía
    queue = BANK.filter(x=>!getSolved(CAT).has(x.id));
    if(queue.length===0) queue = [...BANK];
    shuffle(queue);
    current = queue.shift();
  }
  EL.badge.textContent = '🧩';
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
  buildKeyboard();
}

function buildKeyboard(){
  const letters = 'QWERTYUIOPASDFGHJKLÑZXCVBNM'.split('');
  EL.kb.innerHTML = '';
  letters.forEach(L=>{
    const k = document.createElement('div');
    k.className = 'key'; k.textContent = L;
    k.onclick = ()=>typeLetter(L);
    EL.kb.appendChild(k);
  });
  const back = document.createElement('div');
  back.className='key'; back.textContent='⌫'; back.onclick = backspace;
  EL.kb.appendChild(back);
}

/* --------- Entrada --------- */
function maybeAutoCheck(){
  // cuando todo lleno, validar
  if (boxes.every(b => b.val || b.locked)) check();
}

function typeLetter(L){
  const b = firstEmpty(); if(!b) return;
  b.val = L; b.el.textContent = L; b.el.classList.add('filled');
  play(880,60);
  maybeAutoCheck();
}

function backspace(){
  const i = lastFilled(); if(i<0) return;
  boxes[i].val=''; boxes[i].el.textContent=''; EL.msg.textContent='';
  play(220,60);
}

// teclado físico
window.addEventListener('keydown', (e)=>{
  const k = e.key.toUpperCase();
  if(/^[A-ZÑ]$/.test(k)) typeLetter(k);
  else if(e.key==='Backspace') backspace();
  else if(e.key==='Enter') maybeAutoCheck();
});

/* --------- Validación y feedback --------- */
function userGuessClean(){ return norm(boxes.map(b=>b.val||'').join('')); }

function coinFX(){
  // moneda voladora hacia HUD
  const span = document.createElement('span');
  span.className='coin-fly'; span.textContent='🪙';
  EL.coinFx.appendChild(span);
  setTimeout(()=>span.remove(),650);
}

function win(){
  EL.msg.innerHTML = '<span class="ok">¡Correcto! +20 🪙</span>';
  EL.gamecard.classList.remove('shake'); EL.gamecard.classList.add('winflash');
  coinFX(); play(1200,120);
  coins += 20; saveCoins(coins); EL.coins.textContent = coins;
  addSolved(CAT, current.id);
  bumpStreakOnFirstWinToday();
  setTimeout(()=>{ EL.gamecard.classList.remove('winflash'); nextItem(); }, 700);
}

function fail(){
  EL.msg.innerHTML = '<span class="bad">Aún no. Intenta de nuevo.</span>';
  EL.gamecard.classList.add('shake'); play(140,120);
  setTimeout(()=>EL.gamecard.classList.remove('shake'), 220);
}

function check(){
  if(userGuessClean() === answerClean){ win(); }
  else { fail(); }
}

function nextItem(){ updateHud(); newWord(); }

/* --------- Pistas --------- */
function pay(cost){
  if(coins<cost){ EL.msg.innerHTML = '<span class="bad">No te alcanzan las monedas.</span>'; return false; }
  coins -= cost; saveCoins(coins); EL.coins.textContent = coins; return true;
}

function hintLetter(){
  if(!pay(15)) return;
  const candidates = boxes.filter(b=>!b.locked && !b.val);
  if(!candidates.length){ maybeAutoCheck(); return; }
  const pick = candidates[Math.floor(Math.random()*candidates.length)];
  pick.val = pick.char.toUpperCase(); pick.el.textContent = pick.val;
  pick.locked = true; pick.el.classList.add('lock'); play(700,70);
  maybeAutoCheck();
}
function hintFirst(){
  if(!pay(10)) return;
  const first = boxes.find(b=>!b.locked);
  if(!first){ maybeAutoCheck(); return; }
  first.val = first.char.toUpperCase(); first.el.textContent = first.val;
  first.locked = true; first.el.classList.add('lock'); play(700,70);
  maybeAutoCheck();
}
function hintSolve(){
  if(!pay(50)) return;
  boxes.forEach(b=>{ if(!b.locked){ b.val=b.char.toUpperCase(); b.el.textContent=b.val; b.locked=true; b.el.classList.add('lock'); }});
  play(900,120);
  maybeAutoCheck();
}

/* --------- Init --------- */
updateHud();
newWord();

$('hint-letter').onclick = hintLetter;
$('hint-first').onclick  = hintFirst;
$('hint-solve').onclick  = hintSolve;
