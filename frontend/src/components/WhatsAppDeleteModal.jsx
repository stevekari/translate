import { useState } from 'react';
import { resolveAvatarUrl, handleAvatarError } from '../utils/avatarUrl';

export default function WhatsAppDeleteModal({
  isOpen,
  friend,
  onClose,
  onConfirm,
  isDeleting = false
}) {
  const [deleteMedia, setDeleteMedia] = useState(true);

  if (!isOpen || !friend) return null;

  const displayName = friend?.displayName || friend?.username || 'User';
  const username = friend?.username || '';
  const isDistinctName = displayName && username && displayName.trim().toLowerCase() !== username.trim().toLowerCase();

  return (
    <div className="wa-delete-overlay" onClick={!isDeleting ? onClose : undefined}>
      <div className="wa-delete-card" onClick={(e) => e.stopPropagation()}>
        <div className="wa-delete-header-row">
          <div className="wa-delete-avatar-wrap">
            <img
              src={resolveAvatarUrl(friend?.avatarUrl, displayName)}
              alt={username}
              className="wa-delete-avatar"
              onError={(e) => handleAvatarError(e, displayName || username)}
            />
          </div>
          <div className="wa-delete-icon-badge">
            <i className="fa-solid fa-trash-can"></i>
          </div>
        </div>

        <h3 className="wa-delete-title">
          Delete chat with {isDistinctName ? displayName : `@${username}`}?
        </h3>

        {isDistinctName && (
          <div className="wa-delete-handle">@{username}</div>
        )}

        <p className="wa-delete-sub">
          This friend will be permanently removed from your friends list and conversations. They will not return when you refresh.
        </p>

        <label className="wa-delete-checkbox-row">
          <input
            type="checkbox"
            checked={deleteMedia}
            onChange={(e) => setDeleteMedia(e.target.checked)}
            disabled={isDeleting}
          />
          <span>Also delete messages and media from servers</span>
        </label>

        <div className="wa-delete-actions">
          <button
            type="button"
            className="wa-btn-cancel"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="wa-btn-delete"
            onClick={() => onConfirm(friend, deleteMedia)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete chat</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

