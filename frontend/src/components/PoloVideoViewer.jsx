import { useState, useRef, useEffect } from 'react';
import { resolveBackendUrl } from '../utils/apiBaseUrl';
import { translateMessage } from '../api/conversationApi';
import { useLanguage } from '../contexts/LanguageContext';

const FLOATING_REACTION_EMOJIS = ['❤️', '🙏', '😂', '👍', '🎉', '🔥'];

export default function PoloVideoViewer({
  isOpen,
  onClose,
  videoMessage,
  allVideoMessages = [],
  onSelectVideo,
  currentUser,
  onReact,
}) {
  const { t, language } = useLanguage();
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showCaptions, setShowCaptions] = useState(true);
  const [translatedTranscript, setTranslatedTranscript] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [floatingParticles, setFloatingParticles] = useState([]);

  const parsed = videoMessage ? (typeof videoMessage.content === 'object' ? videoMessage.content : null) : null;
  const rawTranscript = parsed?.transcript || videoMessage?.transcript || '';
  const mediaUrl = resolveBackendUrl(parsed?.mediaUrl || videoMessage?.mediaUrl || parsed?.dataUrl);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [isOpen, videoMessage, playbackSpeed]);

  // Auto translate video transcript if language is set
  useEffect(() => {
    if (videoMessage?.id && rawTranscript && showCaptions) {
      const targetLang = currentUser?.preferredLanguage || language || 'en';
      setIsTranslating(true);
      translateMessage(videoMessage.id, targetLang)
        .then((res) => {
          if (res && res.translatedText) {
            setTranslatedTranscript(res);
          }
        })
        .catch(() => {})
        .finally(() => setIsTranslating(false));
    }
  }, [videoMessage?.id, rawTranscript, currentUser?.preferredLanguage, language, showCaptions]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleSeek = (e) => {
    const seekTo = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  // Trigger floating animated reaction hearts/emojis (Marco Polo style)
  const spawnReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const xPos = Math.floor(Math.random() * 60) + 20; // 20% to 80% horizontal
    const particle = { id, emoji, xPos };
    setFloatingParticles((prev) => [...prev, particle]);

    // Send WebSocket reaction
    if (videoMessage?.id && onReact) {
      onReact(videoMessage.id, emoji);
    }

    setTimeout(() => {
      setFloatingParticles((prev) => prev.filter((p) => p.id !== id));
    }, 2000);
  };

  if (!isOpen || !videoMessage) return null;

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const senderName = videoMessage.senderName || videoMessage.senderUsername || 'Friend';
  const displaySubtitle = translatedTranscript?.translatedText || rawTranscript;

  return (
    <div className="polo-viewer-overlay">
      <div className="polo-viewer-container">
        {/* Top Header */}
        <div className="polo-viewer-header">
          <button type="button" className="polo-viewer-btn" onClick={onClose} title="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="polo-viewer-user-info">
            <h4>{senderName}</h4>
            <span className="polo-viewer-time">
              {new Date(videoMessage.timestamp || videoMessage.createdAt || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <div className="polo-viewer-header-actions">
            <button
              type="button"
              className={`polo-viewer-btn ${showCaptions ? 'active-captions' : ''}`}
              onClick={() => setShowCaptions((prev) => !prev)}
              title="Toggle Live Subtitles [CC]"
            >
              <i className="fa-solid fa-closed-captioning"></i>
            </button>
          </div>
        </div>

        {/* Video Stage with Floating Reaction Particles */}
        <div className="polo-video-stage" onClick={togglePlay}>
          <video
            ref={videoRef}
            src={mediaUrl}
            playsInline
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            className="polo-main-video"
          />

          {!isPlaying && (
            <div className="polo-play-pause-overlay">
              <i className="fa-solid fa-play"></i>
            </div>
          )}

          {/* Floating Live Reaction Particles (Animated emojis floating up) */}
          <div className="polo-floating-particles-layer">
            {floatingParticles.map((p) => (
              <div
                key={p.id}
                className="polo-floating-particle"
                style={{ left: `${p.xPos}%` }}
              >
                {p.emoji}
              </div>
            ))}
          </div>

          {/* Live Closed Captions / Subtitle Bar */}
          {showCaptions && displaySubtitle && (
            <div className="polo-captions-box">
              {isTranslating ? (
                <span className="captions-translating">Translating subtitles...</span>
              ) : (
                <p className="captions-text">
                  {translatedTranscript?.targetLanguage && (
                    <span className="captions-lang-badge">🌍 {translatedTranscript.targetLanguage.toUpperCase()}: </span>
                  )}
                  {displaySubtitle}
                </p>
              )}
            </div>
          )}

          {/* Right-Side Floating Emoji Rail (Marco Polo Style) */}
          <div className="polo-emoji-rail" onClick={(e) => e.stopPropagation()}>
            {FLOATING_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="polo-rail-emoji-btn"
                onClick={() => spawnReaction(emoji)}
                title={`React with ${emoji}`}
              >
                <span>{emoji}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Video Timeline & Controls */}
        <div className="polo-viewer-bottom-bar">
          {/* Progress Bar & Speed Switcher */}
          <div className="polo-progress-row">
            <button type="button" className="polo-speed-badge-btn" onClick={cycleSpeed} title="Playback Speed">
              {playbackSpeed}x
            </button>

            <span className="polo-timer-text">{formatTime(currentTime)}</span>

            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="polo-seeker-slider"
            />

            <span className="polo-timer-text">{formatTime(duration)}</span>
          </div>

          {/* Bottom Story Carousel / Timeline Strips */}
          {allVideoMessages.length > 1 && (
            <div className="polo-timeline-carousel">
              {allVideoMessages.map((msg, idx) => {
                const isActive = msg.id === videoMessage.id;
                const msgParsed = typeof msg.content === 'object' ? msg.content : {};
                const name = msg.senderName || msg.senderUsername || `Video #${idx + 1}`;
                return (
                  <div
                    key={msg.id || idx}
                    className={`polo-carousel-card ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectVideo?.(msg)}
                  >
                    <div className="polo-carousel-thumb-wrap">
                      <i className={`fa-solid ${isActive ? 'fa-play' : 'fa-video'}`}></i>
                    </div>
                    <span className="polo-carousel-label">{name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
