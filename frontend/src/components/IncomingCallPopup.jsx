import { useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { callSounds } from '../utils/callSounds';
import { resolveAvatarUrl, handleAvatarError, getInitials } from '../utils/avatarUrl';

export default function IncomingCallPopup({ call, onAccept, onDecline }) {
  const { t } = useLanguage();
  const videoCall = call?.mediaType === 'video';

  useEffect(() => {
    callSounds.startIncomingRingtone();

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const callerName = call.friend?.displayName || call.friend?.username || 'Someone';
        const title = videoCall ? 'Incoming Messenger Video Call' : 'Incoming Messenger Audio Call';
        new Notification(title, {
          body: `${callerName} is calling you on Messenger`,
          icon: '/favicon.svg',
          tag: `call-${call.callId}`,
          renotify: true,
        });
      } catch {}
    }

    // Keyboard shortcuts for effortless answering: Enter/Space to Accept, Esc to Decline
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleAccept();
      } else if (e.key === 'Escape' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleDecline();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      callSounds.stop();
    };
  }, [call?.callId, call?.friend?.displayName, call?.friend?.username, t, videoCall]);

  const handleAccept = () => {
    callSounds.stop();
    onAccept();
  };

  const handleDecline = () => {
    callSounds.stop();
    callSounds.playEndedSound();
    onDecline();
  };

  const avatarSrc = resolveAvatarUrl(call?.friend?.avatarUrl, call?.friend?.username);
  const friendName = call?.friend?.displayName || call?.friend?.username || 'Someone';

  return (
    <div
      className="incoming-call-popup messenger-incoming-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={videoCall ? 'Incoming Messenger Video Call' : 'Incoming Messenger Audio Call'}
    >
      <div className="incoming-call-backdrop" onClick={handleDecline} />
      <div className="incoming-call-card messenger-incoming-card ringing-pulse">
        {/* Messenger Call Type Pill */}
        <div className="messenger-incoming-type-pill">
          <i className={`fa-solid ${videoCall ? 'fa-video' : 'fa-phone'}`} />
          <span>{videoCall ? 'Messenger Video Call' : 'Messenger Audio Call'}</span>
        </div>

        {/* Messenger Avatar with Glowing Rings */}
        <div className="incoming-call-avatar-wrapper messenger-incoming-avatar-wrapper">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={friendName}
              className="incoming-call-avatar-img messenger-incoming-avatar-img"
              onError={(e) => handleAvatarError(e, friendName)}
            />
          ) : (
            <div className="incoming-call-avatar messenger-incoming-avatar-fallback">
              {getInitials(friendName)}
            </div>
          )}
          <span className="messenger-incoming-wave wave-1" />
          <span className="messenger-incoming-wave wave-2" />
        </div>

        <strong className="incoming-caller-name messenger-incoming-name">{friendName}</strong>
        <span className="incoming-call-status messenger-incoming-status">
          {videoCall ? 'Incoming Video Call...' : 'Incoming Audio Call...'}
        </span>

        {/* Action Buttons: Accept & Decline */}
        <div className="incoming-call-actions messenger-incoming-actions">
          <button
            type="button"
            className="call-action-btn messenger-btn-decline"
            onClick={handleDecline}
            title={`${t('decline')} (Esc)`}
            aria-label={t('decline')}
          >
            <div className="call-btn-circle btn-decline-circle">
              <i className="fa-solid fa-phone-slash" />
            </div>
            <span className="call-btn-label">{t('decline')}</span>
          </button>

          <button
            type="button"
            className="call-action-btn messenger-btn-accept pulse-accept"
            onClick={handleAccept}
            title={`${t('accept')} (Enter / Space)`}
            aria-label={t('accept')}
            autoFocus
          >
            <div className="call-btn-circle btn-accept-circle">
              <i className={`fa-solid ${videoCall ? 'fa-video' : 'fa-phone'}`} />
            </div>
            <span className="call-btn-label">{t('accept')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
