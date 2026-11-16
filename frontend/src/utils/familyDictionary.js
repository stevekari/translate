/**
 * Family & Cultural Dictionary Service
 * Protects family slang, cultural idioms, and terms of endearment from awkward machine translation.
 * Provides interactive cultural context tooltips on messages.
 */

const STORAGE_KEY = 'giochat_family_dictionary';

const DEFAULT_CULTURAL_TERMS = [
  {
    term: 'Abuela',
    meaning: 'Grandmother (Spanish term of deep respect and love)',
    language: 'Spanish',
    culture: 'Latin American / Spanish',
  },
  {
    term: 'Akwaaba',
    meaning: 'Welcome with open arms and heart',
    language: 'Akan / Twi',
    culture: 'Ghanaian',
  },
  {
    term: 'Medaase',
    meaning: 'Thank you very much',
    language: 'Akan / Twi',
    culture: 'Ghanaian',
  },
  {
    term: 'Fufu',
    meaning: 'Beloved traditional pounded cassava & plantain dish served with soup',
    language: 'Akan / Twi',
    culture: 'West African',
  },
  {
    term: 'Obroni',
    meaning: 'Affectionate word for guest, visitor, or person from abroad',
    language: 'Akan / Twi',
    culture: 'Ghanaian',
  },
  {
    term: 'Chérie',
    meaning: 'Sweetheart / Darling',
    language: 'French',
    culture: 'French',
  },
  {
    term: 'Habibi',
    meaning: 'My beloved / my dear friend',
    language: 'Arabic',
    culture: 'Middle Eastern',
  },
  {
    term: 'Nonno',
    meaning: 'Grandfather',
    language: 'Italian',
    culture: 'Italian',
  },
  {
    term: 'Nonni',
    meaning: 'Grandparents',
    language: 'Italian',
    culture: 'Italian',
  },
  {
    term: 'Opa',
    meaning: 'Grandpa / grandfather',
    language: 'German',
    culture: 'German',
  },
  {
    term: 'Oma',
    meaning: 'Grandma / grandmother',
    language: 'German',
    culture: 'German',
  },
  {
    term: 'Bambino',
    meaning: 'Little child / sweetheart',
    language: 'Italian',
    culture: 'Italian',
  },
];

export function getFamilyDictionary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CULTURAL_TERMS));
      return DEFAULT_CULTURAL_TERMS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_CULTURAL_TERMS;
  }
}

export function saveFamilyDictionary(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save family dictionary', e);
  }
}

export function addFamilyTerm(entry) {
  const current = getFamilyDictionary();
  const exists = current.some(
    (t) => t.term.toLowerCase().trim() === entry.term.toLowerCase().trim()
  );
  if (exists) {
    const updated = current.map((t) =>
      t.term.toLowerCase().trim() === entry.term.toLowerCase().trim() ? { ...t, ...entry } : t
    );
    saveFamilyDictionary(updated);
    return updated;
  }
  const next = [{ ...entry, id: Date.now().toString() }, ...current];
  saveFamilyDictionary(next);
  return next;
}

export function removeFamilyTerm(termToDelete) {
  const current = getFamilyDictionary();
  const filtered = current.filter(
    (t) => t.term.toLowerCase().trim() !== termToDelete.toLowerCase().trim()
  );
  saveFamilyDictionary(filtered);
  return filtered;
}

/**
 * Scans a sentence and highlights detected cultural terms
 */
export function annotateCulturalTerms(text) {
  if (!text || typeof text !== 'string') return [{ text, isCultural: false }];

  const dict = getFamilyDictionary();
  if (!dict.length) return [{ text, isCultural: false }];

  // Build regex matching any dictionary term (case-insensitive, whole word)
  const escapedTerms = dict
    .map((d) => d.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const regex = new RegExp(`\\b(${escapedTerms})\\b`, 'gi');

  const tokens = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, matchIndex),
        isCultural: false,
      });
    }

    const matchedWord = match[0];
    const dictEntry = dict.find(
      (d) => d.term.toLowerCase() === matchedWord.toLowerCase()
    );

    tokens.push({
      text: matchedWord,
      isCultural: true,
      entry: dictEntry || { term: matchedWord, meaning: 'Family Term' },
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      text: text.slice(lastIndex),
      isCultural: false,
    });
  }

  return tokens;
}
