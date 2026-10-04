/**
 * Utility for Text-to-Speech (TTS) and Speech-to-Text (STT) voice translations.
 */

// Language code to BCP 47 speech synthesis locale mapping
const LANG_TO_LOCALE = {
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
};

let currentUtterance = null;

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      currentUtterance = null;
    } catch (e) {
      console.warn('Error stopping speech synthesis:', e);
    }
  }
}

export function isSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

export function speakText(text, langCode = 'en', onStart, onEnd, onError) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.('Speech synthesis not supported in this browser');
    return false;
  }

  if (!text || !text.trim()) {
    return false;
  }

  // Cancel any ongoing speech first
  stopSpeaking();

  try {
    const locale = LANG_TO_LOCALE[langCode?.toLowerCase()] || langCode || 'en-US';
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = locale;
    utterance.rate = 0.95; // Slightly natural pace
    utterance.pitch = 1.0;

    // Pick a matching voice if available
    const voices = window.speechSynthesis.getVoices?.() || [];
    if (voices.length > 0) {
      const match = voices.find((v) => v.lang.toLowerCase().startsWith(locale.toLowerCase().slice(0, 2))) ||
                    voices.find((v) => v.lang.toLowerCase().includes(langCode?.toLowerCase()));
      if (match) {
        utterance.voice = match;
      }
    }

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = () => {
      currentUtterance = null;
      onEnd?.();
    };

    utterance.onerror = (err) => {
      currentUtterance = null;
      onError?.(err);
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('Speech synthesis failed:', err);
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
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;
    return recognizer;
  } catch (err) {
    console.warn('Speech recognition creation failed:', err);
    return null;
  }
}
