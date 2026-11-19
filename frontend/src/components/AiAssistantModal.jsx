import React, { useState, useEffect, useRef } from 'react';
import { askAiQuestion } from '../api/aiApi.js';
import '../styles/aiAssistant.css';

export default function AiAssistantModal({
  isOpen,
  onClose,
  initialContext = '',
  chatPartnerName = 'your friend',
  preferredLanguage = 'en',
  onInsertIntoChat,
  onSendDirectly,
}) {
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState(initialContext);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [modelUsed, setModelUsed] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setContext(initialContext);
      setError('');
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen, initialContext]);

  if (!isOpen) return null;

  const handleAsk = async (promptToUse = question) => {
    const q = promptToUse?.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setAnswer(null);

    try {
      const res = await askAiQuestion(q, context, preferredLanguage);
      if (res && res.answer) {
        setAnswer(res.answer);
        setModelUsed(res.model || 'GioAI');
      } else {
        setError('No answer received from AI. Please try asking again.');
      }
    } catch (err) {
      console.error('Failed to get AI answer:', err);
      setError('Could not connect to AI service. Please check your connection and try again.');
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

  const handleInsert = () => {
    if (!answer) return;
    onInsertIntoChat?.(answer);
    onClose();
  };

  const handleSend = () => {
    if (!answer) return;
    onSendDirectly?.(answer);
    onClose();
  };

  const QUICK_PROMPTS = [
    {
      label: '✍️ Draft friendly reply',
      prompt: context ? `Suggest 3 friendly and natural ways to reply to: "${context}"` : `Suggest a friendly reply for a chat with ${chatPartnerName}`,
    },
    {
      label: '💡 Explain meaning',
      prompt: context ? `Explain the meaning, tone, and context of this phrase: "${context}"` : 'Explain common Spanish chat idioms and abbreviations',
    },
    {
      label: '🌍 Cultural tips',
      prompt: context ? `Are there any cultural nuances or etiquette to consider for: "${context}"?` : `Give me polite conversational tips for chatting across cultures with ${chatPartnerName}`,
    },
    {
      label: '🎓 How to say naturally',
      prompt: 'How can I say "I would love to help you with that" naturally in casual conversation?',
    },
  ];

  return (
    <div className="ai-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ai-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-modal-header">
          <div className="ai-modal-title-group">
            <div className="ai-modal-avatar">
              <i className="fa-solid fa-wand-magic-sparkles" />
            </div>
            <div>
              <div className="ai-modal-title">
                GioAI Assistant
                <span className="ai-modal-badge">Q&A · Live</span>
              </div>
              <div className="ai-modal-subtitle">
                Ask anything, draft replies, or understand messages with {chatPartnerName}
              </div>
            </div>
          </div>
          <button type="button" className="ai-modal-close" onClick={onClose} aria-label="Close AI Assistant">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="ai-modal-body">
          {/* Active Context Banner */}
          {context && (
            <div className="ai-context-banner">
              <div className="ai-context-content">
                <i className="fa-solid fa-quote-left" />
                <span>
                  <strong>Referencing message:</strong> "{context}"
                </span>
              </div>
              <button
                type="button"
                className="ai-context-clear"
                onClick={() => setContext('')}
                title="Clear referenced message"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          )}

          {/* Quick Preset Chips */}
          <div className="ai-prompt-chips">
            {QUICK_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="ai-chip-btn"
                onClick={() => {
                  setQuestion(item.prompt);
                  handleAsk(item.prompt);
                }}
                disabled={loading}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Question Input Box */}
          <div className="ai-input-wrapper">
            <textarea
              ref={inputRef}
              className="ai-textarea"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask AI anything (e.g. "What does this mean?", "Draft a polite reply to ${chatPartnerName}", "Translate to Spanish slang")...`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
            />
            <div className="ai-input-actions">
              <span className="ai-input-hint">
                <i className="fa-solid fa-globe" /> Responding in: <strong>{(preferredLanguage || 'en').toUpperCase()}</strong>
              </span>
              <button
                type="button"
                className="ai-submit-btn"
                onClick={() => handleAsk()}
                disabled={loading || !question.trim()}
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" /> Thinking...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane" /> Ask AI
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="ai-error-box">
              <i className="fa-solid fa-circle-exclamation" /> {error}
            </div>
          )}

          {/* AI Response Card */}
          {answer && (
            <div className="ai-answer-card">
              <div className="ai-answer-header">
                <div className="ai-answer-source">
                  <i className="fa-solid fa-brain" /> Answer by <strong>{modelUsed}</strong>
                </div>
                <button
                  type="button"
                  className="ai-answer-copy-btn"
                  onClick={handleCopy}
                  title="Copy to clipboard"
                >
                  <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
                  {copied ? ' Copied!' : ' Copy'}
                </button>
              </div>

              <div className="ai-answer-text">{answer}</div>

              {/* Action Buttons: Insert in Chat / Send as Message */}
              <div className="ai-answer-footer">
                {onInsertIntoChat && (
                  <button type="button" className="ai-action-btn secondary" onClick={handleInsert}>
                    <i className="fa-solid fa-pen-to-square" /> Insert in Chat
                  </button>
                )}
                {onSendDirectly && (
                  <button type="button" className="ai-action-btn primary" onClick={handleSend}>
                    <i className="fa-solid fa-paper-plane" /> Send to {chatPartnerName}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
