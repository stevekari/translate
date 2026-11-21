/**
 * Enhanced Utility for Text-to-Speech (TTS) and Speech-to-Text (STT) Voice Translations.
 * High-quality voice ranking, natural pitch/rate controls, and cross-browser reliability.
 */

// Language code to BCP 47 speech synthesis/recognition locale mapping
export const LANG_TO_LOCALE = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  nl: 'nl-NL',
  pt: 'pt-BR',
  it: 'it-IT',
  tw: 'ak-GH',
  ak: 'ak-GH',
  ru: 'ru-RU',
  ar: 'ar-SA',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  hi: 'hi-IN',
  tr: 'tr-TR',
  pl: 'pl-PL',
  uk: 'uk-UA',
  vi: 'vi-VN',
  th: 'th-TH',
  id: 'id-ID',
  sv: 'sv-SE',
  da: 'da-DK',
  fi: 'fi-FI',
  no: 'nb-NO',
  el: 'el-GR',
  he: 'he-IL',
  cs: 'cs-CZ',
  ro: 'ro-RO',
  hu: 'hu-HU',
  sw: 'sw-KE',
  yo: 'yo-NG',
  ig: 'ig-NG',
  ha: 'ha-NG',
  zu: 'zu-ZA',
  tl: 'fil-PH',
  bn: 'bn-BD',
  ur: 'ur-PK',
  fa: 'fa-IR',
  ms: 'ms-MY',
};

let cachedVoices = [];
let currentUtterance = null;

function loadVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) {
      cachedVoices = v;
    }
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
      currentUtterance = null;
    } catch (e) {
      console.warn('Error stopping speech synthesis:', e);
    }
  }
}

export function isSpeaking() {
  if (isSpeechSynthesisSupported()) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

/**
 * Score voice naturalness:
 * Higher score = more natural, human-sounding voice.
 */
function scoreVoiceQuality(voice) {
  if (!voice) return 0;
  const name = voice.name.toLowerCase();
  let score = 10;

  if (name.includes('natural') || name.includes('neural')) score += 50;
  if (name.includes('google')) score += 40;
  if (name.includes('siri') || name.includes('enhanced') || name.includes('premium')) score += 35;
  if (name.includes('samantha') || name.includes('daniel') || name.includes('karen') || name.includes('luciana') || name.includes('thomas') || name.includes('anna')) score += 25;
  if (voice.localService === false) score += 15; // Cloud-rendered natural voice in Chromium/Edge

  return score;
}

/**
 * Get all available browser voices for a given language code, sorted by naturalness.
 */
export function getAvailableVoicesForLanguage(langCode = 'en') {
  if (!isSpeechSynthesisSupported()) return [];
  loadVoices();
  const voices = cachedVoices.length > 0 ? cachedVoices : (window.speechSynthesis.getVoices() || []);
  if (!voices || voices.length === 0) return [];

  const locale = (LANG_TO_LOCALE[langCode?.toLowerCase()] || langCode || 'en-US').toLowerCase();
  const prefix = locale.slice(0, 2);

  const matched = voices.filter((v) => {
    const vLang = (v.lang || '').toLowerCase();
    return vLang === locale || vLang.startsWith(prefix) || v.name.toLowerCase().includes(langCode?.toLowerCase());
  });

  return matched.sort((a, b) => scoreVoiceQuality(b) - scoreVoiceQuality(a));
}

/**
 * Select the highest quality natural voice for a language.
 */
export function getBestVoiceForLanguage(langCode = 'en', preferredVoiceURI = null) {
  const matchingVoices = getAvailableVoicesForLanguage(langCode);
  if (!matchingVoices || matchingVoices.length === 0) {
    // Fallback: any voice in browser
    return cachedVoices[0] || null;
  }

  if (preferredVoiceURI) {
    const selected = matchingVoices.find((v) => v.voiceURI === preferredVoiceURI);
    if (selected) return selected;
  }

  return matchingVoices[0];
}

/**
 * Speak text aloud with high quality natural voice synthesis.
 */
export function speakText(
  text,
  langCode = 'en',
  onStart,
  onEnd,
  onError,
  rate = 0.95,
  preferredVoiceURI = null
) {
  if (!isSpeechSynthesisSupported()) {
    onError?.('Speech synthesis not supported in this browser');
    return false;
  }

  if (!text || !text.trim()) {
    return false;
  }

  // Cancel any ongoing utterance and wake up speech engine
  stopSpeaking();
  if (typeof window.speechSynthesis.resume === 'function') {
    try {
      window.speechSynthesis.resume();
    } catch {}
  }

  try {
    const locale = LANG_TO_LOCALE[langCode?.toLowerCase()] || langCode || 'en-US';
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = locale;
    utterance.rate = typeof rate === 'number' ? rate : 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const bestVoice = getBestVoiceForLanguage(langCode, preferredVoiceURI);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = () => {
      currentUtterance = null;
      onEnd?.();
    };

    utterance.onerror = (err) => {
      // Ignore canceled error if a new speech was triggered
      if (err?.error === 'canceled' || err?.error === 'interrupted') {
        currentUtterance = null;
        return;
      }
      console.warn('Speech synthesis utterance error:', err);
      currentUtterance = null;
      onError?.(err);
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('Speech synthesis execution failed:', err);
    onError?.(err);
    return false;
  }
}

/**
 * Creates and returns a browser SpeechRecognition instance if supported.
 */
export function createSpeechRecognizer(langCode = 'en') {
  if (typeof window === 'undefined') return null;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  try {
    const recognizer = new SpeechRecognition();
    const locale = LANG_TO_LOCALE[langCode?.toLowerCase()] || langCode || 'en-US';
    recognizer.lang = locale;
    recognizer.continuous = false; // true frequently stalls or auto-stops in Chrome/Safari; false gives instant reliable final results
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;
    return recognizer;
  } catch (err) {
    console.warn('Speech recognition creation failed:', err);
    return null;
  }
}
