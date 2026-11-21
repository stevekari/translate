import React, { useState, useEffect, useRef } from 'react';
import { askAiQuestion } from '../api/aiApi.js';
import FormattedAiText from './FormattedAiText.jsx';
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
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const chatScrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setContext(initialContext || '');
      setError('');

      // Initialize conversation
      const welcomeText = initialContext
        ? `👋 **Hi! I see you are referencing this message from ${chatPartnerName}:**\n> "${initialContext}"\n\nI can help you draft natural replies, explain any slang or idioms, or check cultural nuances. What would you like to do?`
        : `👋 **Hi! I'm GioAI**, your personal multicultural chat assistant.\n\nAsk me anything, draft messages for **${chatPartnerName}**, or ask for translations and cultural guidance!`;

      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: welcomeText,
          model: 'GioAI Assistant',
        },
      ]);

      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, initialContext, chatPartnerName]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  if (!isOpen) return null;

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
      const res = await askAiQuestion(q, context, preferredLanguage, newHistory);
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
        setError('No answer received from AI. Please try asking again.');
      }
    } catch (err) {
      console.error('Failed to get AI answer:', err);
      setError('Could not connect to AI service. Please check your connection and try again.');
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

  const handleInsert = (text) => {
    if (!text) return;
    // Extract primary response if there are numbered points or use full text
    onInsertIntoChat?.(text);
    onClose();
  };

  const handleSend = (text) => {
    if (!text) return;
    onSendDirectly?.(text);
    onClose();
  };

  const QUICK_PROMPTS = [
    {
      label: '✍️ Draft friendly reply',
      prompt: context
        ? `Suggest 3 friendly and natural ways to reply to: "${context}"`
        : `Suggest 3 friendly reply options for a chat with ${chatPartnerName}`,
    },
    {
      label: '💡 Explain meaning & tone',
      prompt: context
        ? `Explain the meaning, tone, and cultural nuance of this message: "${context}"`
        : 'Explain common chat idioms and slang used in casual messaging',
    },
    {
      label: '🌍 Cultural etiquette',
      prompt: context
        ? `Are there any cultural nuances or polite etiquette to consider for: "${context}"?`
        : `Give me polite conversational tips for chatting with friends across different cultures`,
    },
    {
      label: '🗣️ Express naturally',
      prompt: 'How can I say "I really appreciate your help and hope you have a great day" naturally in casual conversation?',
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
                GioAI Studio
                <span className="ai-modal-badge">
                  <span className="ai-modal-pulse-dot" /> Live Multi-Model
                </span>
              </div>
              <div className="ai-modal-subtitle">
                {chatPartnerName ? `Assisting your chat with ${chatPartnerName}` : 'Answers, explanations & translations'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="ai-modal-close"
            onClick={onClose}
            aria-label="Close AI Assistant"
            title="Close"
          >
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

          {/* Chat Thread Container */}
          <div className="ai-modal-messages-container" ref={chatScrollRef}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`ai-message-row ${
                  m.role === 'user' ? 'ai-user-row' : 'ai-assistant-row'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="ai-msg-avatar" aria-hidden="true">
                    <i className="fa-solid fa-brain" />
                  </div>
                )}
                <div className={`ai-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
                  {m.role === 'assistant' ? (
                    <>
                      <div className="ai-bubble-body">
                        <FormattedAiText text={m.text} />
                      </div>
                      <div className="ai-bubble-toolbar">
                        <span className="ai-source-tag">
                          <i className="fa-solid fa-sparkles" /> {m.model || 'GioAI'}
                        </span>
                        <div className="ai-toolbar-actions">
                          <button
                            type="button"
                            className="ai-tool-btn"
                            onClick={() => handleCopy(m.id, m.text)}
                            title="Copy to clipboard"
                          >
                            <i className={`fa-solid ${copiedId === m.id ? 'fa-check' : 'fa-copy'}`} />
                            <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                          </button>
                          {onInsertIntoChat && (
                            <button
                              type="button"
                              className="ai-tool-btn insert-btn"
                              onClick={() => handleInsert(m.text)}
                              title="Insert text into message input"
                            >
                              <i className="fa-solid fa-arrow-down-to-bracket" />
                              <span>Insert</span>
                            </button>
                          )}
                          {onSendDirectly && (
                            <button
                              type="button"
                              className="ai-tool-btn send-btn"
                              onClick={() => handleSend(m.text)}
                              title="Send directly to chat"
                            >
                              <i className="fa-solid fa-paper-plane" />
                              <span>Send</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="ai-user-bubble-text">{m.text}</div>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking Indicator */}
            {loading && (
              <div className="ai-message-row ai-assistant-row">
                <div className="ai-msg-avatar" aria-hidden="true">
                  <i className="fa-solid fa-brain" />
                </div>
                <div className="ai-bubble assistant ai-typing-bubble">
                  <div className="ai-typing-dots">
                    <span className="ai-typing-dot" />
                    <span className="ai-typing-dot" />
                    <span className="ai-typing-dot" />
                  </div>
                  <span className="ai-typing-text">GioAI is generating response...</span>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="ai-error-box">
              <i className="fa-solid fa-circle-exclamation" /> {error}
            </div>
          )}

          {/* Question Input Box */}
          <div className="ai-input-wrapper">
            <textarea
              ref={textareaRef}
              className="ai-textarea"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask GioAI anything (e.g. "Draft a warm reply", "What does 'bet' mean?", "Translate to Spanish")...`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
            />
            <div className="ai-input-actions">
              <span className="ai-input-hint">
                <i className="fa-solid fa-globe" /> Language: <strong>{(preferredLanguage || 'en').toUpperCase()}</strong>
              </span>
              <button
                type="button"
                className="ai-submit-btn"
                onClick={() => handleAsk()}
                disabled={loading || !question.trim()}
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin" /> Thinking...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-arrow-up" /> Ask AI
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
