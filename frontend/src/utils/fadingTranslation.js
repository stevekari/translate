/**
 * Fading Translation Immersion Engine
 * Gradually introduces target-language vocabulary into daily messages so users naturally
 * learn a new language through conversation.
 */

const STORAGE_KEY = 'giochat_fading_immersion';

// High-frequency beginner & intermediate vocabulary mapped by target language
const IMMERSION_VOCAB = {
  es: [
    { target: 'hola', native: 'hello' },
    { target: 'gracias', native: 'thank you' },
    { target: 'amigo', native: 'friend' },
    { target: 'amiga', native: 'friend' },
    { target: 'bueno', native: 'good' },
    { target: 'casa', native: 'house' },
    { target: 'tiempo', native: 'time' },
    { target: 'hoy', native: 'today' },
    { target: 'mañana', native: 'tomorrow' },
    { target: 'por favor', native: 'please' },
    { target: 'siempre', native: 'always' },
    { target: 'ahora', native: 'now' },
    { target: 'familia', native: 'family' },
    { target: 'hermano', native: 'brother' },
    { target: 'hermana', native: 'sister' },
  ],
  fr: [
    { target: 'bonjour', native: 'hello' },
    { target: 'merci', native: 'thank you' },
    { target: 'ami', native: 'friend' },
    { target: 'bien', native: 'good' },
    { target: 'maison', native: 'house' },
    { target: 'temps', native: 'time' },
    { target: 'aujourd’hui', native: 'today' },
    { target: 'demain', native: 'tomorrow' },
    { target: 's’il vous plaît', native: 'please' },
    { target: 'toujours', native: 'always' },
    { target: 'maintenant', native: 'now' },
    { target: 'famille', native: 'family' },
  ],
  de: [
    { target: 'hallo', native: 'hello' },
    { target: 'danke', native: 'thank you' },
    { target: 'Freund', native: 'friend' },
    { target: 'gut', native: 'good' },
    { target: 'Haus', native: 'house' },
    { target: 'Zeit', native: 'time' },
    { target: 'heute', native: 'today' },
    { target: 'morgen', native: 'tomorrow' },
    { target: 'bitte', native: 'please' },
    { target: 'immer', native: 'always' },
    { target: 'jetzt', native: 'now' },
    { target: 'Familie', native: 'family' },
  ],
  tw: [
    { target: 'akwaaba', native: 'welcome' },
    { target: 'medaase', native: 'thank you' },
    { target: 'adamfo', native: 'friend' },
    { target: 'papa', native: 'good' },
    { target: 'fie', native: 'house' },
    { target: 'bere', native: 'time' },
    { target: 'ɛnnɛ', native: 'today' },
    { target: 'ɔkyena', native: 'tomorrow' },
    { target: 'mepaakyɛw', native: 'please' },
    { target: 'daadaa', native: 'always' },
    { target: 'seesei', native: 'now' },
    { target: 'abusua', native: 'family' },
  ],
};

export function getFadingModeConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { enabled: false, targetLang: 'es', immersionLevel: 1 };
    }
    return JSON.parse(raw);
  } catch (e) {
    return { enabled: false, targetLang: 'es', immersionLevel: 1 };
  }
}

export function saveFadingModeConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save fading mode config', e);
  }
}

/**
 * Transforms a sentence into an interactive fading immersion token stream
 */
export function applyFadingImmersion(text, targetLang = 'es', enabled = true) {
  if (!enabled || !text || typeof text !== 'string') {
    return [{ text, isFaded: false }];
  }

  const vocabList = IMMERSION_VOCAB[targetLang?.toLowerCase()] || IMMERSION_VOCAB.es;
  if (!vocabList || !vocabList.length) {
    return [{ text, isFaded: false }];
  }

  // Look for target immersion words present in text or native words to replace
  const tokens = [];
  const words = text.split(/(\s+)/);

  words.forEach((chunk) => {
    const clean = chunk.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const matched = vocabList.find(
      (v) =>
        v.target.toLowerCase() === clean ||
        v.native.toLowerCase() === clean
    );

    if (matched && clean.length > 1) {
      tokens.push({
        text: chunk,
        isFaded: true,
        targetWord: matched.target,
        nativeWord: matched.native,
        targetLang,
      });
    } else {
      tokens.push({
        text: chunk,
        isFaded: false,
      });
    }
  });

  return tokens;
}
