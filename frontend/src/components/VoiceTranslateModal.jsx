import { useState, useEffect, useRef } from 'react';
import { WORLD_LANGUAGES, getLanguageInfo } from '../utils/languages';
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from '../utils/speechUtils';
import { quickTranslate } from '../api/conversationApi';
import '../styles/voiceTranslate.css';

export default function VoiceTranslateModal({
  isOpen = true,
  onClose,
  initialSourceLang = 'auto',
  initialTargetLang = 'en',
  onSendToChat,
  friendName,
}) {
  const [sourceLang, setSourceLang] = useState(initialSourceLang || 'auto');
  const [targetLang, setTargetLang] = useState(initialTargetLang || 'en');
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedSourceLang, setDetectedSourceLang] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState(0.95); // 0.95 = natural, 0.8 = slow
  const [statusMessage, setStatusMessage] = useState('Tap microphone to speak');
  const [copied, setCopied] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const recognizerRef = useRef(null);
  const recognitionSupported = isSpeechRecognitionSupported();
  const synthesisSupported = isSpeechSynthesisSupported();

  // Reset or stop on close
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognizerRef.current) {
        try {
          recognizerRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // Sync initial props
  useEffect(() => {
    if (initialSourceLang) setSourceLang(initialSourceLang);
    if (initialTargetLang && initialTargetLang !== initialSourceLang) {
      setTargetLang(initialTargetLang);
    }
  }, [initialSourceLang, initialTargetLang]);

  // Translate when spokenText changes
  useEffect(() => {
    const textToTranslate = spokenText.trim();
    if (!textToTranslate) {
      setTranslatedText('');
      return;
    }

    let isSubscribed = true;
    setIsTranslating(true);
    setStatusMessage('Translating with GioTranslate AI...');

    const timer = setTimeout(async () => {
      try {
        const res = await quickTranslate(textToTranslate, targetLang, sourceLang === 'auto' ? null : sourceLang);
        if (!isSubscribed) return;
        if (res && res.translatedText) {
          setTranslatedText(res.translatedText);
          if (res.sourceLanguage) {
            setDetectedSourceLang(res.sourceLanguage);
          }
          setStatusMessage('Translation ready! Tap 🔊 to listen');
        }
      } catch (err) {
        if (!isSubscribed) return;
        setStatusMessage('Translation failed. Please try again.');
      } finally {
        if (isSubscribed) setIsTranslating(false);
      }
    }, 350);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [spokenText, targetLang, sourceLang]);

  const handleStartListening = () => {
    if (!recognitionSupported) {
      setManualMode(true);
      setStatusMessage('Voice recognition not supported in this browser. Type your text below.');
      return;
    }

    stopSpeaking();
    setIsPlayingAudio(false);
    setSpokenText('');
    setInterimText('');
    setTranslatedText('');
    setDetectedSourceLang('');
    setIsListening(true);
    setStatusMessage('🎙️ Listening... Speak naturally in ' + getLanguageInfo(sourceLang).name);

    try {
      const rec = createSpeechRecognizer(sourceLang === 'auto' ? 'en' : sourceLang);
      if (!rec) {
        setIsListening(false);
        setManualMode(true);
        setStatusMessage('Speech recognition failed to initialize. You can type below.');
        return;
      }

      rec.onresult = (evt) => {
        let interim = '';
        let finalStr = '';
        for (let i = 0; i < evt.results.length; i++) {
          const trans = evt.results[i][0].transcript;
          if (evt.results[i].isFinal) {
            finalStr += trans + ' ';
          } else {
            interim += trans;
          }
        }
        if (finalStr.trim()) {
          setSpokenText((prev) => (prev ? prev + ' ' + finalStr.trim() : finalStr.trim()));
          setInterimText('');
        } else {
          setInterimText(interim);
        }
      };

      rec.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn('Speech recognition error:', e.error);
          setStatusMessage('Microphone stopped (' + (e.error || 'error') + '). Tap to try again.');
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        setStatusMessage('Finished listening. Processing translation...');
      };

      rec.start();
      recognizerRef.current = rec;
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
      setStatusMessage('Microphone access denied or unavailable.');
    }
  };

  const handleStopListening = () => {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  const handleSwapLanguages = () => {
    stopSpeaking();
    setIsPlayingAudio(false);
    const newSource = targetLang;
    const newTarget = sourceLang === 'auto' ? 'en' : sourceLang;
    setSourceLang(newSource);
    setTargetLang(newTarget);
    setSpokenText(translatedText || '');
    setTranslatedText(spokenText || '');
  };

  const handleListenAloud = (text, lang) => {
    if (!text || !text.trim()) return;

    if (isPlayingAudio) {
      stopSpeaking();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    speakText(
      text,
      lang,
      () => setIsPlayingAudio(true),
      () => setIsPlayingAudio(false),
      () => setIsPlayingAudio(false),
      speechSpeed
    );
  };

  const handleCopy = () => {
    const textToCopy = translatedText || spokenText;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSendToChat = () => {
    if (!translatedText.trim() && !spokenText.trim()) return;
    if (onSendToChat) {
      onSendToChat(
        translatedText.trim() || spokenText.trim(),
        spokenText.trim(),
        sourceLang,
        targetLang
      );
      onClose();
    }
  };

  const sourceInfo = getLanguageInfo(sourceLang);
  const targetInfo = getLanguageInfo(targetLang);

  return (
    <div className="voice-trans-backdrop" onClick={onClose}>
      <div className="voice-trans-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="voice-trans-header">
          <div className="voice-trans-title-wrap">
            <span className="voice-trans-badge">
              <i className="fa-solid fa-microphone-lines"></i> Live Voice Translator
            </span>
            <h2 className="voice-trans-heading">Speak & Understand Any Language</h2>
          </div>
          <button
            type="button"
            className="voice-trans-close-btn"
            onClick={onClose}
            aria-label="Close Voice Translator"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Language Selector Bar with Quick Swap */}
        <div className="voice-trans-lang-bar">
          <div className="voice-trans-lang-select-wrap">
            <span className="voice-trans-lang-label">I Speak</span>
            <div className="voice-trans-select-pill">
              <span className="voice-trans-flag">{sourceInfo.flag || '🌐'}</span>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="voice-trans-select"
                aria-label="Spoken Language"
              >
                <option value="auto">✨ Auto Detect</option>
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
            <span className="voice-trans-lang-label">Translate To</span>
            <div className="voice-trans-select-pill">
              <span className="voice-trans-flag">{targetInfo.flag || '🌐'}</span>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
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

        {/* Live Mic Animation & Central Control */}
        <div className="voice-trans-mic-section">
          <div className="voice-trans-mic-ring-container">
            {isListening && <div className="voice-trans-pulse-wave"></div>}
            {isListening && <div className="voice-trans-pulse-wave wave-delayed"></div>}
            <button
              type="button"
              className={`voice-trans-mic-button ${isListening ? 'listening' : ''}`}
              onClick={isListening ? handleStopListening : handleStartListening}
              title={isListening ? 'Tap to stop' : 'Tap to speak'}
              aria-label={isListening ? 'Stop listening' : 'Start voice translation'}
            >
              <i className={`fa-solid ${isListening ? 'fa-stop' : 'fa-microphone'}`}></i>
            </button>
          </div>

          <p className="voice-trans-status-msg">{statusMessage}</p>

          {/* Audio Waveform visualization during listening */}
          {isListening && (
            <div className="voice-trans-wave-bars">
              {[4, 12, 22, 10, 26, 15, 8, 20, 28, 14, 18, 9, 24, 16, 7].map((h, i) => (
                <span
                  key={i}
                  className="voice-trans-wave-bar"
                  style={{
                    height: `${h}px`,
                    animationDelay: `${(i % 5) * 0.12}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Speech & Translation Display Cards */}
        <div className="voice-trans-cards-container">
          {/* Card 1: What You Spoke */}
          <div className="voice-trans-card-box source-box">
            <div className="voice-trans-card-header">
              <span className="voice-trans-card-title">
                {sourceInfo.flag} You Spoke ({detectedSourceLang ? getLanguageInfo(detectedSourceLang).name : sourceInfo.name})
              </span>
              {spokenText && (
                <button
                  type="button"
                  className="voice-trans-mini-btn"
                  onClick={() => handleListenAloud(spokenText, sourceLang === 'auto' ? detectedSourceLang || 'en' : sourceLang)}
                  title="Listen to original speech"
                >
                  <i className="fa-solid fa-volume-high"></i>
                </button>
              )}
            </div>

            {manualMode ? (
              <textarea
                className="voice-trans-manual-input"
                value={spokenText}
                onChange={(e) => setSpokenText(e.target.value)}
                placeholder="Type anything to speak and translate..."
                rows={3}
              />
            ) : (
              <div className="voice-trans-text-display">
                {spokenText || interimText ? (
                  <p className="voice-trans-speech-p">
                    {spokenText}
                    {interimText && <span className="voice-trans-interim">{interimText}</span>}
                  </p>
                ) : (
                  <p className="voice-trans-placeholder">
                    {isListening ? 'Listening to your voice...' : 'Tap the microphone above and start speaking...'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Translated Result */}
          <div className="voice-trans-card-box target-box">
            <div className="voice-trans-card-header">
              <span className="voice-trans-card-title">
                {targetInfo.flag} Translated into {targetInfo.name}
              </span>
              {translatedText && (
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
                  <span>Translating voice...</span>
                </div>
              ) : translatedText ? (
                <p className="voice-trans-translated-p">{translatedText}</p>
              ) : (
                <p className="voice-trans-placeholder">
                  Translation will appear here in real time...
                </p>
              )}
            </div>

            {/* Listen & Understand Controls */}
            {translatedText && (
              <div className="voice-trans-listen-bar">
                <button
                  type="button"
                  className={`voice-trans-listen-btn ${isPlayingAudio ? 'playing' : ''}`}
                  onClick={() => handleListenAloud(translatedText, targetLang)}
                  title={isPlayingAudio ? 'Stop audio' : 'Listen voice aloud'}
                >
                  <i className={`fa-solid ${isPlayingAudio ? 'fa-pause' : 'fa-volume-high'}`}></i>
                  <span>{isPlayingAudio ? 'Listening...' : '🔊 Listen & Understand'}</span>
                </button>

                {/* Speed toggle for learning */}
                <div className="voice-trans-speed-toggle">
                  <button
                    type="button"
                    className={`speed-btn ${speechSpeed === 0.95 ? 'active' : ''}`}
                    onClick={() => setSpeechSpeed(0.95)}
                    title="Natural voice speed"
                  >
                    1.0x
                  </button>
                  <button
                    type="button"
                    className={`speed-btn ${speechSpeed === 0.8 ? 'active' : ''}`}
                    onClick={() => setSpeechSpeed(0.8)}
                    title="Slow speed - helps you understand each word clearly"
                  >
                    0.8x Slow
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="voice-trans-footer">
          <button
            type="button"
            className="voice-trans-mode-toggle"
            onClick={() => setManualMode(!manualMode)}
          >
            <i className={`fa-solid ${manualMode ? 'fa-microphone' : 'fa-keyboard'}`}></i>
            <span>{manualMode ? 'Switch to Voice Mic' : 'Type Text Instead'}</span>
          </button>

          <div className="voice-trans-right-actions">
            {onSendToChat && (translatedText || spokenText) && (
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
}
