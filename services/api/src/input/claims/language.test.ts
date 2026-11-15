import { describe, expect, it } from 'vitest';
import { looksEnglish } from './language.js';

describe('language of overheard speech', () => {
  // Live 15 Nov: background chatter that was admitted as eligible_public_claim and used the automatic cooldown.
  it.each(['Hey, no estoy acá de nuevo.', 'Trebuie să dăm fix la o CR coaie…', 'Mañana vamos a la playa con mis amigos.', 'Das ist nicht so gut.', 'Tämä on hyvä ja se on totta.'])(
    'recognizes non-English chatter: %s', text => { expect(looksEnglish(text)).toBe(false); });

  it.each([
    'Black people commit 70% of crime.', 'Crocodiles are from the family of zebras.', 'Las Vegas and Los Angeles are big cities.',
    'De Gaulle was the president of France.', 'Real Madrid won la Liga again.', 'Zelensky told NATO that the Donbas front has not moved.',
    'Hola amigos', 'Gracias!', 'Ella Fitzgerald sang jazz in Paris.',
  ])('keeps English, names and short interjections: %s', text => { expect(looksEnglish(text)).toBe(true); });
});
