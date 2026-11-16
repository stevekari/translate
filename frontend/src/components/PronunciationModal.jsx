import { useState, useEffect } from 'react';
import {
  speakText,
  listenForPronunciation,
  isSpeechRecognitionSupported,
} from '../utils/pronunciationService';

export default function PronunciationModal({ text, lang = 'en', onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.85);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState(null);
  const [recognizerRef, setRecognizerRef] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const hasRecognizer = isSpeechRecognitionSupported();

  const handlePlay = (rate = speechRate) => {
    setIsPlaying(true);
    speakText(text, lang, rate);
    setTimeout(() => setIsPlaying(false), Math.max(1500, text.length * 100));
  };

  const handleStartPractice = () => {
    setErrorMsg('');
    setTranscript('');
    setResult(null);
    setIsListening(true);

    const rec = listenForPronunciation({
      targetText: text,
      lang,
      onResult: (res) => {
        setTranscript(res.transcript);
        if (res.isFinal || res.score >= 80) {
          setResult(res);
          setIsListening(false);
        }
      },
      onError: (err) => {
        setErrorMsg(err);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    setRecognizerRef(rec);
  };

  const handleStopPractice = () => {
    if (recognizerRef) {
      try {
        recognizerRef.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  useEffect(() => {
    // Play automatically once on modal open to set phonetic benchmark
    handlePlay(0.9);
    return () => {
      if (recognizerRef) {
        try {
          recognizerRef.stop();
        } catch (e) {}
      }
    };
  }, []);

  return (
    <div className="unique-modal-backdrop" onClick={onClose}>
      <div className="unique-modal-card pronunciation-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="unique-modal-header">
          <div className="unique-modal-title-row">
            <span className="unique-icon-badge coach-badge">
              <i className="fa-solid fa-graduation-cap" />
            </span>
            <div>
              <h2 className="unique-modal-title">Pronunciation Coach</h2>
              <p className="unique-modal-sub">Listen, repeat, and master native accent ({lang.toUpperCase()})</p>
            </div>
          </div>
          <button type="button" className="unique-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Target Phrase Display */}
        <div className="coach-target-box">
          <span className="coach-target-label">Practice Phrase:</span>
          <p className="coach-target-text">"{text}"</p>
          <div className="coach-audio-controls">
            <button
              type="button"
              className={`coach-listen-btn ${isPlaying ? 'playing' : ''}`}
              onClick={() => handlePlay(speechRate)}
            >
              <i className={`fa-solid ${isPlaying ? 'fa-volume-high' : 'fa-play'}`} />
              <span>{isPlaying ? 'Playing Native Audio...' : 'Listen to Native Audio'}</span>
            </button>
            <div className="coach-speed-pills">
              <button
                type="button"
                className={`coach-speed-pill ${speechRate === 0.75 ? 'active' : ''}`}
                onClick={() => {
                  setSpeechRate(0.75);
                  handlePlay(0.75);
                }}
              >
                0.75x Slow
              </button>
              <button
                type="button"
                className={`coach-speed-pill ${speechRate === 1.0 ? 'active' : ''}`}
                onClick={() => {
                  setSpeechRate(1.0);
                  handlePlay(1.0);
                }}
              >
                1.0x Normal
              </button>
            </div>
          </div>
        </div>

        {/* Practice & Feedback Section */}
        <div className="coach-practice-section">
          {!hasRecognizer && (
            <p className="coach-unsupported-note">
              Microphone pronunciation recognition is optimized for Chrome and Safari. You can still listen and practice aloud!
            </p>
          )}

          {hasRecognizer && (
            <>
              <div className="coach-mic-container">
                <button
                  type="button"
                  className={`coach-mic-btn ${isListening ? 'listening' : ''}`}
                  onClick={isListening ? handleStopPractice : handleStartPractice}
                >
                  <i className={`fa-solid ${isListening ? 'fa-stop' : 'fa-microphone'}`} />
                  {isListening && <span className="coach-mic-pulse" />}
                </button>
                <span className="coach-mic-hint">
                  {isListening ? 'Listening... Speak clearly into your mic!' : 'Tap mic and speak phrase'}
                </span>
              </div>

              {transcript && (
                <div className="coach-transcript-box">
                  <span className="coach-transcript-label">We heard:</span>
                  <p className="coach-transcript-text">"{transcript}"</p>
                </div>
              )}

              {result && (
                <div className="coach-result-gauge">
                  <div className="gauge-score-row">
                    <span className="gauge-score-number" style={{ color: result.grade.color }}>
                      {result.score}%
                    </span>
                    <span className="gauge-score-label" style={{ color: result.grade.color }}>
                      {result.grade.label}
                    </span>
                  </div>
                  <div className="gauge-bar-track">
                    <div
                      className="gauge-bar-fill"
                      style={{
                        width: `${result.score}%`,
                        backgroundColor: result.grade.color,
                      }}
                    />
                  </div>
                </div>
              )}

              {errorMsg && <p className="coach-error-text">{errorMsg}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
