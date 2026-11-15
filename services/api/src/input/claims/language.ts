/**
 * A cheap check for overheard speech that is not English, so background chatter in another language never uses the automatic check
 * or its cooldown. The recogniser cannot say: ElevenLabs runs with language_code=en, transcribes Spanish as Spanish anyway and reports
 * "en". Words that are function words in English and in another language (a, in, no, am, are, on, me, he) count for neither side.
 */
const ENGLISH = new Set(('the an and or but of to at by for with from into about over after before than then because while if so as is was were be been ' +
  'being do does did have has had will would can could should may might must shall not it its this that these those there here i you she we they him ' +
  'her us them my your his our their what which who whom whose when where why how all any some more most very just only also too what\'s it\'s ' +
  'that\'s don\'t doesn\'t didn\'t isn\'t aren\'t wasn\'t can\'t won\'t i\'m you\'re we\'re they\'re there\'s people said says think know').split(' '));
const FOREIGN = new Set((
  // Spanish
  'el la los las del que y un una unos unas es son está están estoy estás estamos por para con pero como más muy sí yo tú él ella nosotros ellos ' +
  'mi tu su lo le se te nos al ya hay este esta eso esto aquí acá también porque cuando donde qué cómo vamos tengo tiene hacer bien nada todo ' +
  'nuevo hola gracias mañana amigos mis tus sus ' +
  // Romanian
  'și si să o în din cu pe ce este e sunt ai mai dar că care pentru fi fost asta aici acum foarte doar bine eu ea noi voi ei lui mă îmi ți ' +
  'ne vă trebuie dăm avem nu ' +
  // French
  'les des du et une je il elle nous vous pas qui dans pour avec sur cette mais très oui ' +
  // German
  'der das und ist nicht ich du er wir ein eine mit auf für von zu auch aber sehr ja ' +
  // Italian and Portuguese
  'il della di che non sono anche questo ma não uma com para mas muito ' +
  // Finnish
  'ja ei se että mutta kun niin mitä onko olen oli ole tämä joo').split(' '));
const MIN_WORDS = 3;

/**
 * False when foreign function words outnumber English ones and there are at least two of them. A foreign word counts only when it is
 * lowercase or opens the sentence, so names such as "Los Angeles", "La Paz" or "De Niro" never tip an English sentence. Short
 * sentences (under three words) count as English, so a name or an interjection is never mistaken for another language.
 */
export function looksEnglish(text: string): boolean {
  const tokens = text.match(/[\p{L}']+/gu) ?? [];
  if (tokens.length < MIN_WORDS) return true;
  let english = 0; let foreign = 0;
  tokens.forEach((token, index) => {
    const word = token.toLowerCase();
    if (ENGLISH.has(word)) english++;
    else if (FOREIGN.has(word) && (index === 0 || token === word)) foreign++;
  });
  return !(foreign >= 2 && foreign > english);
}
