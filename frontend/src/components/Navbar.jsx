import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import chatImg from '../assets/chat.jpeg';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { setMyStatus } from '../store/slices/presenceSlice';
import { resolveAvatarUrl, handleAvatarError } from '../utils/avatarUrl';
import QRRoomModal from './QRRoomModal';
import VoiceTranslateModal from './VoiceTranslateModal';
import AiAssistantModal from './AiAssistantModal';
import LiveScoresModal from './LiveScoresModal';
import { getRealFootballScores } from '../api/footballApi';
import { useWeather } from '../contexts/WeatherContext';

export default function Navbar({ user, onLogout, isChatOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, languageOptions, t } = useLanguage();
  const { isStandalone, installApp } = usePWAInstall();
  const myStatus = useSelector((state) => state.presence?.myStatus || 'online');
  const conversations = useSelector((state) => state.chat?.conversations || {});

  const [searchQuery, setSearchQuery] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showVoiceTranslateModal, setShowVoiceTranslateModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showLiveScoresModal, setShowLiveScoresModal] = useState(false);
  const [liveMatchesCount, setLiveMatchesCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    getRealFootballScores('today', false)
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          const count = data.filter((m) => m.isLive).length;
          setLiveMatchesCount(count);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);
  const { weather, formatTemp, showWeatherModal, openWeatherModal, tWeather } = useWeather();

  const totalUnread = useMemo(() => {
    return Object.values(conversations).reduce((sum, conv) => sum + (conv.unread || 0), 0);
  }, [conversations]);

  const isHome = location.pathname === '/home' || location.pathname === '/feed';
  const isFriends = location.pathname === '/friends';
  const isCalls = location.pathname === '/calls';
  const isSettings = location.pathname === '/settings';

  const avatarSrc = resolveAvatarUrl(user?.avatarUrl, user?.displayName || user?.username);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleStatusChange = (e) => {
    dispatch(setMyStatus(e.target.value));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('/friends?search=' + encodeURIComponent(searchQuery.trim()));
    }
  };

  return (
    <nav className="navbar fb-navbar">
      {/* 1. Facebook Left: Logo & Search */}
      <div className="fb-nav-left">
        <Link to="/home" className="fb-brand" title="Giochat Home">
          <img className="fb-logo" src={chatImg} alt="Giochat" />
        </Link>

        {user && (
          <form className="fb-search-form nav-desktop-only" onSubmit={handleSearchSubmit}>
            <i className="fa-solid fa-magnifying-glass fb-search-icon" />
            <input
              type="text"
              className="fb-search-input"
              placeholder={t('search') || 'Search Giochat...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search"
            />
          </form>
        )}
      </div>

      {/* 2. Facebook Center: Iconic Centered Navigation Tabs */}
      {user && (
        <div className="fb-nav-center nav-desktop-only">
          <Link
            to="/home"
            className={`fb-tab ${isHome ? 'active' : ''}`}
            title="Home"
            aria-label="Home"
          >
            <div className="fb-tab-icon-wrap">
              <i className="fa-solid fa-house" />
            </div>
          </Link>

          <Link
            to="/friends"
            className={`fb-tab ${isFriends ? 'active' : ''}`}
            title={t('friends') || 'Friends & Messages'}
            aria-label={t('friends')}
          >
            <div className="fb-tab-icon-wrap">
              <i className="fa-solid fa-user-group" />
              {totalUnread > 0 && (
                <span className="fb-tab-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
              )}
            </div>
          </Link>

          <Link
            to="/calls"
            className={`fb-tab ${isCalls ? 'active' : ''}`}
            title={t('calls') || 'Calls & Video'}
            aria-label={t('calls')}
          >
            <div className="fb-tab-icon-wrap">
              <i className="fa-solid fa-video" />
            </div>
          </Link>

          {/* Weather Tab - positioned at the top right after video call */}
          <button
            type="button"
            className={`fb-tab weather-nav-tab ${showWeatherModal ? 'active' : ''}`}
            onClick={openWeatherModal}
            title={weather ? `${tWeather ? tWeather('weather') : 'Weather'}: ${weather.cityName} (${formatTemp(weather.temperature)})` : (tWeather ? tWeather('weatherAndForecast') : 'Weather & Forecast')}
            aria-label={tWeather ? tWeather('weatherAndForecast') : 'Weather & Forecast'}
          >
            <div className="fb-tab-icon-wrap weather-tab-icon-wrap">
              <i className={weather?.conditionIcon || 'fa-solid fa-cloud-sun'} style={{ color: weather?.conditionColor || '#f59e0b' }} />
              {weather?.cityName && (
                <span className="weather-mini-city">{weather.cityName}</span>
              )}
              {weather?.temperature != null && (
                <span className="weather-mini-temp">{formatTemp(weather.temperature)}</span>
              )}
            </div>
          </button>
        </div>
      )}

      {/* 3. Facebook Right: Clean circular actions, Settings next to Toggle, Profile with Online status badge, Logout */}
      {user && (
        <div className="fb-nav-right">
          {/* Settings & Toggle placed right next to each other */}
          <div className="fb-nav-toggle-group">
            {/* ⚽ Top Navbar Live Football Scores - placed on left of GioAI, reduced height, always visible */}
            <button
              type="button"
              onClick={() => setShowLiveScoresModal(true)}
              className={`top-navbar-livescore-btn ${showLiveScoresModal ? 'active' : ''}`}
              title={liveMatchesCount > 0 ? `⚽ ${liveMatchesCount} Matches Live - Click for Match Center` : '⚽ Live Football Scores - Click for Match Center'}
              aria-label="Live Football Scores"
            >
              <i className="fa-solid fa-futbol" />
              <span className="top-livescore-text">
                {liveMatchesCount > 0 ? `${liveMatchesCount} LIVE` : 'Scores'}
              </span>
              <span className="status-live-dot" />
            </button>

            {/* GioAI Quick Button */}
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className={`fb-circle-btn gioai-circle-btn ${showAiModal ? 'active' : ''}`}
              title="✨ GioAI Assistant - Answers, Explanations & Translations"
              aria-label="GioAI Assistant"
            >
              <i className="fa-solid fa-wand-magic-sparkles" />
            </button>

            {/* Live Voice Translator */}
            <button
              type="button"
              onClick={() => setShowVoiceTranslateModal(true)}
              className="fb-circle-btn voice-trans-nav-btn"
              title="🎙️ Live Voice Translator - Speak & Understand"
              aria-label="Live Voice Translator"
            >
              <i className="fa-solid fa-microphone-lines" />
            </button>

            {/* QR Conversation Room */}
            <button
              type="button"
              onClick={() => setShowQRModal(true)}
              className="fb-circle-btn qr-nav-btn"
              title="QR Conversation Room - Scan & Join"
              aria-label="QR conversation room"
            >
              <i className="fa-solid fa-qrcode" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="fb-circle-btn theme-toggle"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
            </button>

            {/* Settings Button (right next to Toggle) */}
            <Link
              to="/settings"
              className={`fb-circle-btn fb-settings-btn ${isSettings ? 'active' : ''}`}
              title={t('settings')}
              aria-label={t('settings')}
            >
              <i className="fa-solid fa-gear" />
            </Link>
          </div>

          {/* User Profile Avatar with Facebook-style live online status indicator */}
          <div className="fb-profile-wrap">
            <Link
              to="/settings"
              className={`fb-profile-btn ${isSettings ? 'active' : ''}`}
              title={`${user.displayName || user.username} (${myStatus})`}
            >
              <div className="fb-avatar-container">
                <img
                  src={avatarSrc}
                  alt={user.username}
                  className="fb-profile-avatar"
                  onError={(e) => handleAvatarError(e, user?.displayName || user?.username)}
                />
                <span className={`fb-status-badge ${myStatus}`} />
                <select
                  className="fb-status-badge-select"
                  value={myStatus}
                  onChange={handleStatusChange}
                  onClick={(e) => e.stopPropagation()}
                  title={`Your status: ${myStatus}. Click to change.`}
                  aria-label="Change online status"
                >
                  <option value="online">🟢 Online</option>
                  <option value="busy">🟡 Busy</option>
                  <option value="offline">⚪ Offline</option>
                </select>
              </div>
              <span className="fb-profile-name nav-desktop-only">
                {user.displayName || user.username}
              </span>
            </Link>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="fb-circle-btn fb-logout-btn"
            title={t('logout')}
            aria-label={t('logout')}
          >
            <i className="fa-solid fa-arrow-right-from-bracket" />
          </button>
        </div>
      )}
      {showQRModal && (
        <QRRoomModal user={user} onClose={() => setShowQRModal(false)} />
      )}
      {showVoiceTranslateModal && (
        <VoiceTranslateModal
          isOpen={showVoiceTranslateModal}
          onClose={() => setShowVoiceTranslateModal(false)}
          initialSourceLang={user?.preferredLanguage || language || 'en'}
          initialTargetLang={user?.preferredLanguage || language || 'en'}
        />
      )}
      {showAiModal && (
        <AiAssistantModal
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          chatPartnerName={user?.displayName || 'Giochat'}
          preferredLanguage={user?.preferredLanguage || language || 'en'}
        />
      )}
      {showLiveScoresModal && (
        <LiveScoresModal
          isOpen={showLiveScoresModal}
          onClose={() => setShowLiveScoresModal(false)}
          initialFilter={liveMatchesCount > 0 ? 'live' : 'all'}
        />
      )}
    </nav>
  );
}
