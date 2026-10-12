import { useEffect, useRef } from 'react';
import { resolveAvatarUrl, handleAvatarError } from '../utils/avatarUrl';
import { getUserActivitySummary } from '../utils/timeAgo';
import { useSelector } from 'react-redux';

export default function FriendContextMenu({
  x,
  y,
  friend,
  conversationId,
  onClose,
  onDelete,
  onOpenChat,
  onViewProfile,
  onBlock,
  isBlocked = false
}) {
  const menuRef = useRef(null);
  const onlineIds = useSelector((s) => s.presence?.onlineIds || []);
  const userStatuses = useSelector((s) => s.presence?.userStatuses || {});

  const friendId = friend?.id || friend?.userId || friend?._id;
  const isOnline = onlineIds.some((id) => String(id) === String(friendId));
  const presenceObj = userStatuses[String(friendId)] || {};
  const lastSeen = presenceObj.lastSeen || friend?.lastSeen;
  const activity = getUserActivitySummary(isOnline, lastSeen, presenceObj.status || friend?.customStatus);

  const displayName = friend?.displayName || presenceObj?.displayName || friend?.username || 'User';
  const username = friend?.username || '';
  const isDistinctName = displayName && username && displayName.trim().toLowerCase() !== username.trim().toLowerCase();

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!friend) return null;

  // Viewport bounds adjustment
  const menuWidth = 230;
  const menuHeight = 220;
  const posX = x + menuWidth > window.innerWidth ? Math.max(10, window.innerWidth - menuWidth - 14) : Math.max(10, x);
  const posY = y + menuHeight > window.innerHeight ? Math.max(10, window.innerHeight - menuHeight - 14) : Math.max(10, y);

  return (
    <div
      ref={menuRef}
      className="friend-context-menu"
      style={{
        position: 'fixed',
        left: `${posX}px`,
        top: `${posY}px`,
        zIndex: 99999
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header Info */}
      <div className="friend-context-header">
        <div className="friend-context-avatar-wrap">
          <img
            src={resolveAvatarUrl(friend?.avatarUrl, displayName)}
            alt={username}
            className="friend-context-avatar"
            onError={(e) => handleAvatarError(e, displayName || username)}
          />
          <span className={`friend-context-dot ${isOnline ? 'online' : 'offline'}`} />
        </div>
        <div className="friend-context-user-meta">
          <div className="friend-context-name">
            {isDistinctName ? displayName : `@${username}`}
          </div>
          {isDistinctName && (
            <div className="friend-context-handle">@{username}</div>
          )}
          <div
            className={`friend-context-activity ${activity.badgeClass}`}
            title={activity.warning || activity.statusText}
          >
            {activity.label}
          </div>
        </div>
      </div>

      <div className="friend-context-divider" />

      {/* Menu Actions */}
      <div className="friend-context-items">
        {onOpenChat && (
          <button
            type="button"
            className="friend-context-item"
            onClick={() => {
              onClose?.();
              onOpenChat(friend, conversationId);
            }}
          >
            <i className="fa-solid fa-comment-dots"></i>
            <span>Open Chat</span>
          </button>
        )}

        {onViewProfile && (
          <button
            type="button"
            className="friend-context-item"
            onClick={() => {
              onClose?.();
              onViewProfile(friend);
            }}
          >
            <i className="fa-solid fa-id-card"></i>
            <span>View Profile</span>
          </button>
        )}

        {onBlock && (
          <button
            type="button"
            className={`friend-context-item ${isBlocked ? 'warning' : 'danger'}`}
            onClick={() => {
              onClose?.();
              onBlock?.(friend);
            }}
            title={isBlocked ? `Unblock @${username}` : `Block @${username}`}
          >
            <i className={`fa-solid ${isBlocked ? 'fa-user-check' : 'fa-ban'}`}></i>
            <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
          </button>
        )}

        <div className="friend-context-divider" />

        <button
          type="button"
          className="friend-context-item danger"
          onClick={() => {
            onClose?.();
            onDelete?.(friend, conversationId);
          }}
          title={`Delete friend @${username} directly`}
        >
          <i className="fa-solid fa-trash-can"></i>
          <span>Delete Friend</span>
        </button>
      </div>
    </div>
  );
}

