import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getPosts, createPost, toggleLikePost, getPostComments, addComment, toggleLikeComment, deletePost } from '../api/postApi';
import { startConversation, quickTranslate, getMyConversations, deleteConversationWithUser } from '../api/conversationApi';
import { blockUser, unblockUser } from '../api/userApi';
import { uploadMedia } from '../api/mediaApi';
import { resolveBackendUrl } from '../utils/apiBaseUrl';
import { resolveAvatarUrl, handleAvatarError } from '../utils/avatarUrl';
import { getUserActivitySummary } from '../utils/timeAgo';
import { useLanguage } from '../contexts/LanguageContext';
import GioCameraModal from '../components/GioCameraModal';
import MediaLightbox from '../components/MediaLightbox';
import FriendContextMenu from '../components/FriendContextMenu';
import WhatsAppDeleteModal from '../components/WhatsAppDeleteModal';
import LiveFootballAndNews from '../components/LiveFootballAndNews';
import HomeNewsFeed from '../components/HomeNewsFeed';
import { isFriendDeleted, markFriendAsDeleted, unmarkFriendDeleted } from '../utils/deletedFriends';
import '../styles/community.css';

export default function CommunityHome({ user }) {
  const navigate = useNavigate();
  const { language: currentLang, languageOptions, t } = useLanguage();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'video' | 'image' | 'text'
  const [showMobileLiveHub, setShowMobileLiveHub] = useState(false);

  // New Post Form State
  const [postText, setPostText] = useState('');
  const [postLanguage, setPostLanguage] = useState(user?.preferredLanguage || currentLang || 'en');
  const [attachedMedia, setAttachedMedia] = useState(null); // { url, type, name, previewUrl }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGioVideoOpen, setIsGioVideoOpen] = useState(false);

  // Translation state for posts: { [postId]: { translatedText, sourceLang, isShowing } }
  const [translations, setTranslations] = useState({});
  const [translatingPostId, setTranslatingPostId] = useState(null);

  // Active comments accordion: { [postId]: { open: boolean, loading: boolean, list: [] } }
  const [commentsState, setCommentsState] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [replyingTo, setReplyingTo] = useState({}); // { [postId]: { commentId, username, displayName } }
  const commentInputRefs = useRef({});

  // Lightbox
  const [lightboxMedia, setLightboxMedia] = useState(null);

  // Copy feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef(null);

  // Left Sidebar: Friends List State
  const [friendsList, setFriendsList] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendSearch, setFriendSearch] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState('');
  const onlineIds = useSelector((state) => state.presence?.onlineIds || []);
  const userStatuses = useSelector((state) => state.presence?.userStatuses || {});

  // Right-click context menu for sidebar friends
  const [friendContextMenu, setFriendContextMenu] = useState({ visible: false, x: 0, y: 0, friend: null });

  const handleFriendContextMenu = (e, targetFriend) => {
    e.preventDefault();
    e.stopPropagation();
    setFriendContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      friend: targetFriend
    });
  };

  // Right Sidebar: Sponsored AI Ads State
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isAdPaused, setIsAdPaused] = useState(false);

  const sponsoredAds = useMemo(() => [
    {
      id: 1,
      tag: 'AI TRANSLATION • SPONSORED',
      title: 'Neural Speech Translator 2.0',
      desc: 'Dub and translate your voice notes & video walkie-talkies in 100+ languages in real time.',
      cta: 'Try AI Translation',
      icon: 'fa-solid fa-language',
      gradient: 'linear-gradient(135deg, rgba(24, 119, 242, 0.22), rgba(13, 101, 217, 0.08))',
      badgeColor: '#1877f2',
      stars: '4.9 ★★★★★ (12.4k reviews)',
      link: '/settings',
    },
    {
      id: 2,
      tag: 'PRODUCTIVITY • AI COPILOT',
      title: 'Smart Chat Assistant & Summaries',
      desc: 'Instant context summaries and auto-suggested smart replies for fast and effortless chats.',
      cta: 'Explore Copilot',
      icon: 'fa-solid fa-robot',
      gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.22), rgba(109, 40, 217, 0.08))',
      badgeColor: '#8b5cf6',
      stars: '4.8 ★★★★★ (9.1k reviews)',
      link: '/settings',
    },
    {
      id: 3,
      tag: 'STUDIO AUDIO • SPONSORED',
      title: 'AI Acoustic Noise Shield',
      desc: 'Studio-grade filtering removes 99% of background wind and traffic noise from all voice recordings.',
      cta: 'Upgrade Audio',
      icon: 'fa-solid fa-microphone-lines',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(5, 150, 105, 0.08))',
      badgeColor: '#10b981',
      stars: '5.0 ★★★★★ (16.2k reviews)',
      link: '/settings',
    },
    {
      id: 4,
      tag: 'GLOBAL FRIENDS • SPONSORED',
      title: 'Meet Native Speakers Worldwide',
      desc: 'Exchange language and culture directly with verified friends in over 120+ countries.',
      cta: 'Find Friends',
      icon: 'fa-solid fa-earth-americas',
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(217, 119, 6, 0.08))',
      badgeColor: '#f59e0b',
      stars: '4.9 ★★★★★ (21k reviews)',
      link: '/friends',
    },
  ], []);

  // Auto-scroll ads every 4.5 seconds
  useEffect(() => {
    if (isAdPaused) return;
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % sponsoredAds.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isAdPaused, sponsoredAds.length]);

  // Load Friends for Left Sidebar
  useEffect(() => {
    let active = true;
    const loadFriends = async () => {
      try {
        setFriendsLoading(true);
        const convs = await getMyConversations().catch(() => []);
        let list = [];
        const seenIds = new Set();
        const seenUsernames = new Set();
        const currentId = user?.userId || user?.id;
        const currentUsername = (user?.username || '').trim().toLowerCase();
        if (currentId) seenIds.add(currentId);
        if (currentUsername) seenUsernames.add(currentUsername);

        if (Array.isArray(convs) && convs.length > 0) {
          for (const c of convs) {
            const u = c.otherUser;
            if (!u || !u.id || isFriendDeleted(u)) continue;
            // Only mutual friends with an ACCEPTED friendship
            if (c.status !== 'ACCEPTED') continue;
            const uLower = (u.username || '').trim().toLowerCase();
            if (seenIds.has(u.id) || (uLower && seenUsernames.has(uLower))) continue;
            seenIds.add(u.id);
            if (uLower) seenUsernames.add(uLower);
            list.push({
              id: u.id,
              username: u.username,
              displayName: u.displayName || u.username,
              avatarUrl: u.avatarUrl,
              conversationId: c.conversationId,
              lastMessage: c.lastMessage,
            });
          }
        }

        if (active) setFriendsList(list);
      } catch (err) {
        console.error('Failed to load friends for sidebar:', err);
      } finally {
        if (active) setFriendsLoading(false);
      }
    };

    loadFriends();
    return () => {
      active = false;
    };
  }, [user]);

  const filteredFriends = useMemo(() => {
    if (!friendSearch.trim()) return friendsList;
    const q = friendSearch.toLowerCase();
    return friendsList.filter(
      (f) =>
        f.displayName?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q)
    );
  }, [friendsList, friendSearch]);

  const handleOpenChat = async (friend) => {
    unmarkFriendDeleted(friend.id, friend.username);
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

  // Load Posts
  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await getPosts();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching community posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Handle Image File Upload from composer
  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSubmitting(true);
      const res = await uploadMedia(file, 'image');
      setAttachedMedia({
        url: res.url,
        type: 'image',
        name: file.name,
        previewUrl: resolveBackendUrl(res.url),
      });
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Gio Video Modal Media
  const handleGioVideoRecorded = (payloadStr) => {
    try {
      const data = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
      if (data && data.mediaUrl) {
        setAttachedMedia({
          url: data.mediaUrl,
          type: data.type || 'video',
          name: data.fileName || 'Gio Video Note',
          previewUrl: resolveBackendUrl(data.mediaUrl),
          transcript: data.transcript || '',
        });
        if (data.transcript && !postText) {
          setPostText(data.transcript);
        }
      }
    } catch (err) {
      console.error('Error parsing Gio video payload:', err);
    }
  };

  // Submit Post
  const handleCreatePost = async (e) => {
    e?.preventDefault();
    if (!postText.trim() && !attachedMedia) return;

    try {
      setIsSubmitting(true);
      const newPost = await createPost({
        content: postText.trim() || (attachedMedia?.type === 'video' ? '🎥 Video Walkie-Talkie note' : '📸 Photo update'),
        mediaUrl: attachedMedia?.url || null,
        mediaType: attachedMedia?.type || 'text',
        language: postLanguage,
      });

      setPosts((prev) => [newPost, ...prev]);
      setPostText('');
      setAttachedMedia(null);
    } catch (err) {
      console.error('Error creating post:', err);
      alert('Failed to share post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Like
  const handleToggleLike = async (postId) => {
    try {
      // Optimistic update
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const willLike = !p.likedByMe;
            return {
              ...p,
              likedByMe: willLike,
              likeCount: willLike ? p.likeCount + 1 : Math.max(0, p.likeCount - 1),
            };
          }
          return p;
        })
      );
      const updated = await toggleLikePost(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch (err) {
      console.error('Error toggling like:', err);
      fetchPosts(); // Rollback
    }
  };

  // Toggle Comments Drawer
  const handleToggleComments = async (postId) => {
    const current = commentsState[postId];
    if (current?.open) {
      setCommentsState((prev) => ({
        ...prev,
        [postId]: { ...prev[postId], open: false },
      }));
      return;
    }

    setCommentsState((prev) => ({
      ...prev,
      [postId]: { open: true, loading: true, list: prev[postId]?.list || [] },
    }));

    try {
      const list = await getPostComments(postId);
      setCommentsState((prev) => ({
        ...prev,
        [postId]: { open: true, loading: false, list: Array.isArray(list) ? list : [] },
      }));
    } catch (err) {
      console.error('Error loading comments:', err);
      setCommentsState((prev) => ({
        ...prev,
        [postId]: { open: true, loading: false, list: [] },
      }));
    }
  };

  // Start Reply to a specific comment
  const handleStartReply = (postId, comment) => {
    setReplyingTo((prev) => ({
      ...prev,
      [postId]: {
        commentId: comment.id,
        username: comment.username,
        displayName: comment.displayName || comment.username,
      },
    }));
    setTimeout(() => {
      commentInputRefs.current[postId]?.focus();
    }, 50);
  };

  // Cancel Reply mode
  const handleCancelReply = (postId) => {
    setReplyingTo((prev) => ({
      ...prev,
      [postId]: null,
    }));
  };

  // Submit Comment / Reply
  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const replyContext = replyingTo[postId];

    try {
      const newComment = await addComment(postId, {
        content: text,
        parentCommentId: replyContext?.commentId || null,
        replyToUsername: replyContext?.username || null,
      });

      setCommentsState((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          list: [...(prev[postId]?.list || []), newComment],
        },
      }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p))
      );
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      setReplyingTo((prev) => ({ ...prev, [postId]: null }));
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to post reply.');
    }
  };

  // Toggle Like on Comment
  const handleToggleCommentLike = async (postId, commentId) => {
    try {
      // Optimistic update
      setCommentsState((prev) => {
        const currentPostComments = prev[postId]?.list || [];
        const updatedList = currentPostComments.map((c) => {
          if (c.id === commentId) {
            const willLike = !c.likedByMe;
            return {
              ...c,
              likedByMe: willLike,
              likeCount: willLike ? (c.likeCount || 0) + 1 : Math.max(0, (c.likeCount || 0) - 1),
            };
          }
          return c;
        });
        return {
          ...prev,
          [postId]: {
            ...prev[postId],
            list: updatedList,
          },
        };
      });

      const updated = await toggleLikeComment(postId, commentId);
      setCommentsState((prev) => {
        const currentPostComments = prev[postId]?.list || [];
        return {
          ...prev,
          [postId]: {
            ...prev[postId],
            list: currentPostComments.map((c) => (c.id === commentId ? updated : c)),
          },
        };
      });
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  // Translate Post Content
  const handleTranslatePost = async (post) => {
    const postId = post.id;
    const existing = translations[postId];

    if (existing) {
      setTranslations((prev) => ({
        ...prev,
        [postId]: { ...existing, isShowing: !existing.isShowing },
      }));
      return;
    }

    try {
      setTranslatingPostId(postId);
      const targetLang = user?.preferredLanguage || currentLang || 'en';
      const res = await quickTranslate(post.content, targetLang);
      if (res && res.translatedText) {
        setTranslations((prev) => ({
          ...prev,
          [postId]: {
            translatedText: res.translatedText,
            sourceLang: res.sourceLanguage || post.language || 'auto',
            targetLang: res.targetLanguage || targetLang,
            isShowing: true,
          },
        }));
      }
    } catch (err) {
      console.error('Error translating post:', err);
      alert('Could not translate this post right now.');
    } finally {
      setTranslatingPostId(null);
    }
  };

  // Delete Post (Owner only)
  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post.');
    }
  };

  // Start 1-on-1 Chat with Post Creator
  const handleStartChatWithUser = async (postUser) => {
    if (!postUser || !postUser.id) return;
    unmarkFriendDeleted(postUser.id, postUser.username);
    if (String(postUser.id) === String(user?.userId || user?.id)) {
      alert("This is your own post!");
      return;
    }

    try {
      const conv = await startConversation(postUser.id);
      if (conv && conv.id) {
        navigate(`/chat/${conv.id}`, {
          state: {
            friend: {
              id: postUser.id,
              username: postUser.username,
              displayName: postUser.displayName,
              avatarUrl: postUser.avatarUrl,
            },
          },
        });
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
      navigate('/friends');
    }
  };

  // Instant click-to-delete user from sidebar & feed with WhatsApp-style modal
  const handleDeleteFriendEasy = (friend, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setUserToDelete(friend);
  };

  // Block user like Telegram
  const handleBlockFriend = async (targetFriend) => {
    const fId = targetFriend?.id || targetFriend?.userId;
    if (!fId) return;
    try {
      await blockUser(fId);
      // Remove from sidebar list optimistically
      setFriendsList((prev) => prev.filter((f) => f.id !== fId && f.userId !== fId));
    } catch (err) {
      console.error('Failed to block friend:', err);
    }
  };

  // Delete user conversation from sidebar & feed (WhatsApp style confirmation)
  const handleConfirmDeleteSidebarUser = async (targetFriend = userToDelete) => {
    const friendToDelete = targetFriend || userToDelete;
    if (!friendToDelete) return;
    setIsDeletingUser(true);
    setDeleteUserError('');

    const fId = friendToDelete.id || friendToDelete.userId || friendToDelete._id;
    // 1. Mark permanently deleted so they NEVER return on refresh
    markFriendAsDeleted(fId, friendToDelete.username);

    // 2. Optimistically remove from sidebar & feed
    setFriendsList((prev) => prev.filter((f) => f.id !== fId && f.userId !== fId));
    setPosts((prev) => prev.filter((p) => p.user?.id !== fId && p.userId !== fId));

    try {
      if (fId) {
        await deleteConversationWithUser(fId);
      }
      setUserToDelete(null);
    } catch (err) {
      console.warn('Backend delete conversation completed:', err);
      setUserToDelete(null);
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Share App / Post Invite
  const shareLink = `${window.location.origin}/register?ref=${user?.username || ''}`;
  const inviteMessage = `Hey! Join me on Giochat - the real-time AI translation and walkie-talkie community app: ${shareLink}`;

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join me on Giochat!',
        text: inviteMessage,
        url: shareLink,
      }).catch(() => {});
    } else {
      handleCopyInviteLink();
    }
  };

  // Helper: Format Time Ago
  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    if (filter === 'video') {
      return posts.filter((p) => p.mediaType === 'video' || p.mediaType === 'polo');
    }
    if (filter === 'image') {
      return posts.filter((p) => p.mediaType === 'image');
    }
    return posts;
  }, [posts, filter]);

  const currentAd = sponsoredAds[currentAdIndex] || sponsoredAds[0];

  return (
    <div className="community-home-wrapper">
      {/* =========================================================================
          LEFT SIDEBAR: Profile, Friends List & Quick Contacts
          ========================================================================= */}
      <aside className="community-sidebar-left">
        {/* User Mini Profile Card */}
        {user && (
          <div
            className="sidebar-card user-mini-card"
            onClick={() => navigate('/settings')}
            title="View profile & settings"
          >
            <div className="mini-card-avatar-wrap">
              <img
                src={resolveAvatarUrl(user.avatarUrl, user.displayName || user.username)}
                alt={user.username}
                className="mini-card-avatar"
                onError={(e) => handleAvatarError(e, user.displayName || user.username)}
              />
              <span className="mini-card-status-dot online" />
            </div>
            <div className="mini-card-meta">
              {user.displayName && user.displayName.trim().toLowerCase() !== user.username.trim().toLowerCase() ? (
                <>
                  <span className="mini-card-name">{user.displayName}</span>
                  <span className="mini-card-handle">@{user.username}</span>
                </>
              ) : (
                <span className="mini-card-name">@{user.username}</span>
              )}
            </div>
            <i className="fa-solid fa-chevron-right mini-card-arrow"></i>
          </div>
        )}

        {/* Friends & Contacts List */}
        <div className="sidebar-card friends-sidebar-card">
          <div className="sidebar-header">
            <div className="sidebar-title-row">
              <i className="fa-solid fa-user-group sidebar-icon"></i>
              <h3>Friends & Contacts</h3>
            </div>
            <div className="sidebar-header-actions">
              <button
                type="button"
                className="sidebar-clean-badge-btn"
                onClick={() => navigate('/settings?tab=users')}
                title="Clean & manage inactive users"
              >
                <i className="fa-solid fa-broom"></i> Clean
              </button>
              <span className="sidebar-count-badge">
                {filteredFriends.length}
              </span>
            </div>
          </div>

          {/* Friends Search Input */}
          <div className="sidebar-search-box">
            <i className="fa-solid fa-magnifying-glass search-mini-icon"></i>
            <input
              type="text"
              placeholder="Search contacts..."
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              className="sidebar-search-input"
            />
            {friendSearch && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setFriendSearch('')}
                title="Clear search"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          {/* Friends List Container */}
          <div className="sidebar-friends-list">
            {friendsLoading ? (
              <div className="sidebar-loading">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Loading contacts...</span>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="sidebar-empty">
                <i className="fa-solid fa-user-xmark"></i>
                <p>No contacts found</p>
              </div>
            ) : (
              filteredFriends.map((friend) => {
                const isOnline = onlineIds.includes(friend.id);
                const friendLastSeen = userStatuses[friend.id]?.lastSeen || friend.lastSeen;
                const activity = getUserActivitySummary(isOnline, friendLastSeen, userStatuses[friend.id]?.status);
                const status = userStatuses[friend.id]?.status || (isOnline ? 'online' : 'offline');
                return (
                  <div
                    key={friend.id}
                    className="sidebar-friend-item"
                    onClick={() => handleOpenChat(friend)}
                    onContextMenu={(e) => handleFriendContextMenu(e, friend)}
                    title={`Click to chat with ${friend.displayName || friend.username} • Right-click to delete • ${activity.statusText}`}
                  >
                    <div className="friend-avatar-wrap">
                      <img
                        src={resolveAvatarUrl(friend.avatarUrl, friend.displayName || friend.username)}
                        alt={friend.displayName || friend.username}
                        className="friend-avatar"
                        onError={(e) => handleAvatarError(e, friend.displayName || friend.username)}
                      />
                      <span className={`friend-status-dot ${status}`} />
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">
                        {friend.displayName && friend.displayName.trim().toLowerCase() !== friend.username.trim().toLowerCase()
                          ? friend.displayName
                          : `@${friend.username}`}
                      </span>
                      <span className={`friend-status-label ${activity.badgeClass}`} title={activity.statusText}>
                        {activity.label}
                      </span>
                    </div>
                    <div className="friend-actions-group">
                      <button
                        type="button"
                        className="friend-chat-icon-btn"
                        title="Send message"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenChat(friend);
                        }}
                      >
                        <i className="fa-solid fa-comment-dots"></i>
                      </button>
                      <button
                        type="button"
                        className="friend-delete-icon-btn"
                        title={`Delete / clean @${friend.username}`}
                        onClick={(e) => handleDeleteFriendEasy(friend, e)}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="sidebar-footer-link">
            <button
              type="button"
              onClick={() => navigate('/friends')}
              className="sidebar-see-all-btn"
            >
              <i className="fa-solid fa-users"></i> See All Friends ({friendsList.length})
            </button>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="sidebar-card shortcuts-card">
          <h4 className="shortcuts-title">Shortcuts</h4>
          <div className="shortcuts-list">
            <button type="button" className="shortcut-btn" onClick={() => navigate('/friends')}>
              <i className="fa-solid fa-comments shortcut-icon" style={{ color: '#1877f2' }}></i>
              <span>Direct Messages</span>
            </button>
            <button type="button" className="shortcut-btn" onClick={() => navigate('/calls')}>
              <i className="fa-solid fa-video shortcut-icon" style={{ color: '#10b981' }}></i>
              <span>Audio & Video Calls</span>
            </button>
            <button type="button" className="shortcut-btn" onClick={() => setIsGioVideoOpen(true)}>
              <i className="fa-solid fa-camera-rotate shortcut-icon" style={{ color: '#f59e0b' }}></i>
              <span>Gio Video Note</span>
            </button>
            <button type="button" className="shortcut-btn" onClick={() => navigate('/settings')}>
              <i className="fa-solid fa-earth-americas shortcut-icon" style={{ color: '#8b5cf6' }}></i>
              <span>GioTranslate Settings</span>
            </button>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          CENTER COLUMN: Main Community Feed
          ========================================================================= */}
      <main className="community-feed-center">
        {/* 1. Top Hero & Invite Friends Banner */}
        <section className="community-hero-card">
        <div className="community-hero-content">
          <div className="community-hero-badge">
            <span className="hero-sparkle">✨</span> Global Community & Friends
          </div>
          <h1 className="community-hero-title">
            Connect & Chat with Friends Worldwide 🌍
          </h1>
          <p className="community-hero-subtitle">
            Share moments, voice & Gio video walkie-talkies, and break language barriers instantly with AI live translation.
          </p>
        </div>

        {/* Invite Friends Action Capsule */}
        <div className="community-invite-box">
          <div className="invite-box-header">
            <i className="fa-solid fa-user-plus invite-icon"></i>
            <span><strong>Invite your friends to join Giochat:</strong></span>
          </div>

          <div className="invite-actions-row">
            <button
              type="button"
              className={`invite-btn copy-btn ${copiedLink ? 'copied' : ''}`}
              onClick={handleCopyInviteLink}
              title="Copy your personal invite link"
            >
              <i className={`fa-solid ${copiedLink ? 'fa-check' : 'fa-copy'}`}></i>
              <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
            </button>

            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="invite-btn whatsapp-btn"
              title="Share via WhatsApp"
            >
              <i className="fa-brands fa-whatsapp"></i>
              <span>WhatsApp</span>
            </a>

            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('Join me on Giochat!')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="invite-btn telegram-btn"
              title="Share via Telegram"
            >
              <i className="fa-brands fa-telegram"></i>
              <span>Telegram</span>
            </a>

            <button
              type="button"
              className="invite-btn share-native-btn"
              onClick={handleNativeShare}
              title="More Share Options"
            >
              <i className="fa-solid fa-share-nodes"></i>
              <span>Share...</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Post Creator Card */}
      <section className="post-creator-card">
        <div className="creator-top-row">
          <div className="creator-avatar">
            {user?.avatarUrl ? (
              <img src={resolveBackendUrl(user.avatarUrl)} alt={user.username} />
            ) : (
              <div className="creator-avatar-placeholder">
                {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
              </div>
            )}
            <span className="creator-status-dot online"></span>
          </div>

          <div className="creator-input-wrap">
            <textarea
              className="creator-textarea"
              placeholder={`What's happening, ${user?.displayName || user?.username || 'friend'}? Share a thought, photo, or Gio video...`}
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={postText.length > 80 ? 3 : 2}
            />
          </div>
        </div>

        {/* Attached Media Preview */}
        {attachedMedia && (
          <div className="creator-media-preview">
            {attachedMedia.type === 'image' && (
              <div className="preview-image-wrap">
                <img src={attachedMedia.previewUrl} alt="Upload preview" />
                <button
                  type="button"
                  className="remove-media-btn"
                  onClick={() => setAttachedMedia(null)}
                  title="Remove photo"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            )}

            {(attachedMedia.type === 'video' || attachedMedia.type === 'polo' || attachedMedia.type === 'gio') && (
              <div className="preview-video-wrap">
                <video src={attachedMedia.previewUrl} controls playsInline />
                <div className="video-badge-tag">
                  <i className="fa-solid fa-video"></i> Gio Video Note
                </div>
                <button
                  type="button"
                  className="remove-media-btn"
                  onClick={() => setAttachedMedia(null)}
                  title="Remove video note"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Creator Bottom Actions Bar */}
        <div className="creator-bottom-bar">
          <div className="creator-tools">
            {/* 1. Photo Picker */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageFileChange}
            />
            <button
              type="button"
              className="tool-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Add Photo"
              disabled={isSubmitting}
            >
              <i className="fa-solid fa-image tool-icon-photo"></i>
              <span className="tool-label">Photo</span>
            </button>

            {/* 2. Record Gio Video Walkie-Talkie */}
            <button
              type="button"
              className="tool-btn polo-tool-btn gio-tool-btn"
              onClick={() => setIsGioVideoOpen(true)}
              title="Record Gio Video Note"
              disabled={isSubmitting}
            >
              <i className="fa-solid fa-video tool-icon-polo tool-icon-gio"></i>
              <span className="tool-label">Gio Video</span>
            </button>

            {/* 3. Post Language Selector */}
            <div className="post-lang-select-wrap">
              <span className="lang-icon">🌍</span>
              <select
                value={postLanguage}
                onChange={(e) => setPostLanguage(e.target.value)}
                className="post-lang-select"
                title="Post Language"
              >
                {languageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="submit-post-btn"
            onClick={handleCreatePost}
            disabled={isSubmitting || (!postText.trim() && !attachedMedia)}
          >
            {isSubmitting ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Posting...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane"></i>
                <span>Post</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* 3. Feed Navigation / Filter Tabs */}
      <div className="community-filter-tabs">
        <button
          type="button"
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <i className="fa-solid fa-globe"></i>
          <span>All Posts ({posts.length})</span>
        </button>

        <button
          type="button"
          className={`filter-tab ${filter === 'video' ? 'active' : ''}`}
          onClick={() => setFilter('video')}
        >
          <i className="fa-solid fa-video"></i>
          <span>Gio Videos</span>
        </button>

        <button
          type="button"
          className={`filter-tab ${filter === 'image' ? 'active' : ''}`}
          onClick={() => setFilter('image')}
        >
          <i className="fa-solid fa-image"></i>
          <span>Photos</span>
        </button>

        <button
          type="button"
          className={`filter-tab ${filter === 'news' ? 'active' : ''}`}
          onClick={() => setFilter('news')}
        >
          <i className="fa-solid fa-newspaper"></i>
          <span>Live News 🇪🇸🌍</span>
        </button>

        <button
          type="button"
          className={`filter-tab mobile-live-filter-btn ${showMobileLiveHub ? 'active' : ''}`}
          onClick={() => setShowMobileLiveHub((prev) => !prev)}
          title="Toggle Live Football Scores & Real-World News"
        >
          <span className="mobile-live-red-dot" />
          <span>⚽ Scores & News</span>
        </button>

        <button
          type="button"
          className="filter-refresh-btn"
          onClick={fetchPosts}
          title="Refresh Feed"
        >
          <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
        </button>
      </div>

      {/* Mobile Live Football & News Container (When toggled on mobile) */}
      {showMobileLiveHub && (
        <div className="mobile-live-hub-container">
          <LiveFootballAndNews />
        </div>
      )}

      {/* 4. Feed Stream */}
      <section className="community-posts-stream">
        {filter === 'news' ? (
          <HomeNewsFeed user={user} />
        ) : (
          <>
            {loading && posts.length === 0 ? (
              <div className="community-loading-state">
                <i className="fa-solid fa-circle-notch fa-spin"></i>
                <p>Loading global community posts...</p>
              </div>
            ) : (
              filteredPosts.map((post) => {
            const isMyPost = String(post.userId) === String(user?.userId || user?.id);
            const translation = translations[post.id];
            const isTranslating = translatingPostId === post.id;
            const commentsInfo = commentsState[post.id] || { open: false, loading: false, list: [] };

            return (
              <article key={post.id} className="post-card">
                {/* Post Header */}
                <header className="post-card-header">
                  <div
                    className="post-author-info"
                    onClick={() => handleStartChatWithUser({ id: post.userId, username: post.username, displayName: post.displayName, avatarUrl: post.avatarUrl })}
                    title={`Click to chat with @${post.username}`}
                  >
                    <div className="author-avatar-wrap">
                      {post.avatarUrl ? (
                        <img src={resolveBackendUrl(post.avatarUrl)} alt={post.displayName || post.username} />
                      ) : (
                        <div className="author-avatar-fallback">
                          {(post.displayName || post.username || 'U')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="author-meta">
                      <div className="author-name-row">
                        {post.displayName && post.displayName.trim().toLowerCase() !== post.username.trim().toLowerCase() ? (
                          <>
                            <span className="author-display-name">{post.displayName}</span>
                            <span className="author-handle">@{post.username}</span>
                          </>
                        ) : (
                          <span className="author-display-name">@{post.username}</span>
                        )}
                        {post.language && (
                          <span className="post-lang-badge">
                            {post.language.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="post-time">{formatTimeAgo(post.createdAt)}</span>
                    </div>
                  </div>

                  <div className="post-header-actions">
                    {/* Chat with author CTA */}
                    {!isMyPost && (
                      <button
                        type="button"
                        className="post-chat-cta-btn"
                        onClick={() => handleStartChatWithUser({ id: post.userId, username: post.username, displayName: post.displayName, avatarUrl: post.avatarUrl })}
                        title={`Start direct chat with ${post.displayName || post.username}`}
                      >
                        <i className="fa-solid fa-comment-dots"></i>
                        <span>Chat</span>
                      </button>
                    )}

                    {/* Delete button for author */}
                    {isMyPost && (
                      <button
                        type="button"
                        className="post-delete-btn"
                        onClick={() => handleDeletePost(post.id)}
                        title="Delete this post"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    )}
                  </div>
                </header>

                {/* Post Content & AI Translation */}
                <div className="post-body">
                  <p className="post-text-content">
                    {translation?.isShowing ? translation.translatedText : post.content}
                  </p>

                  {/* AI Translation Indicator Box */}
                  {translation?.isShowing && (
                    <div className="translation-indicator-box">
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <span>
                        Translated from <strong>{translation.sourceLang.toUpperCase()}</strong> to{' '}
                        <strong>{translation.targetLang.toUpperCase()}</strong> via Giochat AI
                      </span>
                    </div>
                  )}

                  {/* Inline Translate Toggle Button */}
                  {post.content && post.content.length > 2 && (
                    <button
                      type="button"
                      className={`post-translate-btn ${translation?.isShowing ? 'active' : ''}`}
                      onClick={() => handleTranslatePost(post)}
                      disabled={isTranslating}
                    >
                      {isTranslating ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          <span>Translating...</span>
                        </>
                      ) : translation?.isShowing ? (
                        <>
                          <i className="fa-solid fa-rotate-left"></i>
                          <span>Show Original</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-language"></i>
                          <span>Translate Text</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Post Media Display */}
                {post.mediaUrl && (
                  <div className="post-media-container">
                    {post.mediaType === 'image' && (
                      <div
                        className="post-image-wrap"
                        onClick={() => setLightboxMedia(resolveBackendUrl(post.mediaUrl))}
                      >
                        <img
                          src={resolveBackendUrl(post.mediaUrl)}
                          alt="Community Post"
                          loading="lazy"
                        />
                        <div className="media-zoom-overlay">
                          <i className="fa-solid fa-magnifying-glass-plus"></i>
                        </div>
                      </div>
                    )}

                    {(post.mediaType === 'video' || post.mediaType === 'polo') && (
                      <div className="post-video-player-wrap">
                        <video
                          src={resolveBackendUrl(post.mediaUrl)}
                          controls
                          playsInline
                          preload="metadata"
                          className="post-video-player"
                        />
                        <div className="post-video-badge">
                          <i className="fa-solid fa-video"></i> Gio Video Note
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Post Interactive Footer Bar */}
                <footer className="post-card-footer">
                  {/* Like Button */}
                  <button
                    type="button"
                    className={`post-action-btn like-action ${post.likedByMe ? 'liked' : ''}`}
                    onClick={() => handleToggleLike(post.id)}
                    title={post.likedByMe ? 'Unlike' : 'Like'}
                  >
                    <i className={`fa-${post.likedByMe ? 'solid' : 'regular'} fa-heart heart-icon`}></i>
                    <span className="action-count">{post.likeCount || 0}</span>
                  </button>

                  {/* Comment Button */}
                  <button
                    type="button"
                    className={`post-action-btn comment-action ${commentsInfo.open ? 'active' : ''}`}
                    onClick={() => handleToggleComments(post.id)}
                    title="View & Add Comments"
                  >
                    <i className="fa-regular fa-comment"></i>
                    <span className="action-count">{post.commentsCount || 0}</span>
                  </button>

                  {/* Join / Connect Chat Button */}
                  <button
                    type="button"
                    className="post-action-btn connect-action"
                    onClick={() => handleStartChatWithUser({ id: post.userId, username: post.username, displayName: post.displayName, avatarUrl: post.avatarUrl })}
                    title={`Chat with ${post.displayName || post.username}`}
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                    <span>Connect</span>
                  </button>

                  {/* Share Post */}
                  <button
                    type="button"
                    className="post-action-btn share-action"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `Post by @${post.username} on Giochat`,
                          text: post.content,
                          url: window.location.href,
                        }).catch(() => {});
                      } else {
                        handleCopyInviteLink();
                      }
                    }}
                    title="Share Post"
                  >
                    <i className="fa-solid fa-share"></i>
                  </button>
                </footer>

                {/* Comments Section (X / Twitter Style) */}
                {commentsInfo.open && (
                  <div className="x-comments-section">
                    <div className="x-comments-divider"></div>

                    {/* Comments List */}
                    <div className="x-comments-list">
                      {commentsInfo.loading ? (
                        <div className="x-comments-loading">
                          <i className="fa-solid fa-circle-notch fa-spin"></i>
                          <span>Loading replies...</span>
                        </div>
                      ) : commentsInfo.list.length === 0 ? (
                        <div className="x-no-comments">
                          <i className="fa-regular fa-comments x-empty-icon"></i>
                          <p>No replies yet. Be the first to start the conversation!</p>
                        </div>
                      ) : (
                        commentsInfo.list.map((c, idx) => {
                          const isLast = idx === commentsInfo.list.length - 1;
                          return (
                            <div key={c.id} className="x-comment-row">
                              {/* Left Avatar & Connecting Thread Line */}
                              <div className="x-avatar-col">
                                <div className="x-author-avatar">
                                  {c.avatarUrl ? (
                                    <img src={resolveBackendUrl(c.avatarUrl)} alt={c.username} />
                                  ) : (
                                    <div className="x-avatar-fallback">
                                      {(c.displayName || c.username || 'U')[0].toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                {!isLast && <div className="x-thread-line"></div>}
                              </div>

                              {/* Right Content */}
                              <div className="x-comment-body">
                                <div className="x-comment-header">
                                  {c.displayName && c.displayName.trim().toLowerCase() !== c.username.trim().toLowerCase() ? (
                                    <>
                                      <span className="x-author-name">{c.displayName}</span>
                                      <span className="x-author-handle">@{c.username}</span>
                                    </>
                                  ) : (
                                    <span className="x-author-name">@{c.username}</span>
                                  )}
                                  <span className="x-dot-sep">·</span>
                                  <span className="x-comment-time">{formatTimeAgo(c.createdAt)}</span>
                                </div>

                                {/* Replying to handle indicator (like on X) */}
                                {c.replyToUsername && (
                                  <div className="x-replying-indicator">
                                    <span>Replying to</span>
                                    <span className="x-reply-target">@{c.replyToUsername}</span>
                                  </div>
                                )}

                                <p className="x-comment-text">{c.content}</p>

                                {/* X-Style Action Row */}
                                <div className="x-action-row">
                                  {/* Reply Button */}
                                  <button
                                    type="button"
                                    className="x-action-btn x-reply-btn"
                                    onClick={() => handleStartReply(post.id, c)}
                                    title={`Reply to @${c.username}`}
                                  >
                                    <i className="fa-regular fa-comment"></i>
                                    <span className="x-action-label">Reply</span>
                                  </button>

                                  {/* Like Button */}
                                  <button
                                    type="button"
                                    className={`x-action-btn x-like-btn ${c.likedByMe ? 'liked' : ''}`}
                                    onClick={() => handleToggleCommentLike(post.id, c.id)}
                                    title={c.likedByMe ? 'Unlike' : 'Like'}
                                  >
                                    <i className={`fa-${c.likedByMe ? 'solid' : 'regular'} fa-heart x-heart-icon`}></i>
                                    {(c.likeCount > 0 || c.likedByMe) && (
                                      <span className="x-action-count">{c.likeCount || 0}</span>
                                    )}
                                  </button>

                                  {/* Copy / Share Button */}
                                  <button
                                    type="button"
                                    className="x-action-btn x-share-btn"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(c.content);
                                      alert('Comment text copied!');
                                    }}
                                    title="Copy text"
                                  >
                                    <i className="fa-regular fa-copy"></i>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* X-Style Reply Composer */}
                    <div className="x-composer-wrapper">
                      {/* Replying-to Active Capsule Banner */}
                      {replyingTo[post.id] && (
                        <div className="x-reply-active-banner">
                          <div className="x-reply-badge">
                            <i className="fa-solid fa-reply"></i>
                            <span>Replying to <strong>@{replyingTo[post.id].username}</strong></span>
                          </div>
                          <button
                            type="button"
                            className="x-reply-cancel-btn"
                            onClick={() => handleCancelReply(post.id)}
                            title="Cancel reply"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      )}

                      <form
                        className="x-reply-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddComment(post.id);
                        }}
                      >
                        <div className="x-form-avatar">
                          {user?.avatarUrl ? (
                            <img src={resolveBackendUrl(user.avatarUrl)} alt={user.username} />
                          ) : (
                            <div className="x-form-avatar-fallback">
                              {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="x-form-input-col">
                          <input
                            type="text"
                            ref={(el) => {
                              commentInputRefs.current[post.id] = el;
                            }}
                            className="x-reply-input"
                            placeholder={
                              replyingTo[post.id]
                                ? `Post your reply to @${replyingTo[post.id].username}...`
                                : "Post your reply..."
                            }
                            value={commentInputs[post.id] || ''}
                            onChange={(e) =>
                              setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                            }
                          />
                        </div>

                        <button
                          type="submit"
                          className="x-reply-submit-btn"
                          disabled={!commentInputs[post.id]?.trim()}
                        >
                          <span>{replyingTo[post.id] ? 'Reply' : 'Post'}</span>
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}

        {/* Live Spain & World Breaking News Feed directly under posts or filling the feed */}
        <HomeNewsFeed user={user} hasCommunityPosts={filteredPosts.length > 0} />
      </>
    )}
  </section>
  </main>

      {/* =========================================================================
          RIGHT SIDEBAR: Sponsored AI Ads, Scrolling & Trending
          ========================================================================= */}
      <aside className="community-sidebar-right">
        {/* Card 1: Interactive Sponsored AI Ads Carousel */}
        <div
          className="sidebar-card sponsored-card"
          onMouseEnter={() => setIsAdPaused(true)}
          onMouseLeave={() => setIsAdPaused(false)}
        >
          <div className="sponsored-header">
            <span className="sponsored-label">
              <i className="fa-solid fa-rectangle-ad sponsored-tag-icon"></i>
              <span>Sponsored</span>
            </span>
            <div className="sponsored-actions">
              <span className="sponsored-info-icon" title="Featured AI tools & sponsor suggestions">
                <i className="fa-solid fa-circle-info"></i>
              </span>
            </div>
          </div>

          {/* Active Ad Showcase */}
          <div className="ad-carousel-card" style={{ background: currentAd.gradient }}>
            <div className="ad-top-row">
              <span className="ad-badge" style={{ background: currentAd.badgeColor }}>
                {currentAd.tag}
              </span>
              <div className="ad-icon-circle">
                <i className={currentAd.icon}></i>
              </div>
            </div>

            <h3 className="ad-title">{currentAd.title}</h3>
            <p className="ad-desc">{currentAd.desc}</p>
            <span className="ad-stars">{currentAd.stars}</span>

            <div className="ad-cta-row">
              <button
                type="button"
                className="ad-cta-btn"
                onClick={currentAd.action}
              >
                <span>{currentAd.cta}</span>
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
              </button>
            </div>
          </div>

          {/* Carousel Pagination & Controls */}
          <div className="ad-controls-row">
            <button
              type="button"
              className="ad-nav-btn"
              onClick={() => setCurrentAdIndex((prev) => (prev - 1 + sponsoredAds.length) % sponsoredAds.length)}
              title="Previous Ad"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>

            <div className="ad-dots-wrap">
              {sponsoredAds.map((ad, idx) => (
                <button
                  key={ad.id}
                  type="button"
                  className={`ad-dot ${idx === currentAdIndex ? 'active' : ''}`}
                  onClick={() => setCurrentAdIndex(idx)}
                  title={ad.title}
                />
              ))}
            </div>

            <button
              type="button"
              className="ad-nav-btn"
              onClick={() => setCurrentAdIndex((prev) => (prev + 1) % sponsoredAds.length)}
              title="Next Ad"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

        {/* Card 2: Scrolling AI Spotlight Ticker */}
        <div className="sidebar-card ai-spotlight-card">
          <div className="spotlight-header">
            <span className="spotlight-title">
              <i className="fa-solid fa-bolt" style={{ color: '#eab308' }}></i>
              <span>AI Tech Spotlight</span>
            </span>
            <span className="spotlight-badge">New</span>
          </div>

          <div className="spotlight-scroller-wrap">
            <div className="spotlight-ticker-track">
              <div className="spotlight-item" onClick={() => navigate('/settings')}>
                <div className="spotlight-item-icon" style={{ background: 'rgba(24, 119, 242, 0.15)', color: '#1877f2' }}>
                  <i className="fa-solid fa-microphone-lines"></i>
                </div>
                <div className="spotlight-item-text">
                  <strong>Neural Voice Dubbing</strong>
                  <p>Instant speech synthesis in 100+ native dialects.</p>
                </div>
              </div>

              <div className="spotlight-item" onClick={() => navigate('/settings')}>
                <div className="spotlight-item-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
                  <i className="fa-solid fa-brain"></i>
                </div>
                <div className="spotlight-item-text">
                  <strong>Deep Context Summaries</strong>
                  <p>Catch up on long conversation threads in 1 tap.</p>
                </div>
              </div>

              <div className="spotlight-item" onClick={() => navigate('/settings')}>
                <div className="spotlight-item-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
                <div className="spotlight-item-text">
                  <strong>Quantum E2E Privacy</strong>
                  <p>Next-gen encrypted storage for secret chats.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Real World News & Live Football Scores Hub */}
        <LiveFootballAndNews />

        {/* Footer */}
        <div className="sidebar-footer">
          <p>© 2026 Giochat • Privacy • Terms • Ad Choices • Cookies</p>
        </div>
      </aside>

      {/* Lightbox for full image viewing */}
      {lightboxMedia && (
        <MediaLightbox
          src={lightboxMedia}
          type="image"
          onClose={() => setLightboxMedia(null)}
        />
      )}

      {/* Gio Video Camera & Recorder Modal */}
      <GioCameraModal
        isOpen={isGioVideoOpen}
        onClose={() => setIsGioVideoOpen(false)}
        onSend={handleGioVideoRecorded}
        friendName="Community Post"
      />

      {/* WhatsApp-Style Delete Friend Modal */}
      <WhatsAppDeleteModal
        isOpen={Boolean(userToDelete)}
        friend={userToDelete}
        isDeleting={isDeletingUser}
        onClose={() => !isDeletingUser && setUserToDelete(null)}
        onConfirm={handleConfirmDeleteSidebarUser}
      />


      {friendContextMenu.visible && (
        <FriendContextMenu
          x={friendContextMenu.x}
          y={friendContextMenu.y}
          friend={friendContextMenu.friend}
          onClose={() => setFriendContextMenu({ visible: false, x: 0, y: 0, friend: null })}
          onDelete={(f) => handleDeleteFriendEasy(f)}
          onOpenChat={(f) => handleOpenChat(f)}
          onViewProfile={(f) => handleOpenChat(f)}
          onBlock={(f) => handleBlockFriend(f)}
        />
      )}
    </div>
  );
}
