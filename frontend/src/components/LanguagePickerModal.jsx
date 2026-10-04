import { useState, useMemo, useEffect, useRef } from 'react';
import { WORLD_LANGUAGES, searchLanguages, getLanguageInfo } from '../utils/languages';

export default function LanguagePickerModal({
  isOpen,
  onClose,
  currentLanguage = 'en',
  onSelectLanguage,
  autoTranslate = false,
  onToggleAutoTranslate,
  title = 'Select Translation Language',
  subtitle = 'Choose the language you want messages translated into',
}) {
  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filtered = useMemo(() => searchLanguages(search), [search]);
  const popularLanguages = useMemo(() => WORLD_LANGUAGES.filter((l) => l.popular), []);
  const currentLangInfo = getLanguageInfo(currentLanguage);

  if (!isOpen) return null;

  return (
    <div className="wa-lang-modal-overlay" onClick={onClose}>
      <div className="wa-lang-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wa-lang-modal-header">
          <div className="wa-lang-modal-title-row">
            <div className="wa-lang-modal-title-left">
              <span className="wa-lang-globe">🌍</span>
              <div>
                <h3>{title}</h3>
                <p>{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              className="wa-lang-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Active selection pill */}
          <div className="wa-lang-active-banner">
            <span className="wa-lang-active-label">Currently translating to:</span>
            <div className="wa-lang-active-badge">
              <span className="wa-flag">{currentLangInfo.flag}</span>
              <span className="wa-name">{currentLangInfo.name}</span>
              <span className="wa-native">({currentLangInfo.nativeName})</span>
            </div>
          </div>

          {/* Search Input */}
          <div className="wa-lang-search-wrapper">
            <i className="fa-solid fa-magnifying-glass wa-search-icon"></i>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search from 40+ languages (e.g. Spanish, Twi, French)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="wa-lang-search-input"
            />
            {search && (
              <button
                type="button"
                className="wa-search-clear"
                onClick={() => setSearch('')}
              >
                <i className="fa-solid fa-circle-xmark"></i>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="wa-lang-modal-body">
          {/* Auto Translate Toggle if provided */}
          {typeof onToggleAutoTranslate === 'function' && (
            <div className="wa-auto-translate-bar" onClick={() => onToggleAutoTranslate(!autoTranslate)}>
              <div className="wa-auto-translate-info">
                <div className="wa-auto-translate-title">
                  <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#f59e0b' }}></i>
                  <span>Auto-Translate incoming messages</span>
                </div>
                <div className="wa-auto-translate-desc">
                  Automatically translate every incoming message into your selected language
                </div>
              </div>
              <label className="wa-switch" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={autoTranslate}
                  onChange={(e) => onToggleAutoTranslate(e.target.checked)}
                />
                <span className="wa-slider round"></span>
              </label>
            </div>
          )}

          {/* Popular / Quick Select (when not searching) */}
          {!search && (
            <div className="wa-lang-section">
              <div className="wa-section-header">
                <i className="fa-solid fa-fire" style={{ color: '#f59e0b', marginRight: '6px' }}></i>
                Popular Languages
              </div>
              <div className="wa-popular-grid">
                {popularLanguages.map((lang) => {
                  const isSelected = lang.code === currentLanguage?.toLowerCase();
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      className={`wa-popular-chip ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        onSelectLanguage(lang.code);
                        onClose();
                      }}
                    >
                      <span className="wa-chip-flag">{lang.flag}</span>
                      <span className="wa-chip-name">{lang.name}</span>
                      {isSelected && <i className="fa-solid fa-check wa-chip-check"></i>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Languages List */}
          <div className="wa-lang-section">
            <div className="wa-section-header">
              <i className="fa-solid fa-earth-americas" style={{ color: '#f59e0b', marginRight: '6px' }}></i>
              {search ? `Search Results (${filtered.length})` : 'All World Languages'}
            </div>

            {filtered.length === 0 ? (
              <div className="wa-lang-empty">
                <i className="fa-solid fa-earth-africa"></i>
                <p>No language found matching "{search}"</p>
              </div>
            ) : (
              <div className="wa-lang-list">
                {filtered.map((lang) => {
                  const isSelected = lang.code === currentLanguage?.toLowerCase();
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      className={`wa-lang-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        onSelectLanguage(lang.code);
                        onClose();
                      }}
                    >
                      <span className="wa-row-flag">{lang.flag}</span>
                      <div className="wa-row-text">
                        <span className="wa-row-name">{lang.name}</span>
                        <span className="wa-row-native">{lang.nativeName}</span>
                      </div>
                      {isSelected && (
                        <div className="wa-selected-badge">
                          <i className="fa-solid fa-circle-check"></i>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
