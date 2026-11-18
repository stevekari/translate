import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import {
  getMessages,
  getMyConversations,
  startConversation,
  getConversationDetails,
  acceptChatRequest,
  declineChatRequest,
  resendChatRequest,
  deleteConversation,
  deleteConversationWithUser,
} from '../api/conversationApi';
import { searchUsers, getPresenceMap, updateProfile, blockUser, unblockUser, checkIsBlocked } from '../api/userApi';
import { useWebSocket } from '../hooks/useWebSocket';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import FriendCard from '../components/FriendCard';
import UserProfileModal from '../components/UserProfileModal';
import FriendContextMenu from '../components/FriendContextMenu';
import WhatsAppDeleteModal from '../components/WhatsAppDeleteModal';
import LanguagePickerModal from '../components/LanguagePickerModal';
import { getLanguageInfo } from '../utils/languages';
import { getMessagePreview } from '../utils/messageContent';
import { resolveAvatarUrl, handleAvatarError } from '../utils/avatarUrl';
import { formatTimeAgo, getUserActivitySummary } from '../utils/timeAgo';
import { isFriendDeleted, markFriendAsDeleted, unmarkFriendDeleted } from '../utils/deletedFriends';
import { useLanguage } from '../contexts/LanguageContext';
import { useWebRTCCall } from '../hooks/useWebRTCCall';
import CallPanel from '../components/CallPanel';
import QRRoomModal from '../components/QRRoomModal';
import PronunciationModal from '../components/PronunciationModal';
import FamilyDictionaryModal from '../components/FamilyDictionaryModal';
import FamilyProfileModal from '../components/FamilyProfileModal';
import VoiceTranslateModal from '../components/VoiceTranslateModal';
import { getFriendFamilyProfile } from '../utils/familyProfiles';
import { getFadingModeConfig, saveFadingModeConfig } from '../utils/fadingTranslation';
import { useDispatch, useSelector } from 'react-redux';
import { setActiveConversation, setMessages as setStoreMessages, addMessage as addStoreMessage, updateMessage as updateStoreMessage } from '../store/slices/chatSlice';
import { setUserStatuses } from '../store/slices/presenceSlice';

