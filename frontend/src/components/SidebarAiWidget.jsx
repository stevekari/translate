import React, { useState, useRef } from 'react';
import { askAiQuestion } from '../api/aiApi.js';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import AiAssistantModal from './AiAssistantModal.jsx';

export default function SidebarAiWidget() {
  const { language } = useLanguage();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [modelUsed, setModelUsed] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const inputRef = useRef(null);

  const handleAsk = async (promptToUse = question) => {
    const q = promptToUse?.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setAnswer(null);

    try {
      const res = await askAiQuestion(q, '', language || 'en');
      if (res && res.answer) {
        setAnswer(res.answer);
        setModelUsed(res.model || 'GioAI');
      } else {
        setError('No answer received. Please try again.');
      }
    } catch (err) {
      console.error('Sidebar AI error:', err);
      setError('Could not connect to AI. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!answer) return;
    navigator.clipboard?.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const QUICK_PROMPTS = [
    '💡 Explain a phrase',
    '✍️ Friendly reply',
    '🌍 Cultural tips',
    '🎓 Language practice',
  ];

  return (
    <div className="sidebar-card ai-assistant-sidebar-widget">
      {/* Widget Header */}
      <div className="sidebar-ai-header">
        <div className="sidebar-ai-title-group">
          <div className="sidebar-ai-icon-circle">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <div>
            <div className="sidebar-ai-title">
              GioAI Assistant
              <span className="sidebar-ai-live-dot" title="Live Q&A ready"></span>
            </div>
            <div className="sidebar-ai-subtitle">Get answers, explanations & translations</div>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-ai-expand-btn"
          onClick={() => setShowFullModal(true)}
          title="Open Fullscreen AI Assistant"
          aria-label="Open Fullscreen AI Assistant"
        >
          <i className="fa-solid fa-up-right-and-down-left-from-center"></i>
        </button>
      </div>

      {/* Quick Prompt Chips */}
      <div className="sidebar-ai-chips-wrap">
        {QUICK_PROMPTS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            className="sidebar-ai-chip"
            onClick={() => {
              setQuestion(chip);
              handleAsk(chip);
            }}
            disabled={loading}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        className="sidebar-ai-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
      >
        <div className="sidebar-ai-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="sidebar-ai-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask AI anything..."
            disabled={loading}
          />
          <button
            type="submit"
            className="sidebar-ai-submit-btn"
            disabled={loading || !question.trim()}
            title="Ask AI"
            aria-label="Ask AI"
          >
            {loading ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : (
              <i className="fa-solid fa-arrow-right"></i>
            )}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="sidebar-ai-error">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Answer Box */}
      {answer && (
        <div className="sidebar-ai-answer-card">
          <div className="sidebar-ai-answer-header">
            <span className="sidebar-ai-model-tag">
              <i className="fa-solid fa-brain"></i> {modelUsed}
            </span>
            <button
              type="button"
              className="sidebar-ai-copy-btn"
              onClick={handleCopy}
              title="Copy answer"
            >
              <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="sidebar-ai-answer-text">{answer}</div>
          <div className="sidebar-ai-answer-footer">
            <button
              type="button"
              className="sidebar-ai-clear-btn"
              onClick={() => {
                setAnswer(null);
                setQuestion('');
              }}
            >
              Ask another question
            </button>
          </div>
        </div>
      )}

      {/* Footer hint */}
      <div className="sidebar-ai-bottom-row">
        <span>Powered by GioAI Cloud & Multi-Model Engine</span>
      </div>

      {/* Fullscreen AI Assistant Modal */}
      {showFullModal && (
        <AiAssistantModal
          isOpen={showFullModal}
          onClose={() => setShowFullModal(false)}
          preferredLanguage={language || 'en'}
        />
      )}
    </div>
  );
}
