// Normaliza texto para comparación (sin tildes, espacios ni símbolos)
export const norm = (s) => s
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita tildes
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
  { id:'arrarray', a:'Arrarray', clue:'¡Qué calor! (kichwa)' },
  { id:'chuta', a:'Chuta', clue:'Sorpresa o frustración' },
  { id:'chendo', a:'Chendo', clue:'Es broma / estoy jugando' },
  { id:'bacan', a:'Bacán', clue:'Muy bueno, agradable' },
  { id:'camello', a:'Camello', clue:'Trabajo / empleo' },
  { id:'chiro', a:'Chiro', clue:'Estar sin dinero' },
  { id:'mashi', a:'Mashi', clue:'Amigo (kichwa castellanizado)' },
  { id:'full', a:'Full', clue:'Mucho / en gran cantidad' },
  { id:'guagua', a:'Guagua', clue:'Bebé / niño pequeño' },
  { id:'guambra', a:'Guambra', clue:'Niño/a o joven' },
  { id:'hacervaca', a:'Hacer vaca', clue:'Reunir dinero entre varios' },
  { id:'yapa', a:'Yapa', clue:'Añadidito extra al comprar' },
  { id:'pilas', a:'Pilas', clue:'Estate atento / ponte listo' },
  { id:'qbestia', a:'Qué bestia', clue:'¡Qué increíble! (énfasis)' },
  { id:'canguil', a:'Canguil', clue:'Palomitas de maíz' },
  { id:'visaje', a:'Visaje', clue:'Problema o inconveniente' },
  { id:'fresco', a:'Fresco', clue:'Tranquilo / no hay problema' },
  { id:'llucho', a:'Llucho', clue:'Persona sin prendas de vestir' },
  { id:'shunsho', a:'shunsho', clue:'tonto/menso/bobo'},

  // Lugares & cultura
  { id:'mitaddelmundo', a:'Mitad del Mundo', clue:'Monumento y complejo turístico en Quito' },
  { id:'cotopaxi', a:'Cotopaxi', clue:'Volcán activo y parque nacional' },
  { id:'galapagos', a:'Galápagos', clue:'Islas famosas por su biodiversidad' },
  { id:'cuenca', a:'Cuenca', clue:'Ciudad patrimonial del Azuay' },
  { id:'quilotoa', a:'Quilotoa', clue:'Laguna en cráter volcánico' },
  { id:'basilica', a:'Basílica', clue:'Iglesia gótica icónica en Quito' },
  { id:'banos', a:'Baños', clue:'Cascadas y termas, aventura' },
  { id:'mindo', a:'Mindo', clue:'Aves y naturaleza' },
  { id:'otavalo', a:'Otavalo', clue:'Mercado artesanal famoso' },
  { id:'yasuni', a:'Yasuní', clue:'Parque nacional amazónico' },
{ id:'chiripa', a:'Chiripa', clue:'Buena suerte o casualidad' },
{ id:'trole', a:'Trole', clue:'Transporte urbano eléctrico de Quito' },
{ id:'norio', a:'Norio', clue:'Persona muy estudiosa o tímida' },
{ id:'simon', a:'Simón', clue:'Afirmación enfática ("efectivamente")' },
{ id:'china', a:'China', clue:'Chica de pueblo o trabajadora doméstica' },
{ id:'pelucon', a:'Pelucón', clue:'Persona con mucho dinero' },
{ id:'puchica', a:'Púchica', clue:'Exclamación de admiración o sorpresa' },
{ id:'cucayo', a:'Cucayo', clue:'Comida que se lleva cuando se sale de viaje' },
{ id:'engrupo', a:'Engrupido', clue:'Persona que cree que está enamorada' },
{ id:'quedito', a:'Quedito', clue:'Callado o quieto' },
{ id:'tuco', a:'Tuco', clue:'Persona fuerte o musculosa' },
{ id:'lorenzo', a:'Lorenzo', clue:'Forma coloquial de decir “loco”' },
{ id:'chuchaqui', a:'Chuchaqui', clue:'Resaca o malestar después de beber' },
{ id:'cacho', a:'Cacho', clue:'Chiste o broma' },
{ id:'pipon', a:'Pipón', clue:'Persona con barriga prominente' },
{ id:'buenazo', a:'Buenazo', clue:'Persona amable o algo excelente' },
{ id:'percherona', a:'Percherona', clue:'Mujer robusta mayor de 30 años' },
{ id:'chevere', a:'Chévere', clue:'Algo bueno o agradable' },
{ id:'pana', a:'Pana', clue:'Amigo o compañero' },
{ id:'mande', a:'Mande', clue:'Forma respetuosa de responder' },
{ id:'longo', a:'Longo', clue:'Término despectivo para serrano' },
{ id:'chapa', a:'Chapa', clue:'Policía' },
{ id:'cachar', a:'Cachar', clue:'Entender o comprender' },
{ id:'amano', a:'Amaño', clue:'Pareja que vive junta sin casarse' },
{ id:'patucho', a:'Patucho', clue:'Persona de baja estatura' },
{ id:'flauta', a:'Flauta', clue:'Pene (coloquial)' },
{ id:'shimi', a:'Shimi', clue:'Persona muy llorona' },
{ id:'mono', a:'Mono', clue:'Apodo despectivo para costeño' },
{ id:'sapo', a:'Sapo', clue:'Persona entrometida o corrupta' },
{ id:'choro', a:'Choro', clue:'Ladrón' },
{ id:'shunsho', a:'Shunsho', clue:'Persona tonta o ingenua' },
{ id:'mijo', a:'Mijo', clue:'Forma cariñosa para hijo' },
{ id:'tumbado', a:'Tumbado', clue:'Techo de una casa' },
{ id:'cochoso', a:'Cochoso', clue:'Sucio o desaseado' },
{ id:'vaina', a:'Vaina', clue:'Cosa cuyo nombre no se recuerda' },
{ id:'veci', a:'Veci', clue:'Forma cariñosa de vecino' },
{ id:'singa', a:'Singa', clue:'Nariz (coloquial)' },
{ id:'jumo', a:'Jumo', clue:'Persona borracha' },
{ id:'sobrado', a:'Sobrado', clue:'Persona soberbia' },
{ id:'taita', a:'Taita', clue:'Papá (en quechua)' },
{ id:'suca', a:'Suca', clue:'Mujer rubia (coloquial)' },
{ id:'tutuma', a:'Tutuma', clue:'Cabeza (coloquial)' },
{ id:'chumar', a:'Chumar', clue:'Beber en exceso' },
{ id:'aguite', a:'Agüite', clue:'Tristeza o desánimo' },
{ id:'mijin', a:'Mijín', clue:'Amigo cercano (cariñoso)' },
{ id:'fajarse', a:'Fajarse', clue:'Esforzarse mucho' },
{ id:'botado', a:'Botado', clue:'Abandonado o dejado solo' },
{ id:'plena', a:'Plena', clue:'Verdad directa o completa' },
  // Jerga & expresiones (una sola palabra, nuevas desde Dancefree)
{ id:'huaira', a:'Huaira', clue:'Viento' },
{ id:'labia', a:'Labia', clue:'Habilidad para hablar, palabra encantadora' },
  // Jerga & expresiones (una sola palabra, nuevas desde ChokoTrip)
{ id:'aguaje', a:'Aguaje', clue:'Marea alta' },
{ id:'alhaja', a:'Alhaja', clue:'Simpático, bonito' },
{ id:'allulla', a:'Allulla', clue:'Pan típico de Latacunga (harina de maíz)' },
{ id:'acisito', a:'Aquisito', clue:'Cerca, a una distancia cercana' },
{ id:'bacilar', a:'Bacilar', clue:'1) Pasarlo bien • 2) Molestar • 3) Un beso sin compromiso' },
{ id:'balde', a:'Balde', clue:'Parte trasera de una camioneta' },
{ id:'bola', a:'Bola', clue:'Mucho o en gran cantidad' },
{ id:'biela', a:'Biela', clue:'Cerveza' },
{ id:'caleta', a:'Caleta', clue:'Casa' },
{ id:'chagra', a:'Chagra', clue:'Vaquero andino típico' },
{ id:'chaquinan', a:'Chaquiñán', clue:'Sendero' },
{ id:'chiva', a:'Chiva', clue:'Bus festivo sin puertas ni ventanas' },
{ id:'chupar', a:'Chupar', clue:'Beber alcohol' },
{ id:'chumado', a:'Chumado', clue:'Borracho' },
{ id:'jeva', a:'Jeva', clue:'Mujer, novia' },
{ id:'locro', a:'Locro', clue:'Sopa andina de papa, queso, leche y aguacate' },
{ id:'montubio', a:'Montubio', clue:'Vaquero de la Costa' },
{ id:'pacheco', a:'Pacheco', clue:'Frío' },
{ id:'pite', a:'Pite', clue:'Un poquito' },
{ id:'soroche', a:'Soroche', clue:'Mal de altura' },
{ id:'suco', a:'Suco', clue:'Rubio, de cabello claro' },
{ id:'achachay', a:'Achachay', clue:'¡Qué frío! (expresión kichwa)' },
{ id:'atay', a:'Atatay', clue:'Expresión de asco (kichwa)' },
{ id:'ayayay', a:'Ayayay', clue:'Expresión de dolor (kichwa)' },
{ id:'no_sea_malito', a:'No sea malito', clue:'“Por favor”, ruego cortés' },
{ id:'neque', a:'Ñeque', clue:'Fuerza, tenacidad' },
];

