import { useState, useRef, useEffect, useCallback } from 'react';
import { parseMessageContent } from '../utils/messageContent';
import { resolveBackendUrl } from '../utils/apiBaseUrl';
import VoiceMessage from './VoiceMessage';
import MediaLightbox from './MediaLightbox';
import LanguagePickerModal from './LanguagePickerModal';
import PoloVideoViewer from './PoloVideoViewer';
import { useLanguage } from '../contexts/LanguageContext';
import { translateMessage } from '../api/conversationApi';
import { getLanguageInfo } from '../utils/languages';
import { speakText, stopSpeaking, isSpeaking } from '../utils/speechUtils';

function getLangFlag(code) {
  return getLanguageInfo(code).flag || '🌐';
}

function getLangName(code) {
  if (!code) return '';
  const info = getLanguageInfo(code);
  return info.name || code.toUpperCase();
}

function formatMessageTime(timestamp) {
  const value = Array.isArray(timestamp)
    ? new Date(
        timestamp[0],
        timestamp[1] - 1,
        timestamp[2],
        timestamp[3] ?? 0,
        timestamp[4] ?? 0,
        timestamp[5] ?? 0,
        Math.floor((timestamp[6] ?? 0) / 1000000),
      )
    : new Date(timestamp);

  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function resolveMediaUrl(parsed) {
  const src = parsed.mediaUrl || parsed.dataUrl;
  return resolveBackendUrl(src);
}

function getFileIcon(fileName, contentType) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  if (ext === 'pdf' || (contentType && contentType.includes('pdf'))) {
    return 'fa-file-pdf file-icon-pdf';
  }
  if (['doc', 'docx'].includes(ext) || (contentType && contentType.includes('word'))) {
    return 'fa-file-word file-icon-word';
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || (contentType && contentType.includes('sheet'))) {
    return 'fa-file-excel file-icon-excel';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || (contentType && contentType.includes('zip'))) {
    return 'fa-file-zipper file-icon-zip';
  }
  return 'fa-file-lines file-icon-generic';
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EXTENDED_REACTIONS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏',
  '🔥', '🎉', '✨', '👏', '💯', '🥰',
  '😎', '🥳', '🤝', '💪', '😍', '🤔',
  '👀', '🚀', '⭐', '💥', '🙌', '🤩'
];

