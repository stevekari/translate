import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchUsers, getPresenceMap, blockUser } from "../api/userApi";
import { getMyConversations, startConversation, acceptChatRequest, declineChatRequest, deleteConversation, deleteConversationWithUser } from "../api/conversationApi";
import FriendCard from "../components/FriendCard";
import UserProfileModal from "../components/UserProfileModal";
import FriendContextMenu from "../components/FriendContextMenu";
import WhatsAppDeleteModal from "../components/WhatsAppDeleteModal";
import { isFriendDeleted, markFriendAsDeleted, unmarkFriendDeleted } from "../utils/deletedFriends";
import { getMessagePreview } from "../utils/messageContent";
import { resolveAvatarUrl } from "../utils/avatarUrl";
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

  useEffect(() => {
    getMyConversations()
     .then((items) => {
       const filtered = Array.isArray(items) ? items.filter((c) => !isFriendDeleted(c.otherUser)) : [];
       setConversations(filtered);
       dispatch(setConversationState(filtered));
     })
     .finally(() => setLoading(false));

    getPresenceMap()
      .then((presence) => {
        if (presence && typeof presence === 'object') {
          dispatch(setUserStatuses(presence));
        }
      })
      .catch(() => {});
  }, [dispatch]);

  const sortedConversations = useMemo(() => {
    return [...conversations]
      .filter((c) => !isFriendDeleted(c.otherUser))
      .sort((a, b) => {
        const timeA = new Date(liveConversations[a.conversationId]?.lastMessageAt ?? a.lastMessageTime ?? a.createdAt ?? 0).getTime();
        const timeB = new Date(liveConversations[b.conversationId]?.lastMessageAt ?? b.lastMessageTime ?? b.createdAt ?? 0).getTime();
        return timeB - timeA;
      });
  }, [conversations, liveConversations]);

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
            setSearchResults(results);
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
  }, [trimmedSearch, dispatch]);

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
    } catch (err) {
      console.error('Failed to decline request:', err);
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

        {/* Prominent Incoming Friend Requests Banner for Kwame / Recipient */}
        {incomingRequests.length > 0 && (
          <div className="incoming-requests-container">
            <div className="incoming-requests-header">
              <span className="incoming-badge">{incomingRequests.length}</span>
              <span>Incoming Friend Requests</span>
            </div>
            {incomingRequests.map((req) => {
              const reqDisplayName = req.otherUser?.displayName || req.otherUser?.username || 'User';
              return (
                <div
                  key={req.conversationId}
                  className="incoming-request-item"
                  onClick={() =>
                    navigate(`/chat/${req.conversationId}`, {
                      state: { friend: req.otherUser },
                    })
                  }
                >
                  <div
                    className="incoming-req-avatar-wrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProfileUser(req.otherUser);
                    }}
                  >
                    <img
                      src={resolveAvatarUrl(req.otherUser?.avatarUrl, reqDisplayName)}
                      alt={reqDisplayName}
                      className="incoming-req-avatar"
                    />
                  </div>
                  <div className="incoming-req-details">
                    <strong className="incoming-req-name">{reqDisplayName}</strong>
                    <span className="incoming-req-text">sent you a request</span>
                  </div>
                  <div className="incoming-req-actions">
                    <button
                      type="button"
                      className="btn-req-accept-icon"
                      onClick={(e) => handleQuickAccept(e, req.conversationId)}
                      title="Accept Request"
                      aria-label="Accept Request"
                    >
                      <i className="fa-solid fa-check"></i>
                    </button>
                    <button
                      type="button"
                      className="btn-req-decline-icon"
                      onClick={(e) => handleQuickDecline(e, req.conversationId)}
                      title="Decline Request"
                      aria-label="Decline Request"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Outgoing Friend Requests Pending */}
        {outgoingRequests.length > 0 && (
          <div className="incoming-requests-container" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
            <div className="incoming-requests-header" style={{ color: '#818cf8' }}>
              <span className="incoming-badge" style={{ background: '#4f46e5' }}>{outgoingRequests.length}</span>
              <span>Pending Requests Sent</span>
            </div>
            {outgoingRequests.map((req) => (
              <div
                key={req.conversationId}
                className="incoming-request-item"
                style={{ opacity: 0.9 }}
                onClick={() =>
                  navigate(`/chat/${req.conversationId}`, {
                    state: { friend: req.otherUser },
                  })
                }
              >
                <div className="incoming-req-info">
                  <span className="incoming-req-name">@{req.otherUser?.username || 'User'}</span>
                  <span className="incoming-req-text">waiting for acceptance</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {mutualFriendsConversations.length === 0 && incomingRequests.length === 0 && (
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