import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { searchUsers, getPresenceMap, blockUser } from "../api/userApi";
import { getMyConversations, startConversation, acceptChatRequest, declineChatRequest, deleteConversation, deleteConversationWithUser } from "../api/conversationApi";
import FriendCard from "../components/FriendCard";
import UserProfileModal from "../components/UserProfileModal";
import FriendContextMenu from "../components/FriendContextMenu";
import WhatsAppDeleteModal from "../components/WhatsAppDeleteModal";
import { isFriendDeleted, markFriendAsDeleted, unmarkFriendDeleted } from "../utils/deletedFriends";
import { getMessagePreview } from "../utils/messageContent";
import { resolveAvatarUrl, handleAvatarError } from "../utils/avatarUrl";
import { getUserActivitySummary } from "../utils/timeAgo";
import { useLanguage } from '../contexts/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import { setConversations as setConversationState } from '../store/slices/chatSlice';
import { setUserStatuses } from '../store/slices/presenceSlice';
import { useAuth } from '../hooks/useAuth';

export default function FriendsList() {
  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [friendTab, setFriendTab] = useState('all'); // 'all', 'requests', 'sent'
  const [requestFeedback, setRequestFeedback] = useState({});
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const liveConversations = useSelector((state) => state.chat.conversations);
  const onlineIds = useSelector((state) => state.presence?.onlineIds || []);
  const userStatuses = useSelector((state) => state.presence?.userStatuses || {});
  const { t } = useLanguage();

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, friend: null, conversationId: null });

  const handleContextMenu = (e, friend, conversationId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      friend,
      conversationId
    });
  };

  const [deleteModalTarget, setDeleteModalTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteFriend = (friend, e, conversationId) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDeleteModalTarget({ friend, conversationId });
  };

  const handleConfirmDelete = async (friend, deleteMedia) => {
    const target = friend || deleteModalTarget?.friend;
    if (!target) return;
    setIsDeleting(true);

    const fId = target.id || target.userId || target._id;
    const cId = deleteModalTarget?.conversationId;

    // 1. Mark permanently deleted so they NEVER return on refresh
    markFriendAsDeleted(fId, target.username);

    // 2. Optimistically remove immediately from conversations & search results
    setConversations((prev) => prev.filter((c) => c.conversationId !== cId && c.otherUser?.id !== fId && c.otherUser?.userId !== fId));
    setSearchResults((prev) => prev.filter((u) => u.id !== fId && u.userId !== fId));

    try {
      const calls = [];
      if (cId) calls.push(deleteConversation(cId));
      if (fId) calls.push(deleteConversationWithUser(fId));
      await Promise.allSettled(calls);
    } catch (err) {
      console.warn('Backend delete completed:', err);
    } finally {
      setIsDeleting(false);
      setDeleteModalTarget(null);
    }
  };

  const handleBlockFriend = async (targetFriend) => {
    const fId = targetFriend?.id || targetFriend?.userId;
    if (!fId) return;
    try {
      await blockUser(fId);
      setConversations((prev) => prev.filter((c) => c.otherUser?.id !== fId && c.otherUser?.userId !== fId));
    } catch (err) {
      console.error('Failed to block friend:', err);
    }
  };

  const fetchConversations = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const items = await getMyConversations();
      const filtered = Array.isArray(items)
        ? items.filter((c) => {
            if (!c?.otherUser || isFriendDeleted(c.otherUser)) return false;
            const otherId = c.otherUser.id || c.otherUser.userId;
            if (otherId && currentUserId && String(otherId) === String(currentUserId)) return false;
            if (c.otherUser.username && user?.username && c.otherUser.username.trim().toLowerCase() === user.username.trim().toLowerCase()) return false;
            return true;
          })
        : [];
      setConversations(filtered);
      dispatch(setConversationState(filtered));
    } catch (err) {
      console.warn('Failed to fetch conversations:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [currentUserId, dispatch, user?.username]);

  // Initial load on mount
  useEffect(() => {
    fetchConversations(true);

    getPresenceMap()
      .then((presence) => {
        if (presence && typeof presence === 'object') {
          dispatch(setUserStatuses(presence));
        }
      })
      .catch(() => {});
  }, [fetchConversations, dispatch]);

  // Real-time synchronization: listen for live friend requests and updates without page refresh
  useEffect(() => {
    const handleUpdated = (e) => {
      const items = e?.detail;
      if (Array.isArray(items)) {
        const filtered = items.filter((c) => {
          if (!c?.otherUser || isFriendDeleted(c.otherUser)) return false;
          const otherId = c.otherUser.id || c.otherUser.userId;
          if (otherId && currentUserId && String(otherId) === String(currentUserId)) return false;
          if (c.otherUser.username && user?.username && c.otherUser.username.trim().toLowerCase() === user.username.trim().toLowerCase()) return false;
          return true;
        });
        setConversations(filtered);
      } else {
        fetchConversations(false);
      }
    };

    window.addEventListener('giochat-conversations-updated', handleUpdated);

    // Background poll every 4 seconds to guarantee zero-refresh friend request reception
    const pollInterval = setInterval(() => {
      fetchConversations(false);
    }, 4000);

    return () => {
      window.removeEventListener('giochat-conversations-updated', handleUpdated);
      clearInterval(pollInterval);
    };
  }, [fetchConversations, currentUserId, user?.username]);

  const sortedConversations = useMemo(() => {
    return [...conversations]
      .filter((c) => {
        if (!c?.otherUser || isFriendDeleted(c.otherUser)) return false;
        const otherId = c.otherUser.id || c.otherUser.userId;
        if (otherId && currentUserId && String(otherId) === String(currentUserId)) return false;
        if (c.otherUser.username && user?.username && c.otherUser.username.trim().toLowerCase() === user.username.trim().toLowerCase()) return false;
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(liveConversations[a.conversationId]?.lastMessageAt ?? a.lastMessageTime ?? a.createdAt ?? 0).getTime();
        const timeB = new Date(liveConversations[b.conversationId]?.lastMessageAt ?? b.lastMessageTime ?? b.createdAt ?? 0).getTime();
        return timeB - timeA;
      });
  }, [conversations, liveConversations, currentUserId, user?.username]);

  const trimmedSearch = search.trim();

  useEffect(() => {
    if (trimmedSearch.length < 3) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(() => {
      Promise.all([searchUsers(trimmedSearch), getPresenceMap().catch(() => ({}))])
        .then(([results, presence]) => {
          if (!cancelled) {
            if (presence && typeof presence === 'object') {
              dispatch(setUserStatuses(presence));
            }
            const filtered = (results || []).filter((u) => {
              const uId = u.id || u.userId;
              if (uId && currentUserId && String(uId) === String(currentUserId)) return false;
              if (u.username && user?.username && u.username.trim().toLowerCase() === user.username.trim().toLowerCase()) return false;
              return true;
            });
            setSearchResults(filtered);
          }
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedSearch, dispatch, currentUserId, user?.username]);

  const incomingRequests = useMemo(() => {
    return sortedConversations.filter(
      (c) => c.status === 'PENDING' && c.initiatorId != null && String(c.initiatorId) !== String(currentUserId)
    );
  }, [sortedConversations, currentUserId]);

  const outgoingRequests = useMemo(() => {
    return sortedConversations.filter(
      (c) => c.status === 'PENDING' && c.initiatorId != null && String(c.initiatorId) === String(currentUserId)
    );
  }, [sortedConversations, currentUserId]);

  const mutualFriendsConversations = useMemo(() => {
    return sortedConversations.filter((c) => c.status === 'ACCEPTED');
  }, [sortedConversations]);

  const handleQuickAccept = async (e, convId) => {
    e.stopPropagation();
    try {
      await acceptChatRequest(convId);
      setConversations((prev) =>
        prev.map((c) => (c.conversationId === convId ? { ...c, status: 'ACCEPTED' } : c))
      );
      setRequestFeedback((prev) => ({ ...prev, [convId]: 'accepted' }));
      window.dispatchEvent(new CustomEvent('giochat-conversations-updated'));
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const handleQuickDecline = async (e, convId) => {
    e.stopPropagation();
    try {
      await declineChatRequest(convId);
      setConversations((prev) =>
        prev.map((c) => (c.conversationId === convId ? { ...c, status: 'DECLINED' } : c))
      );
      setRequestFeedback((prev) => ({ ...prev, [convId]: 'declined' }));
      window.dispatchEvent(new CustomEvent('giochat-conversations-updated'));
    } catch (err) {
      console.error('Failed to decline request:', err);
    }
  };

  const handleCancelOutgoing = async (e, convId) => {
    e.stopPropagation();
    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.conversationId !== convId));
      window.dispatchEvent(new CustomEvent('giochat-conversations-updated'));
    } catch (err) {
      console.error('Failed to cancel request:', err);
    }
  };

  const openChat = async (friend) => {
    unmarkFriendDeleted(friend.id || friend.userId, friend.username);
    try {
      const { conversationId } = await startConversation(friend.id);
      navigate(`/chat/${conversationId}`, { state: { friend } });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectFromSearch = (friend) => {
    unmarkFriendDeleted(friend.id || friend.userId, friend.username);
    setSearch("");
    setSearchFocused(false);
    setSelectedProfileUser(friend);
  };

  const showSearchPopup = searchFocused && trimmedSearch.length >= 3;

  const handleStartCall = async (friend, type) => {
    unmarkFriendDeleted(friend.id || friend.userId, friend.username);
    try {
      const { conversationId } = await startConversation(friend.id);
      navigate(`/chat/${conversationId}`, {
        state: { friend, startCallOnMount: type }
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="page-loading">{t('loadingFriends')}</div>;

  return (
    <div className="friends-page-layout">
      <aside className="chat-sidebar friends-sidebar">
        <h2>{t('friends')} <span className="friends-count">({t('friendsCount', { count: mutualFriendsConversations.length })})</span></h2>

        <div className="friends-search">
          <div className="search-bar">
            <input
              type="text"
              placeholder={t('search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            />
            {search && (
              <button
                className="search-clear"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearch("")}
                aria-label={t('clearSearch')}
              >
                ×
              </button>
            )}
          </div>

          {showSearchPopup && (
            <div className="search-popup">
              {searchLoading && (
                <div className="search-popup-empty">{t('searching')}</div>
              )}
              {!searchLoading && searchResults.length === 0 && (
                <div className="search-popup-empty">{t('noFriendsFound')}</div>
              )}
              {!searchLoading &&
                searchResults.map((friend, index) => (
                  <div
                    key={friend.id}
                    className="search-popup-item"
                    style={{ animationDelay: `${index * 30}ms` }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectFromSearch(friend)}
                  >
                    <FriendCard
                      friend={friend}
                      onAvatarClick={(f) => handleSelectFromSearch(f)}
                      onContextMenu={(e, f) => handleContextMenu(e, f)}
                      onDelete={(f, e) => handleDeleteFriend(f, e)}
                    />
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Facebook Friends Navigation Tabs */}
        <div className="fb-requests-nav-tabs">
          <button
            type="button"
            className={`fb-req-tab-btn ${friendTab === 'all' ? 'active' : ''}`}
            onClick={() => setFriendTab('all')}
          >
            <i className="fa-solid fa-user-group" />
            <span>All Friends</span>
          </button>
          <button
            type="button"
            className={`fb-req-tab-btn ${friendTab === 'requests' ? 'active' : ''}`}
            onClick={() => setFriendTab('requests')}
          >
            <i className="fa-solid fa-user-plus" />
            <span>Requests</span>
            {incomingRequests.length > 0 && (
              <span className="fb-badge-alert">{incomingRequests.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`fb-req-tab-btn ${friendTab === 'sent' ? 'active' : ''}`}
            onClick={() => setFriendTab('sent')}
          >
            <i className="fa-solid fa-paper-plane" />
            <span>Sent ({outgoingRequests.length})</span>
          </button>
        </div>

        {/* 1. Requests Tab View */}
        {friendTab === 'requests' && (
          <div className="fb-requests-stream">
            {incomingRequests.length === 0 ? (
              <div className="no-chats-box">
                <i className="fa-solid fa-user-check no-chats-icon" style={{ color: '#1877f2' }} />
                <h3 className="no-chats-title">No Pending Requests</h3>
                <p className="no-chats-desc">When someone sends you a friend request on Giochat, it will appear here.</p>
              </div>
            ) : (
              incomingRequests.map((req) => {
                const reqDisplayName = req.otherUser?.displayName || req.otherUser?.username || 'User';
                const statusFeedback = requestFeedback[req.conversationId];
                return (
                  <div key={req.conversationId} className="fb-request-card">
                    <div
                      className="fb-request-avatar-wrap"
                      onClick={() => setSelectedProfileUser(req.otherUser)}
                      title="View Profile"
                    >
                      <img
                        src={resolveAvatarUrl(req.otherUser?.avatarUrl, reqDisplayName)}
                        alt={reqDisplayName}
                        className="fb-request-avatar"
                        onError={(e) => handleAvatarError(e, reqDisplayName)}
                      />
                    </div>
                    <div className="fb-request-body">
                      <div className="fb-request-name-row">
                        <strong
                          className="fb-request-name"
                          onClick={() => setSelectedProfileUser(req.otherUser)}
                        >
                          {reqDisplayName}
                        </strong>
                        <span className="fb-request-handle">@{req.otherUser?.username}</span>
                      </div>
                      <span className="fb-request-meta-text">
                        <i className="fa-solid fa-user-clock" /> Sent you a friend request
                      </span>

                      {statusFeedback === 'accepted' ? (
                        <div className="fb-request-status-banner">
                          <span className="fb-status-msg-accepted">
                            <i className="fa-solid fa-circle-check" /> Request Confirmed!
                          </span>
                          <button
                            type="button"
                            className="fb-btn-jump-chat"
                            onClick={() =>
                              navigate(`/chat/${req.conversationId}`, {
                                state: { friend: req.otherUser },
                              })
                            }
                          >
                            <i className="fa-solid fa-message" /> Message
                          </button>
                        </div>
                      ) : statusFeedback === 'declined' ? (
                        <div className="fb-request-status-banner">
                          <span className="fb-status-msg-deleted">Request removed</span>
                        </div>
                      ) : (
                        <div className="fb-request-actions-row">
                          <button
                            type="button"
                            className="fb-btn-confirm"
                            onClick={(e) => handleQuickAccept(e, req.conversationId)}
                          >
                            <i className="fa-solid fa-check" /> Confirm
                          </button>
                          <button
                            type="button"
                            className="fb-btn-delete"
                            onClick={(e) => handleQuickDecline(e, req.conversationId)}
                          >
                            <i className="fa-solid fa-xmark" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. Sent Tab View */}
        {friendTab === 'sent' && (
          <div className="fb-requests-stream">
            {outgoingRequests.length === 0 ? (
              <div className="no-chats-box">
                <i className="fa-solid fa-paper-plane no-chats-icon" />
                <h3 className="no-chats-title">No Sent Requests</h3>
                <p className="no-chats-desc">Use search above to find users and connect with friends.</p>
              </div>
            ) : (
              outgoingRequests.map((req) => (
                <div key={req.conversationId} className="fb-request-card">
                  <div
                    className="fb-request-avatar-wrap"
                    onClick={() => setSelectedProfileUser(req.otherUser)}
                  >
                    <img
                      src={resolveAvatarUrl(req.otherUser?.avatarUrl, req.otherUser?.displayName || req.otherUser?.username)}
                      alt={req.otherUser?.username}
                      className="fb-request-avatar"
                      onError={(e) => handleAvatarError(e, req.otherUser?.displayName || req.otherUser?.username)}
                    />
                  </div>
                  <div className="fb-request-body">
                    <div className="fb-request-name-row">
                      <strong className="fb-request-name">{req.otherUser?.displayName || req.otherUser?.username}</strong>
                      <span className="fb-request-handle">@{req.otherUser?.username}</span>
                    </div>
                    <span className="fb-request-meta-text" style={{ color: '#f59e0b' }}>
                      <i className="fa-solid fa-clock" /> Waiting for response
                    </span>
                    <div className="fb-request-actions-row">
                      <button
                        type="button"
                        className="fb-btn-cancel-req"
                        onClick={(e) => handleCancelOutgoing(e, req.conversationId)}
                      >
                        Cancel Request
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. All Friends Tab View */}
        {friendTab === 'all' && (
          <>
            {/* Quick banner notice if incoming requests exist */}
            {incomingRequests.length > 0 && (
              <div
                className="fb-request-card"
                style={{
                  background: 'rgba(24, 119, 242, 0.08)',
                  borderColor: 'rgba(24, 119, 242, 0.25)',
                  cursor: 'pointer',
                  marginBottom: '12px'
                }}
                onClick={() => setFriendTab('requests')}
              >
                <div className="fb-request-avatar-wrap" style={{ width: '42px', height: '42px' }}>
                  <img
                    src={resolveAvatarUrl(incomingRequests[0].otherUser?.avatarUrl, incomingRequests[0].otherUser?.displayName || incomingRequests[0].otherUser?.username)}
                    alt="Incoming"
                    className="fb-request-avatar"
                    onError={(e) => handleAvatarError(e, incomingRequests[0].otherUser?.displayName || incomingRequests[0].otherUser?.username)}
                  />
                </div>
                <div className="fb-request-body">
                  <strong className="fb-request-name" style={{ fontSize: '0.9rem' }}>
                    {incomingRequests[0].otherUser?.displayName || incomingRequests[0].otherUser?.username} {incomingRequests.length > 1 ? `and ${incomingRequests.length - 1} others` : ''} sent you a request
                  </strong>
                  <span className="fb-request-meta-text">Tap to review requests ({incomingRequests.length})</span>
                </div>
                <i className="fa-solid fa-chevron-right" style={{ color: '#1877f2', fontSize: '0.9rem' }} />
              </div>
            )}

            {mutualFriendsConversations.length === 0 && (
              <div className="no-chats-box">
                <i className="fa-solid fa-user-group no-chats-icon" />
                <h3 className="no-chats-title">No Mutual Friends Yet</h3>
                <p className="no-chats-desc">Only accepted mutual friends appear here. Use search above to find usernames and connect.</p>
              </div>
            )}

            <div className="friends-list">
              {mutualFriendsConversations.map((conv) => (
                <FriendCard
                  key={conv.conversationId}
                  friend={conv.otherUser}
                  conversationId={conv.conversationId}
                  lastMessage={getMessagePreview(liveConversations[conv.conversationId]?.lastMessage ?? conv.lastMessage)}
                  lastMessageAt={liveConversations[conv.conversationId]?.lastMessageAt ?? conv.lastMessageTime}
                  status={conv.status}
                  initiatorId={conv.initiatorId}
                  currentUserId={currentUserId}
                  onAvatarClick={(friend) => setSelectedProfileUser(friend)}
                  onContextMenu={(e, friend, cId) => handleContextMenu(e, friend, cId)}
                  onDelete={(friend, e, cId) => handleDeleteFriend(friend, e, cId)}
                  onClick={() =>
                    navigate(`/chat/${conv.conversationId}`, {
                      state: { friend: conv.otherUser },
                    })
                  }
                />
              ))}
            </div>
          </>
        )}
      </aside>

      <section className="friends-placeholder">
        <div className="empty-state">
          {t('selectFriend')}
        </div>
      </section>

      {selectedProfileUser && (
        <UserProfileModal
          user={selectedProfileUser}
          userId={selectedProfileUser.id || selectedProfileUser.userId}
          onClose={() => setSelectedProfileUser(null)}
          onStartCall={(friend, type) => handleStartCall(friend, type)}
        />
      )}

      {contextMenu.visible && (
        <FriendContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          friend={contextMenu.friend}
          conversationId={contextMenu.conversationId}
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, friend: null, conversationId: null })}
          onDelete={(friend, cId) => handleDeleteFriend(friend, null, cId)}
          onOpenChat={(friend, cId) => {
            if (cId) {
              navigate(`/chat/${cId}`, { state: { friend } });
            } else {
              startConversation(friend.id).then((c) => {
                navigate(`/chat/${c.conversationId}`, { state: { friend } });
              }).catch(() => {});
            }
          }}
          onViewProfile={(friend) => setSelectedProfileUser(friend)}
          onBlock={(friend) => handleBlockFriend(friend)}
        />
      )}

      {/* WhatsApp-Style Delete Modal */}
      <WhatsAppDeleteModal
        isOpen={Boolean(deleteModalTarget)}
        friend={deleteModalTarget?.friend}
        isDeleting={isDeleting}
        onClose={() => !isDeleting && setDeleteModalTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}