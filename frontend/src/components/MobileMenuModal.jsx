import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { resolveAvatarUrl, handleAvatarError } from '../utils/avatarUrl';
import '../styles/mobileMenu.css';

export default function MobileMenuModal({
  isOpen,
  onClose,
  user,
  onLogout,
  onOpenLiveScores,
  onOpenWeather,
  onOpenGioAi,
  onOpenVoiceTranslate,
  onOpenQR,
  theme,
  toggleTheme,
  myStatus = 'online',
  onStatusChange,
  liveMatchesCount = 0,
  weather,
  formatTemp = (t) => `${t}°C`,
}) {
  const navigate = useNavigate();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.classList.remove('mobile-menu-open');
    }
    return () => {
      document.body.classList.remove('mobile-menu-open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const avatarSrc = resolveAvatarUrl(user?.avatar, user?.username);

  return createPortal(
    <div className="mobile-menu-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Mobile Navigation Menu">
      <div className="mobile-menu-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Grab Handle for Drawer */}
        <div className="mobile-menu-handle-bar">
          <div className="mobile-menu-handle" />
        </div>

        {/* Header */}
        <div className="mobile-menu-header">
          <div className="mobile-menu-title-wrap">
            <h2 className="mobile-menu-title">Menu</h2>
            <span className="mobile-menu-subtitle">Explore tools, scores, weather & settings</span>
          </div>
          <button
            type="button"
            className="mobile-menu-close-btn"
            onClick={onClose}
            aria-label="Close Menu"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="mobile-menu-content">
          {/* User Profile Card */}
          {user && (
            <div className="mobile-menu-profile-card">
              <div
                className="mobile-menu-profile-main clickable"
                onClick={() => {
                  onClose();
                  navigate('/settings');
                }}
              >
                <div className="mobile-menu-avatar-wrap">
                  <img
                    src={avatarSrc}
                    alt={user.displayName || user.username}
                    className="mobile-menu-avatar"
                    onError={(e) => handleAvatarError(e, user?.displayName || user?.username)}
                  />
                  <span className={`mobile-menu-status-dot ${myStatus}`} />
                </div>
                <div className="mobile-menu-profile-info">
                  <div className="mobile-menu-profile-name">{user.displayName || user.username}</div>
                  <div className="mobile-menu-profile-username">@{user.username}</div>
                </div>
                <i className="fa-solid fa-chevron-right mobile-menu-profile-arrow" />
              </div>

              {/* Status Selector */}
              {onStatusChange && (
                <div className="mobile-menu-status-bar">
                  <span className="mobile-menu-status-label">Online Status:</span>
                  <select
                    className="mobile-menu-status-select"
                    value={myStatus}
                    onChange={(e) => onStatusChange(e.target.value)}
                    aria-label="Change online status"
                  >
                    <option value="online">🟢 Online</option>
                    <option value="busy">🟡 Busy</option>
                    <option value="offline">⚪ Offline</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Core Apps & Tools Grid */}
          <div className="mobile-menu-section-label">Shortcuts & Live Tools</div>
          <div className="mobile-menu-grid">
            {/* ⚽ 1. Live Football Scores */}
            <div
              className="mobile-menu-card card-football clickable"
              onClick={() => {
                onClose();
                onOpenLiveScores && onOpenLiveScores();
              }}
            >
              <div className="menu-card-icon-wrap icon-football">
                <i className="fa-solid fa-futbol" />
              </div>
              <div className="menu-card-text">
                <div className="menu-card-title">Live Scores</div>
                <div className="menu-card-sub">Sofascore match center</div>
              </div>
              <span className={`menu-card-badge ${liveMatchesCount > 0 ? 'badge-live' : 'badge-scores'}`}>
                {liveMatchesCount > 0 ? (
                  <>
                    <span className="live-pulse-dot" />
                    {liveMatchesCount} LIVE
                  </>
                ) : (
                  'Scores'
                )}
              </span>
            </div>

            {/* ☀️ 2. Weather & Forecast */}
            <div
              className="mobile-menu-card card-weather clickable"
              onClick={() => {
                onClose();
                onOpenWeather && onOpenWeather();
              }}
            >
              <div className="menu-card-icon-wrap icon-weather">
                <i className={weather?.conditionIcon || 'fa-solid fa-cloud-sun'} />
              </div>
              <div className="menu-card-text">
                <div className="menu-card-title">Weather & Rain</div>
                <div className="menu-card-sub">
                  {weather?.cityName ? `${weather.cityName} • 5-Day` : '5-Day Forecast & Rain'}
                </div>
              </div>
              {weather?.temperature != null && (
                <span className="menu-card-badge badge-weather">
                  {formatTemp(weather.temperature)}
                </span>
              )}
            </div>

            {/* ✨ 3. GioAI Assistant */}
            <div
              className="mobile-menu-card card-ai clickable"
              onClick={() => {
                onClose();
                onOpenGioAi && onOpenGioAi();
              }}
            >
              <div className="menu-card-icon-wrap icon-ai">
                <i className="fa-solid fa-wand-magic-sparkles" />
              </div>
              <div className="menu-card-text">
                <div className="menu-card-title">GioAI Assistant</div>
                <div className="menu-card-sub">Answers, translate & drafts</div>
              </div>
              <span className="menu-card-badge badge-ai">GioAI</span>
            </div>

            {/* 🎙️ 4. Live Voice Translator */}
            <div
              className="mobile-menu-card card-voice clickable"
              onClick={() => {
                onClose();
                onOpenVoiceTranslate && onOpenVoiceTranslate();
              }}
            >
              <div className="menu-card-icon-wrap icon-voice">
                <i className="fa-solid fa-microphone-lines" />
              </div>
              <div className="menu-card-text">
                <div className="menu-card-title">Voice Translator</div>
                <div className="menu-card-sub">Live speech walkie-talkie</div>
              </div>
              <span className="menu-card-badge badge-voice">Live</span>
            </div>

            {/* 📷 5. QR Room */}
            <div
              className="mobile-menu-card card-qr clickable"
              onClick={() => {
                onClose();
                onOpenQR && onOpenQR();
              }}
            >
              <div className="menu-card-icon-wrap icon-qr">
                <i className="fa-solid fa-qrcode" />
              </div>
              <div className="menu-card-text">
                <div className="menu-card-title">QR Room</div>
                <div className="menu-card-sub">Scan & join private chat</div>
              </div>
            </div>

            {/* 📰 6. Live News */}
            <div
              className="mobile-menu-card card-news clickable"
              onClick={() => {
                onClose();
                navigate('/home');
              }}
            >
              <div className="menu-card-icon-wrap icon-news">
                <i className="fa-solid fa-newspaper" />
              </div>
              <div className="menu-card-text">
                <div className="menu-card-title">Live News</div>
                <div className="menu-card-sub">Spain & World updates</div>
              </div>
            </div>
          </div>

          {/* Preferences & Settings List */}
          <div className="mobile-menu-section-label">Preferences & Account</div>
          <div className="mobile-menu-list">
            {/* ⚙️ Settings */}
            <div
              className="mobile-menu-row clickable"
              onClick={() => {
                onClose();
                navigate('/settings');
              }}
            >
              <div className="menu-row-icon icon-settings">
                <i className="fa-solid fa-gear" />
              </div>
              <div className="menu-row-info">
                <div className="menu-row-title">Settings</div>
                <div className="menu-row-sub">Account, languages, notifications, audio & chat</div>
              </div>
              <i className="fa-solid fa-chevron-right menu-row-arrow" />
            </div>

            {/* 🌓 Theme Toggle */}
            <div
              className="mobile-menu-row clickable"
              onClick={toggleTheme}
            >
              <div className="menu-row-icon icon-theme">
                <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
              </div>
              <div className="menu-row-info">
                <div className="menu-row-title">
                  {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </div>
                <div className="menu-row-sub">
                  Current theme: <strong>{theme === 'dark' ? 'Dark' : 'Light'}</strong>
                </div>
              </div>
              <span className="menu-row-pill">
                {theme === 'dark' ? 'Light ☀️' : 'Dark 🌙'}
              </span>
            </div>

            {/* 🚪 Log Out */}
            {onLogout && (
              <div
                className="mobile-menu-row row-logout clickable"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
              >
                <div className="menu-row-icon icon-logout">
                  <i className="fa-solid fa-arrow-right-from-bracket" />
                </div>
                <div className="menu-row-info">
                  <div className="menu-row-title text-danger">Log Out</div>
                  <div className="menu-row-sub">Sign out from your account</div>
                </div>
                <i className="fa-solid fa-chevron-right menu-row-arrow" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