export default function MessageBubble({
  message,
  currentUser,
  isMine,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onScrollToMessage
}) {
  const { t, language } = useLanguage();
  const [showFullImage, setShowFullImage] = useState(false);
  const [showPoloViewer, setShowPoloViewer] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [showReactionDetails, setShowReactionDetails] = useState(false);

  const menuRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const fullPickerRef = useRef(null);

  // 🌍 GioTranslate state
  const [translation, setTranslation] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(null);
  const [copiedTranslation, setCopiedTranslation] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [isSpeakingTranslation, setIsSpeakingTranslation] = useState(false);

  const isDeleted = Boolean(message.isDeleted);
  const isEdited = Boolean(message.isEdited);
  const time = formatMessageTime(message.timestamp);

  const isRead = message.status === 'READ' || Boolean(message.readAt) || Boolean(message.read) || Boolean(message.seen);
  const isDelivered = message.status === 'DELIVERED';

  const parsed = isDeleted ? { type: 'text', text: 'This message was deleted' } : parseMessageContent(message.content);
  const mediaSrc = resolveMediaUrl(parsed);

  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  const myReaction = reactions.find((r) => String(r.userId) === String(currentUser?.id));

  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
    }
    acc[r.emoji].count += 1;
    acc[r.emoji].users.push(r);
    return acc;
  }, {});
  const distinctReactions = Object.values(groupedReactions);
  const totalReactionsCount = reactions.length;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
      if (
        reactionPickerRef.current &&
        !reactionPickerRef.current.contains(e.target) &&
        (!fullPickerRef.current || !fullPickerRef.current.contains(e.target))
      ) {
        setShowReactionPicker(false);
        setShowFullEmojiPicker(false);
      }
    };
    if (showMenu || showReactionPicker || showFullEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu, showReactionPicker, showFullEmojiPicker]);

  const handleReact = (emoji) => {
    setShowReactionPicker(false);
    setShowFullEmojiPicker(false);
    onReact?.(message.id, emoji);
  };

  useEffect(() => {
    return () => {
      if (isSpeakingTranslation) {
        stopSpeaking();
      }
    };
  }, [isSpeakingTranslation]);

  const handleCopy = () => {
    if (parsed.text) {
      navigator.clipboard?.writeText(parsed.text);
    }
    setShowMenu(false);
  };

  const activeAppLang = language || 'en';
  const userPreferredLang = currentUser?.preferredLanguage || activeAppLang;
  const rawTranslatableText = parsed?.text || parsed?.transcript || '';

  const detectClientLang = (text) => {
    if (!text) return 'en';
    const s = text.trim().toLowerCase();
    if (s.includes('¿') || s.includes('¡') || s.includes('ñ') ||
        /\b(hola|cómo|como|estás|estas|bueno|buena|buenos|buenas|bien|días|noches|gracias|amigo|amiga|adiós|hoy|estoy|qué|que|si|sí|por favor|genial|hasta luego)\b/.test(s)) {
      return 'es';
    }
    if (s.includes('œ') || /\b(bonjour|merci|comment|ça va|salut|oui|non|au revoir|très)\b/.test(s)) {
      return 'fr';
    }
    if (s.includes('ß') || s.includes('ä') || s.includes('ö') || s.includes('ü') || /\b(hallo|danke|wie geht|guten|morgen|bitte|tschüss)\b/.test(s)) {
      return 'de';
    }
    if (s.includes('ɛ') || s.includes('ɔ') || /\b(wo ho te|ɛte sɛn|medaase|akwaaba|chale|mema wo|papa)\b/.test(s)) {
      return 'tw';
    }
    if (/\b(hello|hi|hey|good|morning|night|thank|thanks|how are you|great|yes|no|please|friend|doing|welcome)\b/.test(s)) {
      return 'en';
    }
    return 'auto';
  };

  const handleTranslate = useCallback(async (customTargetLang) => {
    let langToUse = (typeof customTargetLang === 'string' && customTargetLang.trim().length > 0 && !customTargetLang.includes('object'))
      ? customTargetLang.trim()
      : userPreferredLang;

    // Smart auto target: if text is already in the target language (e.g. English text and target is 'en'),
    // flip to Spanish 'es' (or the active UI language if not English)
    if (!customTargetLang) {
      const detected = detectClientLang(rawTranslatableText);
      if (detected !== 'auto' && detected === langToUse) {
        langToUse = (detected === 'en') ? (activeAppLang !== 'en' ? activeAppLang : 'es') : 'en';
      }
    }

    if (!message?.id || isTranslating) return;
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const res = await translateMessage(message.id, langToUse);
      if (res && res.translatedText) {
        setTranslation(res);
        setShowOriginal(false);
      } else {
        setTranslationError(t('translationFailed'));
      }
    } catch (err) {
      console.error('Translation error:', err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || t('translationFailed');
      setTranslationError(typeof errMsg === 'string' ? errMsg : t('translationFailed'));
    } finally {
      setIsTranslating(false);
      setShowLangPicker(false);
    }
  }, [message?.id, rawTranslatableText, isTranslating, userPreferredLang, activeAppLang, t]);

  // Auto-translate if user enabled autoTranslate in settings
  useEffect(() => {
    const isTranslatable = !isDeleted && ((parsed.type === 'text' && parsed.text?.trim()?.length > 0) || (parsed.type === 'audio' && parsed.transcript?.trim()?.length > 0));
    const isIncoming = !isMine;
    const shouldAuto = currentUser?.autoTranslate && isIncoming && isTranslatable && !translation && !isTranslating;

    if (shouldAuto) {
      handleTranslate();
    }
  }, [currentUser?.autoTranslate, isMine, isDeleted, parsed.type, parsed.text, parsed.transcript, translation, isTranslating, handleTranslate]);

  const isCorruptedText = (txt) => {
    if (!txt || typeof txt !== 'string') return true;
    return txt.includes('.webm') || txt.includes('.m4a') || txt.includes('.ogg') ||
           txt.includes('durationSec') || txt.includes('{"type"') || txt.includes('"mediaUrl"');
  };

  const validTranslation = translation && !isCorruptedText(translation.translatedText) ? translation : null;

  const handleCopyTranslation = () => {
    if (validTranslation?.translatedText) {
      navigator.clipboard?.writeText(validTranslation.translatedText);
      setCopiedTranslation(true);
      setTimeout(() => setCopiedTranslation(false), 2000);
    }
  };

  const handleToggleSpeak = (textToSpeak, langCode) => {
    if (isSpeakingTranslation) {
      stopSpeaking();
      setIsSpeakingTranslation(false);
    } else {
      if (!textToSpeak || isCorruptedText(textToSpeak)) return;
      const success = speakText(
        textToSpeak,
        langCode,
        () => setIsSpeakingTranslation(true),
        () => setIsSpeakingTranslation(false),
        () => setIsSpeakingTranslation(false)
      );
      if (!success) {
        setIsSpeakingTranslation(false);
      }
    }
  };

  const isDifferentLanguage = validTranslation && validTranslation.sourceLanguage && validTranslation.targetLanguage &&
    validTranslation.sourceLanguage.toLowerCase() !== validTranslation.targetLanguage.toLowerCase();

  const handleDoubleClick = () => {
    if (!isDeleted) {
      // Quick Like (toggle ❤️ or 👍)
      handleReact(myReaction?.emoji === '❤️' ? '👍' : '❤️');
    }
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={`message-row ${isMine ? 'mine' : 'theirs'} ${isDeleted ? 'deleted-row' : ''} ${distinctReactions.length > 0 ? 'has-reactions' : ''}`}
    >
      <div
        className={`message-bubble ${isMine ? 'mine' : 'theirs'} ${parsed.type === 'audio' ? 'audio-bubble' : ''} ${isDeleted ? 'deleted-bubble' : ''} ${distinctReactions.length > 0 ? 'has-reactions' : ''}`}
        onDoubleClick={handleDoubleClick}
        title={!isDeleted ? "Double-click to like ❤️" : undefined}
      >

        {/* Quoted Reply Preview */}
        {!isDeleted && (message.replyToId || message.replyToContent) && (
          <div
            className="reply-quote-preview"
            onClick={() => message.replyToId && onScrollToMessage?.(message.replyToId)}
            title="Click to jump to message"
          >
            <div className="reply-quote-sender">
              {message.replyToSenderName || 'Reply'}
            </div>
            <div className="reply-quote-text">
              {message.replyToContent || 'Original message'}
            </div>
          </div>
        )}

        {/* Action Menu (⋮) & Emoji React Button */}
        {!isDeleted && (
          <div className="message-actions-wrapper" ref={menuRef}>
            {/* Quick Smile Trigger */}
            <button
              type="button"
              className="message-react-trigger"
              onClick={() => {
                setShowReactionPicker((prev) => !prev);
                setShowFullEmojiPicker(false);
              }}
              title="React with emoji"
              aria-label="React with emoji"
            >
              <i className="fa-regular fa-face-smile"></i>
            </button>

            <button
              type="button"
              className="message-menu-trigger"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Message options"
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>

            {showMenu && (
              <div className="message-dropdown-menu">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    setShowReactionPicker(true);
                  }}
                >
                  <i className="fa-regular fa-face-smile"></i> React
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onReply?.(message);
                  }}
                >
                  <i className="fa-solid fa-reply"></i> Reply
                </button>

                {parsed.text && (
                  <button type="button" onClick={handleCopy}>
                    <i className="fa-regular fa-copy"></i> Copy
                  </button>
                )}

                {/* 🌍 GioTranslate Action in Menu */}
                {(parsed.type === 'text' || parsed.type === 'audio') && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      handleTranslate();
                    }}
                    disabled={isTranslating}
                  >
                    <i className="fa-solid fa-earth-americas"></i> {isTranslating ? t('translating') : `🌍 ${t('gioTranslate')}`}
                  </button>
                )}

                {isMine && parsed.type === 'text' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit?.(message);
                    }}
                  >
                    <i className="fa-solid fa-pen"></i> Edit
                  </button>
                )}

                {isMine && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete?.(message.id);
                    }}
                  >
                    <i className="fa-solid fa-trash-can"></i> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* WhatsApp-Style Floating Reaction Bar */}
        {showReactionPicker && !isDeleted && (
          <div className={`wa-reaction-bar ${isMine ? 'mine' : 'theirs'}`} ref={reactionPickerRef}>
            {QUICK_REACTIONS.map((emoji) => {
              const isSelected = myReaction?.emoji === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  className={`wa-reaction-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => handleReact(emoji)}
                  title={emoji}
                >
                  <span>{emoji}</span>
                </button>
              );
            })}
            <button
              type="button"
              className={`wa-reaction-btn wa-reaction-plus ${showFullEmojiPicker ? 'active' : ''}`}
              onClick={() => setShowFullEmojiPicker((prev) => !prev)}
              title="More reactions"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>
        )}

        {/* Extended Emoji Palette Popup */}
        {showFullEmojiPicker && !isDeleted && (
          <div className={`wa-extended-reaction-picker ${isMine ? 'mine' : 'theirs'}`} ref={fullPickerRef}>
            <div className="wa-extended-grid">
              {EXTENDED_REACTIONS.map((emoji) => {
                const isSelected = myReaction?.emoji === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`wa-ext-emoji-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => handleReact(emoji)}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Deleted Message State */}
        {isDeleted && (
          <div className="deleted-message-content">
            <i className="fa-solid fa-ban" style={{ marginRight: '6px', opacity: 0.7 }}></i>
            <em>This message was deleted</em>
          </div>
        )}

        {/* Text Message Content */}
        {!isDeleted && parsed.type === 'text' && (
          <>
            <div className="message-content">
              {validTranslation && !showOriginal ? validTranslation.translatedText : parsed.text}
            </div>

            {/* 🌍 GioTranslate Result Card at bottom */}
            {validTranslation && (
              <div className="message-translation-box">
                <div className="translation-header">
                  <div className="translation-langs-wrapper">
                    <button
                      type="button"
                      className="translation-langs"
                      onClick={() => setShowLangPicker(true)}
                      title="Click to translate into any language"
                    >
                      <span className="source-lang-tag">
                        {getLangFlag(validTranslation.sourceLanguage)} {getLangName(validTranslation.sourceLanguage)}
                      </span>
                      <i className="fa-solid fa-arrow-right lang-arrow"></i>
                      <span className="target-lang-tag">
                        {getLangFlag(validTranslation.targetLanguage)} {getLangName(validTranslation.targetLanguage)}
                      </span>
                      <i className="fa-solid fa-chevron-down lang-chevron"></i>
                    </button>

                    <LanguagePickerModal
                      isOpen={showLangPicker}
                      onClose={() => setShowLangPicker(false)}
                      currentLanguage={validTranslation.targetLanguage || userPreferredLang}
                      onSelectLanguage={(code) => handleTranslate(code)}
                      title={`🌍 ${t('gioTranslate') || 'TranTranslate'}`}
                      subtitle="Translate this message into any language"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* 🔊 Voice Audio Speak Button */}
                    <button
                      type="button"
                      className={`translation-speak-btn ${isSpeakingTranslation ? 'speaking' : ''}`}
                      onClick={() => handleToggleSpeak(
                        showOriginal ? parsed.text : validTranslation.translatedText,
                        showOriginal ? validTranslation.sourceLanguage : validTranslation.targetLanguage
                      )}
                      title={isSpeakingTranslation ? 'Stop voice' : `Listen in ${getLangName(showOriginal ? validTranslation.sourceLanguage : validTranslation.targetLanguage)}`}
                      aria-label="Listen translation aloud"
                    >
                      {isSpeakingTranslation ? (
                        <>
                          <i className="fa-solid fa-volume-high speaking-pulse"></i>
                          <span className="tts-wave-bars">
                            <span className="b1"></span>
                            <span className="b2"></span>
                            <span className="b3"></span>
                          </span>
                        </>
                      ) : (
                        <i className="fa-solid fa-volume-high"></i>
                      )}
                    </button>

                    <button
                      type="button"
                      className="translation-toggle-btn"
                      onClick={() => setShowOriginal(!showOriginal)}
                      title={showOriginal ? 'Show translation' : 'See original message'}
                    >
                      {showOriginal ? (
                        <>
                          <i className="fa-solid fa-language"></i> {t('showTranslation') || 'Translation'}
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-rotate-left"></i> {t('showOriginal') || 'Original'}
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="translation-copy-btn"
                      onClick={handleCopyTranslation}
                      title={copiedTranslation ? t('copiedTranslation') : t('copyTranslation')}
                    >
                      {copiedTranslation ? (
                        <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <i className="fa-solid fa-check"></i> Copied
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-regular fa-copy"></i>
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Subtext showing the other version */}
                <div className="translation-original-hint">
                  {showOriginal ? (
                    <span><strong style={{ color: '#fbbf24' }}>🌍 {getLangName(validTranslation.targetLanguage)}:</strong> {validTranslation.translatedText}</span>
                  ) : (
                    <span><strong>Original ({getLangName(validTranslation.sourceLanguage)}):</strong> {parsed.text}</span>
                  )}
                </div>
              </div>
            )}

            {/* Quick Translate Button if not yet translated */}
            {!validTranslation && !isMine && (
              <button
                type="button"
                className="quick-translate-trigger"
                onClick={() => handleTranslate()}
                disabled={isTranslating}
                title="Translate with TranTranslate"
              >
                <span>🌍</span>
                <span>{isTranslating ? t('translating') : t('translate')}</span>
              </button>
            )}

            {translationError && (
              <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> {translationError}
              </div>
            )}
          </>
        )}

        {/* Image Message */}
        {!isDeleted && parsed.type === 'image' && (
          <>
            <img
              className="message-image clickable-image"
              src={mediaSrc}
              alt={parsed.fileName || t('sharedPhoto')}
              onClick={() => setShowFullImage(true)}
              loading="lazy"
            />
            {showFullImage && (
              <MediaLightbox
                src={mediaSrc}
                fileName={parsed.fileName}
                senderName={isMine ? 'You' : message.senderName || message.senderUsername || 'Friend'}
                time={time}
                onClose={() => setShowFullImage(false)}
              />
            )}
          </>
        )}

        {/* 📹 Video Note / Polo Walkie-Talkie Message */}
        {!isDeleted && (parsed.type === 'video' || parsed.type === 'polo') && (
          <div className="polo-bubble-card" onClick={() => setShowPoloViewer(true)}>
            <div className="polo-bubble-preview-wrap">
              <video src={mediaSrc} className="polo-bubble-thumb" preload="metadata" />
              <div className="polo-bubble-play-overlay">
                <i className="fa-solid fa-play"></i>
              </div>
              {parsed.durationSec != null && (
                <span className="polo-bubble-duration">
                  {Math.floor(parsed.durationSec / 60)}:{(parsed.durationSec % 60) < 10 ? '0' : ''}{parsed.durationSec % 60}
                </span>
              )}
            </div>

            {parsed.transcript && (
              <div className="polo-bubble-transcript">
                <i className="fa-solid fa-closed-captioning"></i>
                <span>{parsed.transcript}</span>
              </div>
            )}

            {showPoloViewer && (
              <PoloVideoViewer
                isOpen={showPoloViewer}
                onClose={() => setShowPoloViewer(false)}
                videoMessage={{ ...message, content: parsed }}
                currentUser={currentUser}
                onReact={onReact}
              />
            )}
          </div>
        )}

        {/* File / Document Message */}
        {!isDeleted && parsed.type === 'file' && (
          <div className="document-message-card">
            <div className="document-card-icon">
              <i className={`fa-solid ${getFileIcon(parsed.fileName, parsed.contentType)}`}></i>
            </div>
            <div className="document-card-details">
              <span className="document-card-name" title={parsed.fileName}>
                {parsed.fileName || 'Attachment'}
              </span>
              {parsed.fileSize && (
                <span className="document-card-size">{parsed.fileSize}</span>
              )}
            </div>
            <a
              href={mediaSrc}
              target="_blank"
              rel="noreferrer"
              download={parsed.fileName || 'document'}
              className="document-download-btn"
              title="Download File"
            >
              <i className="fa-solid fa-arrow-down-to-bracket"></i>
            </a>
          </div>
        )}

        {/* Voice Message */}
        {!isDeleted && parsed.type === 'audio' && (
          <div className="voice-message-container">
            <VoiceMessage src={mediaSrc} durationSec={parsed.durationSec} isMine={isMine} />

            {/* Voice Translation Section */}
            {validTranslation ? (
              <div className="message-translation-box voice-translation-box">
                <div className="translation-header">
                  <div className="translation-langs-wrapper">
                    <button
                      type="button"
                      className="translation-langs"
                      onClick={() => setShowLangPicker(true)}
                      title="Click to translate voice note into any language"
                    >
                      <span className="source-lang-tag">
                        {getLangFlag(validTranslation.sourceLanguage)} {getLangName(validTranslation.sourceLanguage)}
                      </span>
                      <i className="fa-solid fa-arrow-right lang-arrow"></i>
                      <span className="target-lang-tag">
                        {getLangFlag(validTranslation.targetLanguage)} {getLangName(validTranslation.targetLanguage)}
                      </span>
                      <i className="fa-solid fa-chevron-down lang-chevron"></i>
                    </button>

                    <LanguagePickerModal
                      isOpen={showLangPicker}
                      onClose={() => setShowLangPicker(false)}
                      currentLanguage={validTranslation.targetLanguage || userPreferredLang}
                      onSelectLanguage={(code) => handleTranslate(code)}
                      title={`🎙️ Voice Translate`}
                      subtitle="Translate voice note into any language"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* 🔊 Play Voice Translation */}
                    <button
                      type="button"
                      className={`voice-listen-btn ${isSpeakingTranslation ? 'speaking' : ''}`}
                      onClick={() => handleToggleSpeak(
                        showOriginal ? (parsed.transcript || parsed.text) : validTranslation.translatedText,
                        showOriginal ? validTranslation.sourceLanguage : validTranslation.targetLanguage
                      )}
                      title={isSpeakingTranslation ? 'Stop voice' : `Listen voice in ${getLangName(showOriginal ? validTranslation.sourceLanguage : validTranslation.targetLanguage)}`}
                    >
                      <i className={`fa-solid ${isSpeakingTranslation ? 'fa-volume-high speaking-pulse' : 'fa-volume-high'}`}></i>
                      <span>{isSpeakingTranslation ? 'Playing Voice...' : 'Listen Voice'}</span>
                      {isSpeakingTranslation && (
                        <span className="tts-wave-bars">
                          <span className="b1"></span>
                          <span className="b2"></span>
                          <span className="b3"></span>
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      className="translation-toggle-btn"
                      onClick={() => setShowOriginal(!showOriginal)}
                    >
                      {showOriginal ? (
                        <>
                          <i className="fa-solid fa-language"></i> {t('showTranslation') || 'Translation'}
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-rotate-left"></i> {t('showOriginal') || 'Original'}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Voice Translation Body */}
                <div className="voice-translation-text">
                  <span className="voice-trans-badge">🎙️ {showOriginal ? 'Original Transcript' : 'Voice Translated'}:</span>
                  <p className="voice-trans-quote">
                    {showOriginal ? (parsed.transcript || parsed.text || 'Voice Message') : validTranslation.translatedText}
                  </p>
                </div>
              </div>
            ) : (
              /* Quick Voice Translate Trigger Button */
              !isMine && (
                <button
                  type="button"
                  className="quick-translate-trigger quick-voice-translate"
                  onClick={() => handleTranslate()}
                  disabled={isTranslating}
                  title="Translate voice message into your language"
                >
                  <i className="fa-solid fa-ear-listen" style={{ fontSize: '0.85rem' }}></i>
                  <span>{isTranslating ? t('translating') : '🌍 Translate Voice & Listen'}</span>
                </button>
              )
            )}

            {translationError && (
              <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> {translationError}
              </div>
            )}
          </div>
        )}

        {/* Call History Message */}
        {!isDeleted && parsed.type === 'call' && (
          <div className={`call-history ${parsed.status}`}>
            <i className={`fa-solid ${parsed.mediaType === 'video' ? 'fa-video' : 'fa-phone'}`}></i>
            <span>{t(parsed.mediaType === 'video' ? 'videoCall' : 'voiceCall')}</span>
            <small>{t(parsed.status === 'completed' ? 'callCompleted' : 'callMissed')}</small>
          </div>
        )}

        {/* Message Meta (Time, Edited label, Read Receipts) */}
        <div className="message-meta">
          {isEdited && !isDeleted && <span className="message-edited-badge">(edited)</span>}
          <span className="message-time">{time}</span>
          {isMine && !isDeleted && (
            <span
              className={`message-status ${isRead ? 'read' : isDelivered ? 'delivered' : 'sent'}`}
              title={isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'}
            >
              {isRead ? '✓✓' : isDelivered ? '✓✓' : '✓'}
            </span>
          )}
        </div>

        {/* WhatsApp & Telegram Style Bottom Reactions Bar */}
        {!isDeleted && distinctReactions.length > 0 && (
          <div className={`message-reactions-bottom-bar ${isMine ? 'mine' : 'theirs'}`}>
            {distinctReactions.map((grp) => {
              const didIReact = myReaction?.emoji === grp.emoji;
              return (
                <button
                  key={grp.emoji}
                  type="button"
                  className={`reaction-bottom-chip ${didIReact ? 'active-my-reaction' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReact(grp.emoji);
                  }}
                  title={didIReact ? `You reacted ${grp.emoji} (tap to remove)` : `React with ${grp.emoji}`}
                >
                  <span className="reaction-chip-emoji">{grp.emoji}</span>
                  {grp.count > 1 && <span className="reaction-chip-count">{grp.count}</span>}
                </button>
              );
            })}

            {/* Quick add reaction button on the bottom bar */}
            <button
              type="button"
              className="reaction-bottom-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowReactionPicker((prev) => !prev);
              }}
              title="Add reaction"
              aria-label="Add reaction"
            >
              <i className="fa-solid fa-plus"></i>
            </button>

            {/* Info / Details Button */}
            {totalReactionsCount > 1 && (
              <button
                type="button"
                className="reaction-bottom-info-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactionDetails(true);
                }}
                title="View all reactions"
              >
                <i className="fa-solid fa-users"></i>
              </button>
            )}
          </div>
        )}

        {/* Reaction Details Modal */}
        {showReactionDetails && (
          <div className="wa-reactions-modal-overlay" onClick={() => setShowReactionDetails(false)}>
            <div className="wa-reactions-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="wa-reactions-modal-header">
                <h4>Reactions ({totalReactionsCount})</h4>
                <button
                  type="button"
                  className="wa-modal-close-btn"
                  onClick={() => setShowReactionDetails(false)}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="wa-reactions-modal-list">
                {reactions.map((r, idx) => {
                  const isMe = String(r.userId) === String(currentUser?.id);
                  return (
                    <div key={`${r.userId}-${r.emoji}-${idx}`} className="wa-reaction-user-row">
                      <div className="wa-reaction-user-info">
                        <span className="wa-reaction-user-name">
                          {isMe ? 'You' : (r.username || `User #${r.userId}`)}
                        </span>
                        {isMe && <span className="wa-reaction-remove-hint">Tap emoji to remove</span>}
                      </div>
                      <button
                        type="button"
                        className={`wa-reaction-user-emoji ${isMe ? 'clickable-toggle' : ''}`}
                        onClick={() => {
                          if (isMe) {
                            handleReact(r.emoji);
                            setShowReactionDetails(false);
                          }
                        }}
                        title={isMe ? 'Remove reaction' : ''}
                      >
                        {r.emoji}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}