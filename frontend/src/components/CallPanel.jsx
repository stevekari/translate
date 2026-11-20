import { useEffect, useRef, useState, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { resolveAvatarUrl, handleAvatarError, getInitials } from '../utils/avatarUrl';

export default function CallPanel({
  callState,
  callType,
  isRinging,
  localStream,
  remoteStream,
  error,
  friend,
  currentUser,
  isMutedAudio = false,
  isMutedVideo = false,
  toggleMuteAudio,
  toggleMuteVideo,
  switchCamera,
  onAccept,
  onEnd,
}) {
  const { t } = useLanguage();
  const [durationSec, setDurationSec] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const remoteAudioRef = useRef(null);
  const mainVideoRef = useRef(null);
  const pipVideoRef = useRef(null);

  const connected = callState === 'connected';
  const incoming = callState === 'incoming';
  const calling = callState === 'calling';
  const videoCall = callType === 'video';

  // Call duration timer
  useEffect(() => {
    if (!connected) {
      setDurationSec(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [connected]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Detect whether remoteStream has an active video track
  useEffect(() => {
    if (!remoteStream) {
      setHasRemoteVideo(false);
      return undefined;
    }

    const checkVideo = () => {
      const vTracks = remoteStream.getVideoTracks();
      const active = vTracks.some((t) => t.enabled && t.readyState === 'live');
      setHasRemoteVideo(active);
    };

    checkVideo();
    remoteStream.addEventListener('addtrack', checkVideo);
    remoteStream.addEventListener('removetrack', checkVideo);

    const vTracks = remoteStream.getVideoTracks();
    vTracks.forEach((track) => {
      track.addEventListener('mute', checkVideo);
      track.addEventListener('unmute', checkVideo);
      track.addEventListener('ended', checkVideo);
    });

    return () => {
      remoteStream.removeEventListener('addtrack', checkVideo);
      remoteStream.removeEventListener('removetrack', checkVideo);
      vTracks.forEach((track) => {
        track.removeEventListener('mute', checkVideo);
        track.removeEventListener('unmute', checkVideo);
        track.removeEventListener('ended', checkVideo);
      });
    };
  }, [remoteStream]);

  // Keep remote audio track playing
  const attachRemoteAudio = useCallback(
    (node) => {
      remoteAudioRef.current = node;
      if (node && remoteStream) {
        node.srcObject = remoteStream;
        node.play().catch(() => {});
      }
    },
    [remoteStream]
  );

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Attach streams to main and PiP video elements based on isSwapped
  useEffect(() => {
    const mainStream = isSwapped ? localStream : remoteStream;
    const pipStream = isSwapped ? remoteStream : localStream;

    if (mainVideoRef.current) {
      if (mainStream) {
        mainVideoRef.current.srcObject = mainStream;
        mainVideoRef.current.play().catch(() => {});
      } else {
        mainVideoRef.current.srcObject = null;
      }
    }

    if (pipVideoRef.current) {
      if (pipStream) {
        pipVideoRef.current.srcObject = pipStream;
        pipVideoRef.current.play().catch(() => {});
      } else {
        pipVideoRef.current.srcObject = null;
      }
    }
  }, [isSwapped, localStream, remoteStream]);

  // Keyboard answering when call is incoming
  useEffect(() => {
    if (!incoming) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        onAccept?.();
      } else if (e.key === 'Escape' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        onEnd?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [incoming, onAccept, onEnd]);

  if (callState === 'idle') return null;

  const friendAvatarSrc = resolveAvatarUrl(friend?.avatarUrl, friend?.username);
  const friendDisplayName = friend?.displayName || friend?.username || 'Friend';

  const myAvatarSrc = resolveAvatarUrl(currentUser?.avatarUrl, currentUser?.username);
  const myDisplayName = currentUser?.displayName || currentUser?.username || 'You';

  // Which user is currently in the big main view
  const bigPersonAvatar = isSwapped ? myAvatarSrc : friendAvatarSrc;
  const bigPersonName = isSwapped ? myDisplayName : friendDisplayName;

  // Which user is currently in the small PiP view
  const pipPersonAvatar = isSwapped ? friendAvatarSrc : myAvatarSrc;
  const pipPersonName = isSwapped ? friendDisplayName : myDisplayName;

  const isMainVideoActive = isSwapped
    ? Boolean(localStream && !isMutedVideo)
    : Boolean(connected && hasRemoteVideo);

  const isPipVideoActive = isSwapped
    ? Boolean(connected && hasRemoteVideo)
    : Boolean(localStream && !isMutedVideo);

  return (
    <div className={`whatsapp-call-overlay ${videoCall ? 'video-mode' : 'voice-mode'} state-${callState}`}>
      {/* Remote Audio Track */}
      <audio
        ref={attachRemoteAudio}
        autoPlay
        playsInline
        onLoadedMetadata={(e) => e.target.play().catch(() => {})}
      />

      {/* 1. Full-Screen Ambient Blurred Photo Backdrop (WhatsApp Luxury Look) */}
      <div
        className="whatsapp-call-ambient-backdrop"
        style={friendAvatarSrc ? { backgroundImage: `url(${friendAvatarSrc})` } : undefined}
      />

      {/* 2. Top Header Overlay: Name, Encryption Lock & Duration */}
      <header className="whatsapp-call-top-bar">
        <div className="whatsapp-top-info">
          <div className="whatsapp-encrypted-pill">
            <i className="fa-solid fa-lock" />
            <span>End-to-end encrypted</span>
          </div>
          <h2 className="whatsapp-call-peer-name">{friendDisplayName}</h2>
          <span className="whatsapp-call-status-pill">
            {connected ? (
              <>
                <span className="live-call-dot" />
                <span>{formatDuration(durationSec)}</span>
              </>
            ) : calling ? (
              <span>{t(isRinging ? 'ringing' : 'calling')}...</span>
            ) : incoming ? (
              <span>{t(videoCall ? 'incomingVideoCall' : 'incomingVoiceCall')}</span>
            ) : (
              <span>Connecting...</span>
            )}
          </span>
        </div>
      </header>

      {/* 3. Main Center View: Full-Screen Remote Video OR Large Photo of Person */}
      <div className="whatsapp-main-viewport">
        {videoCall && (
          <video
            ref={mainVideoRef}
            className={`whatsapp-main-video ${isMainVideoActive ? 'is-visible' : 'is-hidden'}`}
            autoPlay
            playsInline
            muted={isSwapped}
            onLoadedMetadata={(e) => e.target.play().catch(() => {})}
          />
        )}

        {/* When video is not yet streaming, camera is off, or voice call: Show BIG Photo */}
        {(!videoCall || !isMainVideoActive) && (
          <div className="whatsapp-big-photo-card">
            <div className="whatsapp-big-avatar-wrapper">
              {bigPersonAvatar ? (
                <img
                  src={bigPersonAvatar}
                  alt={bigPersonName}
                  className="whatsapp-big-avatar-img"
                  onError={(e) => handleAvatarError(e, bigPersonName)}
                />
              ) : (
                <div className="whatsapp-big-avatar-fallback">
                  {getInitials(bigPersonName)}
                </div>
              )}
              {/* WhatsApp Pulsing Emerald Wave Rings */}
              <span className={`whatsapp-pulse-ring ring-1 ${connected ? 'connected-glow' : ''}`} />
              <span className={`whatsapp-pulse-ring ring-2 ${connected ? 'connected-glow' : ''}`} />
            </div>

            <h3 className="whatsapp-photo-name">{bigPersonName}</h3>
            <p className="whatsapp-photo-subtext">
              {connected
                ? (videoCall ? 'Video is connecting / camera paused' : `${formatDuration(durationSec)} • Voice Call`)
                : calling
                  ? t(isRinging ? 'ringing' : 'calling')
                  : incoming
                    ? (videoCall ? 'Incoming WhatsApp Video Call...' : 'Incoming WhatsApp Voice Call...')
                    : 'Connecting call...'}
            </p>
          </div>
        )}

        {/* 4. Small Picture-in-Picture (PiP) Window (WhatsApp Floating Corner Card) */}
        {videoCall && (
          <div
            className="whatsapp-pip-container"
            onClick={() => setIsSwapped((prev) => !prev)}
            title="Tap to swap view"
            role="button"
            tabIndex={0}
          >
            <video
              ref={pipVideoRef}
              className={`whatsapp-pip-video ${isPipVideoActive ? 'is-visible' : 'is-hidden'}`}
              autoPlay
              playsInline
              muted={!isSwapped}
              onLoadedMetadata={(e) => e.target.play().catch(() => {})}
            />

            {!isPipVideoActive && (
              <div className="whatsapp-pip-placeholder">
                {pipPersonAvatar ? (
                  <img
                    src={pipPersonAvatar}
                    alt={pipPersonName}
                    className="whatsapp-pip-avatar"
                    onError={(e) => handleAvatarError(e, pipPersonName)}
                  />
                ) : (
                  <div className="whatsapp-pip-initial">
                    {getInitials(pipPersonName)}
                  </div>
                )}
                <span className="whatsapp-pip-cam-off-icon">
                  <i className="fa-solid fa-video-slash" />
                </span>
              </div>
            )}

            <div className="whatsapp-pip-swap-badge">
              <i className="fa-solid fa-arrows-rotate" />
              <span>Swap</span>
            </div>
          </div>
        )}
      </div>

      {error && <div className="whatsapp-call-error-toast">{error}</div>}

      {/* 5. Floating Bottom Control Dock (WhatsApp Style) */}
      <footer className="whatsapp-call-bottom-dock">
        {incoming ? (
          <div className="whatsapp-incoming-actions">
            <button
              type="button"
              className="whatsapp-ctrl-btn btn-accept-call pulse-accept"
              onClick={onAccept}
              title={`${t('accept')} (Enter / Space)`}
              aria-label={t('accept')}
              autoFocus
            >
              <i className={`fa-solid ${videoCall ? 'fa-video' : 'fa-phone'}`} />
              <span className="btn-label">{t('accept')}</span>
            </button>

            <button
              type="button"
              className="whatsapp-ctrl-btn btn-decline-call"
              onClick={onEnd}
              title={`${t('decline')} (Esc)`}
              aria-label={t('decline')}
            >
              <i className="fa-solid fa-phone-slash" />
              <span className="btn-label">{t('decline')}</span>
            </button>
          </div>
        ) : (
          <div className="whatsapp-active-controls">
            {/* Audio Mute Button */}
            {toggleMuteAudio && (
              <button
                type="button"
                className={`whatsapp-ctrl-btn ${isMutedAudio ? 'is-muted' : ''}`}
                onClick={toggleMuteAudio}
                title={isMutedAudio ? t('unmute') : t('mute')}
                aria-label={isMutedAudio ? t('unmute') : t('mute')}
              >
                <i className={`fa-solid ${isMutedAudio ? 'fa-microphone-slash' : 'fa-microphone'}`} />
                <span className="btn-hint">{isMutedAudio ? 'Muted' : 'Mute'}</span>
              </button>
            )}

            {/* Video Camera Toggle */}
            {videoCall && toggleMuteVideo && (
              <button
                type="button"
                className={`whatsapp-ctrl-btn ${isMutedVideo ? 'is-muted' : ''}`}
                onClick={toggleMuteVideo}
                title={isMutedVideo ? t('turnCameraOn') : t('turnCameraOff')}
                aria-label={isMutedVideo ? t('turnCameraOn') : t('turnCameraOff')}
              >
                <i className={`fa-solid ${isMutedVideo ? 'fa-video-slash' : 'fa-video'}`} />
                <span className="btn-hint">{isMutedVideo ? 'Cam Off' : 'Cam On'}</span>
              </button>
            )}

            {/* Flip / Switch Camera Button */}
            {videoCall && switchCamera && (
              <button
                type="button"
                className="whatsapp-ctrl-btn btn-flip"
                onClick={switchCamera}
                title={t('switchCamera')}
                aria-label={t('switchCamera')}
              >
                <i className="fa-solid fa-camera-rotate" />
                <span className="btn-hint">Flip</span>
              </button>
            )}

            {/* End Call Button (Big Red WhatsApp Hangup) */}
            <button
              type="button"
              className="whatsapp-ctrl-btn btn-hangup-call"
              onClick={onEnd}
              title={t('endCall')}
              aria-label={t('endCall')}
            >
              <i className="fa-solid fa-phone-slash" />
              <span className="btn-hint">End</span>
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
