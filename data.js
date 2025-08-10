// Normaliza texto para comparación
export const norm = (s) => s
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // sin tildes
  .replace(/[^a-zñ]/g,'');

// ---- Banco global (mezcla de comida, jerga y lugares) ----
export const ALL_WORDS = [
  // Comida & bebida
  { id:'bolon', a:'Bolón', clue:'Verde majado con queso o chicharrón' },
  { id:'encebollado', a:'Encebollado', clue:'Sopa icónica con pescado (albacora) y yuca' },
  { id:'tigrillo', a:'Tigrillo', clue:'Verde majado con huevo y queso, de Zaruma' },
  { id:'cuyasado', a:'Cuy asado', clue:'Carne tradicional de la Sierra' },
  { id:'hornado', a:'Hornado', clue:'Chancho horneado con mote' },
  { id:'ceviche', a:'Ceviche', clue:'Mariscos al limón, estilo ecuatoriano' },
  { id:'fritada', a:'Fritada', clue:'Cerdo frito con mote y maduro' },
  { id:'coladamorada', a:'Colada morada', clue:'Bebida morada del Día de Difuntos' },
  { id:'humita', a:'Humita', clue:'Masa de maíz tierna al vapor en hoja' },
  { id:'tamal', a:'Tamal', clue:'Masa envuelta en hoja, rellena' },
  { id:'yaguarlocro', a:'Yaguarlocro', clue:'Locro con chanfaina (sangre frita)' },
  { id:'llapingacho', a:'Llapingacho', clue:'Tortilla de papa con queso y salsa de maní' },
  { id:'corviche', a:'Corviche', clue:'Bola de verde rellena, de Manabí' },
  { id:'pandeyuca', a:'Pan de yuca', clue:'Panecillo con almidón y queso' },
  { id:'morocho', a:'Morocho', clue:'Bebida espesa de maíz con leche' },
  { id:'chocloconqueso', a:'Choclo con queso', clue:'Maíz tierno con queso y ají' },
  { id:'caldodesalchicha', a:'Caldo de salchicha', clue:'Sopa lojana tradicional' },
  { id:'chontaduro', a:'Chontaduro', clue:'Fruto amazónico que se come con miel' },
  { id:'guatita', a:'Guatita', clue:'Mondongo en salsa de maní' },
  { id:'melcocha', a:'Melcocha', clue:'Dulce artesanal de caña' },

  // Jerga & expresiones
  { id:'ñano', a:'Ñaño', clue:'Hermano/a o amigo cercano' },
  { id:'deley', a:'De ley', clue:'Seguro, por supuesto' },
  { id:'achachay', a:'Achachay', clue:'¡Qué frío! (kichwa)' },
  { id:'arrarray', a:'Arrarray', clue:'¡Qué calor! (kichwa)' },
  { id:'chuta', a:'Chuta', clue:'Sorpresa o frustración' },
  { id:'chendo', a:'Chendo', clue:'Es broma / estoy jugando' },
  { id:'bacan', a:'Bacán', clue:'Muy bueno, agradable' },
  { id:'camello', a:'Camello', clue:'Trabajo / empleo' },
  { id:'chiro', a:'Estar chiro', clue:'Estar sin dinero' },
  { id:'mashi', a:'Mashi', clue:'Amigo (kichwa castellanizado)' },
  { id:'full', a:'Full', clue:'Mucho / en gran cantidad' },
  { id:'guagua', a:'Guagua', clue:'Bebé / niño pequeño' },
  { id:'guambra', a:'Guambra', clue:'Niño/a o joven' },
  { id:'hacervaca', a:'Hacer vaca', clue:'Reunir dinero entre varios' },
  { id:'yapa', a:'Yapa', clue:'Añadidito extra al comprar' },
  { id:'pilas', a:'Pilas', clue:'Estate atento / ponte listo' },
  { id:'qbestia', a:'¡Qué bestia!', clue:'¡Qué increíble! (énfasis)' },
  { id:'canguil', a:'Canguil', clue:'Palomitas de maíz' },
  { id:'visaje', a:'Visaje', clue:'Problema o inconveniente' },
  { id:'fresco', a:'Fresco', clue:'Tranquilo / no hay problema' },

  // Lugares & cultura
  { id:'mitaddelmundo', a:'Mitad del Mundo', clue:'Monumento y complejo turístico en Quito' },
  { id:'cotopaxi', a:'Cotopaxi', clue:'Volcán activo y parque nacional' },
  { id:'galapagos', a:'Galápagos', clue:'Islas famosas por su biodiversidad' },
  { id:'cuenca', a:'Cuenca', clue:'Ciudad patrimonial del Azuay' },
  { id:'quilotoa', a:'Quilotoa', clue:'Laguna en cráter volcánico' },
  { id:'basilica', a:'Basílica del Voto Nacional', clue:'Iglesia gótica icónica en Quito' },
  { id:'banos', a:'Baños', clue:'Cascadas y termas, aventura' },
  { id:'mindo', a:'Mindo', clue:'Aves y naturaleza' },
  { id:'otavalo', a:'Otavalo', clue:'Mercado artesanal famoso' },
  { id:'yasuni', a:'Yasuní', clue:'Parque nacional amazónico' },
];

// --- Storage global (sin categorías) ---
const LS = {
  coins: 'ecuabulario_coins',
  solved_all: 'ecuabulario_solved_all'
};

export function ensureInit(){
  try{
    if(localStorage.getItem(LS.coins)===null) localStorage.setItem(LS.coins,'200');
    if(localStorage.getItem(LS.solved_all)===null) localStorage.setItem(LS.solved_all,'[]');
  }catch(e){
    // Fallback en caso de bloqueo de storage
    window.__ecuabulario_mem__ = window.__ecuabulario_mem__ || {coins:200, solved:[]};
  }
}
export function loadCoins(){
  try{ return parseInt(localStorage.getItem(LS.coins)||'0',10); }
  catch{ return (window.__ecuabulario_mem__?.coins)||0; }
}
export function saveCoins(v){
  try{ localStorage.setItem(LS.coins, String(v)); }
  catch{ (window.__ecuabulario_mem__||(window.__ecuabulario_mem__={coins:0,solved:[]})).coins=v; }
}
export function getSolvedAll(){
  try{ return new Set(JSON.parse(localStorage.getItem(LS.solved_all)||'[]')); }
  catch{ return new Set(window.__ecuabulario_mem__?.solved||[]); }
}
export function addSolvedAll(id){
  try{
    const set = getSolvedAll(); set.add(id);
    localStorage.setItem(LS.solved_all, JSON.stringify([...set]));
  }catch{
    const mem = (window.__ecuabulario_mem__||(window.__ecuabulario_mem__={coins:0,solved:[]}));
    if(!mem.solved.includes(id)) mem.solved.push(id);
  }
}
export function getProgressAll(){
  const done = getSolvedAll().size;
  const total = ALL_WORDS.length;
  return {done,total,level:Math.max(1,Math.floor(done/10)+1),ratio:total?done/total:0};
}
