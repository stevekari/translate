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
import LiveScoresModal from '../components/LiveScoresModal';
import HomeNewsFeed from '../components/HomeNewsFeed';
import StoriesReelsTray from '../components/StoriesReelsTray';
import CreateReelModal from '../components/CreateReelModal';
import InstagramReelsViewer from '../components/InstagramReelsViewer';
import { getActiveReels, fetchRealReels, saveNewReel, toggleLikeReel, getWatchedReelIds } from '../utils/reelsData';
import { getLiveNews, FALLBACK_NEWS } from '../api/newsApi';
import { useWeather } from '../contexts/WeatherContext';
import { isFriendDeleted, markFriendAsDeleted, unmarkFriendDeleted } from '../utils/deletedFriends';
import '../styles/community.css';

export default function CommunityHome({ user }) {
  const navigate = useNavigate();
  const { language: currentLang, languageOptions, t } = useLanguage();
  const { weather, formatTemp, openWeatherModal, tWeather } = useWeather();

  const [posts, setPosts] = useState([]);
  const [liveNews, setLiveNews] = useState(FALLBACK_NEWS);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'wall' | 'general' | 'video' | 'image' | 'news'
  const [showMobileLiveHub, setShowMobileLiveHub] = useState(false);
  const [showLiveScoresModal, setShowLiveScoresModal] = useState(false);

  // Instagram / Facebook 5-Hour Reels & Status State
  const [reels, setReels] = useState(() => getActiveReels());
  const [watchedReelIds, setWatchedReelIds] = useState(() => getWatchedReelIds());
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [activeReelIndex, setActiveReelIndex] = useState(null);

  // Welcome Banner: Appears ONCE upon login for 30s, then NEVER appears again
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => {
    const uId = user?.userId || user?.id;
    if (!uId) return false;
    const seen = localStorage.getItem(`gio_welcome_seen_${uId}`);
    const justLoggedIn = sessionStorage.getItem('just_logged_in');
    if (justLoggedIn === 'true' && seen !== 'true') {
      localStorage.setItem(`gio_welcome_seen_${uId}`, 'true');
      sessionStorage.removeItem('just_logged_in');
      return true;
    }
    return false;
  });
  const [welcomeSecondsLeft, setWelcomeSecondsLeft] = useState(30);

  useEffect(() => {
    if (!showWelcomeBanner) return;
    const interval = setInterval(() => {
      setWelcomeSecondsLeft((prev) => {
        if (prev <= 1) {
          setShowWelcomeBanner(false);
          const uId = user?.userId || user?.id;
          if (uId) localStorage.setItem(`gio_welcome_seen_${uId}`, 'true');
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showWelcomeBanner, user]);

  const handleDismissWelcome = () => {
    setShowWelcomeBanner(false);
    const uId = user?.userId || user?.id;
    if (uId) localStorage.setItem(`gio_welcome_seen_${uId}`, 'true');
  };

  useEffect(() => {
    const handleOpenReels = (e) => {
      const idx = typeof e.detail?.index === 'number' ? e.detail.index : 0;
      setActiveReelIndex(idx);
    };
    const handleOpenCreate = () => {
      setIsCreateReelOpen(true);
    };
    window.addEventListener('open-reels-viewer', handleOpenReels);
    window.addEventListener('open-create-reel', handleOpenCreate);
    return () => {
      window.removeEventListener('open-reels-viewer', handleOpenReels);
      window.removeEventListener('open-create-reel', handleOpenCreate);
    };
  }, []);

  // New Post Form State
  const [postText, setPostText] = useState('');
  const [postLanguage, setPostLanguage] = useState(user?.preferredLanguage || currentLang || 'en');
  const [attachedMedia, setAttachedMedia] = useState(null); // { url, type, name, previewUrl }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGioVideoOpen, setIsGioVideoOpen] = useState(false);

  // Translation state for posts: { [postId]: { translatedText, sourceLang, isShowing } }
  const [translations, setTranslations] = useState({});
  const [translatingPostId, setTranslatingPostId] = useState(null);

  const targetLangCode = user?.preferredLanguage || currentLang || 'en';
  const targetLangName = useMemo(() => {
    const map = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      pt: 'Portuguese',
      nl: 'Dutch',
      it: 'Italian',
      tw: 'Twi',
      ak: 'Twi',
      ar: 'Arabic',
      zh: 'Chinese',
      ru: 'Russian',
      ja: 'Japanese',
    };
    return map[targetLangCode.toLowerCase()] || targetLangCode.toUpperCase();
  }, [targetLangCode]);

  // 5-Day Weather & Rain Forecast calculation for the left sidebar shortcuts card
  const fiveDaysWeather = useMemo(() => {
    if (!weather?.forecast || weather.forecast.length === 0) return [];
    return weather.forecast.slice(0, 5);
  }, [weather?.forecast]);

  const rainForecastSummary = useMemo(() => {
    if (!fiveDaysWeather || fiveDaysWeather.length === 0) return null;
    const rainyDays = fiveDaysWeather.filter(
      (d) =>
        d.precipitationProb >= 35 ||
        [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(d.weatherCode)
    );
    if (rainyDays.length === 0) {
      return { willRain: false, message: tWeather ? tWeather('sunnyDryDays') : 'Sunny & dry for the next 5 days ☀️' };
    }
    const daysStr = rainyDays.map((d) => d.dayName).join(', ');
    const maxChance = Math.max(...rainyDays.map((d) => d.precipitationProb || 50));
    return {
      willRain: true,
      message: tWeather
        ? tWeather('rainExpectedOn', { days: `${daysStr} (${maxChance}%)` })
        : `Rain expected on ${daysStr} (${maxChance}% chance) 🌧️`,
    };
  }, [fiveDaysWeather, tWeather]);

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

  // Load real active 5-hour reels (only you & followed friends, strictly no fake posts)
  useEffect(() => {
    const realData = fetchRealReels(friendsList, posts, user);
    setReels(realData);
  }, [friendsList, posts, user]);

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

  // Right Sidebar: Spotlight & Trending State
  // (Fake sponsored ads removed per user request)

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
        if (currentId) {
          seenIds.add(currentId);
          seenIds.add(String(currentId));
        }
        if (currentUsername) seenUsernames.add(currentUsername);

        if (Array.isArray(convs) && convs.length > 0) {
          for (const c of convs) {
            const u = c.otherUser;
            if (!u || !u.id || isFriendDeleted(u)) continue;
            // Only mutual friends with an ACCEPTED friendship
            if (c.status !== 'ACCEPTED') continue;
            const uIdStr = String(u.id);
            const uLower = (u.username || '').trim().toLowerCase();
            if (
              (currentId && (String(currentId) === uIdStr || currentId === u.id)) ||
              (currentUsername && uLower === currentUsername) ||
              seenIds.has(u.id) ||
              seenIds.has(uIdStr) ||
              (uLower && seenUsernames.has(uLower))
            ) continue;
            seenIds.add(u.id);
            seenIds.add(uIdStr);
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

  // Load Posts and Live Breaking News for blended feed
  const fetchLiveNewsData = async () => {
    try {
      setNewsLoading(true);
      const data = await getLiveNews('all', 'ALL');
      if (Array.isArray(data) && data.length > 0) {
        setLiveNews(data);
      }
    } catch (err) {
      console.warn('Error fetching live news for feed:', err);
    } finally {
      setNewsLoading(false);
    }
  };

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
    fetchLiveNewsData();
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
      // If comments were not loaded yet, fetch them first so the full thread is visible
      let currentList = commentsState[postId]?.list;
      if (!commentsState[postId]?.open && currentList === undefined) {
        try {
          const fetched = await getPostComments(postId);
          currentList = Array.isArray(fetched) ? fetched : [];
        } catch {
          currentList = [];
        }
      } else {
        currentList = currentList || [];
      }

      const newComment = await addComment(postId, {
        content: text,
        parentCommentId: replyContext?.commentId || null,
        replyToUsername: replyContext?.username || null,
      });

      setCommentsState((prev) => ({
        ...prev,
        [postId]: {
          open: true,
          loading: false,
          list: [...(currentList || []), newComment],
        },
      }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p))
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

  const currentUserId = user?.userId || user?.id;

  const myPosts = useMemo(() => {
    if (!currentUserId) return [];
    return posts.filter((p) => String(p.userId) === String(currentUserId));
  }, [posts, currentUserId]);

  const myPhotosCount = useMemo(() => {
    return myPosts.filter((p) => p.mediaType === 'image').length;
  }, [myPosts]);

  const getPostTimestamp = (post) => {
    if (!post) return 0;
    if (post.createdAt) {
      const t = new Date(post.createdAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    return Date.now() - 3600000;
  };

  const getNewsTimestamp = (article, idx) => {
    if (!article) return 0;
    if (article.pubDate) {
      const t = new Date(article.pubDate).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (article.timeAgo) {
      const matchMin = article.timeAgo.match(/(\d+)\s*m/);
      if (matchMin) return Date.now() - parseInt(matchMin[1], 10) * 60 * 1000;
      const matchHour = article.timeAgo.match(/(\d+)\s*h/);
      if (matchHour) return Date.now() - parseInt(matchHour[1], 10) * 3600 * 1000;
      const matchDay = article.timeAgo.match(/(\d+)\s*d/);
      if (matchDay) return Date.now() - parseInt(matchDay[1], 10) * 86400 * 1000;
      if (article.timeAgo.toLowerCase().includes('just now')) return Date.now() - 60 * 1000;
    }
    return Date.now() - (idx + 1) * 14 * 60 * 1000;
  };

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    if (filter === 'wall') {
      return myPosts;
    }
    if (filter === 'video') {
      return posts.filter((p) => p.mediaType === 'video' || p.mediaType === 'polo');
    }
    if (filter === 'image') {
      return posts.filter((p) => p.mediaType === 'image');
    }
    return posts;
  }, [posts, filter, myPosts]);

  // Facebook-Style Blended Chronological Feed Timeline (Posts + Live Breaking News)
  const feedTimeline = useMemo(() => {
    if (filter === 'wall') {
      return myPosts.map((p) => ({
        type: 'post',
        post: p,
        timestamp: getPostTimestamp(p),
        id: `post-${p.id}`,
      }));
    }
    if (filter === 'video') {
      return posts
        .filter((p) => p.mediaType === 'video' || p.mediaType === 'polo')
        .map((p) => ({
          type: 'post',
          post: p,
          timestamp: getPostTimestamp(p),
          id: `post-${p.id}`,
        }));
    }
    if (filter === 'image') {
      return posts
        .filter((p) => p.mediaType === 'image')
        .map((p) => ({
          type: 'post',
          post: p,
          timestamp: getPostTimestamp(p),
          id: `post-${p.id}`,
        }));
    }
    // 'all' and 'general': blend community posts and live breaking news chronologically!
    const postItems = posts.map((p) => ({
      type: 'post',
      post: p,
      timestamp: getPostTimestamp(p),
      id: `post-${p.id}`,
    }));
    const newsItems = (liveNews || []).slice(0, 16).map((n, idx) => ({
      type: 'news',
      article: n,
      timestamp: getNewsTimestamp(n, idx),
      id: `news-${n.id || idx}`,
    }));

    return [...postItems, ...newsItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [posts, liveNews, filter, myPosts]);

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

          {/* 5-Day Weather & Rain Forecast (At the bottom of shortcuts) */}
          {weather && fiveDaysWeather.length > 0 && (
            <div className="shortcuts-weather-section">
              <div className="shortcuts-weather-divider" />
              <div
                className="shortcuts-weather-header"
                onClick={openWeatherModal}
                role="button"
                tabIndex={0}
                title="Click for full 7-day forecast & city search"
              >
                <div className="shortcuts-weather-title-group">
                  <span className="shortcuts-weather-label">
                    <i className="fa-solid fa-cloud-sun"></i> {tWeather ? tWeather('fiveDayWeather') : '5-Day Weather'}
                  </span>
                  <span className="shortcuts-weather-city">
                    <i className="fa-solid fa-location-dot"></i> {weather.cityName}
                  </span>
                </div>
                <div className="shortcuts-weather-temp-badge">
                  <i className={weather.conditionIcon} style={{ color: weather.conditionColor }} />
                  <span>{formatTemp(weather.temperature)}</span>
                </div>
              </div>

              {/* Rain Prediction Summary */}
              {rainForecastSummary && (
                <div className={`shortcuts-rain-alert ${rainForecastSummary.willRain ? 'has-rain' : 'no-rain'}`}>
                  <i className={`fa-solid ${rainForecastSummary.willRain ? 'fa-cloud-showers-heavy' : 'fa-sun'}`} />
                  <span>{rainForecastSummary.message}</span>
                </div>
              )}

              {/* 5 Days Weather & Rain Forecast Rows */}
              <div className="shortcuts-weather-5days-list">
                {fiveDaysWeather.map((day) => {
                  const willRain =
                    day.precipitationProb >= 35 ||
                    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(day.weatherCode);

                  return (
                    <div
                      key={day.date}
                      className={`shortcuts-weather-row ${day.dayName === 'Today' ? 'is-today' : ''}`}
                      onClick={openWeatherModal}
                      title={`${day.dayName}: ${day.label}, High: ${formatTemp(day.maxTemp)}, Low: ${formatTemp(day.minTemp)}, Rain: ${day.precipitationProb}%`}
                    >
                      <div className="sc-day-name-col">
                        <strong className="sc-day-name">{day.dayName}</strong>
                        <span className="sc-day-label">{day.label}</span>
                      </div>

                      <div className="sc-day-icon-col">
                        <i className={day.icon} style={{ color: day.color }} />
                      </div>

                      <div className="sc-day-rain-col">
                        {willRain ? (
                          <span className="sc-rain-pill will-rain" title={`${day.precipitationProb}% rain chance`}>
                            <i className="fa-solid fa-droplet"></i> {day.precipitationProb}%
                          </span>
                        ) : (
                          <span className="sc-rain-pill no-rain" title="0% rain">
                            <i className="fa-solid fa-sun"></i> 0%
                          </span>
                        )}
                      </div>

                      <div className="sc-day-temp-col">
                        <span className="sc-temp-max">{formatTemp(day.maxTemp)}</span>
                        <span className="sc-temp-min">{formatTemp(day.minTemp)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="shortcuts-weather-see-all-btn"
                onClick={openWeatherModal}
              >
                <span>{tWeather ? tWeather('fullForecast') : 'Full Forecast & City Search'}</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* =========================================================================
          CENTER COLUMN: Main Community Feed
          ========================================================================= */}
      <main className="community-feed-center">
        {/* Top Homepage Live Score Bar (Reduced Height, Always Visible, Pops Up Screen) */}
        <div
          className="homepage-top-livescore-bar clickable"
          onClick={() => setShowLiveScoresModal(true)}
          title="Click to pop up all live football matches on screen"
        >
          <div className="hp-live-bar-left">
            <i className="fa-solid fa-futbol" />
            <span className="hp-live-bar-title">Live Scores</span>
            <span className="hp-live-bar-tag">
              <span className="status-live-dot" />
              ESPN Live Center
            </span>
          </div>
          <div className="hp-live-bar-right">
            <span>Tap to open live matches</span>
            <i className="fa-solid fa-arrow-up-right-from-square" />
          </div>
        </div>

        {/* Instagram & Facebook Stories & Reels Tray (5 Hours Only) */}
        <StoriesReelsTray
          user={user}
          reels={reels}
          watchedReelIds={watchedReelIds}
          onOpenCreate={() => setIsCreateReelOpen(true)}
          onSelectReel={(idx) => setActiveReelIndex(idx)}
        />

        {/* Welcome Greeting: Appears ONCE on login, auto-hides in 30s, and NEVER appears again */}
        {showWelcomeBanner && (
          <div className="home-welcome-widget animate-fade-in">
            <div className="home-welcome-top-row">
              <div className="home-welcome-left">
                <div className="home-welcome-avatar-wrap">
                  <img
                    src={resolveAvatarUrl(user?.avatarUrl, user?.displayName || user?.username)}
                    alt={user?.username}
                    className="home-welcome-avatar"
                    onError={(e) => handleAvatarError(e, user?.displayName || user?.username)}
                  />
                  <span className="welcome-avatar-pulse"></span>
                </div>
                <div className="home-welcome-text">
                  <h2 className="home-welcome-title">
                    Welcome, <span className="welcome-user-name">{user?.displayName || user?.username || 'Friend'}</span>! 👋
                  </h2>
                  <p className="home-welcome-desc">
                    Connect with friends, share your photos &amp; messages, and catch real-time news.
                  </p>
                </div>
              </div>

              <div className="home-welcome-top-actions">
                <span className="welcome-countdown-chip" title="Closes in 30 seconds">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  <span>Hiding in {welcomeSecondsLeft}s</span>
                </span>
                <button
                  type="button"
                  className="welcome-close-btn"
                  onClick={handleDismissWelcome}
                  title="Close welcome message"
                  aria-label="Close"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            <div className="welcome-progress-track">
              <div
                className="welcome-progress-fill"
                style={{ width: `${(welcomeSecondsLeft / 30) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Global Community & Friends Quick Interactive Trigger Bar */}
        <div
          className="community-global-trigger-bar clickable"
          onClick={() => window.dispatchEvent(new CustomEvent('open-global-community-modal'))}
          title="Click to open Global Community & Friends popup"
        >
          <div className="cgt-left">
            <span className="cgt-sparkle">✨</span>
            <div className="cgt-text-col">
              <div className="cgt-title-row">
                <span className="cgt-title">Global Community &amp; Friends</span>
                <span className="cgt-badge">Worldwide</span>
              </div>
              <p className="cgt-desc">
                Select friends to chat &amp; call, or share your invite link via WhatsApp &amp; Telegram
              </p>
            </div>
          </div>
          <div className="cgt-right">
            <button
              type="button"
              className="cgt-btn"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('open-global-community-modal'));
              }}
            >
              <i className="fa-solid fa-share-nodes" />
              <span>Select or Share</span>
            </button>
          </div>
        </div>

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
              placeholder={
                filter === 'wall'
                  ? `Write something on your wall, ${user?.displayName || user?.username || 'friend'}... (Photos & posts also appear on General Feed)`
                  : `What's on your mind, ${user?.displayName || user?.username || 'friend'}?`
              }
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

      {/* Mobile-Only 5-Day Weather & Rain Prediction Capsule (Shown on mobile when left sidebar is hidden) */}
      {weather && fiveDaysWeather.length > 0 && (
        <div className="mobile-feed-weather-card">
          <div className="mobile-feed-weather-top" onClick={openWeatherModal} role="button" tabIndex={0}>
            <div className="mobile-weather-left">
              <span className="mobile-weather-city">
                <i className="fa-solid fa-location-dot"></i> {weather.cityName}
              </span>
              <span className="mobile-weather-type">{weather.conditionText}</span>
            </div>
            <div className="mobile-weather-right">
              <i className={weather.conditionIcon} style={{ color: weather.conditionColor }} />
              <span className="mobile-weather-temp">{formatTemp(weather.temperature)}</span>
            </div>
          </div>

          {rainForecastSummary && (
            <div className={`shortcuts-rain-alert ${rainForecastSummary.willRain ? 'has-rain' : 'no-rain'}`}>
              <i className={`fa-solid ${rainForecastSummary.willRain ? 'fa-cloud-showers-heavy' : 'fa-sun'}`} />
              <span>{rainForecastSummary.message}</span>
            </div>
          )}

          {/* Horizontal swipeable 5-day forecast cards for mobile */}
          <div className="mobile-5days-scroll">
            {fiveDaysWeather.map((day) => {
              const willRain =
                day.precipitationProb >= 35 ||
                [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(day.weatherCode);

              return (
                <div
                  key={day.date}
                  className={`mobile-day-card ${day.dayName === 'Today' ? 'is-today' : ''}`}
                  onClick={openWeatherModal}
                >
                  <span className="mobile-day-name">{day.dayName}</span>
                  <i className={`${day.icon} mobile-day-icon`} style={{ color: day.color }} />
                  <span className="mobile-day-type">{day.label}</span>
                  {willRain ? (
                    <span className="mobile-rain-badge will-rain">
                      <i className="fa-solid fa-droplet"></i> {day.precipitationProb}%
                    </span>
                  ) : (
                    <span className="mobile-rain-badge no-rain">
                      <i className="fa-solid fa-sun"></i> 0%
                    </span>
                  )}
                  <div className="mobile-day-temps">
                    <span className="temp-max">{formatTemp(day.maxTemp)}</span>
                    <span className="temp-min">{formatTemp(day.minTemp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Feed Navigation / Filter Tabs */}
      <div className="community-filter-tabs">
        <button
          type="button"
          className={`filter-tab my-wall-tab-btn ${filter === 'wall' ? 'active' : ''}`}
          onClick={() => setFilter('wall')}
          title="My Personal Wall - Share photos & messages on your timeline"
        >
          <i className="fa-solid fa-address-card"></i>
          <span>My Wall ({myPosts.length})</span>
        </button>

        <button
          type="button"
          className={`filter-tab ${filter === 'general' ? 'active' : ''} general-feedback-tab`}
          onClick={() => setFilter('general')}
          title="General Feedback - Facebook-style feed where posts and live news flow chronologically"
        >
          <i className="fa-solid fa-comments"></i>
          <span>General Feedback</span>
        </button>

        <button
          type="button"
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <i className="fa-solid fa-globe"></i>
          <span>All Feed ({posts.length})</span>
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
          className="filter-tab live-scores-tab-btn"
          onClick={() => setShowLiveScoresModal(true)}
          title="Pop up live scores on screen"
        >
          <span className="mobile-live-red-dot" />
          <span>⚽ Live Scores</span>
          <span className="live-pill-count">LIVE</span>
        </button>

        <button
          type="button"
          className={`filter-tab mobile-live-filter-btn ${showMobileLiveHub ? 'active' : ''}`}
          onClick={() => setShowLiveScoresModal(true)}
          title="Pop up Live Football Scores on screen"
        >
          <span className="mobile-live-red-dot" />
          <span>⚽ Live Scores</span>
        </button>

        <button
          type="button"
          className="filter-refresh-btn"
          onClick={fetchPosts}
          title="Refresh Feed"
        >
          <i className={`fa-solid fa-rotate-right ${loading || newsLoading ? 'fa-spin' : ''}`}></i>
        </button>
      </div>

      {/* 4. Feed Stream */}
      <section className="community-posts-stream">
        {filter === 'wall' && (
          <div className="my-wall-profile-header">
            <div className="my-wall-cover">
              <div className="my-wall-cover-badge">
                <i className="fa-solid fa-id-badge"></i>
                <span>My Personal Wall &amp; Timeline</span>
              </div>
            </div>
            <div className="my-wall-profile-bar">
              <div className="my-wall-avatar-container">
                <img
                  src={resolveAvatarUrl(user?.avatarUrl, user?.displayName || user?.username)}
                  alt={user?.username}
                  className="my-wall-avatar"
                  onError={(e) => handleAvatarError(e, user?.displayName || user?.username)}
                />
                <span className="my-wall-status-badge online" />
              </div>
              <div className="my-wall-info">
                <div className="my-wall-name-row">
                  <h2 className="my-wall-display-name">{user?.displayName || user?.username}</h2>
                  {user?.displayName && user?.displayName !== user?.username && (
                    <span className="my-wall-handle">@{user?.username}</span>
                  )}
                  <span className="my-wall-lang-badge">
                    {(user?.preferredLanguage || currentLang || 'EN').toUpperCase()}
                  </span>
                </div>
                <p className="my-wall-bio">
                  Sharing my photos, moments &amp; updates on Giochat 🌍
                </p>
                <div className="my-wall-stats-row">
                  <span className="my-wall-stat-item">
                    <strong>{myPosts.length}</strong> Posts
                  </span>
                  <span className="my-wall-stat-dot">•</span>
                  <span className="my-wall-stat-item">
                    <strong>{myPhotosCount}</strong> Photos
                  </span>
                  <span className="my-wall-stat-dot">•</span>
                  <span className="my-wall-stat-item">
                    <strong>{friendsList.length}</strong> Friends
                  </span>
                </div>
              </div>
            </div>
            <div className="my-wall-notice-banner">
              <i className="fa-solid fa-bullhorn"></i>
              <span>
                <strong>Wall to Feed Sync:</strong> Everything you post on your wall is automatically visible on <strong>General Feedback</strong> for all your friends to see!
              </span>
            </div>
          </div>
        )}

        {filter === 'general' && (
          <div className="general-feedback-header">
            <div className="general-feedback-badge">
              <i className="fa-solid fa-comments"></i>
              <span>General Feedback Timeline</span>
            </div>
            <p className="general-feedback-subtitle">
              Facebook-style live feed: Your wall photos &amp; posts appear here. Newer posts and live breaking news appear on top, while older posts flow down.
            </p>
          </div>
        )}
        {filter === 'news' ? (
          <HomeNewsFeed user={user} />
        ) : (
          <>
            {loading && posts.length === 0 ? (
              <div className="community-loading-state">
                <i className="fa-solid fa-circle-notch fa-spin"></i>
                <p>Loading global community posts...</p>
              </div>
            ) : filter === 'wall' && myPosts.length === 0 ? (
              <div className="my-wall-empty-state">
                <div className="empty-wall-icon-wrap">
                  <i className="fa-solid fa-camera-retro"></i>
                </div>
                <p>You haven't posted any photos or messages yet. Write a post or upload a photo above to share on your wall and General Feedback.</p>
              </div>
            ) : (
              feedTimeline.map((item) => {
                if (item.type === 'news') {
                  const article = item.article;
                  return (
                    <article key={item.id} className="post-card home-inline-news-card">
                      <header className="post-card-header news-card-header">
                        <div className="post-author-info">
                          <div className="news-source-logo-wrap">
                            <span className="news-source-flag">{article.sourceLogo || '📰'}</span>
                          </div>
                          <div className="author-meta">
                            <div className="author-name-row">
                              <span className="author-display-name">{article.source}</span>
                              {article.verified && <i className="fa-solid fa-circle-check news-verified-badge" title="Verified source" />}
                              {article.category && (
                                <span className="post-lang-badge news-badge-cat">{article.category}</span>
                              )}
                            </div>
                            <div className="author-meta-subrow">
                              <span className="post-time">{article.timeAgo || 'Recent'}</span>
                              <span className="post-privacy-dot">•</span>
                              <span className="news-breaking-tag">⚡ Live Breaking News</span>
                            </div>
                          </div>
                        </div>
                        {article.url && (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="news-outlet-link-btn"
                            title={`Open full story on ${article.source}`}
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square"></i>
                          </a>
                        )}
                      </header>

                      <div className="post-card-content news-card-body">
                        <h3 className="inline-news-title">
                          <a href={article.url} target="_blank" rel="noopener noreferrer">
                            {article.title}
                          </a>
                        </h3>
                        {article.summary && (
                          <p className="inline-news-summary">{article.summary}</p>
                        )}
                        {article.imageUrl && (
                          <div className="inline-news-image-wrap">
                            <img
                              src={article.imageUrl}
                              alt={article.title}
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                        )}
                      </div>

                      <footer className="post-card-footer news-card-footer">
                        {article.url && (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="post-action-btn news-read-action-btn"
                          >
                            <i className="fa-solid fa-newspaper"></i>
                            <span>Read on {article.source}</span>
                          </a>
                        )}
                        <button
                          type="button"
                          className="post-action-btn news-share-to-wall-btn"
                          onClick={() => {
                            setPostText(`📰 Breaking from ${article.source}:\n"${article.title}"\n${article.url}`);
                            window.scrollTo({ top: 350, behavior: 'smooth' });
                          }}
                          title="Share this news story to your wall and general feed"
                        >
                          <i className="fa-solid fa-share-nodes"></i>
                          <span>Share to My Wall / Feed</span>
                        </button>
                      </footer>
                    </article>
                  );
                }

                const post = item.post;
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
                      <div className="author-meta-subrow">
                        <span className="post-time">{formatTimeAgo(post.createdAt)}</span>
                        <span className="post-privacy-dot">•</span>
                        <i className="fa-solid fa-earth-americas post-privacy-icon" title="Public post" />
                      </div>
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
                          <span>Translate to {targetLangName}</span>
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

                {/* Facebook Reaction & Comment Counters Row */}
                {(post.likeCount > 0 || post.commentsCount > 0) && (
                  <div className="post-metrics-row">
                    <div className="metrics-likes">
                      {post.likeCount > 0 && (
                        <span className="metrics-badge" title={`${post.likeCount} Likes`}>
                          <span className="fb-like-circle">
                            <i className="fa-solid fa-thumbs-up" />
                          </span>
                          <span className="metrics-count">{post.likeCount}</span>
                        </span>
                      )}
                    </div>
                    <div className="metrics-comments-shares">
                      {post.commentsCount > 0 && (
                        <button
                          type="button"
                          className="metrics-text-btn"
                          onClick={() => handleToggleComments(post.id)}
                        >
                          {post.commentsCount} {post.commentsCount === 1 ? 'comment' : 'comments'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Facebook Post Interactive Action Footer Bar */}
                <footer className="post-card-footer fb-style-footer">
                  {/* Like Button */}
                  <button
                    type="button"
                    className={`post-action-btn like-action fb-like-btn ${post.likedByMe ? 'liked' : ''}`}
                    onClick={() => handleToggleLike(post.id)}
                    title={post.likedByMe ? 'Unlike' : 'Like'}
                  >
                    <i className={`fa-${post.likedByMe ? 'solid' : 'regular'} fa-thumbs-up fb-action-icon`}></i>
                    <span className="action-label">Like</span>
                  </button>

                  {/* Comment Button */}
                  <button
                    type="button"
                    className={`post-action-btn comment-action fb-comment-btn ${commentsInfo.open ? 'active' : ''}`}
                    onClick={() => handleToggleComments(post.id)}
                    title="View & Add Comments"
                  >
                    <i className="fa-regular fa-message fb-action-icon"></i>
                    <span className="action-label">Comment</span>
                  </button>

                  {/* Share Post */}
                  <button
                    type="button"
                    className="post-action-btn share-action fb-share-btn"
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
                    <i className="fa-solid fa-share fb-action-icon"></i>
                    <span className="action-label">Share</span>
                  </button>

                  {/* Join / Connect Chat Button */}
                  <button
                    type="button"
                    className="post-action-btn connect-action fb-connect-btn"
                    onClick={() => handleStartChatWithUser({ id: post.userId, username: post.username, displayName: post.displayName, avatarUrl: post.avatarUrl })}
                    title={`Chat with ${post.displayName || post.username}`}
                  >
                    <i className="fa-solid fa-paper-plane fb-action-icon"></i>
                    <span className="action-label">Chat</span>
                  </button>
                </footer>

                {/* Comments Section (Toggled Open / Hide when clicking Comment button) */}
                {commentsInfo.open && (
                  <div className="x-comments-section">
                    <div className="x-comments-divider"></div>

                    {/* Active Reply Banner if replying to a specific user */}
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

                    {/* Active Comment Input to make comments */}
                    <form
                      className="quick-comment-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddComment(post.id);
                      }}
                    >
                      <div className="quick-comment-avatar">
                        {user?.avatarUrl ? (
                          <img src={resolveBackendUrl(user.avatarUrl)} alt={user.username} />
                        ) : (
                          <div className="quick-comment-avatar-fallback">
                            {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="quick-comment-input-wrap">
                        <input
                          type="text"
                          ref={(el) => {
                            commentInputRefs.current[post.id] = el;
                          }}
                          className="quick-comment-input"
                          placeholder={
                            replyingTo[post.id]
                              ? `Reply to @${replyingTo[post.id].username}...`
                              : "Write a comment..."
                          }
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          autoFocus
                        />
                      </div>

                      <button
                        type="submit"
                        className="quick-comment-submit-btn"
                        disabled={!commentInputs[post.id]?.trim()}
                        title={replyingTo[post.id] ? 'Reply' : 'Post comment'}
                      >
                        <i className="fa-solid fa-paper-plane"></i>
                      </button>
                    </form>

                    {/* Written Comments List (hidden if no comments have been written yet) */}
                    {commentsInfo.loading ? (
                      <div className="x-comments-loading">
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                        <span>Loading comments...</span>
                      </div>
                    ) : (
                      commentsInfo.list && commentsInfo.list.length > 0 && (
                        <div className="x-comments-list">
                          {commentsInfo.list.map((c, idx) => {
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

                                  {/* Replying to handle indicator */}
                                  {c.replyToUsername && (
                                    <div className="x-replying-indicator">
                                      <span>Replying to</span>
                                      <span className="x-reply-target">@{c.replyToUsername}</span>
                                    </div>
                                  )}

                                  <p className="x-comment-text">{c.content}</p>

                                  {/* Action Row */}
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
                          })}
                        </div>
                      )
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}

        {/* Live Spain & World Breaking News Feed directly under posts or filling the feed when not on My Wall */}
        {filter !== 'wall' && (
          <HomeNewsFeed user={user} hasCommunityPosts={feedTimeline.length > 0} />
        )}
      </>
    )}
  </section>
  </main>

      {/* =========================================================================
          RIGHT SIDEBAR: AI Spotlight & Trending
          ========================================================================= */}
      <aside className="community-sidebar-right">
        {/* Scrolling AI Spotlight Ticker (.sidebar-card) */}
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

      {/* 📸 Create 5h Reel Modal */}
      <CreateReelModal
        isOpen={isCreateReelOpen}
        user={user}
        onClose={() => setIsCreateReelOpen(false)}
        onReelCreated={(newReel) => {
          saveNewReel(newReel);
          fetchPosts();
          const refreshed = fetchRealReels(friendsList, posts, user);
          setReels(refreshed);
        }}
      />

      {/* ✨ Fullscreen Instagram Reels Viewer */}
      {activeReelIndex !== null && (
        <InstagramReelsViewer
          isOpen={activeReelIndex !== null}
          reels={reels}
          initialReelIndex={activeReelIndex}
          onClose={() => setActiveReelIndex(null)}
          onToggleLike={(reelId) => {
            const updated = toggleLikeReel(reelId);
            setReels(updated);
          }}
          onReelWatched={(reelId) => {
            setWatchedReelIds((prev) => (prev.includes(reelId) ? prev : [...prev, reelId]));
          }}
        />
      )}

      {/* ⚽ Fullscreen Live Scores Popup Screen */}
      {showLiveScoresModal && (
        <LiveScoresModal
          isOpen={showLiveScoresModal}
          onClose={() => setShowLiveScoresModal(false)}
          initialFilter="all"
        />
      )}


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
