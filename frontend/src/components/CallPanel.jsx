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
  facingMode = 'user',
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
  // Directly set DOM node muted = (stream === localStream) to prevent mobile autoplay block & dark screen
  useEffect(() => {
    const mainStream = isSwapped ? localStream : remoteStream;
    const pipStream = isSwapped ? remoteStream : localStream;

    if (mainVideoRef.current) {
      mainVideoRef.current.muted = (mainStream === localStream);
      mainVideoRef.current.playsInline = true;
      if (mainStream) {
        if (mainVideoRef.current.srcObject !== mainStream) {
          mainVideoRef.current.srcObject = mainStream;
        }
        mainVideoRef.current.play().catch(() => {});
      } else {
        mainVideoRef.current.srcObject = null;
      }
    }

    if (pipVideoRef.current) {
      pipVideoRef.current.muted = (pipStream === localStream);
      pipVideoRef.current.playsInline = true;
      if (pipStream) {
        if (pipVideoRef.current.srcObject !== pipStream) {
          pipVideoRef.current.srcObject = pipStream;
        }
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

  const hasLocalVideo = Boolean(
    localStream &&
    localStream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live') &&
    !isMutedVideo
  );

  const isMainVideoActive = isSwapped ? hasLocalVideo : Boolean(connected && hasRemoteVideo);
  const isPipVideoActive = isSwapped ? Boolean(connected && hasRemoteVideo) : hasLocalVideo;
  const showAnyVideo = videoCall || hasLocalVideo || hasRemoteVideo;

  // Check if main video is displaying local front camera to apply mirroring
  const isMainLocalFront = isSwapped && facingMode === 'user';
  const isPipLocalFront = !isSwapped && facingMode === 'user';

  return (
    <div className={`messenger-call-overlay ${showAnyVideo ? 'video-mode' : 'voice-mode'} state-${callState}`}>
      {/* Remote Audio Track */}
      <audio
        ref={attachRemoteAudio}
        autoPlay
        playsInline
        onLoadedMetadata={(e) => e.target.play().catch(() => {})}
      />

      {/* 1. Ambient Blurred Backdrop */}
      <div
        className="messenger-call-ambient-backdrop"
        style={friendAvatarSrc ? { backgroundImage: `url(${friendAvatarSrc})` } : undefined}
      />

      {/* 2. Messenger Top Header: Call Type Badge, Peer Name, Status */}
      <header className="messenger-call-top-bar">
        <div className="messenger-top-info">
          <div className="messenger-call-badge">
            <i className={`fa-solid ${showAnyVideo ? 'fa-video' : 'fa-phone'}`} />
            <span>{showAnyVideo ? 'Messenger Video Call' : 'Messenger Audio Call'}</span>
          </div>

          <h2 className="messenger-call-peer-name">{friendDisplayName}</h2>

          <span className="messenger-call-status-pill">
            {connected ? (
              <>
                <span className="messenger-live-dot" />
                <span>{formatDuration(durationSec)} • Connected</span>
              </>
            ) : calling ? (
              <span>{t(isRinging ? 'ringing' : 'calling')}...</span>
            ) : incoming ? (
              <span>{showAnyVideo ? 'Incoming Video Call...' : 'Incoming Audio Call...'}</span>
            ) : (
              <span>Connecting call...</span>
            )}
          </span>
        </div>
      </header>

      {/* 3. Main Center Viewport: Full-Screen Video OR Facebook Messenger Avatar Card */}
      <div className="messenger-main-viewport">
        {showAnyVideo && (
          <video
            ref={mainVideoRef}
            className={`messenger-main-video ${isMainVideoActive ? 'is-visible' : 'is-hidden'} ${isMainLocalFront ? 'is-mirrored' : ''}`}
            autoPlay
            playsInline
            muted={isSwapped}
            onLoadedMetadata={(e) => e.target.play().catch(() => {})}
          />
        )}

        {/* When video is paused/off or in audio mode: Show Messenger Glowing Profile Card */}
        {(!showAnyVideo || !isMainVideoActive) && (
          <div className="messenger-big-photo-card">
            <div className="messenger-big-avatar-wrapper">
              {bigPersonAvatar ? (
                <img
                  src={bigPersonAvatar}
                  alt={bigPersonName}
                  className="messenger-big-avatar-img"
                  onError={(e) => handleAvatarError(e, bigPersonName)}
                />
              ) : (
                <div className="messenger-big-avatar-fallback">
                  {getInitials(bigPersonName)}
                </div>
              )}
              {/* Facebook Messenger Pulsing Audio Wave Rings */}
              <span className={`messenger-pulse-ring ring-1 ${connected ? 'connected-glow' : ''}`} />
              <span className={`messenger-pulse-ring ring-2 ${connected ? 'connected-glow' : ''}`} />
            </div>

            <h3 className="messenger-photo-name">{bigPersonName}</h3>
            <p className="messenger-photo-subtext">
              {connected
                ? (showAnyVideo ? 'Camera is paused' : `${formatDuration(durationSec)} • Audio Call`)
                : calling
                  ? (isRinging ? 'Ringing...' : 'Calling...')
                  : incoming
                    ? (showAnyVideo ? 'Incoming Messenger Video Call...' : 'Incoming Messenger Audio Call...')
                    : 'Connecting...'}
            </p>
          </div>
        )}

        {/* 4. Small Picture-in-Picture (PiP) Window (Messenger Floating Corner Card) */}
        {showAnyVideo && (
          <div
            className="messenger-pip-container"
            onClick={() => setIsSwapped((prev) => !prev)}
            title="Tap to swap view"
            role="button"
            tabIndex={0}
          >
            <video
              ref={pipVideoRef}
              className={`messenger-pip-video ${isPipVideoActive ? 'is-visible' : 'is-hidden'} ${isPipLocalFront ? 'is-mirrored' : ''}`}
              autoPlay
              playsInline
              muted={!isSwapped}
              onLoadedMetadata={(e) => e.target.play().catch(() => {})}
            />

            {!isPipVideoActive && (
              <div className="messenger-pip-placeholder">
                {pipPersonAvatar ? (
                  <img
                    src={pipPersonAvatar}
                    alt={pipPersonName}
                    className="messenger-pip-avatar"
                    onError={(e) => handleAvatarError(e, pipPersonName)}
                  />
                ) : (
                  <div className="messenger-pip-initial">
                    {getInitials(pipPersonName)}
                  </div>
                )}
                <span className="messenger-pip-cam-off-icon">
                  <i className="fa-solid fa-video-slash" />
                </span>
              </div>
            )}

            <div className="messenger-pip-swap-badge">
              <i className="fa-solid fa-arrows-rotate" />
              <span>Swap</span>
            </div>
          </div>
        )}
      </div>

      {error && <div className="messenger-call-error-toast">{error}</div>}

      {/* 5. Floating Bottom Control Dock (Facebook Messenger Style) */}
      <footer className="messenger-call-bottom-dock">
        {incoming ? (
          <div className="messenger-incoming-actions">
            <button
              type="button"
              className="messenger-ctrl-btn btn-accept-call pulse-accept"
              onClick={onAccept}
              title={`${t('accept')} (Enter / Space)`}
              aria-label={t('accept')}
              autoFocus
            >
              <i className={`fa-solid ${showAnyVideo ? 'fa-video' : 'fa-phone'}`} />
              <span className="btn-label">{t('accept')}</span>
            </button>

            <button
              type="button"
              className="messenger-ctrl-btn btn-decline-call"
              onClick={onEnd}
              title={`${t('decline')} (Esc)`}
              aria-label={t('decline')}
            >
              <i className="fa-solid fa-phone-slash" />
              <span className="btn-label">{t('decline')}</span>
            </button>
          </div>
        ) : (
          <div className="messenger-active-controls">
            {/* Audio Mute Button */}
            {toggleMuteAudio && (
              <button
                type="button"
                className={`messenger-ctrl-btn ${isMutedAudio ? 'is-muted' : ''}`}
                onClick={toggleMuteAudio}
                title={isMutedAudio ? t('unmute') : t('mute')}
                aria-label={isMutedAudio ? t('unmute') : t('mute')}
              >
                <i className={`fa-solid ${isMutedAudio ? 'fa-microphone-slash' : 'fa-microphone'}`} />
                <span className="btn-hint">{isMutedAudio ? 'Muted' : 'Mute'}</span>
              </button>
            )}

            {/* Video Camera Toggle (Available in BOTH audio & video calls, like Facebook Messenger) */}
            {toggleMuteVideo && (
              <button
                type="button"
                className={`messenger-ctrl-btn ${isMutedVideo || !hasLocalVideo ? 'is-muted' : ''}`}
                onClick={toggleMuteVideo}
                title={hasLocalVideo && !isMutedVideo ? t('turnCameraOff') : t('turnCameraOn')}
                aria-label={hasLocalVideo && !isMutedVideo ? t('turnCameraOff') : t('turnCameraOn')}
              >
                <i className={`fa-solid ${hasLocalVideo && !isMutedVideo ? 'fa-video' : 'fa-video-slash'}`} />
                <span className="btn-hint">{hasLocalVideo && !isMutedVideo ? 'Cam Off' : 'Cam On'}</span>
              </button>
            )}

            {/* Flip / Switch Camera Button (Front / Back switch with zero dark screen) */}
            {switchCamera && (
              <button
                type="button"
                className="messenger-ctrl-btn btn-flip"
                onClick={switchCamera}
                title={t('switchCamera')}
                aria-label={t('switchCamera')}
              >
                <i className="fa-solid fa-camera-rotate" />
                <span className="btn-hint">Flip</span>
              </button>
            )}

            {/* Swap View Button (Swaps PiP and Main video without reload) */}
            {showAnyVideo && (
              <button
                type="button"
                className="messenger-ctrl-btn btn-swap"
                onClick={() => setIsSwapped((prev) => !prev)}
                title="Swap video views"
                aria-label="Swap video views"
              >
                <i className="fa-solid fa-arrows-rotate" />
                <span className="btn-hint">Swap</span>
              </button>
            )}

            {/* End Call Button (Big Red Messenger Hangup) */}
            <button
              type="button"
              className="messenger-ctrl-btn btn-hangup-call"
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