// --- Storage global (PUNTOS + resueltos) ---
const LS = {
  points: 'ecuabulario_points',           // puntos del usuario
  solved_all: 'ecuabulario_solved_all'    // palabras resueltas
};

export function ensureInit(){
  try{
    if(localStorage.getItem(LS.points)===null) localStorage.setItem(LS.points,'100');  // empieza con 100
    if(localStorage.getItem(LS.solved_all)===null) localStorage.setItem(LS.solved_all,'[]');
  }catch(e){
    // Fallback si el storage está bloqueado
    window.__ecuabulario_mem__ = window.__ecuabulario_mem__ || {points:100, solved:[]};
  }
}

export function loadPoints(){
  try{ return parseInt(localStorage.getItem(LS.points)||'0',10); }
  catch{ return (window.__ecuabulario_mem__?.points) || 0; }
}
export function savePoints(v){
  try{ localStorage.setItem(LS.points, String(v)); }
  catch{
    const mem = (window.__ecuabulario_mem__ ||= {points:0, solved:[]});
    mem.points = v;
  }
}

export function getSolvedAll(){
  try{ return new Set(JSON.parse(localStorage.getItem(LS.solved_all)||'[]')); }
  catch{ return new Set(window.__ecuabulario_mem__?.solved || []); }
}
export function addSolvedAll(id){
  try{
    const set = getSolvedAll(); set.add(id);
    localStorage.setItem(LS.solved_all, JSON.stringify([...set]));
  }catch{
    const mem = (window.__ecuabulario_mem__ ||= {points:0, solved:[]});
    if(!mem.solved.includes(id)) mem.solved.push(id);
  }
}

export function getProgressAll(){
  const done = getSolvedAll().size;
  const total = ALL_WORDS.length;
  return {
    done, total,
    level: Math.max(1, Math.floor(done/10)+1),
    ratio: total ? done/total : 0
  };
}
