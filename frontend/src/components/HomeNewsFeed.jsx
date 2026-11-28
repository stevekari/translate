import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLiveNews, FALLBACK_NEWS, NEWS_COUNTRIES, NEWS_CATEGORIES } from '../api/newsApi';
import { quickTranslate, sendMessageRest, getMyConversations, startConversation } from '../api/conversationApi';
import { isFriendDeleted } from '../utils/deletedFriends';
import { useLanguage } from '../contexts/LanguageContext';
import { resolveBackendUrl } from '../utils/apiBaseUrl';
import LanguagePickerModal from './LanguagePickerModal';
import { WORLD_LANGUAGES, getLanguageInfo } from '../utils/languages';

export default function HomeNewsFeed({ user, hasCommunityPosts = true }) {
  const navigate = useNavigate();
  const { language: currentAppLang } = useLanguage();
  const defaultTarget = user?.preferredLanguage || currentAppLang || 'en';

  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCountry, setActiveCountry] = useState(() => {
    const saved = localStorage.getItem('gio_news_country');
    if (!saved || saved === 'WORLD') return 'ALL';
    return saved;
  });
  const [targetLang, setTargetLang] = useState(() => {
    const saved = localStorage.getItem('gio_news_target_lang');
    if (saved && WORLD_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
    return defaultTarget;
  });
  const [showNewsLangModal, setShowNewsLangModal] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(() => {
    return localStorage.getItem('gio_news_auto_translate') === 'true';
  });

  // Sync target language whenever user profile or app language loads
  useEffect(() => {
    const saved = localStorage.getItem('gio_news_target_lang');
    if (!saved) {
      const preferred = user?.preferredLanguage || currentAppLang || 'en';
      setTargetLang(preferred);
    }
  }, [user?.preferredLanguage, currentAppLang]);

  const [newsList, setNewsList] = useState(FALLBACK_NEWS);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedText, setLastUpdatedText] = useState('Just now');
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0);

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

  // Send to Chat modal state
  const [sendToChatArticle, setSendToChatArticle] = useState(null);
  const [friendsForShare, setFriendsForShare] = useState([]);
  const [loadingFriendsForShare, setLoadingFriendsForShare] = useState(false);
  const [shareFriendSearch, setShareFriendSearch] = useState('');
  const [sendingChatId, setSendingChatId] = useState(null);
  const [sentSuccessId, setSentSuccessId] = useState(null);

  // Reusable news fetcher
  const fetchArticles = useCallback(async (cat = activeCategory, country = activeCountry, force = false) => {
    setLoading(true);
    try {
      const data = await getLiveNews(cat, country, force);
      if (Array.isArray(data) && data.length > 0) {
        setNewsList(data);
        setSecondsSinceRefresh(0);
        setLastUpdatedText('Just now');
      }
    } catch (err) {
      console.warn('Error fetching homepage live news:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeCategory, activeCountry]);

  // Fetch when category or country changes
  useEffect(() => {
    fetchArticles(activeCategory, activeCountry, false);
  }, [activeCategory, activeCountry, fetchArticles]);

  // Live auto-refresh: polls for current breaking news every 60 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchArticles(activeCategory, activeCountry, true);
    }, 60000);

    return () => clearInterval(refreshInterval);
  }, [activeCategory, activeCountry, fetchArticles]);

  // Relative time counter (updates "Updated 10s ago", "20s ago", etc.)
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsSinceRefresh((prev) => {
        const next = prev + 10;
        if (next < 60) {
          setLastUpdatedText(`${next}s ago`);
        } else {
          setLastUpdatedText(`${Math.floor(next / 60)}m ago`);
        }
        return next;
      });
    }, 10000);

    return () => clearInterval(ticker);
  }, [newsList]);

  // Manual refresh handler
  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchArticles(activeCategory, activeCountry, true);
  };

  // Country selection change handler
  const handleCountryChange = (newCountry) => {
    setActiveCountry(newCountry);
    localStorage.setItem('gio_news_country', newCountry);
  };

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
    localStorage.setItem('gio_news_target_lang', newLang);
    // If autoTranslate is on, reset existing translations to re-translate to new language
    if (autoTranslate) {
      setTranslations({});
    }
  };

  // Open Send to Chat Friend Selector Modal
  const handleOpenSendToChat = async (article) => {
    setSendToChatArticle(article);
    setShareFriendSearch('');
    setSentSuccessId(null);
    setSendingChatId(null);
    setLoadingFriendsForShare(true);
    try {
      const convs = await getMyConversations().catch(() => []);
      const currentId = user?.userId || user?.id;
      const currentUsername = (user?.username || '').trim().toLowerCase();
      const list = [];
      const seen = new Set();
      if (Array.isArray(convs)) {
        for (const c of convs) {
          const u = c.otherUser;
          if (!u || !u.id || isFriendDeleted(u)) continue;
          if (c.status !== 'ACCEPTED') continue;
          const uIdStr = String(u.id);
          const uLower = (u.username || '').trim().toLowerCase();
          if (
            (currentId && (String(currentId) === uIdStr || currentId === u.id)) ||
            (currentUsername && uLower === currentUsername) ||
            seen.has(uIdStr)
          ) continue;
          seen.add(uIdStr);
          list.push({
            id: u.id,
            username: u.username,
            displayName: u.displayName || u.username,
            avatarUrl: u.avatarUrl,
            conversationId: c.conversationId,
          });
        }
      }
      setFriendsForShare(list);
    } catch (err) {
      console.error('Failed to load friends for send to chat:', err);
    } finally {
      setLoadingFriendsForShare(false);
    }
  };

  // Send Article Directly to Selected Friend via Chat REST API
  const handleSendArticleToFriend = async (friend) => {
    if (!sendToChatArticle || sendingChatId) return;
    setSendingChatId(friend.id);
    try {
      let convId = friend.conversationId;
      if (!convId) {
        const conv = await startConversation(friend.id);
        convId = conv?.conversationId || conv?.id;
      }
      if (!convId) throw new Error('Could not resolve conversation ID');

      const articleTrans = translations[sendToChatArticle.id];
      const title = (articleTrans?.isShowing && articleTrans.title) ? articleTrans.title : sendToChatArticle.title;
      const summary = (articleTrans?.isShowing && articleTrans.summary) ? articleTrans.summary : sendToChatArticle.summary;

      const messageContent = `📰 *${sendToChatArticle.source || 'News'}*: ${title}\n\n${summary || ''}\n\n🔗 ${sendToChatArticle.url || ''}`.trim();

      await sendMessageRest(convId, messageContent);
      setSentSuccessId(friend.id);
    } catch (err) {
      console.error('Failed to send article to chat:', err);
      alert('Could not send article to chat. Please try again.');
    } finally {
      setSendingChatId(null);
    }
  };

  const filteredShareFriends = useMemo(() => {
    if (!shareFriendSearch.trim()) return friendsForShare;
    const q = shareFriendSearch.toLowerCase();
    return friendsForShare.filter(
      (f) => f.displayName?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q)
    );
  }, [friendsForShare, shareFriendSearch]);

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

    setOpenComments((prev) => ({
      ...prev,
      [articleId]: true,
    }));

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

  const activeLangObj = getLanguageInfo(targetLang);
  const activeCountryObj = NEWS_COUNTRIES.find((c) => c.code === activeCountry) || NEWS_COUNTRIES[0];

  return (
    <div className={`home-news-feed-container ${!hasCommunityPosts ? 'is-primary-feed' : ''}`}>
      {/* Section Header */}
      <div className="home-news-header-box">
        <div className="home-news-header-top-row">
          <div className="home-news-header-title">
            <span className="live-sparkle-pill">
              <span className="live-dot-green"></span> LIVE
            </span>
            <h3>
              {activeCountryObj.code === 'ALL'
                ? '🌍 Global Breaking News (Multi-Country Mix)'
                : `${activeCountryObj.flag} ${activeCountryObj.name} Breaking News`}
            </h3>
          </div>

          {/* Country + AI Translation + Live Refresh Toolbar */}
          <div className="news-ai-lang-toolbar">
            {/* Country Selector */}
            <div className="news-country-select-wrap" title="Select country for live local & breaking news">
              <i className="fa-solid fa-location-dot country-pin-icon"></i>
              <select
                className="news-country-select"
                value={activeCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                {NEWS_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Translation Language Selector */}
            <button
              type="button"
              className="news-lang-select-wrap news-language-button"
              onClick={() => setShowNewsLangModal(true)}
              title="Choose any language for news translation"
            >
              <i className="fa-solid fa-globe lang-globe-icon"></i>
              <span className="news-language-label">{activeLangObj.flag} {activeLangObj.name}</span>
            </button>

            {/* Auto Translate Toggle */}
            <button
              type="button"
              className={`news-auto-translate-toggle ${autoTranslate ? 'active' : ''}`}
              onClick={handleToggleAutoTranslate}
              title="Automatically translate all stories to your chosen language"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span>{autoTranslate ? 'Auto: ON' : 'Auto: OFF'}</span>
            </button>

            {/* Live Refresh Button */}
            <button
              type="button"
              className={`news-refresh-btn ${isRefreshing ? 'is-spinning' : ''}`}
              onClick={handleManualRefresh}
              title="Refresh breaking news feed now"
              disabled={loading || isRefreshing}
            >
              <i className={`fa-solid fa-arrows-rotate ${isRefreshing || loading ? 'fa-spin' : ''}`}></i>
              <span className="news-refresh-label">Live Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Status Bar */}
        <div className="home-news-status-bar">
          <span className="news-status-item news-status-live">
            <span className="live-dot-green"></span> Live Stream
          </span>
          <span className="news-status-item news-status-country">
            {activeCountryObj.code === 'ALL'
              ? '🌍 Mixed Countries Feed'
              : `${activeCountryObj.flag} ${activeCountryObj.name}`}
          </span>
          <span className="news-status-item news-status-updated">
            <i className="fa-regular fa-clock"></i> Updated {lastUpdatedText}
          </span>
          <span className="news-status-item news-status-auto">
            <i className="fa-solid fa-bolt"></i> Auto-updates every 60s
          </span>
        </div>

        {/* Quick Country Pills Row featuring Ghana 🇬🇭 prominently */}
        <div className="news-quick-country-row">
          <button
            type="button"
            className={`news-quick-pill ${activeCountry === 'ALL' ? 'active' : ''}`}
            onClick={() => handleCountryChange('ALL')}
          >
            🌍 All (Mixed)
          </button>
          <button
            type="button"
            className={`news-quick-pill ghana-pill ${activeCountry === 'GH' ? 'active' : ''}`}
            onClick={() => handleCountryChange('GH')}
          >
            🇬🇭 Ghana News
          </button>
          <button
            type="button"
            className={`news-quick-pill ${activeCountry === 'US' ? 'active' : ''}`}
            onClick={() => handleCountryChange('US')}
          >
            🇺🇸 USA
          </button>
          <button
            type="button"
            className={`news-quick-pill ${activeCountry === 'GB' ? 'active' : ''}`}
            onClick={() => handleCountryChange('GB')}
          >
            🇬🇧 UK
          </button>
          <button
            type="button"
            className={`news-quick-pill ${activeCountry === 'ES' ? 'active' : ''}`}
            onClick={() => handleCountryChange('ES')}
          >
            🇪🇸 Spain
          </button>
          <button
            type="button"
            className={`news-quick-pill ${activeCountry === 'NG' ? 'active' : ''}`}
            onClick={() => handleCountryChange('NG')}
          >
            🇳🇬 Nigeria
          </button>
          <button
            type="button"
            className={`news-quick-pill ${activeCountry === 'FR' ? 'active' : ''}`}
            onClick={() => handleCountryChange('FR')}
          >
            🇫🇷 France
          </button>
        </div>

        <p className="home-news-subtitle">
          {activeCountryObj.code === 'ALL'
            ? `Breaking news blended across Spain 🇪🇸, US 🇺🇸, UK 🇬🇧, Ghana 🇬🇭, France 🇫🇷, Nigeria 🇳🇬, Germany 🇩🇪, and global wire services — auto-translated to ${activeLangObj.flag} ${activeLangObj.name}.`
            : `Real-time stories from ${activeCountryObj.flag} ${activeCountryObj.name} and top breaking channels, auto-translated to ${activeLangObj.flag} ${activeLangObj.name} with original source links.`}
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
                      {article.country && article.country !== 'WORLD' && (
                        <span className="news-country-pill" title={`From ${article.country}`}>
                          {article.sourceLogo || '🌍'} {article.country}
                        </span>
                      )}
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

                {/* 3. Send to Chat Button */}
                <button
                  type="button"
                  className="post-action-btn send-to-chat-action"
                  onClick={() => handleOpenSendToChat(article)}
                  title="Send story to a friend in chat"
                >
                  <i className="fa-regular fa-paper-plane"></i>
                  <span>Send</span>
                </button>

                {/* 4. Like Button */}
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

              {/* Comments Section (Toggled Open / Hide when clicking Comment button) */}
              {isCommentsOpen && (
                <div className="x-comments-section news-comments-drawer">
                  <div className="x-comments-divider"></div>

                  {/* Active comment input to write comments */}
                  <form
                    className="quick-comment-form"
                    onSubmit={(e) => handleAddComment(e, article.id)}
                  >
                    <div className="quick-comment-avatar">
                      {user?.avatarUrl ? (
                        <img src={resolveBackendUrl(user.avatarUrl)} alt={user.username || 'You'} />
                      ) : (
                        <div className="quick-comment-avatar-fallback">
                          {(user?.displayName || user?.username || 'Y')[0].toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="quick-comment-input-wrap">
                      <input
                        type="text"
                        className="quick-comment-input"
                        placeholder="Write a comment on this story..."
                        value={commentInputs[article.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [article.id]: e.target.value,
                          }))
                        }
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      className="quick-comment-submit-btn"
                      disabled={!commentInputs[article.id]?.trim()}
                      title="Post comment"
                    >
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </form>

                  {/* Written Comments List (hidden if no comments have been written yet) */}
                  {articleComments && articleComments.length > 0 && (
                    <div className="x-comments-list" style={{ marginTop: '8px' }}>
                      {articleComments.map((c) => (
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
                      ))}
                    </div>
                  )}
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

      <LanguagePickerModal
        isOpen={showNewsLangModal}
        onClose={() => setShowNewsLangModal(false)}
        currentLanguage={targetLang}
        onSelectLanguage={handleChangeTargetLang}
        title="Translate News"
        subtitle="Choose the language you want news articles translated into"
      />

      {/* Send to Chat Modal */}
      {sendToChatArticle && (
        <div className="news-modal-backdrop" onClick={() => setSendToChatArticle(null)}>
          <div
            className="news-modal-card send-to-chat-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="news-modal-close-btn"
              onClick={() => setSendToChatArticle(null)}
              title="Close"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="send-to-chat-header">
              <div className="send-to-chat-icon-badge">
                <i className="fa-regular fa-paper-plane"></i>
              </div>
              <div>
                <h3>Send News Story to Chat</h3>
                <p className="send-to-chat-sub">Share this article directly with a friend in your conversations</p>
              </div>
            </div>

            {/* Article Mini Preview */}
            <div className="send-to-chat-preview-box">
              <span className="send-to-chat-source-tag">
                {sendToChatArticle.sourceLogo} {sendToChatArticle.source}
              </span>
              <p className="send-to-chat-article-title">
                {translations[sendToChatArticle.id]?.isShowing
                  ? translations[sendToChatArticle.id].title
                  : sendToChatArticle.title}
              </p>
            </div>

            {/* Friends Search */}
            <div className="send-to-chat-search-wrap">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Search friends to send to..."
                value={shareFriendSearch}
                onChange={(e) => setShareFriendSearch(e.target.value)}
                className="send-to-chat-search-input"
              />
              {shareFriendSearch && (
                <button
                  type="button"
                  className="search-clear-mini"
                  onClick={() => setShareFriendSearch('')}
                >
                  ×
                </button>
              )}
            </div>

            {/* Friends List */}
            <div className="send-to-chat-friends-list">
              {loadingFriendsForShare ? (
                <div className="send-to-chat-empty">
                  <i className="fa-solid fa-spinner fa-spin"></i> Loading friends...
                </div>
              ) : filteredShareFriends.length === 0 ? (
                <div className="send-to-chat-empty">
                  <i className="fa-solid fa-user-group"></i> No friends found
                </div>
              ) : (
                filteredShareFriends.map((f) => {
                  const isSent = sentSuccessId === f.id;
                  const isSending = sendingChatId === f.id;
                  return (
                    <div key={f.id} className="send-to-chat-friend-row">
                      <div className="send-to-chat-friend-info">
                        <div className="friend-avatar-wrap">
                          {f.avatarUrl ? (
                            <img src={resolveBackendUrl(f.avatarUrl)} alt={f.username} className="friend-avatar-img" />
                          ) : (
                            <div className="friend-avatar-fallback">
                              {(f.displayName || f.username || 'F')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="friend-name-col">
                          <span className="friend-name-text">{f.displayName || f.username}</span>
                          <span className="friend-user-handle">@{f.username}</span>
                        </div>
                      </div>

                      <div className="send-to-chat-friend-actions">
                        {isSent ? (
                          <>
                            <span className="sent-badge">
                              <i className="fa-solid fa-check"></i> Sent
                            </span>
                            {f.conversationId && (
                              <button
                                type="button"
                                className="open-chat-link-btn"
                                onClick={() => {
                                  setSendToChatArticle(null);
                                  navigate(`/chat/${f.conversationId}`);
                                }}
                              >
                                View Chat ➔
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            className="send-btn"
                            disabled={isSending}
                            onClick={() => handleSendArticleToFriend(f)}
                          >
                            {isSending ? (
                              <>
                                <i className="fa-solid fa-spinner fa-spin"></i> Sending...
                              </>
                            ) : (
                              <>
                                <i className="fa-regular fa-paper-plane"></i> Send
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
