import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyConversations, startConversation, sendMessageRest } from '../api/conversationApi';
import { resolveAvatarUrl, handleAvatarError } from '../utils/avatarUrl';
import { generateQRCodeSVG } from '../utils/qrGenerator';

export default function GlobalCommunityModal({ isOpen, onClose, user }) {
  const navigate = useNavigate();
  const [friendsList, setFriendsList] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [sharingToId, setSharingToId] = useState(null);
  const [sharedSuccessId, setSharedSuccessId] = useState(null);

  const username = user?.username || user?.displayName || 'user';
  const shareLink = `${window.location.origin}/register?ref=${encodeURIComponent(username)}`;
  const inviteMessage = `Hey! Join me on Giochat - the real-time AI live translated community & chat app: ${shareLink}`;

  // QR Code SVG
  const qrSvg = useMemo(() => {
    try {
      return generateQRCodeSVG(shareLink, 220);
    } catch {
      return null;
    }
  }, [shareLink]);

  // Load friends/conversations when modal is opened
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingFriends(true);

    getMyConversations()
      .then((convs) => {
        if (!isMounted) return;
        const currentUserId = user?.userId || user?.id;
        const list = [];
        const seen = new Set();

        if (Array.isArray(convs)) {
          for (const c of convs) {
            const participants = c.participants || [];
            const other = participants.find((p) => String(p.id || p.userId) !== String(currentUserId));
            if (other && !seen.has(other.id || other.userId)) {
              seen.add(other.id || other.userId);
              list.push({
                id: other.id || other.userId,
                username: other.username,
                displayName: other.displayName || other.username,
                avatarUrl: other.avatarUrl,
                conversationId: c.conversationId || c.id,
              });
            }
          }
        }
        setFriendsList(list);
      })
      .catch((err) => {
        console.warn('Failed to load friends for community modal:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingFriends(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Giochat',
          text: inviteMessage,
          url: shareLink,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Open Chat with friend
  const handleOpenChat = async (friend) => {
    onClose();
    if (friend.conversationId) {
      navigate(`/chat/${friend.conversationId}`);
    } else {
      try {
        const conv = await startConversation(friend.id);
        if (conv?.id) {
          navigate(`/chat/${conv.id}`);
        } else {
          navigate('/friends');
        }
      } catch (err) {
        console.error('Failed to start chat:', err);
        navigate('/friends');
      }
    }
  };

  // Share invite link directly to friend's conversation
  const handleShareToFriend = async (friend) => {
    setSharingToId(friend.id);
    try {
      let convId = friend.conversationId;
      if (!convId) {
        const conv = await startConversation(friend.id);
        convId = conv?.id;
      }
      if (convId) {
        await sendMessageRest(convId, {
          content: `🌟 Here is my personal Giochat invite link: ${shareLink}\nShare it with friends or family to connect instantly!`,
          type: 'text',
        });
        setSharedSuccessId(friend.id);
        setTimeout(() => setSharedSuccessId(null), 2500);
      }
    } catch (err) {
      console.error('Failed to send share message to friend:', err);
      handleCopyLink();
    } finally {
      setSharingToId(null);
    }
  };

  const filteredFriends = friendsList.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return f.displayName?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q);
  });

  return (
    <div className="gcm-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Global Community & Friends">
      <div className="gcm-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Top Header - Weather UX Style */}
        <div className="gcm-header">
          <div className="gcm-header-title-wrap">
            <i className="fa-solid fa-users-rays gcm-header-icon" />
            <div className="gcm-header-text">
              <h2 className="gcm-title">Global Community &amp; Friends</h2>
              <span className="gcm-sub">Select friends to chat &amp; share your invite link worldwide 🌍</span>
            </div>
          </div>
          <button
            type="button"
            className="weather-close-btn gcm-top-close-btn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Modal Body: gcm-body */}
        <div className="gcm-body">
          {/* 1. Share Hub Section */}
          <section className="gcm-card-section">
            <div className="gcm-section-header">
              <i className="fa-solid fa-bullhorn" />
              <span>Your Personal Invite Link:</span>
            </div>

            <div className="gcm-link-bar">
              <div className="gcm-link-text" title={shareLink}>
                {shareLink}
              </div>
              <button
                type="button"
                className={`gcm-copy-pill ${copiedLink ? 'copied' : ''}`}
                onClick={handleCopyLink}
                title="Copy personal invite link"
              >
                <i className={`fa-solid ${copiedLink ? 'fa-check' : 'fa-copy'}`} />
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            <div className="gcm-social-grid">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="gcm-social-chip whatsapp"
                title="Share via WhatsApp"
              >
                <i className="fa-brands fa-whatsapp" />
                <span>WhatsApp</span>
              </a>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(inviteMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="gcm-social-chip telegram"
                title="Share via Telegram"
              >
                <i className="fa-brands fa-telegram" />
                <span>Telegram</span>
              </a>

              <button
                type="button"
                className="gcm-social-chip native-share"
                onClick={handleNativeShare}
                title="Share via system apps"
              >
                <i className="fa-solid fa-share-nodes" />
                <span>Share...</span>
              </button>

              <button
                type="button"
                className={`gcm-social-chip qr-chip ${showQrCode ? 'active' : ''}`}
                onClick={() => setShowQrCode(!showQrCode)}
                title="Toggle QR Code to scan in person"
              >
                <i className="fa-solid fa-qrcode" />
                <span>{showQrCode ? 'Hide QR' : 'QR Code'}</span>
              </button>
            </div>

            {/* In-Person QR Code Card */}
            {showQrCode && qrSvg && (
              <div className="gcm-qr-card-weather animate-fade-in">
                <div className="gcm-qr-svg-wrap" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                <p className="gcm-qr-hint">Scan with camera to connect on Giochat instantly</p>
              </div>
            )}
          </section>

          {/* 2. Select & Share with Friends Section */}
          <section className="gcm-card-section gcm-friends-section">
            <div className="gcm-section-header">
              <i className="fa-solid fa-user-group" />
              <span>Select Friends to Chat or Share With ({friendsList.length}):</span>
            </div>

            {/* Search Input matching Weather toolbar */}
            <div className="weather-search-wrapper gcm-search-wrap">
              <i className="fa-solid fa-magnifying-glass weather-search-icon" />
              <input
                type="text"
                className="weather-search-input gcm-search-input"
                placeholder="Search friends by name or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search friends"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="weather-search-clear gcm-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <i className="fa-solid fa-circle-xmark" />
                </button>
              )}
            </div>

            {/* Friends List Container */}
            <div className="gcm-friends-list">
              {loadingFriends ? (
                <div className="gcm-empty-card">
                  <i className="fa-solid fa-circle-notch fa-spin" />
                  <span>Loading your friends...</span>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="gcm-empty-card">
                  <i className="fa-solid fa-user-plus" />
                  <span>
                    {searchQuery
                      ? 'No friends match your search.'
                      : 'No friends connected yet. Share your invite link above to bring friends to Giochat!'}
                  </span>
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSharing = sharingToId === friend.id;
                  const isSuccess = sharedSuccessId === friend.id;

                  return (
                    <div key={friend.id} className="gcm-friend-row">
                      <div className="gcm-friend-left" onClick={() => handleOpenChat(friend)} title={`Chat with ${friend.displayName}`}>
                        <div className="gcm-friend-avatar-wrap">
                          <img
                            src={resolveAvatarUrl(friend.avatarUrl, friend.displayName || friend.username)}
                            alt={friend.username}
                            className="gcm-friend-avatar"
                            onError={(e) => handleAvatarError(e, friend.displayName || friend.username)}
                          />
                          <span className="gcm-status-dot online" />
                        </div>
                        <div className="gcm-friend-info">
                          <span className="gcm-friend-name">{friend.displayName}</span>
                          <span className="gcm-friend-handle">@{friend.username}</span>
                        </div>
                      </div>

                      <div className="gcm-friend-actions">
                        <button
                          type="button"
                          className={`gcm-action-pill share-to-chat ${isSuccess ? 'success' : ''}`}
                          onClick={() => handleShareToFriend(friend)}
                          disabled={isSharing}
                          title="Send your invite link directly into chat with this friend"
                        >
                          {isSharing ? (
                            <i className="fa-solid fa-spinner fa-spin" />
                          ) : isSuccess ? (
                            <>
                              <i className="fa-solid fa-circle-check" />
                              <span>Sent!</span>
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-paper-plane" />
                              <span>Share Link</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          className="gcm-action-pill chat-direct"
                          onClick={() => handleOpenChat(friend)}
                          title={`Open chat with ${friend.displayName}`}
                        >
                          <i className="fa-solid fa-comment-dots" />
                          <span>Chat</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* 3. CANCEL BUTTON inside gcm-body */}
          <div className="gcm-cancel-row">
            <button
              type="button"
              className="gcm-cancel-btn"
              onClick={onClose}
              title="Cancel and close modal"
              aria-label="Cancel"
            >
              <i className="fa-solid fa-xmark" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
