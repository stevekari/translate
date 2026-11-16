import { useState, useMemo } from 'react';
import {
  getFamilyDictionary,
  addFamilyTerm,
  removeFamilyTerm,
} from '../utils/familyDictionary';

export default function FamilyDictionaryModal({ onClose }) {
  const [dictionary, setDictionary] = useState(() => getFamilyDictionary());
  const [search, setSearch] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newLanguage, setNewLanguage] = useState('Akan / Twi');
  const [newCulture, setNewCulture] = useState('Family Slang');
  const [showAddForm, setShowAddForm] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return dictionary;
    const q = search.trim().toLowerCase();
    return dictionary.filter(
      (item) =>
        item.term.toLowerCase().includes(q) ||
        item.meaning.toLowerCase().includes(q) ||
        (item.language && item.language.toLowerCase().includes(q)) ||
        (item.culture && item.culture.toLowerCase().includes(q))
    );
  }, [dictionary, search]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newTerm.trim() || !newMeaning.trim()) return;

    const updated = addFamilyTerm({
      term: newTerm.trim(),
      meaning: newMeaning.trim(),
      language: newLanguage.trim() || 'Custom',
      culture: newCulture.trim() || 'Family',
    });

    setDictionary(updated);
    setNewTerm('');
    setNewMeaning('');
    setShowAddForm(false);
  };

  const handleDelete = (term) => {
    const updated = removeFamilyTerm(term);
    setDictionary(updated);
  };

  return (
    <div className="unique-modal-backdrop" onClick={onClose}>
      <div className="unique-modal-card dictionary-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="unique-modal-header">
          <div className="unique-modal-title-row">
            <span className="unique-icon-badge dict-badge">
              <i className="fa-solid fa-book-bookmark" />
            </span>
            <div>
              <h2 className="unique-modal-title">Family & Cultural Dictionary</h2>
              <p className="unique-modal-sub">Custom words, nicknames & idioms protected in translations</p>
            </div>
          </div>
          <button type="button" className="unique-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="dict-toolbar">
          <div className="dict-search-wrap">
            <i className="fa-solid fa-magnifying-glass dict-search-icon" />
            <input
              type="text"
              placeholder="Search family terms or meanings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="dict-search-input"
            />
          </div>
          <button
            type="button"
            className="dict-add-btn"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <i className={`fa-solid ${showAddForm ? 'fa-minus' : 'fa-plus'}`} />
            <span>{showAddForm ? 'Cancel' : 'Add Term'}</span>
          </button>
        </div>

        {/* Add Form Accordion */}
        {showAddForm && (
          <form onSubmit={handleAdd} className="dict-new-form">
            <div className="dict-form-grid">
              <input
                type="text"
                placeholder="Family word or idiom (e.g. Abuela, Maa, Fufu)"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                required
                className="dict-input"
              />
              <input
                type="text"
                placeholder="Exact meaning / Cultural context"
                value={newMeaning}
                onChange={(e) => setNewMeaning(e.target.value)}
                required
                className="dict-input"
              />
              <input
                type="text"
                placeholder="Language / Dialect (e.g. Spanish, Twi)"
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                className="dict-input"
              />
              <input
                type="text"
                placeholder="Category (e.g. Family nickname, Food, Greeting)"
                value={newCulture}
                onChange={(e) => setNewCulture(e.target.value)}
                className="dict-input"
              />
            </div>
            <button type="submit" className="dict-save-btn">
              <i className="fa-solid fa-check" />
              <span>Save to Family Dictionary</span>
            </button>
          </form>
        )}

        {/* Terms List */}
        <div className="dict-items-list">
          {filtered.length === 0 ? (
            <div className="dict-empty-state">
              <i className="fa-solid fa-book-open dict-empty-icon" />
              <p>No family terms found. Add your unique words above!</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div key={item.term} className="dict-item-card">
                <div className="dict-item-info">
                  <div className="dict-item-header">
                    <span className="dict-item-term">{item.term}</span>
                    <span className="dict-item-lang-badge">{item.language || 'Family'}</span>
                    {item.culture && <span className="dict-item-culture-badge">{item.culture}</span>}
                  </div>
                  <p className="dict-item-meaning">{item.meaning}</p>
                </div>
                <button
                  type="button"
                  className="dict-item-delete"
                  onClick={() => handleDelete(item.term)}
                  title="Remove term"
                >
                  <i className="fa-solid fa-trash-can" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
