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

/* ===== costos de pistas ===== */
const COST_HINT_LETTER = 4;
const COST_HINT_FIRST  = 7;

/* ===== modo de juego ===== */
const MODE = new URLSearchParams(location.search).get('mode') === 'time' ? 'time' : 'classic';
let timeLeft = 120;   // segundos
let timerId = null;
let hits = 0;
let timeStarted = false;
let timeEnded = false;

/* ===== estado general ===== */
let points = loadPoints();
if (EL.pointsEl) EL.pointsEl.textContent = points;

const solvedSet = getSolvedAll();
let queue = ALL_WORDS.filter(x => !solvedSet.has(x.id));
if (queue.length === 0) queue = [...ALL_WORDS];
shuffle(queue);

let current = null, answerClean = '', boxes = []; // boxes: {el,char,locked,val}
let TOKEN_LENS = []; // longitudes de cada palabra (solo letras)

/* ===== helpers ===== */
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
  boxes.forEach(b => b.el?.classList.remove('focus'));
  const b = firstEmpty();
  if (b && b.el){
    b.el.classList.add('focus');
    try { b.el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch {}
  }
}

/* =======================
   Auto-ajuste / variables CSS
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

/* =======================
   UI contrarreloj
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
   Render palabra (por palabras)
   ======================= */
function newWord(){
  // 1) Si hay palabra pendiente y no está resuelta, úsala
  const savedId = localStorage.getItem(LS_CURRENT);
  if (savedId) {
    const alreadySolved = getSolvedAll().has(savedId);
    const found = ALL_WORDS.find(w => w.id === savedId);
    if (!alreadySolved && found) current = found;
  }

  // 2) Si no hay pendiente, saca la siguiente SIN repetir palabras ya acertadas
  if (!current) {
    const solvedNow = getSolvedAll();

    // Limpia la cola por si quedó algo ya resuelto
    queue = queue.filter(w => !solvedNow.has(w.id));

    // Si la cola quedó vacía, vuelve a llenar SOLO con no resueltas
    if (queue.length === 0) {
      const fresh = ALL_WORDS.filter(w => !solvedNow.has(w.id));
      if (fresh.length === 0) {
        // No quedan palabras nuevas: mostramos fin de banco
        localStorage.removeItem(LS_CURRENT);
        if (EL.clue) EL.clue.textContent = '¡No hay más palabras por ahora!';
        if (EL.msg)  EL.msg.innerHTML = '<span class="ok">Completaste todas 👏</span>';
        if (EL.goText) EL.goText.textContent = '¡Has completado todas las palabras!';
        if (EL.gameover) EL.gameover.style.display = 'flex';
        return;
      }
      shuffle(fresh);
      queue = fresh;
    }

    current = queue.shift();
  }

  // Guardar como pendiente hasta acertarla (evita cambio si recargas)
  localStorage.setItem(LS_CURRENT, current.id);

  // UI
  if (EL.clue) EL.clue.textContent = current.clue;
  if (EL.msg)  EL.msg.textContent  = '';

  // Prepara BOXES (solo letras) y TOKEN_LENS (longitud por palabra)
  const tokens = current.a.split(/[\s-]+/).filter(Boolean);
  const isLetter = ch => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(ch);

  TOKEN_LENS = tokens.map(t => [...t].filter(isLetter).length);

  boxes = [];
  tokens.forEach(t => {
    for (const ch of t){
      if (isLetter(ch)) boxes.push({ el:null, char:ch, locked:false, val:'' });
    }
  });

  answerClean = norm(current.a);
  fitSlots(); // render inicial
}
  // UI contrarreloj
  ensureTimeUI();
  updateBadges();

  // Prepara BOXES (solo letras) y TOKEN_LENS (longitud por palabra)
  const tokens = current.a.split(/[\s-]+/).filter(Boolean);
  const isLetter = ch => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(ch);

  TOKEN_LENS = tokens.map(t => [...t].filter(isLetter).length);

  boxes = [];
  tokens.forEach(t => {
    for (const ch of t){
      if (isLetter(ch)) boxes.push({ el:null, char:ch, locked:false, val:'' });
    }
  });

  answerClean = norm(current.a);
  fitSlots(); // render inicial
}

