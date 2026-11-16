/**
 * Pronunciation Coach Service
 * Leverages native Web Speech Synthesis (TTS) & Web Speech Recognition (ASR).
 * Zero external API cost, instant audio response, cross-platform (Chrome, Safari, iOS, Android).
 */

const LANG_CODE_MAP = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  nl: 'nl-NL',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ar: 'ar-SA',
  hi: 'hi-IN',
  tr: 'tr-TR',
  tw: 'en-GH', // Akan/Twi fallback to Ghanaian English voice if Akan voice not present
  ak: 'en-GH',
};

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSpeechRecognitionSupported() {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

export function speakText(text, lang = 'en', rate = 0.9) {
  if (!isSpeechSynthesisSupported()) {
    console.warn('Speech synthesis is not supported on this device.');
    return false;
  }

  // Cancel any ongoing utterance
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const targetTag = LANG_CODE_MAP[lang?.toLowerCase()] || lang || 'en-US';
  utterance.lang = targetTag;
  utterance.rate = rate; // slightly slower for language learners

  // Pick best matching voice
  const voices = window.speechSynthesis.getVoices() || [];
  const voice = voices.find(
    (v) => v.lang === targetTag || v.lang.startsWith(lang.toLowerCase())
  );
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
  return true;
}

/**
 * Computes Levenshtein-based similarity score between 0 and 100
 */
export function calculateAccuracy(spoken, target) {
  if (!spoken || !target) return 0;
  const cleanSpoken = spoken.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const cleanTarget = target.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();

  if (cleanSpoken === cleanTarget) return 100;

  const sWords = cleanSpoken.split(/\s+/);
  const tWords = cleanTarget.split(/\s+/);

  let matchCount = 0;
  tWords.forEach((word) => {
    if (sWords.includes(word)) matchCount++;
  });

  const wordRatio = (matchCount / Math.max(tWords.length, 1)) * 70;
  const lenRatio = Math.max(0, 1 - Math.abs(cleanSpoken.length - cleanTarget.length) / Math.max(cleanTarget.length, 1)) * 30;

  return Math.min(100, Math.round(wordRatio + lenRatio));
}

/**
 * Starts speech recognition to evaluate user's pronunciation
 */
export function listenForPronunciation({
  targetText,
  lang = 'en',
  onResult,
  onError,
  onEnd,
}) {
  if (!isSpeechRecognitionSupported()) {
    onError?.('Speech recognition is not supported in this browser. Please use Chrome or Safari.');
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognizer = new SpeechRecognition();

  recognizer.lang = LANG_CODE_MAP[lang?.toLowerCase()] || lang || 'en-US';
  recognizer.interimResults = true;
  recognizer.maxAlternatives = 1;

  recognizer.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((r) => r[0].transcript)
      .join(' ');
    const isFinal = event.results[event.results.length - 1].isFinal;
    const score = calculateAccuracy(transcript, targetText);

    onResult?.({
      transcript,
      isFinal,
      score,
      grade: getScoreGrade(score),
    });
  };

  recognizer.onerror = (err) => {
    onError?.(err.error || 'Failed to capture voice.');
  };

  recognizer.onend = () => {
    onEnd?.();
  };

  try {
    recognizer.start();
    return recognizer;
  } catch (e) {
    onError?.('Microphone could not be started.');
    return null;
  }
}

export function getScoreGrade(score) {
  if (score >= 90) return { label: 'Native Fluency! 🌟', color: '#10b981', stars: 5 };
  if (score >= 75) return { label: 'Great Pronunciation! 👍', color: '#3b82f6', stars: 4 };
  if (score >= 50) return { label: 'Good Try! Keep going 💪', color: '#f59e0b', stars: 3 };
  return { label: 'Listen again & repeat! 🎧', color: '#ef4444', stars: 2 };
}
