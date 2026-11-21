import React, { useState, useRef, useEffect } from 'react';
import { askAiQuestion } from '../api/aiApi.js';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import AiAssistantModal from './AiAssistantModal.jsx';
import FormattedAiText from './FormattedAiText.jsx';
import '../styles/aiAssistant.css';

export default function SidebarAiWidget() {
  const { language } = useLanguage();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "👋 **Hi! I'm GioAI**, your personal chat and language companion.\n\nAsk me anything, or tap a quick prompt below for instant replies, translations, and explanations!",
      model: 'GioAI Assistant',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [showFullModal, setShowFullModal] = useState(false);
  const chatScrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleAsk = async (promptToUse = question) => {
    const q = (typeof promptToUse === 'string' ? promptToUse : question)?.trim();
    if (!q || loading) return;

    const userMsgId = 'u-' + Date.now();
    const newHistory = [...messages, { id: userMsgId, role: 'user', text: q }];
    setMessages(newHistory);
    setQuestion('');
    setLoading(true);
    setError('');

    try {
      const res = await askAiQuestion(q, '', language || 'en', newHistory);
      if (res && res.answer) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'a-' + Date.now(),
            role: 'assistant',
            text: res.answer,
            model: res.model || 'GioAI',
          },
        ]);
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

  const handleCopy = (id, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        text: "👋 Chat reset! Ask me anything, or select a quick tool below to get started.",
        model: 'GioAI Assistant',
      },
    ]);
    setError('');
    setQuestion('');
  };

  const handleChipClick = (type) => {
    if (loading) return;

    if (type === 'reply') {
      const prompt = 'Suggest 3 friendly and natural ways to reply to a friend in chat';
      setQuestion(prompt);
      handleAsk(prompt);
    } else if (type === 'explain') {
      const template = 'Explain the phrase: "no cap" and how to use it';
      setQuestion(template);
      inputRef.current?.focus();
    } else if (type === 'culture') {
      const prompt = 'Give me 3 practical tips for polite cross-cultural conversation in chat';
      setQuestion(prompt);
      handleAsk(prompt);
    } else if (type === 'translate') {
      const template = 'How do you say "Thank you for being such a wonderful friend" naturally in Spanish?';
      setQuestion(template);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="sidebar-card ai-assistant-sidebar-widget">
      {/* Widget Header with Glowing AI Badge */}
      <div className="sidebar-ai-header">
        <div className="sidebar-ai-title-group">
          <div className="sidebar-ai-icon-circle">
            <i className="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <div>
            <div className="sidebar-ai-title">
              <span>GioAI Assistant</span>
              <span className="sidebar-ai-live-pill">
                <span className="sidebar-ai-pulse-dot"></span>
                Live
              </span>
            </div>
            <div className="sidebar-ai-subtitle">Get answers, explanations & translations</div>
          </div>
        </div>

        <div className="sidebar-ai-header-actions">
          {messages.length > 2 && (
            <button
              type="button"
              className="sidebar-ai-header-btn"
              onClick={handleClear}
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <i className="fa-solid fa-rotate-left"></i>
            </button>
          )}
          <button
            type="button"
            className="sidebar-ai-header-btn expand-btn"
            onClick={() => setShowFullModal(true)}
            title="Open Fullscreen AI Studio"
            aria-label="Open Fullscreen AI Studio"
          >
            <i className="fa-solid fa-up-right-and-down-left-from-center"></i>
          </button>
        </div>
      </div>

      {/* Interactive Conversation View */}
      <div className="sidebar-ai-chat-thread" ref={chatScrollRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`sidebar-ai-message-row ${
              m.role === 'user' ? 'sidebar-ai-user-row' : 'sidebar-ai-assistant-row'
            }`}
          >
            {m.role === 'assistant' && (
              <div className="sidebar-ai-msg-avatar" aria-hidden="true">
                <i className="fa-solid fa-brain"></i>
              </div>
            )}
            <div className={`sidebar-ai-bubble ${m.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
              {m.role === 'assistant' ? (
                <>
                  <div className="sidebar-ai-bubble-content">
                    <FormattedAiText text={m.text} />
                  </div>
                  <div className="sidebar-ai-bubble-footer">
                    <span className="sidebar-ai-model-tag">
                      <i className="fa-solid fa-sparkles"></i> {m.model || 'GioAI'}
                    </span>
                    <button
                      type="button"
                      className="sidebar-ai-copy-btn"
                      onClick={() => handleCopy(m.id, m.text)}
                      title="Copy to clipboard"
                    >
                      <i className={`fa-solid ${copiedId === m.id ? 'fa-check' : 'fa-copy'}`}></i>
                      <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="sidebar-ai-user-text">{m.text}</div>
              )}
            </div>
          </div>
        ))}

        {/* Thinking Indicator */}
        {loading && (
          <div className="sidebar-ai-message-row sidebar-ai-assistant-row">
            <div className="sidebar-ai-msg-avatar" aria-hidden="true">
              <i className="fa-solid fa-brain"></i>
            </div>
            <div className="sidebar-ai-bubble assistant-bubble sidebar-ai-typing-bubble">
              <div className="sidebar-ai-typing-dots">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
              <span className="sidebar-ai-typing-label">GioAI is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Smart Action Chips */}
      <div className="sidebar-ai-chips-wrap">
        <button
          type="button"
          className="sidebar-ai-chip"
          onClick={() => handleChipClick('reply')}
          disabled={loading}
          title="Get 3 instant friendly reply suggestions"
        >
          <span className="chip-icon">✍️</span> Friendly replies
        </button>
        <button
          type="button"
          className="sidebar-ai-chip"
          onClick={() => handleChipClick('explain')}
          disabled={loading}
          title="Deconstruct slang or phrases"
        >
          <span className="chip-icon">💡</span> Explain phrase
        </button>
        <button
          type="button"
          className="sidebar-ai-chip"
          onClick={() => handleChipClick('culture')}
          disabled={loading}
          title="Cross-cultural communication tips"
        >
          <span className="chip-icon">🌍</span> Cultural tips
        </button>
        <button
          type="button"
          className="sidebar-ai-chip"
          onClick={() => handleChipClick('translate')}
          disabled={loading}
          title="Translate phrases naturally"
        >
          <span className="chip-icon">🗣️</span> How to say...
        </button>
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
            placeholder="Ask GioAI anything..."
            disabled={loading}
          />
          <button
            type="submit"
            className="sidebar-ai-submit-btn"
            disabled={loading || !question.trim()}
            title="Send to GioAI"
            aria-label="Send to GioAI"
          >
            {loading ? (
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            ) : (
              <i className="fa-solid fa-arrow-up"></i>
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

      {/* Footer hint */}
      <div className="sidebar-ai-bottom-row">
        <span>Powered by GioAI Multi-Model Engine</span>
      </div>

      {/* Fullscreen AI Assistant Studio Modal */}
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