/* ===== Cálculo layout por PALABRAS ===== */
function layoutByWords(wordLens){
  const isPortrait = window.innerHeight >= window.innerWidth;
  const maxRows = IS_MOBILE ? (isPortrait ? 3 : 2) : 2; // móvil: hasta 3 en vertical; desktop: máx 2
  const containerW = EL.slots.clientWidth || (window.innerWidth - 32);
  const gapL  = cssNum('--gap-letter', BASE.gapL);
  const gapW  = cssNum('--gap-word-col', BASE.gapCol);

  // Tamaños base por plataforma
  const sizeMax = IS_MOBILE ? 54 : 88;
  const sizeMin = IS_MOBILE ? 22 : 24;

  // Si es UNA sola palabra: SIEMPRE 1 fila
  if (wordLens.length === 1){
    const n = wordLens[0];
    let size = Math.floor( (containerW - gapL*(n-1)) / n );
    size = Math.max(sizeMin, Math.min(size, sizeMax));
    return { size, rows: [ [n] ] };
  }

  // Empaquetar palabras en filas para un tamaño dado
  const packRows = (sz)=>{
    const rows = [];
    let row = [];
    let used = 0;
    for (let i=0;i<wordLens.length;i++){
      const n = wordLens[i];
      const wordWidth = n*sz + (n-1)*gapL;
      const extra = row.length ? gapW : 0;
      if (!row.length){
        row.push(n);
        used = wordWidth;
      } else if (used + extra + wordWidth <= containerW){
        row.push(n);
        used += extra + wordWidth;
      } else {
        rows.push(row);
        row = [n];
        used = wordWidth;
      }
    }
    if (row.length) rows.push(row);
    return rows;
  };

  // Buscar el tamaño mayor que entra en <= maxRows
  let size = sizeMax, rows = packRows(size);
  while (rows.length > maxRows && size > sizeMin){
    size -= 2;
    rows = packRows(size);
  }
  if (rows.length > maxRows){ size = sizeMin; rows = packRows(size); }

  return { size, rows };
}

/* ===== Render segun layout por PALABRAS ===== */
function renderByWords(layout){
  EL.slots.innerHTML = '';
  let idx = 0;

  layout.rows.forEach(rowSpec=>{
    const row = document.createElement('div');
    row.className = 'row';

    rowSpec.forEach(wordLen=>{
      const w = document.createElement('div');
      w.className = 'word';
      w.style.gridTemplateColumns = `repeat(${wordLen}, var(--slot-size))`;

      for(let i=0;i<wordLen;i++){
        const b = boxes[idx++];
        const s = document.createElement('div');
        s.className = 'slot' + (b.locked ? ' lock' : '');
        s.textContent = b.val || '';
        w.appendChild(s);
        b.el = s; // re-bind
      }
      row.appendChild(w);
    });

    EL.slots.appendChild(row);
  });

  highlightNext();
}

/* ===== Ajuste final ===== */
function fitSlots(){
  if (!current || !boxes.length) return;

  const layout = layoutByWords(TOKEN_LENS);
  setSize(layout.size);

  // Ajuste de gaps según tamaño elegido
  const scale = Math.max(0.6, Math.min(1, layout.size / BASE.size));
  setGaps(
    Math.max(6,  Math.floor(BASE.gapL   * scale)),   // letras dentro de palabra
    Math.max(6,  Math.floor(BASE.gapRow * scale)),   // separación entre filas
    Math.max(10, Math.floor(BASE.gapCol * scale))    // separación entre palabras
  );

  renderByWords(layout);
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
  // +10 por acierto (clásico)
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
  if (MODE !== 'time'){ points -= 20; updateHud(); }
  EL.msg && (EL.msg.innerHTML = MODE==='time'
    ? '<span class="bad">Incorrecto</span>'
    : '<span class="bad">Incorrecto (-20 ⭐️)</span>');
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
