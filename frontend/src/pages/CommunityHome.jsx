import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosts, createPost, toggleLikePost, getPostComments, addComment, toggleLikeComment, deletePost } from '../api/postApi';
import { startConversation, quickTranslate } from '../api/conversationApi';
import { uploadMedia } from '../api/mediaApi';
import { resolveBackendUrl } from '../utils/apiBaseUrl';
import { useLanguage } from '../contexts/LanguageContext';
import PoloCameraModal from '../components/PoloCameraModal';
import MediaLightbox from '../components/MediaLightbox';
import '../styles/community.css';

export default function CommunityHome({ user }) {
  const navigate = useNavigate();
  const { language: currentLang, languageOptions, t } = useLanguage();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'video' | 'image' | 'text'

  // New Post Form State
  const [postText, setPostText] = useState('');
  const [postLanguage, setPostLanguage] = useState(user?.preferredLanguage || currentLang || 'en');
  const [attachedMedia, setAttachedMedia] = useState(null); // { url, type, name, previewUrl }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPoloOpen, setIsPoloOpen] = useState(false);

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

  // Handle Polo Modal Media
  const handlePoloRecorded = (payloadStr) => {
    try {
      const data = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;
      if (data && data.mediaUrl) {
        setAttachedMedia({
          url: data.mediaUrl,
          type: data.type || 'video',
          name: data.fileName || 'Polo Video Note',
          previewUrl: resolveBackendUrl(data.mediaUrl),
          transcript: data.transcript || '',
        });
        if (data.transcript && !postText) {
          setPostText(data.transcript);
        }
      }
    } catch (err) {
      console.error('Error parsing polo payload:', err);
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

  // Share App / Post Invite
  const shareLink = `${window.location.origin}/register?ref=${user?.username || ''}`;
  const inviteMessage = `Hey! Join me on Tranchat - the real-time AI translation and walkie-talkie community app: ${shareLink}`;

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join me on Tranchat!',
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

  return (
    <div className="community-page-container">
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
            Share moments, voice & Marco Polo video walkie-talkies, and break language barriers instantly with AI live translation.
          </p>
        </div>

        {/* Invite Friends Action Capsule */}
        <div className="community-invite-box">
          <div className="invite-box-header">
            <i className="fa-solid fa-user-plus invite-icon"></i>
            <span><strong>Invite your friends to join Tranchat:</strong></span>
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
              href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('Join me on Tranchat!')}`}
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
              placeholder={`What's happening, ${user?.displayName || user?.username || 'friend'}? Share a thought, photo, or Marco Polo video...`}
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

            {(attachedMedia.type === 'video' || attachedMedia.type === 'polo') && (
              <div className="preview-video-wrap">
                <video src={attachedMedia.previewUrl} controls playsInline />
                <div className="video-badge-tag">
                  <i className="fa-solid fa-video"></i> Polo Video Note
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

            {/* 2. Record Marco Polo Video Walkie-Talkie */}
            <button
              type="button"
              className="tool-btn polo-tool-btn"
              onClick={() => setIsPoloOpen(true)}
              title="Record Marco Polo Video Note"
              disabled={isSubmitting}
            >
              <i className="fa-solid fa-video tool-icon-polo"></i>
              <span className="tool-label">Polo Video</span>
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
          <span>Polo Videos</span>
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
          className="filter-refresh-btn"
          onClick={fetchPosts}
          title="Refresh Feed"
        >
          <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
        </button>
      </div>

      {/* 4. Feed Stream */}
      <section className="community-posts-stream">
        {loading && posts.length === 0 ? (
          <div className="community-loading-state">
            <i className="fa-solid fa-circle-notch fa-spin"></i>
            <p>Loading global community posts...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="community-empty-state">
            <div className="empty-icon">🌟</div>
            <h3>No posts in this feed yet</h3>
            <p>Be the first to share a moment or video note with the community!</p>
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
                        <span className="author-display-name">{post.displayName || post.username}</span>
                        <span className="author-handle">@{post.username}</span>
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
                        <strong>{translation.targetLang.toUpperCase()}</strong> via Tranchat AI
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
                          <i className="fa-solid fa-walkie-talkie"></i> Marco Polo Note
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
                          title: `Post by @${post.username} on Tranchat`,
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
                                  <span className="x-author-name">{c.displayName || c.username}</span>
                                  <span className="x-author-handle">@{c.username}</span>
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
      </section>

      {/* Lightbox for full image viewing */}
      {lightboxMedia && (
        <MediaLightbox
          src={lightboxMedia}
          type="image"
          onClose={() => setLightboxMedia(null)}
        />
      )}

      {/* Marco Polo Camera & Walkie-Talkie Recorder Modal */}
      <PoloCameraModal
        isOpen={isPoloOpen}
        onClose={() => setIsPoloOpen(false)}
        onSend={handlePoloRecorded}
        friendName="Community Post"
      />
    </div>
  );
}
