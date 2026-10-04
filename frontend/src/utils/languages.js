export const WORLD_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', popular: true },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', popular: true },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', popular: true },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', popular: true },
  { code: 'tw', name: 'Twi (Akan)', nativeName: 'Twi / Akan', flag: '🇬🇭', popular: true },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', popular: true },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', popular: true },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', popular: true },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', popular: true },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳', popular: true },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', popular: true },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', popular: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', popular: true },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Èdè Yorùbá', flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo', nativeName: 'Asụsụ Igbo', flag: '🇳🇬' },
  { code: 'ha', name: 'Hausa', nativeName: 'Harshen Hausa', flag: '🇳🇬' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', flag: '🇿🇦' },
  { code: 'tl', name: 'Tagalog (Filipino)', nativeName: 'Tagalog', flag: '🇵🇭' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
];

export function getLanguageInfo(code) {
  if (!code) return { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' };
  const lower = code.toLowerCase().trim();
  const match = WORLD_LANGUAGES.find(
    (l) => l.code === lower || (lower === 'ak' && l.code === 'tw')
  );
  if (match) return match;
  return {
    code: lower,
    name: code.toUpperCase(),
    nativeName: code.toUpperCase(),
    flag: '🌐',
  };
}

export function searchLanguages(query) {
  if (!query || !query.trim()) return WORLD_LANGUAGES;
  const q = query.toLowerCase().trim();
  return WORLD_LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
  );
}
