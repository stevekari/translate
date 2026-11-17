import { useState, useEffect, useRef } from 'react';
import { getLiveNews, FALLBACK_NEWS } from '../api/newsApi';
import { quickTranslate } from '../api/conversationApi';
import { useLanguage } from '../contexts/LanguageContext';

const NEWS_CATEGORIES = [
  { id: 'all', label: 'All ⚡' },
  { id: 'Spain', label: 'Spain 🇪🇸' },
  { id: 'World', label: 'World 🌍' },
  { id: 'Football', label: 'Football ⚽' },
  { id: 'Tech', label: 'Tech 🚀' },
];

const GLOBAL_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ak', name: 'Twi', flag: '🇬🇭' },
];

export default function HomeNewsFeed({ user }) {
  const { language: currentAppLang } = useLanguage();
  const defaultTarget = user?.preferredLanguage || currentAppLang || 'en';

  const [activeCategory, setActiveCategory] = useState('all');
  const [targetLang, setTargetLang] = useState(defaultTarget);
  const [autoTranslate, setAutoTranslate] = useState(() => {
    return localStorage.getItem('gio_news_auto_translate') === 'true';
  });

  const [newsList, setNewsList] = useState(FALLBACK_NEWS);
  const [loading, setLoading] = useState(false);

  // Translations Map: { [articleId]: { title, summary, sourceLang, targetLang, isShowing } }
  const [translations, setTranslations] = useState({});
  const [translatingIds, setTranslatingIds] = useState({});

  const [likesState, setLikesState] = useState(() => {
    try {
      const saved = localStorage.getItem('gio_news_likes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [commentsState, setCommentsState] = useState(() => {
    try {
      const saved = localStorage.getItem('gio_news_comments');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [commentInputs, setCommentInputs] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Fetch news when category changes
  useEffect(() => {
    let isMounted = true;
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const data = await getLiveNews(activeCategory);
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setNewsList(data);
        }
      } catch (err) {
        console.warn('Error fetching homepage live news:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchArticles();

    return () => {
      isMounted = false;
    };
  }, [activeCategory]);

  // Translate a single article (Headline + Summary)
  const handleTranslateArticle = async (article, forceTarget = targetLang) => {
    const articleId = article.id;
    const existing = translations[articleId];

    // Toggle if already translated into the same target language
    if (existing && existing.targetLang === forceTarget) {
      setTranslations((prev) => ({
        ...prev,
        [articleId]: { ...existing, isShowing: !existing.isShowing },
      }));
      return;
    }

    setTranslatingIds((prev) => ({ ...prev, [articleId]: true }));
    try {
      const separator = ' ||| ';
      const payload = `${article.title}${separator}${article.summary}`;
      const res = await quickTranslate(payload, forceTarget);

      if (res && res.translatedText) {
        const parts = res.translatedText.split(separator);
        const translatedTitle = parts[0]?.trim() || article.title;
        const translatedSummary = parts.slice(1).join(separator)?.trim() || res.translatedText;

        setTranslations((prev) => ({
          ...prev,
          [articleId]: {
            title: translatedTitle,
            summary: translatedSummary,
            sourceLang: res.sourceLanguage || 'auto',
            targetLang: res.targetLanguage || forceTarget,
            isShowing: true,
          },
        }));
      }
    } catch (err) {
      console.error('Error translating news article:', err);
      alert('Could not translate this news story at the moment.');
    } finally {
      setTranslatingIds((prev) => ({ ...prev, [articleId]: false }));
    }
  };

  // Auto-translate batch effect when autoTranslate is on or targetLang changes
  useEffect(() => {
    if (!autoTranslate || !newsList || newsList.length === 0) return;

    let isMounted = true;
    const batchTranslate = async () => {
      for (const article of newsList.slice(0, 6)) {
        if (!isMounted) break;
        const existing = translations[article.id];
        if (!existing || existing.targetLang !== targetLang) {
          await handleTranslateArticle(article, targetLang);
        }
      }
    };

    batchTranslate();

    return () => {
      isMounted = false;
    };
  }, [autoTranslate, targetLang, newsList]);

  // Handle Target Language Change
  const handleChangeTargetLang = (newLang) => {
    setTargetLang(newLang);
    // If autoTranslate is on, reset existing translations to re-translate to new language
    if (autoTranslate) {
      setTranslations({});
    }
  };

  // Toggle Auto-Translate Switch
  const handleToggleAutoTranslate = () => {
    setAutoTranslate((prev) => {
      const next = !prev;
      localStorage.setItem('gio_news_auto_translate', String(next));
      if (!next) {
        // revert showing state
        setTranslations((curr) => {
          const reverted = {};
          Object.keys(curr).forEach((k) => {
            reverted[k] = { ...curr[k], isShowing: false };
          });
          return reverted;
        });
      }
      return next;
    });
  };

  // Handle Like Toggle
  const handleToggleLike = (articleId, baseLikes = 120) => {
    setLikesState((prev) => {
      const current = prev[articleId] || { liked: false, count: baseLikes };
      const nextLiked = !current.liked;
      const nextCount = nextLiked ? current.count + 1 : Math.max(0, current.count - 1);
      const updated = {
        ...prev,
        [articleId]: { liked: nextLiked, count: nextCount },
      };
      try {
        localStorage.setItem('gio_news_likes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Handle Toggle Comment Drawer
  const handleToggleComments = (articleId) => {
    setOpenComments((prev) => ({
      ...prev,
      [articleId]: !prev[articleId],
    }));
  };

  // Handle Add Comment
  const handleAddComment = (e, articleId) => {
    e.preventDefault();
    const text = commentInputs[articleId]?.trim();
    if (!text) return;

    const newComment = {
      id: `comment-${Date.now()}`,
      username: user?.username || 'you',
      displayName: user?.displayName || user?.username || 'You',
      avatarUrl: user?.avatarUrl || null,
      text,
      createdAt: 'Just now',
    };

    setCommentsState((prev) => {
      const existing = prev[articleId] || [];
      const updated = {
        ...prev,
        [articleId]: [newComment, ...existing],
      };
      try {
        localStorage.setItem('gio_news_comments', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setCommentInputs((prev) => ({ ...prev, [articleId]: '' }));
  };

  // Handle Share
  const handleShare = (article) => {
    const tInfo = translations[article.id];
    const titleToShare = tInfo?.isShowing ? tInfo.title : article.title;
    const summaryToShare = tInfo?.isShowing ? tInfo.summary : article.summary;

    if (navigator.share) {
      navigator
        .share({
          title: titleToShare,
          text: `${titleToShare}\n\n${summaryToShare}`,
          url: article.url || window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(`${titleToShare}\n\n${summaryToShare}\n${article.url || ''}`);
      setCopiedId(article.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const activeLangObj = GLOBAL_LANGUAGES.find((l) => l.code === targetLang) || GLOBAL_LANGUAGES[0];

  return (
    <div className="home-news-feed-container">
      {/* Section Header */}
      <div className="home-news-header-box">
        <div className="home-news-header-top-row">
          <div className="home-news-header-title">
            <span className="live-sparkle-pill">
              <span className="live-dot-green"></span> LIVE
            </span>
            <h3>Global Breaking News</h3>
          </div>

          {/* AI Translation Toolbar */}
          <div className="news-ai-lang-toolbar">
            <div className="news-lang-select-wrap">
              <i className="fa-solid fa-globe lang-globe-icon"></i>
              <select
                className="news-target-lang-select"
                value={targetLang}
                onChange={(e) => handleChangeTargetLang(e.target.value)}
                title="Select preferred translation language for all news"
              >
                {GLOBAL_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={`news-auto-translate-toggle ${autoTranslate ? 'active' : ''}`}
              onClick={handleToggleAutoTranslate}
              title="Automatically translate all stories to your chosen language"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span>{autoTranslate ? 'Auto: ON' : 'Auto: OFF'}</span>
            </button>
          </div>
        </div>

        <p className="home-news-subtitle">
          Real-time stories from Spain and around the world, auto-translated to {activeLangObj.flag} {activeLangObj.name} with original article links.
        </p>

        {/* Category Filter Chips */}
        <div className="home-news-chips-row">
          {NEWS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`home-news-chip ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="home-news-loading">
          <i className="fa-solid fa-circle-notch fa-spin"></i>
          <span>Fetching fresh global headlines...</span>
        </div>
      )}

      {/* News Posts List */}
      <div className="home-news-cards-list">
        {newsList.map((article) => {
          const articleLikeInfo = likesState[article.id] || {
            liked: false,
            count: article.likes || 120,
          };
          const articleComments = commentsState[article.id] || [];
          const isCommentsOpen = Boolean(openComments[article.id]);
          const translation = translations[article.id];
          const isTranslating = Boolean(translatingIds[article.id]);

          const displayTitle = translation?.isShowing ? translation.title : article.title;
          const displaySummary = translation?.isShowing ? translation.summary : article.summary;

          return (
            <article key={article.id} className="post-card home-news-card">
              {/* Header */}
              <header className="post-card-header">
                <div className="post-author-info">
                  <div className="author-avatar-wrap news-avatar-wrap">
                    <span className="news-avatar-emoji">{article.sourceLogo || '📰'}</span>
                  </div>
                  <div className="author-meta">
                    <div className="author-name-row">
                      <span className="author-display-name">{article.source}</span>
                      <span className="x-post-verified" title="Verified News Outlet">
                        <i className="fa-solid fa-circle-check"></i>
                      </span>
                      <span className="author-handle">{article.handle || '@news'}</span>
                      <span className="post-lang-badge">{article.category}</span>
                    </div>
                    <span className="post-time">{article.timeAgo}</span>
                  </div>
                </div>

                {/* Direct Link to Original Site */}
                {article.url && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-header-ext-link"
                    title={`Open original article on ${article.source}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{article.source?.split(' ')[0] || 'Original'}</span>
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                  </a>
                )}
              </header>

              {/* Body */}
              <div className="post-card-body">
                <h3 className="news-feed-headline">{displayTitle}</h3>
                <p className="news-feed-summary">{displaySummary}</p>

                {/* Translation Indicator Box */}
                {translation?.isShowing && (
                  <div className="translation-indicator-box news-translation-banner">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    <span>
                      Translated from <strong>{(translation.sourceLang || 'ORIGINAL').toUpperCase()}</strong> to{' '}
                      <strong>{(translation.targetLang || targetLang).toUpperCase()}</strong> via Giochat AI
                    </span>
                  </div>
                )}

                {/* Translate Button */}
                <div className="news-translate-row">
                  <button
                    type="button"
                    className={`news-inline-translate-btn ${translation?.isShowing ? 'active' : ''}`}
                    onClick={() => handleTranslateArticle(article)}
                    disabled={isTranslating}
                  >
                    {isTranslating ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        <span>Translating story...</span>
                      </>
                    ) : translation?.isShowing ? (
                      <>
                        <i className="fa-solid fa-rotate-left"></i>
                        <span>Show Original Story</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-language"></i>
                        <span>Translate to {activeLangObj.flag} {activeLangObj.name}</span>
                      </>
                    )}
                  </button>
                </div>

                {article.imageUrl && (
                  <div className="news-media-preview">
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Read Full Story Button */}
                {article.url && (
                  <div className="news-read-action-banner">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="news-read-direct-btn"
                    >
                      <i className="fa-solid fa-newspaper"></i>
                      <span>Read full story on {article.source}</span>
                      <i className="fa-solid fa-arrow-up-right-from-square arrow-ext"></i>
                    </a>
                  </div>
                )}
              </div>

              {/* Interactive Footer: X (Twitter) Standard Actions */}
              <footer className="post-card-footer">
                {/* 1. Reply / Comment Button */}
                <button
                  type="button"
                  className={`post-action-btn comment-action ${isCommentsOpen ? 'active' : ''}`}
                  onClick={() => handleToggleComments(article.id)}
                  title="View & Add Comments"
                >
                  <i className="fa-regular fa-comment"></i>
                  <span className="action-count">{articleComments.length}</span>
                </button>

                {/* 2. Repost / Share Button */}
                <button
                  type="button"
                  className="post-action-btn share-action"
                  onClick={() => handleShare(article)}
                  title="Share this story"
                >
                  <i className="fa-solid fa-repeat"></i>
                  <span className="action-count">{article.reposts || 38}</span>
                </button>

                {/* 3. Like Button */}
                <button
                  type="button"
                  className={`post-action-btn like-action ${articleLikeInfo.liked ? 'liked' : ''}`}
                  onClick={() => handleToggleLike(article.id, article.likes || 120)}
                  title={articleLikeInfo.liked ? 'Unlike' : 'Like'}
                >
                  <i
                    className={`fa-${articleLikeInfo.liked ? 'solid' : 'regular'} fa-heart heart-icon`}
                  ></i>
                  <span className="action-count">{articleLikeInfo.count}</span>
                </button>

                {/* 4. Quick Modal Reader */}
                <button
                  type="button"
                  className="post-action-btn quick-read-action"
                  onClick={() => setSelectedArticle(article)}
                  title="Quick Reader Mode"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square"></i>
                  <span>Read</span>
                </button>
              </footer>

              {/* Comments Section */}
              {isCommentsOpen && (
                <div className="x-comments-section news-comments-drawer">
                  <div className="x-comments-divider"></div>

                  {/* Comment Composer */}
                  <form
                    className="x-reply-composer"
                    onSubmit={(e) => handleAddComment(e, article.id)}
                  >
                    <div className="x-composer-avatar">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username || 'You'} />
                      ) : (
                        <div className="x-avatar-fallback">
                          {(user?.displayName || user?.username || 'Y')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="x-form-input-col">
                      <input
                        type="text"
                        className="x-reply-input"
                        placeholder="Leave a comment on this story..."
                        value={commentInputs[article.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [article.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <button
                      type="submit"
                      className="x-reply-submit-btn"
                      disabled={!commentInputs[article.id]?.trim()}
                    >
                      Post
                    </button>
                  </form>

                  {/* Existing Comments List */}
                  <div className="x-comments-list" style={{ marginTop: '12px' }}>
                    {articleComments.length === 0 ? (
                      <div className="x-no-comments">
                        <i className="fa-regular fa-comments x-empty-icon"></i>
                        <p>No comments yet. Share your thoughts on this story!</p>
                      </div>
                    ) : (
                      articleComments.map((c) => (
                        <div key={c.id} className="x-comment-row">
                          <div className="x-avatar-col">
                            <div className="x-author-avatar">
                              {c.avatarUrl ? (
                                <img src={c.avatarUrl} alt={c.username} />
                              ) : (
                                <div className="x-avatar-fallback">
                                  {(c.displayName || c.username || 'U')[0].toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="x-comment-content">
                            <div className="x-comment-author-row">
                              <span className="x-comment-author-name">{c.displayName}</span>
                              <span className="x-comment-handle">@{c.username}</span>
                              <span className="x-comment-dot">·</span>
                              <span className="x-comment-time">{c.createdAt}</span>
                            </div>
                            <p className="x-comment-text">{c.text}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Reader Modal */}
      {selectedArticle && (
        <div className="match-modal-backdrop" onClick={() => setSelectedArticle(null)}>
          <div className="match-modal-card news-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="match-modal-header">
              <div className="news-modal-source-row">
                <span className="news-source-tag">
                  <span>{selectedArticle.sourceLogo || '📰'}</span>
                  <strong>{selectedArticle.source}</strong>
                  {selectedArticle.handle && (
                    <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>{selectedArticle.handle}</span>
                  )}
                </span>
                <span className="news-cat-pill">{selectedArticle.category}</span>
                <span className="news-time-ago">{selectedArticle.timeAgo}</span>
              </div>
              <button
                type="button"
                className="match-modal-close-btn"
                onClick={() => setSelectedArticle(null)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <h3 className="news-modal-headline">
              {translations[selectedArticle.id]?.isShowing
                ? translations[selectedArticle.id].title
                : selectedArticle.title}
            </h3>
            <p className="news-modal-lead">
              {translations[selectedArticle.id]?.isShowing
                ? translations[selectedArticle.id].summary
                : selectedArticle.summary}
            </p>

            {translations[selectedArticle.id]?.isShowing && (
              <div className="translation-indicator-box news-translation-banner" style={{ margin: '8px 0' }}>
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>
                  Translated to <strong>{translations[selectedArticle.id].targetLang.toUpperCase()}</strong> via Giochat AI
                </span>
              </div>
            )}

            {selectedArticle.imageUrl && (
              <div style={{ borderRadius: '12px', overflow: 'hidden', maxHeight: '220px', margin: '12px 0' }}>
                <img
                  src={selectedArticle.imageUrl}
                  alt={selectedArticle.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            <div className="news-modal-footer">
              {selectedArticle.url ? (
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-modal-open-link-btn"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square"></i> Read Full Story on {selectedArticle.source}
                </a>
              ) : (
                <span className="news-read-time">
                  <i className="fa-solid fa-newspaper"></i> Verified Journalism Feed
                </span>
              )}

              <button
                type="button"
                className="news-share-btn"
                onClick={() => handleShare(selectedArticle)}
              >
                <i className="fa-solid fa-share-nodes"></i> Share Story
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