export default function Chat({ currentUserId, currentUser }) {
  const { conversationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedFriend = location.state?.friend;
  const { t, language, setLanguage } = useLanguage();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setActiveConversation(conversationId));
    return () => dispatch(setActiveConversation(null));
  }, [conversationId, dispatch]);

  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationStatus, setConversationStatus] = useState('ACCEPTED');
  const [conversationInitiatorId, setConversationInitiatorId] = useState(null);
  const [requestActionLoading, setRequestActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friend, setFriend] = useState(selectedFriend ?? null);
  const [loading, setLoading] = useState(true);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [callSignal, setCallSignal] = useState(location.state?.incomingCall ?? null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [showChatLangModal, setShowChatLangModal] = useState(false);
  const [chatLanguage, setChatLanguage] = useState(currentUser?.preferredLanguage || language || 'en');
  const [autoTranslate, setAutoTranslate] = useState(currentUser?.autoTranslate !== false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, friend: null, conversationId: null });
  const [deleteModalTarget, setDeleteModalTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFriendBlocked, setIsFriendBlocked] = useState(false);
  const [isBlockedByFriend, setIsBlockedByFriend] = useState(false);

  // Phase 2: Unique Experience state
  const [showQRModal, setShowQRModal] = useState(false);
  const [pronunciationTarget, setPronunciationTarget] = useState(null);
  const [showFamilyDictModal, setShowFamilyDictModal] = useState(false);
  const [showFamilyProfileModal, setShowFamilyProfileModal] = useState(false);
  const [fadingMode, setFadingMode] = useState(() => getFadingModeConfig().enabled);
  const [showVoiceTranslateModal, setShowVoiceTranslateModal] = useState(false);
  const [showMessengerToolsModal, setShowMessengerToolsModal] = useState(false);
  const [familyProfile, setFamilyProfile] = useState(null);
  const [blockConfirmTarget, setBlockConfirmTarget] = useState(null);

  useEffect(() => {
    const fId = friend?.id || friend?.userId || friend?._id;
    if (fId) {
      setFamilyProfile(getFriendFamilyProfile(fId));
    }
  }, [friend]);

  const handleToggleFadingMode = () => {
    const next = !fadingMode;
    setFadingMode(next);
    saveFadingModeConfig({ enabled: next, targetLang: chatLanguage || 'es' });
  };

  useEffect(() => {
    const fId = friend?.id || friend?.userId || friend?._id;
    if (!fId) {
      setIsFriendBlocked(false);
      setIsBlockedByFriend(false);
      return;
    }
    checkIsBlocked(fId)
      .then((res) => {
        if (res) {
          setIsFriendBlocked(Boolean(res.blockedByMe));
          setIsBlockedByFriend(Boolean(res.blockedByThem));
        }
      })
      .catch(() => {});
  }, [friend]);

  const handleToggleBlockFriend = async (targetFriend = friend) => {
    const fId = targetFriend?.id || targetFriend?.userId || targetFriend?._id;
    if (!fId) return;
    try {
      if (isFriendBlocked) {
        await unblockUser(fId);
        setIsFriendBlocked(false);
      } else {
        await blockUser(fId);
        setIsFriendBlocked(true);
      }
    } catch (err) {
      console.error('Failed to toggle block:', err);
    }
  };

  const handleContextMenu = (e, targetFriend, cId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      friend: targetFriend,
      conversationId: cId
    });
  };

  const handleDeleteFriend = (targetFriend, e, cId) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setContextMenu({ visible: false, x: 0, y: 0, friend: null, conversationId: null });
    setDeleteModalTarget({ friend: targetFriend, conversationId: cId });
  };

  const handleConfirmDelete = async (targetFriend, deleteMedia) => {
    const fId = targetFriend?.id || targetFriend?.userId || targetFriend?._id;
    const cId = deleteModalTarget?.conversationId;
    setIsDeleting(true);

    // Persistently mark as deleted in localStorage so refreshing never brings them back
    markFriendAsDeleted(fId, targetFriend?.username);

    // Optimistically remove from conversations list and search
    setConversations((prev) => (Array.isArray(prev) ? prev.filter((c) => c.conversationId !== cId && c.otherUser?.id !== fId && c.otherUser?.userId !== fId) : []));
    setSearchResults((prev) => (Array.isArray(prev) ? prev.filter((u) => u.id !== fId && u.userId !== fId) : []));

    // If currently chatting with this friend, navigate back to /friends
    if (String(fId) === String(friend?.id) || (cId && String(cId) === String(conversationId))) {
      navigate('/friends');
    }

    try {
      const promises = [];
      if (cId) {
        promises.push(deleteConversation(cId));
      }
      if (fId) {
        promises.push(deleteConversationWithUser(fId));
      }
      await Promise.allSettled(promises);
    } catch (err) {
      console.warn('Backend delete completed with warnings:', err);
    } finally {
      setIsDeleting(false);
      setDeleteModalTarget(null);
    }
  };

  useEffect(() => {
    if (currentUser?.preferredLanguage) {
      setChatLanguage(currentUser.preferredLanguage);
    } else if (language) {
      setChatLanguage(language);
    }
    if (currentUser?.autoTranslate !== undefined) {
      setAutoTranslate(currentUser.autoTranslate !== false);
    }
  }, [currentUser, language]);

  const handleChatLanguageSelect = async (code) => {
    setChatLanguage(code);
    if (['en', 'de', 'nl', 'tw', 'es', 'fr', 'pt'].includes(code)) {
      setLanguage(code);
    }
    try {
      await updateProfile({ preferredLanguage: code, autoTranslate });
      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        localStorage.setItem('user', JSON.stringify({ ...parsed, preferredLanguage: code }));
      }
    } catch (e) {
      console.warn('Failed to update language profile:', e);
    }
  };

  const handleToggleAutoTranslate = async (enabled) => {
    setAutoTranslate(enabled);
    try {
      await updateProfile({ preferredLanguage: chatLanguage, autoTranslate: enabled });
      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        localStorage.setItem('user', JSON.stringify({ ...parsed, autoTranslate: enabled }));
      }
    } catch (e) {
      console.warn('Failed to update auto-translate profile:', e);
    }
  };

  const chatLangInfo = getLanguageInfo(chatLanguage);

  const messagesEndRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleMessagesScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 220);
  }, []);

  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeConversations = (Array.isArray(conversations) ? conversations : []).filter(
    (c) => !isFriendDeleted(c?.otherUser) && (c.status === 'ACCEPTED' || String(c.conversationId) === String(conversationId))
  );

  useEffect(() => {
    scrollToBottom(safeMessages.length <= 1 ? 'auto' : 'smooth');
  }, [safeMessages.length, scrollToBottom]);

  const reduxMessages = useSelector((s) => s.chat?.messagesByConv?.[String(conversationId)]);

  // Synchronize any background incoming messages arriving via Redux
  useEffect(() => {
    if (reduxMessages && Array.isArray(reduxMessages) && reduxMessages.length > 0) {
      setMessages((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const map = new Map();
        list.forEach((m) => {
          if (m.id) map.set(m.id, m);
          else map.set(`${m.senderId}-${m.timestamp}`, m);
        });
        reduxMessages.forEach((m) => {
          if (m.id) map.set(m.id, { ...(map.get(m.id) || {}), ...m });
          else map.set(`${m.senderId}-${m.timestamp}`, m);
        });
        return Array.from(map.values()).sort((a, b) => {
          const tA = new Date(a.timestamp || a.createdAt || 0).getTime();
          const tB = new Date(b.timestamp || b.createdAt || 0).getTime();
          return tA - tB;
        });
      });
    }
  }, [reduxMessages, conversationId]);

  const userStatuses = useSelector((s) => s.presence?.userStatuses || {});
  const onlineIds = useSelector((s) => s.presence?.onlineIds || []);
  const typingMap = useSelector((s) => s.presence?.typing || {});
  const reduxConversations = useSelector((s) => s.chat?.conversations || {});

  const otherUnreadTotal = useMemo(() => {
    return Object.values(reduxConversations).reduce((sum, conv) => {
      const cId = conv.conversationId || conv.id;
      if (String(cId) === String(conversationId)) return sum;
      return sum + (conv.unread || 0);
    }, 0);
  }, [reduxConversations, conversationId]);

  const handleBack = useCallback(() => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/friends');
    }
  }, [navigate]);

  const sortConversations = (items) => {
    if (!Array.isArray(items)) return [];
    return [...items].sort((a, b) => {
      const timeA = new Date(a.lastMessageAt || a.lastMessageTime || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || b.lastMessageTime || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  };

  const handleIncoming = useCallback((message) => {
    if (!message) return;

    if (message.type === 'CONVERSATION_ACCEPTED' || message.status === 'ACCEPTED') {
      setConversationStatus('ACCEPTED');
    }
    if (message.type === 'CONVERSATION_DECLINED' || message.status === 'DECLINED') {
      setConversationStatus('DECLINED');
    }
    if (message.type === 'CONVERSATION_PENDING' || message.status === 'PENDING') {
      setConversationStatus('PENDING');
      if (message.initiatorId != null) {
        setConversationInitiatorId(message.initiatorId);
      }
    }

    if (message.content) {
      setMessages((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (message.id && list.some((m) => m.id === message.id)) {
          return list.map((m) => (m.id === message.id ? { ...m, ...message } : m));
        }
      });

      if (message.conversationId) {
        dispatch(addStoreMessage({ conversationId: String(message.conversationId), message }));
      }

      setConversations((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const updated = list.map((c) =>
          String(c.conversationId) === String(message.conversationId || conversationId)
            ? {
                ...c,
                lastMessage: message.content,
                lastMessageTime: message.timestamp || new Date().toISOString(),
                lastMessageAt: message.timestamp || new Date().toISOString(),
              }
            : c
        );
        return sortConversations(updated);
      });
    }
  }, [conversationId, dispatch]);

  const handleReceipt = useCallback((receipt) => {
    if (!receipt) return;
    setMessages((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map((msg) => {
        if (String(msg.senderId) === String(currentUserId)) {
          return { ...msg, status: 'READ', readAt: receipt.readAt };
        }
        return msg;
      });
    });
  }, [currentUserId]);

  const {
    sendMessage,
    sendTyping,
    sendReadReceipt,
    sendEdit,
    sendDelete,
    sendReaction,
    sendCallSignal,
  } = useWebSocket(conversationId, handleIncoming, setCallSignal, handleReceipt);


  const handleSend = useCallback(
    (content, replyToId, replyToSenderName, replyToContent) => {
      sendMessage(content, replyToId, replyToSenderName, replyToContent);
      setConversations((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const updated = list.map((c) =>
          String(c.conversationId) === String(conversationId)
            ? {
                ...c,
                lastMessage: content,
                lastMessageTime: new Date().toISOString(),
                lastMessageAt: new Date().toISOString(),
              }
            : c
        );
        return sortConversations(updated);
      });
    },
    [conversationId, sendMessage]
  );

  const handleSaveEdit = useCallback(
    (messageId, newContent) => {
      sendEdit(messageId, newContent);
      setEditingMessage(null);
      setMessages((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.map((m) =>
          m.id === messageId
            ? { ...m, content: newContent, isEdited: true, editedAt: new Date().toISOString() }
            : m
        );
      });
    },
    [sendEdit]
  );

  const handleDelete = useCallback(
    (messageId) => {
      sendDelete(messageId);
      setMessages((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.map((m) =>
          m.id === messageId
            ? { ...m, isDeleted: true, content: 'This message was deleted' }
            : m
        );
      });
    },
    [sendDelete]
  );

  const handleReply = useCallback((message) => {
    const isMine = message.senderId === currentUserId;
    const senderName = isMine ? 'You' : (friend?.displayName || friend?.username || 'Friend');
    let snippet = message.content;
    try {
      const parsed = JSON.parse(message.content);
      snippet = parsed.text || (parsed.type ? `[${parsed.type}]` : message.content);
    } catch (_) {}

    setReplyingTo({
      id: message.id,
      senderName,
      isMine,
      content: snippet,
      contentSnippet: snippet.length > 60 ? snippet.slice(0, 60) + '...' : snippet,
    });
  }, [currentUserId, friend]);

  const handleScrollToMessage = useCallback((targetMsgId) => {
    const el = document.getElementById(`msg-${targetMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('message-highlight');
      setTimeout(() => el.classList.remove('message-highlight'), 1800);
    }
  }, []);

  const call = useWebRTCCall({
    conversationId,
    currentUserId,
    sendSignal: sendCallSignal,
    onSignal: callSignal,
    autoAccept: Boolean(location.state?.autoAccept),
  });

  const friendId = friend?.userId || friend?._id || friend?.id;
  const friendPresence = friendId ? userStatuses[String(friendId)] : null;
  const isFriendPresent = friendId ? onlineIds.some((i) => String(i) === String(friendId)) : false;
  const isFriendOnline = friendPresence?.online ?? isFriendPresent;
  const friendCustomStatus = friendPresence?.status || (isFriendOnline ? 'online' : 'offline');
  const isFriendBusy = friendCustomStatus === 'busy';

  const effectiveCurrentUserId = currentUserId || (() => {
    try {
      const u = JSON.parse(localStorage.getItem('user'));
      return u?.userId || u?.id;
    } catch {
      return null;
    }
  })();

  const friendStatusType = isFriendBusy ? 'busy' : isFriendOnline ? 'online' : 'offline';
  const friendLastSeenTime = friendPresence?.lastSeen || friend?.lastSeen;
  const friendLastSeenText = !isFriendOnline && friendLastSeenTime ? `Last seen ${formatTimeAgo(friendLastSeenTime)}` : null;
  const friendStatusLabel = isFriendBusy
    ? t('busy')
    : isFriendOnline
      ? t('online')
      : (friendLastSeenText || t('offline'));

  const typingState = typingMap[String(conversationId)];
  const isTypingFresh = typingState?.timestamp ? (Date.now() - typingState.timestamp < 3500) : true;
  const isOtherTyping = Boolean(
    typingState?.isTyping &&
    isTypingFresh &&
    effectiveCurrentUserId != null &&
    String(typingState.userId) !== String(effectiveCurrentUserId)
  );

  useEffect(() => {
    if (selectedFriend) {
      setFriend(selectedFriend);
    }
  }, [selectedFriend]);

  const autoStartCallType = location.state?.startCallType;
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    if (autoStartCallType && call.callState === 'idle' && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      const timer = setTimeout(() => {
        call.startCall(autoStartCallType);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoStartCallType, call]);

  useEffect(() => {
    setSidebarLoading(true);
    getMyConversations()
      .then((conversationsData) => {
        const filtered = (conversationsData || []).filter((c) => !isFriendDeleted(c?.otherUser));
        const sorted = sortConversations(filtered);
        setConversations(sorted);

        const currentConversation = sorted.find(
          (c) => String(c.conversationId) === String(conversationId)
        );
        if (currentConversation) {
          if (currentConversation.status) {
            setConversationStatus(currentConversation.status);
          }
          if (currentConversation.initiatorId != null) {
            setConversationInitiatorId(currentConversation.initiatorId);
          }
          if (currentConversation.otherUser) {
            setFriend((prev) => ({ ...(prev || {}), ...currentConversation.otherUser }));
          }
        }
      })
      .finally(() => setSidebarLoading(false));
  }, [conversationId, selectedFriend]);

  useEffect(() => {
    if (!conversationId) return;
    getConversationDetails(conversationId)
      .then((conv) => {
        if (conv) {
          if (conv.status) setConversationStatus(conv.status);
          if (conv.initiatorId != null) setConversationInitiatorId(conv.initiatorId);
          if (conv.otherUser) {
            setFriend((prev) => ({ ...(prev || {}), ...conv.otherUser }));
          }
        }
      })
      .catch(() => {});
  }, [conversationId, selectedFriend]);

  const handleAcceptRequest = async () => {
    try {
      setRequestActionLoading(true);
      await acceptChatRequest(conversationId);
      setConversationStatus('ACCEPTED');
      setConversations((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.map((c) =>
          String(c.conversationId) === String(conversationId) ? { ...c, status: 'ACCEPTED' } : c
        );
      });
    } catch (err) {
      console.error('Failed to accept chat request:', err);
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    try {
      setRequestActionLoading(true);
      await declineChatRequest(conversationId);
      setConversationStatus('DECLINED');
      setConversations((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.map((c) =>
          String(c.conversationId) === String(conversationId) ? { ...c, status: 'DECLINED' } : c
        );
      });
    } catch (err) {
      console.error('Failed to decline chat request:', err);
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleResendRequest = async () => {
    try {
      setRequestActionLoading(true);
      const targetFriendId = friend?.id || friend?.userId || friend?._id;
      await resendChatRequest(conversationId, targetFriendId);
      setConversationStatus('PENDING');
      setConversationInitiatorId(currentUserId);
      setConversations((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.map((c) =>
          String(c.conversationId) === String(conversationId)
            ? { ...c, status: 'PENDING', initiatorId: currentUserId }
            : c
        );
      });
    } catch (err) {
      console.error('Failed to resend chat request:', err);
    } finally {
      setRequestActionLoading(false);
    }
  };


  useEffect(() => {
    setLoading(true);
    getMessages(conversationId)
      .then((msgs) => {
        const list = Array.isArray(msgs) ? msgs : [];
        setMessages(list);
        dispatch(setStoreMessages({ conversationId, messages: list }));
        sendReadReceipt();
      })
      .catch(() => {
        setMessages([]);
      })
      .finally(() => setLoading(false));
  }, [conversationId, sendReadReceipt, dispatch]);

  const trimmedSearch = search.trim();
  const showSearchPopup = searchFocused && trimmedSearch.length >= 3;

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

  const handleSelectFromSearch = (nextFriend) => {
    unmarkFriendDeleted(nextFriend?.id || nextFriend?.userId, nextFriend?.username);
    setSearch('');
    setSearchFocused(false);
    setSelectedProfileUser(nextFriend);
  };

  const friendDisplayName = friend?.displayName || friend?.username || 'User';

  const isPending = conversationStatus === 'PENDING';
  const isDeclined = conversationStatus === 'DECLINED';
  const isAccepted = conversationStatus === 'ACCEPTED' || (!isPending && !isDeclined);
  const isInitiator = conversationInitiatorId != null && effectiveCurrentUserId != null && String(conversationInitiatorId) === String(effectiveCurrentUserId);
  const isRecipient = isPending && (!isInitiator || (conversationInitiatorId != null && String(conversationInitiatorId) !== String(effectiveCurrentUserId)));

  return (
    <div className="chat-layout-page">
      <aside className="chat-sidebar">
        <h2>{t('friends')} <span className="friends-count">({t('friendsCount', { count: safeConversations.length })})</span></h2>

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
                onClick={() => setSearch('')}
                aria-label={t('clearSearch')}
              >
                ×
              </button>
            )}
          </div>

          {showSearchPopup && (
            <div className="search-popup">
              {searchLoading && <div className="search-popup-empty">{t('searching')}</div>}
              {!searchLoading && searchResults.length === 0 && (
                <div className="search-popup-empty">{t('noFriendsFound')}</div>
              )}
              {!searchLoading &&
                searchResults.map((nextFriend, index) => (
                  <div
                    key={nextFriend.id}
                    className="search-popup-item"
                    style={{ animationDelay: `${index * 30}ms` }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectFromSearch(nextFriend)}
                  >
                    <FriendCard
                      friend={nextFriend}
                      onAvatarClick={(f) => handleSelectFromSearch(f)}
                      onContextMenu={(e, f) => handleContextMenu(e, f)}
                      onDelete={(f, e) => handleDeleteFriend(f, e)}
                    />
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="friends-list">
          {sidebarLoading && <div className="empty-state">{t('loadingFriends')}</div>}
          {!sidebarLoading && safeConversations.length === 0 && (
            <div className="no-chats-box">
              <i className="fa-solid fa-comments no-chats-icon" />
              <h3 className="no-chats-title">{t('noChats')}</h3>
              <p className="no-chats-desc">{t('noChatsDesc')}</p>
            </div>
          )}
          {!sidebarLoading &&
            safeConversations.map((conv) => (
              <FriendCard
                key={conv.conversationId}
                friend={conv.otherUser}
                conversationId={conv.conversationId}
                lastMessage={getMessagePreview(conv.lastMessage)}
                lastMessageAt={conv.lastMessageAt ?? conv.lastMessageTime}
                status={conv.status}
                initiatorId={conv.initiatorId}
                currentUserId={currentUserId}
                onAvatarClick={(f) => setSelectedProfileUser(f)}
                onContextMenu={(e, f, cId) => handleContextMenu(e, f, cId)}
                onDelete={(f, e, cId) => handleDeleteFriend(f, e, cId)}
                onClick={() => navigate(`/chat/${conv.conversationId}`, { state: { friend: conv.otherUser } })}
                active={friend?.id === conv.otherUser?.id}
              />
            ))}
        </div>
      </aside>

      <section className="chat-page">
        <div className="chat-header">
          {friend && (
            <>
              <div className="chat-header-user">
                <button
                  type="button"
                  className="chat-back-btn fb-chat-back-btn"
                  onClick={handleBack}
                  title={t('friends') || 'Back to Chats'}
                  aria-label="Back to chats"
                >
                  <i className="fa-solid fa-arrow-left" />
                  {otherUnreadTotal > 0 && (
                    <span className="fb-back-unread-badge">
                      {otherUnreadTotal > 99 ? '99+' : otherUnreadTotal}
                    </span>
                  )}
                </button>
                <div
                  className="friend-avatar-wrap clickable"
                  onClick={() => setSelectedProfileUser(friend)}
                  title="View profile"
                >
                  <img
                    src={resolveAvatarUrl(friend.avatarUrl, friendDisplayName)}
                    alt={friendDisplayName}
                    onError={(e) => handleAvatarError(e, friendDisplayName)}
                  />
                  <span className={`online-dot ${friendStatusType}`} title={friendStatusLabel}></span>
                </div>
                <div
                  className="chat-header-details clickable"
                  onClick={() => setSelectedProfileUser(friend)}
                >
                  <div className="chat-header-name-row">
                    <h2>{friendDisplayName}</h2>
                    {familyProfile?.roleLabel && (
                      <span
                        className="family-role-badge-tag clickable"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFamilyProfileModal(true);
                        }}
                        title={`Family Role: ${familyProfile.roleLabel} (${familyProfile.formalityTone || 'Standard'}). Click to edit.`}
                      >
                        <i className={familyProfile.roleIcon || 'fa-solid fa-people-roof'} />
                        <span>{familyProfile.roleLabel}</span>
                      </span>
                    )}
                    {friend.username && friend.username !== friendDisplayName && (
                      <span className="chat-header-handle">@{friend.username}</span>
                    )}
                  </div>
                  <span className={`chat-header-status ${friendStatusType}`}>
                    {isOtherTyping ? (
                      <span className="typing-header-text">
                        <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span> typing...
                      </span>
                    ) : (
                      friendStatusLabel
                    )}
                  </span>
                </div>
              </div>
              <div className="chat-header-actions">
                {/* Desktop Quick Tools: Language Pill & Immersion Mode */}
                <div className="chat-header-desktop-tools">
                  {isAccepted && (
                    <div className="chat-header-lang-wrapper">
                      <button
                        type="button"
                        className="chat-header-translate-pill"
                        onClick={() => setShowChatLangModal(true)}
                        title="Change translation target language"
                      >
                        <span className="lang-pill-icon">🌍</span>
                        <span className="lang-pill-flag">{chatLangInfo.flag}</span>
                        <span className="lang-pill-name">{chatLangInfo.name}</span>
                        <i className="fa-solid fa-chevron-down lang-pill-arrow"></i>
                      </button>
                    </div>
                  )}

                  {isAccepted && (
                    <button
                      type="button"
                      className={`chat-call-btn ${fadingMode ? 'immersion-active' : ''}`}
                      onClick={handleToggleFadingMode}
                      title={fadingMode ? 'Fading Immersion Mode: ON (Click to toggle)' : 'Enable Fading Immersion Learning Mode'}
                      aria-label="Fading immersion mode"
                    >
                      <i className="fa-solid fa-brain" />
                    </button>
                  )}
                  {isAccepted && <div className="chat-header-divider" />}
                </div>

                {/* Primary Call & More Action Group: Clean, visible everywhere without overflowing */}
                <div className="chat-header-call-group fb-header-call-group">
                  <button
                    type="button"
                    className="chat-call-btn voice-call-btn"
                    onClick={() => call.startCall('voice')}
                    disabled={call.callState !== 'idle' || !isAccepted || isFriendBlocked || isBlockedByFriend}
                    aria-label="Start voice call"
                    title={isFriendBlocked ? 'Unblock user to make voice calls' : !isAccepted ? 'Calls available once request is accepted' : 'Start voice call'}
                  >
                    <i className="fa-solid fa-phone"></i>
                  </button>

                  <button
                    type="button"
                    className="chat-call-btn video-call-btn"
                    onClick={() => call.startCall('video')}
                    disabled={call.callState !== 'idle' || !isAccepted || isFriendBlocked || isBlockedByFriend}
                    aria-label="Start video call"
                    title={isFriendBlocked ? 'Unblock user to make video calls' : !isAccepted ? 'Calls available once request is accepted' : 'Start video call'}
                  >
                    <i className="fa-solid fa-video"></i>
                  </button>

                  {/* Facebook Messenger More / Chat Details & Tools button */}
                  <button
                    type="button"
                    className={`chat-call-btn fb-chat-more-btn ${showMessengerToolsModal ? 'active' : ''}`}
                    onClick={() => setShowMessengerToolsModal(true)}
                    title="Conversation details, translation & tools"
                    aria-label="Conversation details and tools"
                  >
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                    {isFriendBlocked && <span className="fb-more-blocked-badge" />}
                  </button>
                </div>
              </div>
            </>
          )}
          {!friend && (
            <h2>
              {t('openChat')}{' '}
              <button className="link-button" onClick={() => navigate('/friends')}>
                {t('friendsList')}
              </button>
            </h2>
          )}
        </div>

        <div className="chat-messages" onScroll={handleMessagesScroll}>
          {loading && <div className="page-loading">{t('loadingConversation')}</div>}
          {!loading && safeMessages.length === 0 && friend && (
            <div className="chat-person-hero-card">
              <div
                className="person-hero-avatar-wrap clickable"
                onClick={() => setSelectedProfileUser(friend)}
                title="View full profile"
              >
                <img
                  src={resolveAvatarUrl(friend.avatarUrl, friendDisplayName)}
                  alt={friendDisplayName}
                  className="person-hero-avatar"
                  onError={(e) => handleAvatarError(e, friendDisplayName)}
                />
                <span className={`online-dot ${friendStatusType}`} />
              </div>

              <h3 className="person-hero-name" onClick={() => setSelectedProfileUser(friend)}>
                {friendDisplayName}
              </h3>
              {friend.username && (
                <span className="person-hero-handle">@{friend.username}</span>
              )}

              {friend.bio && (
                <p className="person-hero-bio">"{friend.bio}"</p>
              )}

              {isPending && isRecipient && (
                <div className="person-hero-status pending-received">
                  <div className="hero-status-tag">
                    <i className="fa-solid fa-user-plus"></i> Friend Request
                  </div>
                  <p>{friendDisplayName} sent you a friend request.</p>
                  <div className="hero-status-actions">
                    <button
                      type="button"
                      className="btn-req-accept"
                      onClick={handleAcceptRequest}
                      disabled={requestActionLoading}
                    >
                      <i className="fa-solid fa-check"></i> Accept
                    </button>
                    <button
                      type="button"
                      className="btn-req-decline"
                      onClick={handleDeclineRequest}
                      disabled={requestActionLoading}
                    >
                      <i className="fa-solid fa-xmark"></i> Decline
                    </button>
                  </div>
                </div>
              )}

              {isPending && isInitiator && (
                <div className="person-hero-status pending-sent">
                  <div className="hero-status-tag">
                    <i className="fa-regular fa-clock"></i> Friend Request Sent
                  </div>
                  <p>Waiting for {friendDisplayName} to accept your request.</p>
                  <button
                    type="button"
                    className="btn-view-profile"
                    onClick={() => setSelectedProfileUser(friend)}
                    style={{ marginTop: '6px' }}
                  >
                    <i className="fa-regular fa-user"></i> View Profile
                  </button>
                </div>
              )}

              {isDeclined && (
                <div className="person-hero-status declined">
                  <div className="hero-status-tag">
                    <i className="fa-solid fa-ban"></i> Request Declined
                  </div>
                  <p>Previous chat request was declined.</p>
                  <button
                    type="button"
                    className="btn-req-resend"
                    onClick={handleResendRequest}
                    disabled={requestActionLoading}
                    style={{
                      background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                      color: '#12100c',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontWeight: '700',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '6px'
                    }}
                  >
                    <i className="fa-solid fa-rotate-right"></i> Send Request Again
                  </button>
                </div>
              )}

              {isAccepted && (
                <div className="person-hero-status accepted">
                  <p className="hero-greeting">{t('sayHi', { username: friendDisplayName })}</p>
                  <button
                    type="button"
                    className="btn-view-profile"
                    onClick={() => setSelectedProfileUser(friend)}
                  >
                    <i className="fa-regular fa-user"></i> View Profile
                  </button>
                </div>
              )}
            </div>
          )}
          {safeMessages.map((m) => (
            <MessageBubble
              key={m.id ?? `${m.senderId}-${m.timestamp}`}
              message={m}
              currentUser={{ ...currentUser, preferredLanguage: chatLanguage, autoTranslate }}
              friend={friend}
              isMine={m.senderId === currentUserId}
              onReply={handleReply}
              onReact={sendReaction}
              onEdit={(msg) => {
                setEditingMessage(msg);
                setReplyingTo(null);
              }}
              onDelete={handleDelete}
              onScrollToMessage={handleScrollToMessage}
              onPronounce={(text, lang) => setPronunciationTarget({ text, lang: lang || chatLanguage || 'en' })}
              fadingModeEnabled={fadingMode}
              immersionLang={chatLanguage}
            />
          ))}

          {/* Typing bubble inside chat area */}
          {isOtherTyping && (
            <div className="message-row theirs typing-row">
              <div className="message-bubble theirs typing-bubble">
                <span className="typing-bubble-text">{friendDisplayName} is typing</span>
                <span className="typing-dots-anim">
                  <span></span><span></span><span></span>
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />

          {/* WhatsApp / Telegram Floating Scroll to Bottom Button */}
          {showScrollBottom && (
            <button
              type="button"
              className="chat-scroll-bottom-btn"
              onClick={() => scrollToBottom('smooth')}
              title="Scroll to bottom"
              aria-label="Scroll to bottom"
            >
              <i className="fa-solid fa-chevron-down"></i>
            </button>
          )}
        </div>

        {/* Facebook Messenger Style Chat Request Invitation Box */}
        {isRecipient && (
          <div className="fb-messenger-request-box">
            <div className="fb-messenger-req-header">
              <img
                src={resolveAvatarUrl(friend?.avatarUrl, friendDisplayName)}
                alt={friendDisplayName}
                className="fb-messenger-req-avatar"
                onError={(e) => handleAvatarError(e, friendDisplayName)}
              />
              <div className="fb-messenger-req-title-wrap">
                <span className="fb-messenger-req-title">{friendDisplayName} sent you a request</span>
                <span className="fb-messenger-req-sub">
                  Accept to start translating and chatting. They won't know you've seen this request until you accept.
                </span>
              </div>
            </div>
            <div className="fb-messenger-req-actions">
              <button
                type="button"
                className="fb-messenger-req-btn-confirm"
                onClick={handleAcceptRequest}
                disabled={requestActionLoading}
              >
                <i className="fa-solid fa-check" /> Confirm Request
              </button>
              <button
                type="button"
                className="fb-messenger-req-btn-delete"
                onClick={handleDeclineRequest}
                disabled={requestActionLoading}
              >
                <i className="fa-solid fa-xmark" /> Delete
              </button>
              <button
                type="button"
                className="fb-messenger-req-btn-block"
                onClick={() => setBlockConfirmTarget(friend)}
                disabled={requestActionLoading}
              >
                <i className="fa-solid fa-ban" /> Block
              </button>
            </div>
          </div>
        )}

        {isDeclined && (
          <div className="chat-request-bar declined-request" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-ban declined-ban-icon"></i>
              <div className="chat-request-info">
                <span>This chat request was declined.</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-req-resend"
              onClick={handleResendRequest}
              disabled={requestActionLoading}
              style={{
                background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                color: '#12100c',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-rotate-right"></i> Send Request Again
            </button>
          </div>
        )}

        <CallPanel
          callState={call.callState}
          callType={call.callType}
          isRinging={call.isRinging}
          localStream={call.localStream}
          remoteStream={call.remoteStream}
          error={call.error}
          friend={friend}
          isMutedAudio={call.isMutedAudio}
          isMutedVideo={call.isMutedVideo}
          toggleMuteAudio={call.toggleMuteAudio}
          toggleMuteVideo={call.toggleMuteVideo}
          switchCamera={call.switchCamera}
          onAccept={call.acceptCall}
          onEnd={call.callState === 'incoming' ? call.rejectCall : call.endCall}
        />

        {isFriendBlocked ? (
          <div className="fb-messenger-blocked-bar">
            <div className="fb-messenger-blocked-info">
              <div className="fb-blocked-shield-icon">
                <i className="fa-solid fa-user-shield" />
              </div>
              <div className="fb-messenger-blocked-texts">
                <strong>You blocked {friendDisplayName}</strong>
                <span>You can't message or call each other in this chat. Unblock to resume chatting.</span>
              </div>
            </div>
            <button
              type="button"
              className="fb-messenger-unblock-btn"
              onClick={() => handleToggleBlockFriend(friend)}
            >
              <i className="fa-solid fa-user-check" /> Unblock
            </button>
          </div>
        ) : isBlockedByFriend ? (
          <div className="fb-messenger-blocked-bar" style={{ background: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="fb-messenger-blocked-info">
              <i className="fa-solid fa-circle-exclamation" style={{ color: '#f59e0b', fontSize: '1.2rem' }} />
              <div className="fb-messenger-blocked-texts">
                <strong>This account is unavailable</strong>
                <span>You cannot send messages or start calls with @{friend?.username || 'this user'}.</span>
              </div>
            </div>
          </div>
        ) : (
          <ChatInput
            onSend={handleSend}
            onTyping={sendTyping}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            editingMessage={editingMessage}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={() => setEditingMessage(null)}
            disabled={!isAccepted && isRecipient ? true : isDeclined ? true : false}
            disabledPlaceholder={
              isRecipient
                ? 'Accept chat request to send messages...'
                : isDeclined
                ? 'Chat request was declined'
                : ''
            }
            onOpenVoiceTranslate={() => setShowVoiceTranslateModal(true)}
          />
        )}
      </section>

      {/* WhatsApp-Style Chat Language Modal */}
      <LanguagePickerModal
        isOpen={showChatLangModal}
        onClose={() => setShowChatLangModal(false)}
        currentLanguage={chatLanguage}
        onSelectLanguage={handleChatLanguageSelect}
        autoTranslate={autoTranslate}
        onToggleAutoTranslate={handleToggleAutoTranslate}
        title="🌍 GioTranslate Chat Language"
        subtitle={`Select language to translate messages in chat with ${friendDisplayName || 'friend'}`}
      />

      {selectedProfileUser && (
        <UserProfileModal
          user={selectedProfileUser}
          userId={selectedProfileUser.id || selectedProfileUser.userId}
          onClose={() => setSelectedProfileUser(null)}
          onStartCall={(f, type) => {
            setSelectedProfileUser(null);
            call.startCall(type);
          }}
        />
      )}

      {contextMenu.visible && (
        <FriendContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          friend={contextMenu.friend}
          conversationId={contextMenu.conversationId}
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, friend: null, conversationId: null })}
          onDelete={(f, cId) => handleDeleteFriend(f, null, cId)}
          onOpenChat={(f, cId) => {
            if (cId) {
              navigate(`/chat/${cId}`, { state: { friend: f } });
            } else {
              startConversation(f.id).then((c) => {
                navigate(`/chat/${c.conversationId}`, { state: { friend: f } });
              }).catch(() => {});
            }
          }}
          onViewProfile={(f) => setSelectedProfileUser(f)}
          onBlock={(f) => handleToggleBlockFriend(f)}
          isBlocked={isFriendBlocked}
        />
      )}

      {deleteModalTarget && (
        <WhatsAppDeleteModal
          friend={deleteModalTarget.friend}
          isOpen={Boolean(deleteModalTarget)}
          isLoading={isDeleting}
          isOnline={onlineIds.includes(deleteModalTarget.friend?.id || deleteModalTarget.friend?.userId)}
          presence={userStatuses[String(deleteModalTarget.friend?.id || deleteModalTarget.friend?.userId)]}
          onClose={() => !isDeleting && setDeleteModalTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {showQRModal && (
        <QRRoomModal user={currentUser} onClose={() => setShowQRModal(false)} />
      )}

      {showVoiceTranslateModal && (
        <VoiceTranslateModal
          isOpen={showVoiceTranslateModal}
          onClose={() => setShowVoiceTranslateModal(false)}
          initialSourceLang={currentUser?.preferredLanguage || language || 'en'}
          initialTargetLang={chatLanguage || friend?.preferredLanguage || 'es'}
          friendName={friendDisplayName}
          onSendToChat={(translatedText, originalSpokenText) => {
            const payload = {
              content: JSON.stringify({
                type: 'text',
                text: translatedText,
                transcript: originalSpokenText,
              }),
            };
            handleSend(payload.content);
          }}
        />
      )}

      {pronunciationTarget && (
        <PronunciationModal
          text={pronunciationTarget.text}
          lang={pronunciationTarget.lang}
          onClose={() => setPronunciationTarget(null)}
        />
      )}

      {showFamilyDictModal && (
        <FamilyDictionaryModal onClose={() => setShowFamilyDictModal(false)} />
      )}

      {showFamilyProfileModal && (
        <FamilyProfileModal
          friend={friend}
          onClose={() => setShowFamilyProfileModal(false)}
          onSaved={(saved) => setFamilyProfile(saved)}
        />
      )}

      {blockConfirmTarget && (
        <div className="unique-modal-backdrop" onClick={() => setBlockConfirmTarget(null)}>
          <div className="fb-confirm-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="fb-confirm-modal-header">
              <div className="fb-confirm-icon-danger">
                <i className="fa-solid fa-user-slash" />
              </div>
              <div>
                <h3 className="fb-confirm-title">Block @{blockConfirmTarget.username || 'this user'}?</h3>
                <p className="fb-confirm-desc">
                  They will no longer be able to message you, start video calls, or see your community posts. You can unblock them at any time in Settings.
                </p>
              </div>
            </div>
            <div className="fb-confirm-actions">
              <button
                type="button"
                className="fb-confirm-cancel"
                onClick={() => setBlockConfirmTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fb-confirm-action-btn"
                onClick={async () => {
                  await handleToggleBlockFriend(blockConfirmTarget);
                  setBlockConfirmTarget(null);
                }}
              >
                Block Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Facebook Messenger Style Chat Details & Tools Sheet */}
      {showMessengerToolsModal && friend && (
        <div className="unique-modal-backdrop fb-tools-backdrop" onClick={() => setShowMessengerToolsModal(false)}>
          <div className="fb-messenger-tools-card" onClick={(e) => e.stopPropagation()}>
            <div className="fb-tools-card-header">
              <div className="fb-tools-user-summary">
                <div
                  className="fb-tools-avatar-wrap clickable"
                  onClick={() => {
                    setShowMessengerToolsModal(false);
                    setSelectedProfileUser(friend);
                  }}
                  title="View full profile"
                >
                  <img
                    src={resolveAvatarUrl(friend?.avatarUrl, friendDisplayName)}
                    alt={friendDisplayName}
                    onError={(e) => handleAvatarError(e, friendDisplayName)}
                  />
                  <span className={`online-dot ${friendStatusType}`} />
                </div>
                <div className="fb-tools-user-info">
                  <h3>{friendDisplayName}</h3>
                  <p className="fb-tools-status">
                    {friend.username ? `@${friend.username}` : ''} • {friendStatusLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="fb-tools-close-btn"
                onClick={() => setShowMessengerToolsModal(false)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="fb-tools-scroll-content">
              {/* Language Selection Quick Banner */}
              <div className="fb-tools-section">
                <span className="fb-tools-section-title">Translation Target</span>
                <button
                  type="button"
                  className="fb-tools-lang-btn"
                  onClick={() => {
                    setShowMessengerToolsModal(false);
                    setShowChatLangModal(true);
                  }}
                >
                  <div className="fb-tools-lang-info">
                    <span className="fb-tools-lang-flag">{chatLangInfo.flag}</span>
                    <div className="fb-tools-lang-text">
                      <strong>{chatLangInfo.name}</strong>
                      <span>Tap to change language</span>
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>

              {/* Quick Tools Grid */}
              <div className="fb-tools-section">
                <span className="fb-tools-section-title">Chat & Learning Tools</span>
                <div className="fb-tools-list">
                  <button
                    type="button"
                    className="fb-tools-item"
                    onClick={() => {
                      setShowMessengerToolsModal(false);
                      setShowVoiceTranslateModal(true);
                    }}
                  >
                    <div className="fb-tools-item-icon voice-icon">
                      <i className="fa-solid fa-microphone-lines"></i>
                    </div>
                    <div className="fb-tools-item-text">
                      <strong>Live Voice Translator</strong>
                      <span>Speak and listen translated in real time</span>
                    </div>
                    <i className="fa-solid fa-chevron-right arrow"></i>
                  </button>

                  <button
                    type="button"
                    className="fb-tools-item"
                    onClick={() => {
                      handleToggleFadingMode();
                    }}
                  >
                    <div className={`fb-tools-item-icon brain-icon ${fadingMode ? 'active' : ''}`}>
                      <i className="fa-solid fa-brain"></i>
                    </div>
                    <div className="fb-tools-item-text">
                      <strong>Fading Immersion Mode</strong>
                      <span>Vocabulary immersion learning</span>
                    </div>
                    <span className={`fb-tools-toggle-badge ${fadingMode ? 'on' : 'off'}`}>
                      {fadingMode ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="fb-tools-item"
                    onClick={() => {
                      setShowMessengerToolsModal(false);
                      setShowFamilyDictModal(true);
                    }}
                  >
                    <div className="fb-tools-item-icon dict-icon">
                      <i className="fa-solid fa-book-bookmark"></i>
                    </div>
                    <div className="fb-tools-item-text">
                      <strong>Cultural Dictionary</strong>
                      <span>Slang, idioms & shared expressions</span>
                    </div>
                    <i className="fa-solid fa-chevron-right arrow"></i>
                  </button>

                  <button
                    type="button"
                    className="fb-tools-item"
                    onClick={() => {
                      setShowMessengerToolsModal(false);
                      setShowQRModal(true);
                    }}
                  >
                    <div className="fb-tools-item-icon qr-icon">
                      <i className="fa-solid fa-qrcode"></i>
                    </div>
                    <div className="fb-tools-item-text">
                      <strong>QR Conversation Room</strong>
                      <span>Scan code to quickly join chat</span>
                    </div>
                    <i className="fa-solid fa-chevron-right arrow"></i>
                  </button>

                  {familyProfile && (
                    <button
                      type="button"
                      className="fb-tools-item"
                      onClick={() => {
                        setShowMessengerToolsModal(false);
                        setShowFamilyProfileModal(true);
                      }}
                    >
                      <div className="fb-tools-item-icon family-icon">
                        <i className={familyProfile.roleIcon || 'fa-solid fa-people-roof'} />
                      </div>
                      <div className="fb-tools-item-text">
                        <strong>Family Role & Formality</strong>
                        <span>{familyProfile.roleLabel} • {familyProfile.formalityTone || 'Standard'}</span>
                      </div>
                      <i className="fa-solid fa-chevron-right arrow"></i>
                    </button>
                  )}

                  <button
                    type="button"
                    className="fb-tools-item"
                    onClick={() => {
                      setShowMessengerToolsModal(false);
                      setSelectedProfileUser(friend);
                    }}
                  >
                    <div className="fb-tools-item-icon profile-icon">
                      <i className="fa-solid fa-user"></i>
                    </div>
                    <div className="fb-tools-item-text">
                      <strong>View Full Profile</strong>
                      <span>Bio, media & mutual friends</span>
                    </div>
                    <i className="fa-solid fa-chevron-right arrow"></i>
                  </button>
                </div>
              </div>

              {/* Privacy & Danger Zone */}
              <div className="fb-tools-section fb-tools-danger-section">
                <span className="fb-tools-section-title">Privacy & Conversation</span>
                <div className="fb-tools-list">
                  <button
                    type="button"
                    className="fb-tools-item danger"
                    onClick={() => {
                      setShowMessengerToolsModal(false);
                      handleToggleBlockFriend(friend);
                    }}
                  >
                    <div className="fb-tools-item-icon block-icon">
                      <i className={`fa-solid ${isFriendBlocked ? 'fa-user-check' : 'fa-ban'}`}></i>
                    </div>
                    <div className="fb-tools-item-text">
                      <strong>{isFriendBlocked ? 'Unblock Friend' : 'Block User'}</strong>
                      <span>{isFriendBlocked ? 'Allow calls and messages again' : 'Stop calls and messages from this user'}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="fb-tools-item danger"
                    onClick={(e) => {
                      setShowMessengerToolsModal(false);
                      handleDeleteFriend(friend, e, conversationId);
                    }}
                  >
                    <div className="fb-tools-item-icon delete-icon">
                      <i className="fa-solid fa-trash-can"></i>
                    </div>
                    <div className="fb-tools-item-text">
                      <strong>Delete Chat</strong>
                      <span>Permanently remove chat messages</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
