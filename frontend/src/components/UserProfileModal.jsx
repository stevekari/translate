import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getUserProfile, blockUser, unblockUser, checkIsBlocked } from '../api/userApi';
import {
  startConversation,
  sendFriendRequest,
  getConversationWithUser,
  acceptChatRequest,
  declineChatRequest,
} from '../api/conversationApi';
import { formatJoinedDate, formatLastSeenText } from '../utils/timeAgo';
import { unmarkFriendDeleted } from '../utils/deletedFriends';
import { handleAvatarError, getInitials } from '../utils/avatarUrl';
import '../styles/profileModal.css';

export default function UserProfileModal({ user, userId, onClose, onStartCall }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(user || null);
  const [loading, setLoading] = useState(!user && Boolean(userId));
  const [relationship, setRelationship] = useState({ exists: false, status: 'NONE', isInitiator: false, conversationId: null });
  const [relLoading, setRelLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const targetId = String(user?.id || user?.userId || userId);
  const presenceState = useSelector((state) => state.presence?.userStatuses?.[targetId]);
  const isOnline = presenceState?.online ?? (presenceState?.status && presenceState?.status !== 'offline');
  const statusStr = presenceState?.status || profile?.customStatus || (isOnline ? 'online' : 'offline');
  const lastSeenVal = presenceState?.lastSeen || profile?.lastSeen;

  useEffect(() => {
    if (userId && (!user || !user.bio)) {
      setLoading(true);
      getUserProfile(userId)
        .then((data) => setProfile(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [userId, user]);

  useEffect(() => {
    const friendId = profile?.id || userId;
    if (friendId) {
      getConversationWithUser(friendId)
        .then((rel) => {
          if (rel && rel.status) {
            setRelationship(rel);
          }
        })
        .catch(() => {});

      checkIsBlocked(friendId)
        .then((res) => {
          if (res && res.blockedByMe !== undefined) {
            setIsBlocked(Boolean(res.blockedByMe));
          }
        })
        .catch(() => {});
    }
  }, [profile, userId]);

  if (!profile && !loading) return null;

  const displayName = profile?.displayName || profile?.username || 'User';
  const username = profile?.username || '';
  const avatarUrl = profile?.avatarUrl;
  const bio = profile?.bio || 'No bio provided yet.';
  const joinedText = formatJoinedDate(profile?.createdAt);
  const statusText = formatLastSeenText(isOnline, lastSeenVal, statusStr);

  const handleSendFriendRequest = async () => {
    const friendIdToUse = profile?.id || profile?.userId || userId;
    if (!friendIdToUse) return;
    try {
      setRelLoading(true);
      const res = await sendFriendRequest(friendIdToUse);
      setRelationship({
        exists: true,
        status: 'PENDING',
        isInitiator: true,
        conversationId: res?.conversationId || relationship?.conversationId,
      });
      setActionSuccessMsg('Friend request sent!');
      setTimeout(() => setActionSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Failed to send friend request', err);
    } finally {
      setRelLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    try {
      setRelLoading(true);
      await acceptChatRequest(relationship.conversationId);
      setRelationship((prev) => ({ ...prev, status: 'ACCEPTED' }));
      setActionSuccessMsg('Request accepted!');
      setTimeout(() => setActionSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Failed to accept request', err);
    } finally {
      setRelLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    try {
      setRelLoading(true);
      await declineChatRequest(relationship.conversationId);
      setRelationship((prev) => ({ ...prev, status: 'DECLINED' }));
    } catch (err) {
      console.error('Failed to decline request', err);
    } finally {
      setRelLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const friendIdToUse = profile?.id || profile?.userId || userId;
    if (!friendIdToUse) return;
    unmarkFriendDeleted(friendIdToUse, profile?.username);
    try {
      const res = await startConversation(friendIdToUse);
      onClose();
      navigate(`/chat/${res.conversationId}`, { state: { friend: profile } });
    } catch (err) {
      console.error('Failed to start chat', err);
    }
  };

  const handleToggleBlock = async () => {
    const friendIdToUse = profile?.id || profile?.userId || userId;
    if (!friendIdToUse) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await unblockUser(friendIdToUse);
        setIsBlocked(false);
        setActionSuccessMsg('User unblocked');
      } else {
        await blockUser(friendIdToUse);
        setIsBlocked(true);
        setActionSuccessMsg('User blocked');
      }
      setTimeout(() => setActionSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to toggle block:', err);
    } finally {
      setBlockLoading(false);
    }
  };

  const handleStartCall = (type) => {
    onClose();
    if (onStartCall) {
      onStartCall(profile, type);
    } else {
      handleSendMessage();
    }
  };

  const isAccepted = relationship.status === 'ACCEPTED';
  const isPending = relationship.status === 'PENDING';
  const isDeclined = relationship.status === 'DECLINED';
  const isNone = !relationship.exists || relationship.status === 'NONE';

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="profile-modal-close-btn" onClick={onClose} aria-label="Close">
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="profile-modal-header">
          <div className="profile-modal-avatar-wrapper">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="profile-modal-avatar"
                onError={(e) => handleAvatarError(e, displayName || username)}
              />
            ) : (
              <div className="profile-modal-avatar-fallback">
                {getInitials(displayName || username)}
              </div>
            )}
            <span className={`profile-modal-status-badge ${isOnline ? (statusStr === 'busy' ? 'busy' : 'online') : 'offline'}`} />
          </div>

          <h2 className="profile-modal-name">{displayName}</h2>
          <p className="profile-modal-handle">@{username}</p>

          <div className={`profile-modal-status-pill ${isOnline ? (statusStr === 'busy' ? 'busy' : 'online') : 'offline'}`}>
            <span className="profile-status-dot" />
            <span>{statusText}</span>
          </div>
        </div>

        <div className="profile-modal-body">
          <div className="profile-modal-section">
            <span className="profile-modal-section-title">About</span>
            <p className="profile-modal-bio">{bio}</p>
          </div>

          <div className="profile-modal-meta">
            <div className="profile-meta-item">
              <i className="fa-regular fa-calendar"></i>
              <span>{joinedText}</span>
            </div>
            {profile?.email && (
              <div className="profile-meta-item">
                <i className="fa-regular fa-envelope"></i>
                <span>{profile.email}</span>
              </div>
            )}
          </div>

          {actionSuccessMsg && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#4ade80',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              textAlign: 'center',
              margin: '10px 0'
            }}>
              <i className="fa-solid fa-circle-check"></i> {actionSuccessMsg}
            </div>
          )}
        </div>

        <div className="profile-modal-actions">
          {/* STATE 1: ALREADY FRIENDS */}
          {isAccepted && (
            <div className="profile-actions-row">
              <button
                type="button"
                className="profile-fb-btn primary message-btn"
                onClick={handleSendMessage}
              >
                <i className="fa-solid fa-comment-dots"></i>
                <span>Message</span>
              </button>
              <button
                type="button"
                className="profile-fb-btn secondary icon-btn"
                onClick={() => handleStartCall('voice')}
                title="Voice Call"
                aria-label="Voice Call"
              >
                <i className="fa-solid fa-phone"></i>
                <span>Voice</span>
              </button>
              <button
                type="button"
                className="profile-fb-btn secondary icon-btn"
                onClick={() => handleStartCall('video')}
                title="Video Call"
                aria-label="Video Call"
              >
                <i className="fa-solid fa-video"></i>
                <span>Video</span>
              </button>
            </div>
          )}

          {/* STATE 2: INCOMING REQUEST (User received friend request) -> FACEBOOK CONFIRM / DELETE */}
          {isPending && !relationship.isInitiator && (
            <div className="profile-actions-row">
              <button
                type="button"
                className="profile-fb-btn primary"
                onClick={handleAcceptRequest}
                disabled={relLoading}
              >
                <i className="fa-solid fa-user-check"></i>
                <span>Confirm</span>
              </button>
              <button
                type="button"
                className="profile-fb-btn secondary"
                onClick={handleDeclineRequest}
                disabled={relLoading}
              >
                <i className="fa-solid fa-xmark"></i>
                <span>Delete</span>
              </button>
            </div>
          )}

          {/* STATE 3: OUTGOING REQUEST (User sent request) -> FACEBOOK PENDING */}
          {isPending && relationship.isInitiator && (
            <div className="profile-actions-col">
              <div className="profile-actions-row">
                <button
                  type="button"
                  className="profile-fb-btn secondary pending-btn"
                  disabled
                >
                  <i className="fa-regular fa-clock"></i>
                  <span>Request Sent</span>
                </button>
                {relationship.conversationId && (
                  <button
                    type="button"
                    className="profile-fb-btn primary"
                    onClick={() => {
                      onClose();
                      navigate(`/chat/${relationship.conversationId}`, { state: { friend: profile } });
                    }}
                  >
                    <i className="fa-solid fa-comments"></i>
                    <span>Open Chat</span>
                  </button>
                )}
              </div>
              <span className="profile-pending-hint">Waiting for @{username} to respond</span>
            </div>
          )}

          {/* STATE 4: PREVIOUS REQUEST DECLINED */}
          {isDeclined && (
            <div className="profile-actions-col">
              <span className="profile-declined-hint">
                <i className="fa-solid fa-circle-exclamation"></i> Previous request was declined
              </span>
              <button
                type="button"
                className="profile-fb-btn primary full-width"
                onClick={handleSendFriendRequest}
                disabled={relLoading}
              >
                <i className="fa-solid fa-user-plus"></i>
                <span>Add Friend Again</span>
              </button>
            </div>
          )}

          {/* STATE 5: NOT FRIENDS -> FACEBOOK ADD FRIEND */}
          {isNone && (
            <button
              type="button"
              className="profile-fb-btn primary full-width"
              onClick={handleSendFriendRequest}
              disabled={relLoading}
            >
              <i className="fa-solid fa-user-plus"></i>
              <span>Add Friend</span>
            </button>
          )}

          {/* DISCRETE, COMPACT, OVERFLOW-PROOF BLOCK / UNBLOCK OPTION */}
          <div className="profile-modal-block-wrap">
            <button
              type="button"
              className={`profile-compact-block-btn ${isBlocked ? 'is-blocked' : ''}`}
              onClick={handleToggleBlock}
              disabled={blockLoading}
              title={isBlocked ? 'Unblock user' : 'Block user'}
            >
              <i className={`fa-solid ${isBlocked ? 'fa-user-check' : 'fa-ban'}`}></i>
              <span>{isBlocked ? 'Unblock User' : 'Block User'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

