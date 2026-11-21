import { useState, useEffect, useRef, useCallback } from 'react';
import { formatReelTimeRemaining, markReelAsWatched } from '../utils/reelsData';
import { resolveAvatarUrl, handleAvatarError } from '../utils/avatarUrl';
import { sendMessageRest, startConversation } from '../api/conversationApi';
import '../styles/reels.css';

export default function InstagramReelsViewer({
  isOpen,
  reels = [],
  initialReelIndex = 0,
  onClose,
  onToggleLike,
  onReelWatched,
}) {
  const [currentReelIndex, setCurrentReelIndex] = useState(initialReelIndex);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0); // 0 to 100 for current item
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);

  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const holdTimeoutRef = useRef(null);

  // Sync index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentReelIndex(initialReelIndex);
      setCurrentItemIndex(0);
      setProgress(0);
      setIsPaused(false);
      setReplySent(false);
    }
  }, [isOpen, initialReelIndex]);

  const currentReel = reels[currentReelIndex];

  // Mark current reel as watched as soon as viewed
  useEffect(() => {
    if (isOpen && currentReel?.id) {
      markReelAsWatched(currentReel.id);
      if (onReelWatched) {
        onReelWatched(currentReel.id);
      }
    }
  }, [isOpen, currentReelIndex, currentReel?.id, onReelWatched]);
  const items = currentReel?.items || [];
  const currentItem = items[currentItemIndex] || {};
  const isVideo = currentItem.type === 'video';

  // Duration for current item in milliseconds
  const currentDurationMs = isVideo
    ? (currentItem.duration || 10) * 1000
    : (currentItem.duration || 5) * 1000;

  // Next slide or next reel
  const handleNext = useCallback(() => {
    if (currentItemIndex < items.length - 1) {
      setCurrentItemIndex((prev) => prev + 1);
      setProgress(0);
    } else if (currentReelIndex < reels.length - 1) {
      setCurrentReelIndex((prev) => prev + 1);
      setCurrentItemIndex(0);
      setProgress(0);
    } else {
      // Reached the end of all reels
      onClose();
    }
  }, [currentItemIndex, items.length, currentReelIndex, reels.length, onClose]);

  // Previous slide or previous reel
  const handlePrev = useCallback(() => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex((prev) => prev - 1);
      setProgress(0);
    } else if (currentReelIndex > 0) {
      setCurrentReelIndex((prev) => prev - 1);
      const prevReelItems = reels[currentReelIndex - 1]?.items || [];
      setCurrentItemIndex(Math.max(0, prevReelItems.length - 1));
      setProgress(0);
    }
  }, [currentItemIndex, currentReelIndex, reels]);

  // Timer progression for images & fallback
  useEffect(() => {
    if (!isOpen || isPaused || isVideo) return;

    const intervalTime = 50; // update every 50ms
    const step = (intervalTime / currentDurationMs) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timerRef.current);
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timerRef.current);
  }, [isOpen, isPaused, isVideo, currentDurationMs, handleNext]);

  // Video progress tracking
  const handleVideoTimeUpdate = () => {
    if (videoRef.current && isVideo && !isPaused) {
      const v = videoRef.current;
      if (v.duration > 0) {
        const pct = (v.currentTime / v.duration) * 100;
        setProgress(pct);
        if (v.ended || pct >= 99.5) {
          handleNext();
        }
      }
    }
  };

  // Keyboard navigation & Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Touch & Hold to Pause
  const handleHoldStart = () => {
    holdTimeoutRef.current = setTimeout(() => {
      setIsPaused(true);
      if (videoRef.current) videoRef.current.pause();
    }, 150);
  };

  const handleHoldEnd = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (isPaused) {
      setIsPaused(false);
      if (videoRef.current) videoRef.current.play().catch(() => {});
    }
  };

  // Quick Emoji Reaction
  const handleSendEmoji = (emoji) => {
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 900);
    if (onToggleLike && !currentReel?.likedByMe) {
      onToggleLike(currentReel.id);
    }
  };

  // Send Direct Reply to Reel Creator
  const handleSendReply = async (e) => {
    e?.preventDefault();
    if (!replyText.trim() || !currentReel) return;

    try {
      const message = `Replied to your 5h Reel: "${replyText.trim()}"`;
      if (currentReel.userId && currentReel.userId !== 'me') {
        let convId = currentReel.userId;
        try {
          const conv = await startConversation(currentReel.userId);
          if (conv && conv.id) convId = conv.id;
        } catch {}
        await sendMessageRest(convId, message);
      }
      setReplySent(true);
      setReplyText('');
      setTimeout(() => setReplySent(false), 2500);
    } catch (err) {
      console.warn('Reply note sent locally:', err);
      setReplySent(true);
      setReplyText('');
      setTimeout(() => setReplySent(false), 2500);
    }
  };

  if (!isOpen || !currentReel) return null;

  const timeRemaining = formatReelTimeRemaining(currentReel.createdAt);
  const avatar = resolveAvatarUrl(currentReel.userAvatar, currentReel.displayName || currentReel.username);

  return (
    <div
      className="instagram-reels-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="instagram-reels-container"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleHoldStart}
        onMouseUp={handleHoldEnd}
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
      >
        {/* =========================================================================
            1. TOP SEGMENTED PROGRESS BARS
            ========================================================================= */}
        <div className="reels-progress-bar-container">
          {items.map((it, idx) => {
            let fillWidth = 0;
            if (idx < currentItemIndex) {
              fillWidth = 100;
            } else if (idx === currentItemIndex) {
              fillWidth = progress;
            } else {
              fillWidth = 0;
            }

            return (
              <div key={it.id || idx} className="reels-progress-segment">
                <div
                  className="reels-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(0, fillWidth))}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* =========================================================================
            2. TOP HEADER (Avatar, User, 5h Time Remaining, Mute, Close)
            ========================================================================= */}
        <div className="reels-header-bar">
          <div className="reels-user-meta">
            <img
              src={avatar}
              alt={currentReel.displayName || currentReel.username}
              className="reels-header-avatar"
              onError={(e) => handleAvatarError(e, currentReel.displayName || currentReel.username)}
            />
            <div className="reels-user-titles">
              <span className="reels-username">
                {currentReel.displayName || `@${currentReel.username}`}
              </span>
              <span className="reels-time-left-tag">
                <i className="fa-regular fa-clock" />
                <span>{timeRemaining}</span>
              </span>
            </div>
          </div>

          <div className="reels-controls-group">
            {isVideo && (
              <button
                type="button"
                className="reels-control-icon-btn"
                onClick={() => setIsMuted((prev) => !prev)}
                title={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                <i className={`fa-solid fa-volume-${isMuted ? 'xmark' : 'high'}`} />
              </button>
            )}

            <button
              type="button"
              className="reels-control-icon-btn"
              onClick={() => setIsPaused((prev) => !prev)}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              <i className={`fa-solid fa-${isPaused ? 'play' : 'pause'}`} />
            </button>

            <button
              type="button"
              className="reels-control-icon-btn"
              onClick={onClose}
              title="Close Reel"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            3. MEDIA VIEWPORT & TAP ZONES
            ========================================================================= */}
        <div className="reels-media-viewport">
          {isVideo ? (
            <video
              ref={videoRef}
              src={currentItem.url}
              className="reels-media-video"
              autoPlay
              playsInline
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
            />
          ) : (
            <img
              src={currentItem.url}
              alt={currentItem.caption || 'Reel media'}
              className="reels-media-image"
            />
          )}

          {/* Left / Right Tap zones */}
          <div
            className="reels-tap-zone reels-tap-left"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            title="Previous item"
          />
          <div
            className="reels-tap-zone reels-tap-right"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            title="Next item"
          />

          {/* Paused Indicator */}
          {isPaused && (
            <div className="reels-paused-badge">
              <i className="fa-solid fa-pause" />
            </div>
          )}

          {/* Heart Burst Animation */}
          {heartBurst && (
            <div className="reels-paused-badge" style={{ color: '#ef4444', animation: 'bounce 0.8s' }}>
              <i className="fa-solid fa-heart" />
            </div>
          )}
        </div>

        {/* =========================================================================
            4. BOTTOM BAR: CAPTION, LIKE & DIRECT REPLY
            ========================================================================= */}
        <div className="reels-bottom-bar">
          {/* Caption */}
          {(currentItem.caption || currentReel.caption) && (
            <div className="reels-caption-box">
              <strong>@{currentReel.username}</strong>
              <span>{currentItem.caption || currentReel.caption}</span>
            </div>
          )}

          {/* Quick Reaction Emojis */}
          <div className="reels-quick-emojis">
            {['❤️', '🔥', '👏', '😂', '😮', '⚽'].map((em) => (
              <button
                key={em}
                type="button"
                className="reel-emoji-btn"
                onClick={() => handleSendEmoji(em)}
              >
                {em}
              </button>
            ))}
          </div>

          {/* Reply Row & Heart Reaction */}
          <div className="reels-reply-row">
            <form onSubmit={handleSendReply} className="reels-reply-input-wrap">
              <input
                type="text"
                className="reels-reply-input"
                placeholder={replySent ? '✅ Reply sent to chat!' : `Send message to @${currentReel.username}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <button
                type="submit"
                className="reels-send-reply-btn"
                disabled={!replyText.trim()}
                title="Send reply"
              >
                <i className="fa-solid fa-paper-plane" />
              </button>
            </form>

            {/* Like Heart Button */}
            <button
              type="button"
              className={`reels-heart-btn ${currentReel.likedByMe ? 'is-liked' : ''}`}
              onClick={() => onToggleLike && onToggleLike(currentReel.id)}
              title="Like this reel"
            >
              <i className={`fa-${currentReel.likedByMe ? 'solid' : 'regular'} fa-heart`} />
              <span className="reels-heart-count">{currentReel.likes || 0}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
