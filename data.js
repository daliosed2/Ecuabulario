// Utilidades
export const norm = (s) => s
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // sin tildes
  .replace(/[^a-zñ]/g,''); // sin espacios/guiones

const LS = {
  coins: 'ecuapalas_coins',
  solved: 'ecuapalas_solved_food'
};

export function ensureInit(){
  if(localStorage.getItem(LS.coins)===null) localStorage.setItem(LS.coins,'200'); // monedas iniciales
  if(localStorage.getItem(LS.solved)===null) localStorage.setItem(LS.solved,'[]');
}
export function loadCoins(){ return parseInt(localStorage.getItem(LS.coins)||'0',10); }
export function saveCoins(v){ localStorage.setItem(LS.coins, String(v)); }
export function getSolved(cat='food'){ return new Set(JSON.parse(localStorage.getItem(LS.solved)||'[]')); }
export function addSolved(id){
  const set = getSolved(); set.add(id);
  localStorage.setItem(LS.solved, JSON.stringify([...set]));
}
export function getProgress(cat='food'){
  const done = getSolved(cat).size;
  const total = BANKS[cat].length;
  return {done,total,level:Math.max(1,Math.floor(done/10)+1),ratio:total?done/total:0};
}

// Banco (puedes editar/expandir libremente)
export const BANKS = {
  food: [
    { id:'bolon',      a:'Bolón',        clue:'Plato de verde majado con queso o chicharrón' },
    { id:'encebollado',a:'Encebollado',  clue:'Sopa icónica con pescado (albacora) y yuca' },
    { id:'tigrillo',   a:'Tigrillo',     clue:'Verde majado con huevo y queso, de Zaruma' },
    { id:'cuyasado',   a:'Cuy asado',    clue:'Carne tradicional de la Sierra' },
    { id:'hornado',    a:'Hornado',      clue:'Chancho horneado servido con mote' },
    { id:'ceviche',    a:'Ceviche',      clue:'Mariscos cocidos en limón, estilo ecuatoriano' },
    { id:'fritada',    a:'Fritada',      clue:'Cerdo frito con mote y maduro' },
    { id:'colada',     a:'Colada morada',clue:'Bebida morada del Día de Difuntos' },
    { id:'humita',     a:'Humita',       clue:'Masa de maíz tierna al vapor en hoja' },
    { id:'tamal',      a:'Tamal',        clue:'Masa envuelta (hoja) típica de varias regiones' },
    { id:'yaguarlocro',a:'Yaguarlocro',  clue:'Locro con chanfaina (sangre frita) por encima' },
    { id:'llapingacho',a:'Llapingacho',  clue:'Tortillas de papa con queso y salsa de maní' },
    { id:'corviche',   a:'Corviche',     clue:'Bola de verde rellena y frita, de Manabí' },
    { id:'panaderiv',  a:'Pan de yuca',  clue:'Panecillo con almidón y queso' },
    { id:'morocho',    a:'Morocho',      clue:'Bebida espesa de maíz con leche' },
    { id:'choclo',     a:'Choclo con queso', clue:'Maíz tierno con queso y ají' },
    { id:'caldo',      a:'Caldo de salchicha', clue:'Sopa lojana tradicional' },
    { id:'chontaduro', a:'Chontaduro',   clue:'Fruto amazónico que se come con miel' },
    { id:'encebolladom',a:'Encebollado mixto', clue:'Versión con camarón y pescado' },
    { id:'guatita',    a:'Guatita',      clue:'Mondongo en salsa de maní' },
  ]
};
