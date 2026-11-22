import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  const conversations = useSelector((state) => state.chat?.conversations || {});

  // Calculate total unread messages across all conversations
  const totalUnread = useMemo(() => {
    return Object.values(conversations).reduce((sum, conv) => sum + (conv.unread || 0), 0);
  }, [conversations]);

  const isHomeActive = location.pathname === '/home' || location.pathname === '/feed';
  const isFriendsActive = location.pathname === '/friends';
  const isCallsActive = location.pathname === '/calls';
  const isSettingsActive = location.pathname === '/settings';
  const isChatOpen = location.pathname.startsWith('/chat/');

  // If in an active chat screen on mobile, hide bottom menu so chat input gets full space
  if (isChatOpen) {
    return null;
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      {/* 1. Home / Community Feed */}
      <button
        type="button"
        className={`mobile-nav-item ${isHomeActive ? 'active' : ''}`}
        onClick={() => navigate('/home')}
        aria-label="Home"
      >
        <div className="mobile-nav-icon-wrap">
          <i className="fa-solid fa-earth-americas" />
        </div>
        <span className="mobile-nav-label">Feed</span>
      </button>

      {/* 2. Reels / 5h Statuses (Instagram & Facebook Style) */}
      <button
        type="button"
        className="mobile-nav-item"
        onClick={() => {
          if (location.pathname !== '/home') {
            navigate('/home');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-reels-viewer', { detail: { index: 0 } }));
            }, 350);
          } else {
            window.dispatchEvent(new CustomEvent('open-reels-viewer', { detail: { index: 0 } }));
          }
        }}
        aria-label="Reels"
        title="Watch 5-hour reels & statuses"
      >
        <div className="mobile-nav-icon-wrap reels-nav-icon">
          <i className="fa-solid fa-clapperboard" />
          <span className="mobile-nav-reels-dot" />
        </div>
        <span className="mobile-nav-label">Reels</span>
      </button>

      {/* 3. Chats */}
      <button
        type="button"
        className={`mobile-nav-item ${isFriendsActive ? 'active' : ''}`}
        onClick={() => navigate('/friends')}
        aria-label={t('chats')}
      >
        <div className="mobile-nav-icon-wrap">
          <i className="fa-solid fa-comments" />
          {totalUnread > 0 && (
            <span className="mobile-nav-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
          )}
        </div>
        <span className="mobile-nav-label">{t('chats')}</span>
      </button>

      {/* 4. Calls */}
      <button
        type="button"
        className={`mobile-nav-item ${isCallsActive ? 'active' : ''}`}
        onClick={() => navigate('/calls')}
        aria-label={t('calls')}
      >
        <div className="mobile-nav-icon-wrap">
          <i className="fa-solid fa-phone" />
        </div>
        <span className="mobile-nav-label">{t('calls')}</span>
      </button>

      {/* 5. GioAI Assistant */}
      <button
        type="button"
        className="mobile-nav-item mobile-nav-gioai"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('open-gioai-assistant'));
        }}
        aria-label="GioAI Assistant"
        title="✨ GioAI Assistant"
      >
        <div className="mobile-nav-icon-wrap gioai-mobile-icon-wrap">
          <i className="fa-solid fa-wand-magic-sparkles" />
        </div>
        <span className="mobile-nav-label">GioAI</span>
      </button>

      {/* 6. More Menu */}
      <button
        type="button"
        className="mobile-nav-item mobile-nav-menu"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('open-mobile-menu'));
        }}
        aria-label="Menu"
        title="More Menu - Live Scores, Weather, Settings & Tools"
      >
        <div className="mobile-nav-icon-wrap">
          <i className="fa-solid fa-bars" />
        </div>
        <span className="mobile-nav-label">Menu</span>
      </button>
    </nav>
  );
}
