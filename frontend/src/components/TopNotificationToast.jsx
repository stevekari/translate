import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveBackendUrl } from '../utils/apiBaseUrl';

// Gentle audio chime synthesizer
function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.08); // A5
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // D6

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);

    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  } catch (_) {}
}

export default function TopNotificationToast() {
  const navigate = useNavigate();
  const [activeNotif, setActiveNotif] = useState(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleNotification = (e) => {
      const notif = e.detail;
      if (!notif) return;

      playNotificationChime();
      setIsLeaving(false);
      setActiveNotif(notif);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        dismissToast();
      }, 5500);
    };

    window.addEventListener('tranchat-notification', handleNotification);
    return () => {
      window.removeEventListener('tranchat-notification', handleNotification);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismissToast = () => {
    setIsLeaving(true);
    setTimeout(() => {
      setActiveNotif(null);
      setIsLeaving(false);
    }, 300);
  };

  if (!activeNotif) return null;

  const getBadgeInfo = () => {
    if (activeNotif.type === 'POST_LIKE') {
      return { icon: 'fa-solid fa-heart', label: 'Liked your post', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' };
    }
    if (activeNotif.type === 'COMMENT_LIKE') {
      return { icon: 'fa-solid fa-heart', label: 'Liked your comment', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.2)' };
    }
    if (activeNotif.type === 'POST_COMMENT') {
      return { icon: 'fa-solid fa-comment-dots', label: 'New comment', color: '#eab308', bg: 'rgba(234, 179, 8, 0.2)' };
    }
    return { icon: 'fa-solid fa-bell', label: 'Notification', color: '#eab308', bg: 'rgba(234, 179, 8, 0.2)' };
  };

  const badge = getBadgeInfo();

  const handleToastClick = () => {
    dismissToast();
    navigate('/home');
  };

  return (
    <div className={`top-notification-container ${isLeaving ? 'leaving' : 'entering'}`}>
      <div className="top-notification-card" onClick={handleToastClick}>
        {/* User Avatar with Action Icon Badge */}
        <div className="notif-avatar-wrapper">
          {activeNotif.senderAvatarUrl ? (
            <img src={resolveBackendUrl(activeNotif.senderAvatarUrl)} alt={activeNotif.senderName} />
          ) : (
            <div className="notif-avatar-placeholder">
              {(activeNotif.senderName || 'U')[0].toUpperCase()}
            </div>
          )}
          <span className="notif-badge-icon" style={{ backgroundColor: badge.color }}>
            <i className={badge.icon}></i>
          </span>
        </div>

        {/* Content Body */}
        <div className="notif-content-wrapper">
          <div className="notif-header-row">
            <span className="notif-sender-name">{activeNotif.senderName || activeNotif.senderUsername}</span>
            <span className="notif-badge-tag" style={{ color: badge.color, backgroundColor: badge.bg }}>
              {badge.label}
            </span>
          </div>
          <p className="notif-message-text">{activeNotif.message}</p>
          {activeNotif.snippet && (
            <p className="notif-snippet-text">"{activeNotif.snippet}"</p>
          )}
        </div>

        {/* Action Button & Close */}
        <div className="notif-actions-wrapper" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="notif-view-btn"
            onClick={handleToastClick}
            title="View in Feed"
          >
            <span>View</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
          <button
            type="button"
            className="notif-close-btn"
            onClick={dismissToast}
            title="Dismiss"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Progress bar */}
        <div className="notif-progress-bar"></div>
      </div>
    </div>
  );
}
