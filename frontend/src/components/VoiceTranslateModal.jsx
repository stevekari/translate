import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { WORLD_LANGUAGES, getLanguageInfo } from '../utils/languages';
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  getAvailableVoicesForLanguage,
} from '../utils/speechUtils';
import { quickTranslate } from '../api/conversationApi';
import '../styles/voiceTranslate.css';

// Quick phrase chips for instant 1-tap testing
const QUICK_PHRASES = [
  { label: 'Hello, how are you? 👋', text: 'Hello, how are you?' },
  { label: 'Thank you very much! 🙏', text: 'Thank you very much!' },
  { label: 'Nice to meet you! ✨', text: 'Nice to meet you!' },
  { label: 'Where is the train station? 🚆', text: 'Where is the train station?' },
  { label: 'How much does this cost? 🏷️', text: 'How much does this cost?' },
  { label: 'Can you help me, please? 🤝', text: 'Can you help me, please?' },
];

export default function VoiceTranslateModal({
  isOpen = true,
  onClose,
  initialSourceLang = 'en',
  initialTargetLang = 'es',
  onSendToChat,
  friendName,
}) {
  const [sourceLang, setSourceLang] = useState(initialSourceLang || 'en');
  const [targetLang, setTargetLang] = useState(initialTargetLang || 'es');
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedSourceLang, setDetectedSourceLang] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playingWhich, setPlayingWhich] = useState(null); // 'source' | 'target' | null
  const [autoSpeak, setAutoSpeak] = useState(true); // Automatically speak translation
  const [speechSpeed, setSpeechSpeed] = useState(0.95);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Speak or type to translate instantly');
  const [copied, setCopied] = useState(false);

  const recognizerRef = useRef(null);
  const translateTimerRef = useRef(null);
  const recognitionSupported = isSpeechRecognitionSupported();
  const synthesisSupported = isSpeechSynthesisSupported();

  // Load voices whenever targetLang changes
  useEffect(() => {
    const voices = getAvailableVoicesForLanguage(targetLang);
    setAvailableVoices(voices);
    if (voices.length > 0 && !selectedVoiceURI) {
      setSelectedVoiceURI(voices[0].voiceURI);
    }
  }, [targetLang]);

  // Clean up speech and recognizer on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognizerRef.current) {
        try {
          recognizerRef.current.stop();
        } catch (e) {}
      }
      if (translateTimerRef.current) {
        clearTimeout(translateTimerRef.current);
      }
    };
  }, []);

  // Sync initial props
  useEffect(() => {
    if (initialSourceLang) setSourceLang(initialSourceLang === 'auto' ? 'en' : initialSourceLang);
    if (initialTargetLang && initialTargetLang !== initialSourceLang) {
      setTargetLang(initialTargetLang);
    }
  }, [initialSourceLang, initialTargetLang]);

  // Perform translation
  const triggerTranslation = useCallback(async (text, sLang, tLang, shouldSpeak = false) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setTranslatedText('');
      setStatusMessage('Speak or type to translate instantly');
      return;
    }

    setIsTranslating(true);
    setStatusMessage('Translating with GioTranslate AI...');

    try {
      const res = await quickTranslate(trimmed, tLang, sLang === 'auto' ? null : sLang);
      if (res && res.translatedText) {
        setTranslatedText(res.translatedText);
        if (res.sourceLanguage) {
          setDetectedSourceLang(res.sourceLanguage);
        }
        setStatusMessage('Translation ready! 🔊 Speaking aloud...');

        if (shouldSpeak || autoSpeak) {
          setTimeout(() => {
            handleSpeak(res.translatedText, tLang, 'target');
          }, 150);
        } else {
          setStatusMessage('Translation ready! Tap 🔊 to hear voice');
        }
      }
    } catch (err) {
      console.warn('Voice translation request error:', err);
      setStatusMessage('Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  }, [autoSpeak]);

  // Debounced translation as user types
  const handleInputChange = (val) => {
    setInputText(val);
    if (translateTimerRef.current) clearTimeout(translateTimerRef.current);
    if (!val.trim()) {
      setTranslatedText('');
      return;
    }
    translateTimerRef.current = setTimeout(() => {
      triggerTranslation(val, sourceLang, targetLang, false);
    }, 400);
  };

  // Start speech recognition
  const handleStartListening = () => {
    if (!recognitionSupported) {
      setStatusMessage('Speech recognition not supported in this browser. Please type text below.');
      return;
    }

    stopSpeaking();
    setIsPlayingAudio(false);
    setPlayingWhich(null);
    setIsListening(true);
    setStatusMessage('🎙️ Listening... speak now in ' + getLanguageInfo(sourceLang).name);

    try {
      const rec = createSpeechRecognizer(sourceLang);
      if (!rec) {
        setIsListening(false);
        setStatusMessage('Speech recognition could not be started. Type below.');
        return;
      }

      rec.onresult = (evt) => {
        let transcript = '';
        for (let i = 0; i < evt.results.length; i++) {
          transcript += evt.results[i][0].transcript + ' ';
        }
        const clean = transcript.trim();
        if (clean) {
          setInputText(clean);
          triggerTranslation(clean, sourceLang, targetLang, true);
        }
      };

      rec.onerror = (e) => {
        setIsListening(false);
        if (e.error !== 'no-speech') {
          console.warn('Speech recognition error:', e.error);
          setStatusMessage('Microphone stopped (' + (e.error || 'error') + '). Type below or tap mic again.');
        } else {
          setStatusMessage('No speech detected. Tap microphone and speak clearly.');
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
      recognizerRef.current = rec;
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
      setStatusMessage('Microphone access denied. Please grant mic permissions or type text below.');
    }
  };

  const handleStopListening = () => {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
    setStatusMessage('Finished listening.');
  };

  // Language Swap
  const handleSwapLanguages = () => {
    stopSpeaking();
    setIsPlayingAudio(false);
    setPlayingWhich(null);
    const newSource = targetLang;
    const newTarget = sourceLang === 'auto' ? 'en' : sourceLang;
    setSourceLang(newSource);
    setTargetLang(newTarget);
    setInputText(translatedText || '');
    setTranslatedText(inputText || '');
    if (translatedText.trim()) {
      triggerTranslation(translatedText, newSource, newTarget, false);
    }
  };

  // Speak text aloud
  const handleSpeak = (text, lang, which = 'target') => {
    if (!text || !text.trim()) return;

    if (isPlayingAudio && playingWhich === which) {
      stopSpeaking();
      setIsPlayingAudio(false);
      setPlayingWhich(null);
      return;
    }

    setIsPlayingAudio(true);
    setPlayingWhich(which);
    setStatusMessage(`🔊 Speaking in ${getLanguageInfo(lang).name}...`);

    speakText(
      text,
      lang,
      () => {
        setIsPlayingAudio(true);
        setPlayingWhich(which);
      },
      () => {
        setIsPlayingAudio(false);
        setPlayingWhich(null);
        setStatusMessage('Speech finished.');
      },
      (err) => {
        console.warn('Speech audio error:', err);
        setIsPlayingAudio(false);
        setPlayingWhich(null);
        setStatusMessage('Audio playback error.');
      },
      speechSpeed,
      which === 'target' ? selectedVoiceURI : null
    );
  };

  // Quick phrase select
  const handleSelectQuickPhrase = (phraseText) => {
    setInputText(phraseText);
    triggerTranslation(phraseText, sourceLang, targetLang, true);
  };

  // Copy translated text
  const handleCopy = () => {
    const textToCopy = translatedText || inputText;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Send to chat
  const handleSendToChat = () => {
    if (!translatedText.trim() && !inputText.trim()) return;
    if (onSendToChat) {
      onSendToChat(
        translatedText.trim() || inputText.trim(),
        inputText.trim(),
        sourceLang,
        targetLang
      );
      onClose();
    }
  };

  const sourceInfo = getLanguageInfo(sourceLang);
  const targetInfo = getLanguageInfo(targetLang);

  if (!isOpen) return null;

  const modalContent = (
    <div className="voice-trans-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="voice-trans-card" onClick={(e) => e.stopPropagation()}>
        {/* Prominent Always-Visible Top Close Button */}
        <button
          type="button"
          className="voice-trans-close-btn"
          onClick={onClose}
          aria-label="Close Voice Translator"
          title="Close Voice Translator"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* Header */}
        <div className="voice-trans-header">
          <div className="voice-trans-title-wrap">
            <span className="voice-trans-badge">
              <i className="fa-solid fa-microphone-lines"></i> Live Voice & Speech Translator
            </span>
            <h2 className="voice-trans-heading">Speak & Translate With Natural Voice</h2>
          </div>
        </div>

        {/* Language Selector Bar with Quick Swap */}
        <div className="voice-trans-lang-bar">
          <div className="voice-trans-lang-select-wrap">
            <span className="voice-trans-lang-label">I Speak (Source)</span>
            <div className="voice-trans-select-pill">
              <span className="voice-trans-flag">{sourceInfo.flag || '🌐'}</span>
              <select
                value={sourceLang}
                onChange={(e) => {
                  const newSource = e.target.value;
                  setSourceLang(newSource);
                  if (inputText.trim()) {
                    triggerTranslation(inputText, newSource, targetLang, false);
                  }
                }}
                className="voice-trans-select"
                aria-label="Spoken Language"
              >
                {WORLD_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name} ({l.nativeName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Button */}
          <button
            type="button"
            className="voice-trans-swap-btn"
            onClick={handleSwapLanguages}
            title="Swap Languages"
            aria-label="Swap source and target languages"
          >
            <i className="fa-solid fa-right-left"></i>
          </button>

          <div className="voice-trans-lang-select-wrap">
            <span className="voice-trans-lang-label">Translate & Hear (Target)</span>
            <div className="voice-trans-select-pill">
              <span className="voice-trans-flag">{targetInfo.flag || '🌐'}</span>
              <select
                value={targetLang}
                onChange={(e) => {
                  const newTarget = e.target.value;
                  setTargetLang(newTarget);
                  if (inputText.trim()) {
                    triggerTranslation(inputText, sourceLang, newTarget, false);
                  }
                }}
                className="voice-trans-select"
                aria-label="Target Translation Language"
              >
                {WORLD_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name} ({l.nativeName})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Live Mic Section & Status */}
        <div className="voice-trans-mic-section">
          <div className="voice-trans-mic-ring-container">
            {isListening && <div className="voice-trans-pulse-wave"></div>}
            {isListening && <div className="voice-trans-pulse-wave wave-delayed"></div>}
            <button
              type="button"
              className={`voice-trans-mic-button ${isListening ? 'listening' : ''}`}
              onClick={isListening ? handleStopListening : handleStartListening}
              title={isListening ? 'Tap to stop' : 'Tap to speak into microphone'}
              aria-label={isListening ? 'Stop listening' : 'Start voice recording'}
            >
              <i className={`fa-solid ${isListening ? 'fa-stop' : 'fa-microphone'}`}></i>
            </button>
          </div>

          <p className="voice-trans-status-msg">{statusMessage}</p>

          {/* Live audio waves when speaking or playing */}
          {(isListening || isPlayingAudio) && (
            <div className="voice-trans-wave-bars">
              {[6, 16, 26, 12, 30, 18, 10, 24, 32, 16, 22, 11, 28, 19, 8].map((h, i) => (
                <span
                  key={i}
                  className="voice-trans-wave-bar"
                  style={{
                    height: `${h}px`,
                    animationDelay: `${(i % 5) * 0.1}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Testing Phrase Chips */}
        <div className="voice-trans-quick-phrases">
          <span className="voice-trans-quick-label">Try quick phrases:</span>
          <div className="voice-trans-chips-scroll">
            {QUICK_PHRASES.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="voice-trans-chip"
                onClick={() => handleSelectQuickPhrase(chip.text)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dual Cards: Source Speech/Input & Target Translation */}
        <div className="voice-trans-cards-container">
          {/* 1. What You Say (Source) */}
          <div className="voice-trans-card-box source-box">
            <div className="voice-trans-card-header">
              <span className="voice-trans-card-title">
                {sourceInfo.flag} {sourceInfo.name} (Your Voice / Input)
              </span>
              {inputText.trim() && (
                <button
                  type="button"
                  className={`voice-trans-mini-btn ${isPlayingAudio && playingWhich === 'source' ? 'active-audio' : ''}`}
                  onClick={() => handleSpeak(inputText, sourceLang, 'source')}
                  title="Listen to original speech"
                >
                  <i className={`fa-solid ${isPlayingAudio && playingWhich === 'source' ? 'fa-volume-high fa-beat' : 'fa-volume-high'}`}></i>
                </button>
              )}
            </div>

            <textarea
              className="voice-trans-manual-input"
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Speak with microphone above, or type anything here to translate..."
              rows={3}
            />
          </div>

          {/* 2. Translation & Speech Playback (Target) */}
          <div className="voice-trans-card-box target-box">
            <div className="voice-trans-card-header">
              <span className="voice-trans-card-title">
                {targetInfo.flag} {targetInfo.name} (Translation)
              </span>
              {translatedText.trim() && (
                <div className="voice-trans-header-actions">
                  <button
                    type="button"
                    className="voice-trans-mini-btn"
                    onClick={handleCopy}
                    title="Copy translated text"
                  >
                    <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                  </button>
                </div>
              )}
            </div>

            <div className="voice-trans-text-display">
              {isTranslating ? (
                <div className="voice-trans-loading">
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Translating voice to {targetInfo.name}...</span>
                </div>
              ) : translatedText ? (
                <p className="voice-trans-translated-p">{translatedText}</p>
              ) : (
                <p className="voice-trans-placeholder">
                  Translated voice will appear here and speak aloud automatically...
                </p>
              )}
            </div>

            {/* Natural Voice Controls & Speak Aloud Button */}
            {translatedText && (
              <div className="voice-trans-listen-bar">
                <button
                  type="button"
                  className={`voice-trans-listen-btn ${isPlayingAudio && playingWhich === 'target' ? 'playing' : ''}`}
                  onClick={() => handleSpeak(translatedText, targetLang, 'target')}
                  title={isPlayingAudio && playingWhich === 'target' ? 'Pause audio' : 'Speak translation aloud'}
                >
                  <i className={`fa-solid ${isPlayingAudio && playingWhich === 'target' ? 'fa-volume-high fa-beat' : 'fa-volume-high'}`}></i>
                  <span>{isPlayingAudio && playingWhich === 'target' ? '🔊 Speaking...' : '🔊 Speak Translation Aloud'}</span>
                </button>

                {/* Speed Toggle */}
                <div className="voice-trans-speed-toggle">
                  <button
                    type="button"
                    className={`speed-btn ${speechSpeed === 0.95 ? 'active' : ''}`}
                    onClick={() => setSpeechSpeed(0.95)}
                    title="Natural speed"
                  >
                    1.0x
                  </button>
                  <button
                    type="button"
                    className={`speed-btn ${speechSpeed === 0.8 ? 'active' : ''}`}
                    onClick={() => setSpeechSpeed(0.8)}
                    title="Slow & clear - easy to understand"
                  >
                    0.8x Slow
                  </button>
                </div>
              </div>
            )}

            {/* Voice Quality Selector */}
            {availableVoices.length > 1 && (
              <div className="voice-trans-voice-picker-row">
                <span className="voice-picker-label">
                  <i className="fa-solid fa-headphones"></i> Voice:
                </span>
                <select
                  value={selectedVoiceURI}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  className="voice-picker-select"
                >
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} {v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('google') ? '✨ (Natural)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Footer Options */}
        <div className="voice-trans-footer">
          <label className="voice-trans-auto-speak-label" title="Automatically speak translation aloud">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(e) => setAutoSpeak(e.target.checked)}
            />
            <span>🔊 Auto-Speak Translation</span>
          </label>

          <div className="voice-trans-right-actions">
            <button
              type="button"
              className="voice-trans-footer-close-btn"
              onClick={onClose}
              title="Close Voice Translator"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark"></i>
              <span>Close</span>
            </button>

            {onSendToChat && (translatedText || inputText) && (
              <button
                type="button"
                className="voice-trans-send-chat-btn"
                onClick={handleSendToChat}
                title={friendName ? `Send translation to ${friendName}` : 'Send to chat'}
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>Send to Chat</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
