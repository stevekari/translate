import { useState, useEffect, useRef, useMemo } from 'react';
import { getLiveNews, FALLBACK_NEWS, NEWS_COUNTRIES, NEWS_CATEGORIES } from '../api/newsApi';
import { getRealFootballScores } from '../api/footballApi';
import { INITIAL_MATCHES } from '../utils/liveMatchesData';
import LiveScoresModal from './LiveScoresModal';
import '../styles/liveScoresAndNews.css';

export default function LiveFootballAndNews() {
  const [activeTab, setActiveTab] = useState('football'); // 'football' | 'news' | 'trends'
  const [matches, setMatches] = useState(INITIAL_MATCHES);
  const [isRealScoresActive, setIsRealScoresActive] = useState(false);
  const [newsList, setNewsList] = useState(FALLBACK_NEWS);
  const [newsLoading, setNewsLoading] = useState(false);
  const [leagueFilter, setLeagueFilter] = useState('all'); // 'all' | 'live' | 'ucl' | 'epl' | 'laliga' | 'seriea' | 'bundesliga' | 'ligue1' | 'intl'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'live' | 'ft' | 'upcoming'
  const [matchSearch, setMatchSearch] = useState('');
  const [newsFilter, setNewsFilter] = useState('all'); // 'all' | 'Football' | 'Tech' | 'World'
  const [newsCountry, setNewsCountry] = useState(() => {
    const saved = localStorage.getItem('gio_news_country');
    if (!saved || saved === 'WORLD') return 'ALL';
    return saved;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Just now');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showScoresModal, setShowScoresModal] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef(null);

  // Helper to render team crest (supports real ESPN logo images and emoji fallbacks)
  const renderTeamCrest = (crest, fallback = '⚽') => {
    if (typeof crest === 'string' && crest.startsWith('http')) {
      return (
        <img
          src={crest}
          alt=""
          className="team-crest-img"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    }
    return <span className="team-crest">{crest || fallback}</span>;
  };

  // Fetch real-time live matches from ESPN on mount and periodically
  useEffect(() => {
    let isMounted = true;
    const loadRealScores = async (force = false) => {
      try {
        const data = await getRealFootballScores('today', force);
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setMatches(data);
          setIsRealScoresActive(data.some((m) => m.isRealMatch));
        }
      } catch (err) {
        console.warn('Real football API error:', err);
      }
    };

    loadRealScores();

    // Auto-refresh real live scores every 30 seconds
    const interval = setInterval(() => {
      loadRealScores(true);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Live match minute ticker (updates live matches realistically between polls)
  useEffect(() => {
    const interval = setInterval(() => {
      setMatches((prevMatches) =>
        prevMatches.map((m) => {
          if (m.isLive && m.minute && m.minute < 90) {
            const nextMin = m.minute + 1;
            return {
              ...m,
              minute: nextMin,
              status: nextMin >= 90 ? 'FT' : `LIVE ${nextMin}'`,
              isLive: nextMin < 90,
            };
          }
          return m;
        })
      );
    }, 45000); // 45s tick

    return () => clearInterval(interval);
  }, []);

  // Fetch live breaking news whenever category or country changes
  useEffect(() => {
    let isMounted = true;
    const fetchNews = async () => {
      setNewsLoading(true);
      try {
        const data = await getLiveNews(newsFilter, newsCountry);
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setNewsList(data);
          setLastUpdated('Just now');
        }
      } catch (err) {
        console.warn('Live news fetch failed:', err);
      } finally {
        if (isMounted) setNewsLoading(false);
      }
    };

    fetchNews();

    return () => {
      isMounted = false;
    };
  }, [newsFilter, newsCountry]);

  // Handle scroll detection for Scroll-to-Top button
  const handleScroll = (e) => {
    if (e.target.scrollTop > 200) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCountryChange = (countryCode) => {
    setNewsCountry(countryCode);
    localStorage.setItem('gio_news_country', countryCode);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [newsData, scoresData] = await Promise.allSettled([
        getLiveNews(newsFilter, newsCountry, true),
        getRealFootballScores('today', true),
      ]);
      if (newsData.status === 'fulfilled' && newsData.value && newsData.value.length > 0) {
        setNewsList(newsData.value);
      }
      if (scoresData.status === 'fulfilled' && scoresData.value && scoresData.value.length > 0) {
        setMatches(scoresData.value);
        setIsRealScoresActive(scoresData.value.some((m) => m.isRealMatch));
      }
      setLastUpdated('Just now');
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter matches by League, Status, and Search Query
  const filteredMatches = matches.filter((m) => {
    // 1. League Filter
    if (leagueFilter === 'live' && !m.isLive) return false;
    if (leagueFilter !== 'all' && leagueFilter !== 'live' && m.leagueCode !== leagueFilter) {
      return false;
    }

    // 2. Status Filter
    if (statusFilter === 'live' && !m.isLive) return false;
    if (statusFilter === 'ft' && m.status !== 'FT') return false;
    if (statusFilter === 'upcoming' && (m.isLive || m.status === 'FT')) return false;

    // 3. Search Query Filter
    if (matchSearch.trim()) {
      const q = matchSearch.trim().toLowerCase();
      const matchText = `${m.homeTeam} ${m.awayTeam} ${m.league} ${m.homeCode} ${m.awayCode} ${m.stadium}`.toLowerCase();
      const scorerText = m.scorers.map((s) => s.player).join(' ').toLowerCase();
      return matchText.includes(q) || scorerText.includes(q);
    }

    return true;
  });

  // Sort matches: Live matches first, then by league importance so top 8+ live matches appear right in view
  const sortedMatches = useMemo(() => {
    return [...filteredMatches].sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return 0;
    });
  }, [filteredMatches]);

  const liveMatchesCount = matches.filter((m) => m.isLive).length;
  const activeCountryObj = NEWS_COUNTRIES.find((c) => c.code === newsCountry) || NEWS_COUNTRIES[0];

  return (
    <div className="sidebar-card live-hub-card">
      {/* Segmented Top Tab Switcher */}
      <div className="live-hub-tabs-row">
        <button
          type="button"
          className={`live-hub-tab-btn ${activeTab === 'football' ? 'active' : ''}`}
          onClick={() => setActiveTab('football')}
        >
          <span>⚽ Live Scores</span>
          {liveMatchesCount > 0 && (
            <span
              className="live-tab-badge pulse-red clickable"
              onClick={(e) => {
                e.stopPropagation();
                setShowScoresModal(true);
              }}
              title="Pop up live matches on screen"
            >
              {liveMatchesCount} LIVE ↗
            </span>
          )}
        </button>

        <button
          type="button"
          className={`live-hub-tab-btn ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          <span>🌍 World News</span>
        </button>

        <button
          type="button"
          className={`live-hub-tab-btn ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          <span>🔥 Trends</span>
        </button>
      </div>

      {/* Subheader with Refresh Tool & Popup Fullscreen Scoreboard Button */}
      <div className="live-hub-subbar">
        <span className="live-hub-updated-text">
          <i className="fa-solid fa-clock"></i> {lastUpdated}
        </span>
        <div className="live-hub-actions-group">
          <button
            type="button"
            className="live-hub-popup-btn"
            onClick={() => setShowScoresModal(true)}
            title="Pop up live scores fullscreen on screen"
            aria-label="Pop up live scoreboard"
          >
            <i className="fa-solid fa-up-right-and-down-left-from-center"></i>
            <span>Pop up</span>
          </button>
          <button
            type="button"
            className="live-hub-refresh-btn"
            onClick={handleManualRefresh}
            title="Refresh Live Scores & News"
            aria-label="Refresh"
          >
            <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? 'fa-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: LIVE FOOTBALL SCORES & EXTENSIVE SCROLLABLE SCOREBOARD
          ========================================================================= */}
      {activeTab === 'football' && (
        <div className="football-feed-section">
          {/* Live Summary Banner with Click-to-Popup & Real-time Live Badge */}
          <div
            className="football-summary-banner clickable"
            onClick={() => setShowScoresModal(true)}
            title="Click to pop up all live matches on screen"
          >
            <div className="football-live-count-pill">
              <span className="status-live-dot" />
              <span>{liveMatchesCount} Matches Live • Tap for Live Center</span>
              <i className="fa-solid fa-arrow-up-right-from-square live-popup-hint-icon" />
            </div>
            <div className="football-banner-right-tags">
              <span className="football-real-indicator" title="Connected to Real Live Football ESPN Feeds">
                <i className="fa-solid fa-circle-check" /> Real Live Feed
              </span>
              <span className="football-total-badge">{matches.length} Total</span>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="football-search-wrapper">
            <i className="fa-solid fa-magnifying-glass search-icon" />
            <input
              type="text"
              className="football-search-input"
              value={matchSearch}
              onChange={(e) => setMatchSearch(e.target.value)}
              placeholder="Search team, league or player..."
            />
            {matchSearch && (
              <button
                type="button"
                className="football-search-clear"
                onClick={() => setMatchSearch('')}
                title="Clear search"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Status Quick Filter Buttons */}
          <div className="football-status-filter-row">
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({matches.length})
            </button>
            <button
              type="button"
              className={`status-pill-btn live ${statusFilter === 'live' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('live');
                setShowScoresModal(true);
              }}
              title="Click to view live matches popup"
            >
              🔴 Live ({liveMatchesCount}) ↗
            </button>
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'ft' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ft')}
            >
              Finished ({matches.filter((m) => m.status === 'FT').length})
            </button>
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'upcoming' ? 'active' : ''}`}
              onClick={() => setStatusFilter('upcoming')}
            >
              Scheduled ({matches.filter((m) => !m.isLive && m.status !== 'FT').length})
            </button>
          </div>

          {/* League Filter Chips (Scrollable) */}
          <div className="football-chips-row">
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'all' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('all')}
            >
              All Leagues
            </button>
            <button
              type="button"
              className={`football-chip live-chip ${leagueFilter === 'live' ? 'active' : ''}`}
              onClick={() => {
                setLeagueFilter('live');
                setShowScoresModal(true);
              }}
            >
              🔴 Live Popup
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'ucl' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('ucl')}
            >
              🏆 Champions League
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'epl' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('epl')}
            >
              🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'laliga' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('laliga')}
            >
              🇪🇸 La Liga
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'seriea' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('seriea')}
            >
              🇮🇹 Serie A
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'bundesliga' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('bundesliga')}
            >
              🇩🇪 Bundesliga
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'ligue1' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('ligue1')}
            >
              🇫🇷 Ligue 1
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'intl' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('intl')}
            >
              🌍 International
            </button>
          </div>

          {/* Scrollable Matches Viewport Container */}
          <div
            className="football-matches-scroll-container"
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            {filteredMatches.length === 0 ? (
              <div className="football-empty-state">
                <i className="fa-solid fa-futbol empty-icon" />
                <p>No matches found matching your filters</p>
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={() => {
                    setLeagueFilter('all');
                    setStatusFilter('all');
                    setMatchSearch('');
                  }}
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              <div className="football-matches-list">
                {sortedMatches.map((m) => {
                  const homeLeading = m.homeScore > m.awayScore;
                  const awayLeading = m.awayScore > m.homeScore;

                  return (
                    <div
                      key={m.id}
                      className={`football-match-card ${m.isLive ? 'is-live-card' : ''}`}
                      onClick={() => setSelectedMatch(m)}
                      title="Click for full match stats, lineups & live commentary"
                    >
                      {/* Competition Bar */}
                      <div className="match-comp-row">
                        <span className="match-league-name">
                          {m.leagueFlag} {m.league}
                        </span>
                        <span
                          className={`match-status-badge ${
                            m.isLive ? 'live-badge' : m.status === 'FT' ? 'ft-badge' : 'upcoming-badge'
                          }`}
                        >
                          {m.isLive && <span className="status-live-dot" />}
                          {m.status}
                        </span>
                      </div>

                      {/* Teams & Live Score Row */}
                      <div className="match-score-board">
                        {/* Home Team */}
                        <div className={`team-col home-col ${homeLeading ? 'is-winner' : ''}`}>
                          {renderTeamCrest(m.homeCrest)}
                          <span className="team-name">{m.homeTeam}</span>
                        </div>

                        {/* Score Center */}
                        <div className="score-center-col">
                          {m.status.includes('TODAY') ? (
                            <span className="match-time-upcoming">{m.status.replace('TODAY ', '')}</span>
                          ) : (
                            <div className={`score-pill ${m.isLive ? 'live-score-pill' : ''}`}>
                              <span className={`score-num ${homeLeading ? 'winner-num' : ''}`}>
                                {m.homeScore}
                              </span>
                              <span className="score-divider">-</span>
                              <span className={`score-num ${awayLeading ? 'winner-num' : ''}`}>
                                {m.awayScore}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Away Team */}
                        <div className={`team-col away-col ${awayLeading ? 'is-winner' : ''}`}>
                          {renderTeamCrest(m.awayCrest)}
                          <span className="team-name">{m.awayTeam}</span>
                        </div>
                      </div>

                      {/* Scorers Summary Bar */}
                      {m.scorers.length > 0 && (
                        <div className="match-scorers-ticker">
                          <i className="fa-solid fa-futbol" />
                          <span className="scorers-text">
                            {m.scorers.map((s, idx) => (
                              <span key={idx} className="scorer-item">
                                {s.player} {s.minute}
                                {idx < m.scorers.length - 1 ? ' • ' : ''}
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scroll to Top Floating Button */}
          {showScrollTop && (
            <button
              type="button"
              className="football-scroll-top-btn"
              onClick={scrollToTop}
              title="Scroll to top of scores"
              aria-label="Scroll to top"
            >
              <i className="fa-solid fa-arrow-up" />
            </button>
          )}

          {/* Footer count indicator */}
          <div className="football-footer-indicator">
            <span>Showing {filteredMatches.length} of {matches.length} matches • Tap match for live stats</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: REAL-WORLD BREAKING NEWS (X-STYLE FEED)
          ========================================================================= */}
      {activeTab === 'news' && (
        <div className="news-feed-section">
          {/* Country Selection & Live Status Subbar */}
          <div className="sidebar-news-country-row">
            <div className="news-country-select-wrap">
              <i className="fa-solid fa-location-dot country-pin-icon"></i>
              <select
                className="news-country-select"
                value={newsCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
                title="Filter news by country"
              >
                {NEWS_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={`live-hub-refresh-btn ${isRefreshing ? 'is-spinning' : ''}`}
              onClick={handleManualRefresh}
              title="Refresh live news"
              disabled={newsLoading || isRefreshing}
            >
              <i className={`fa-solid fa-arrows-rotate ${isRefreshing || newsLoading ? 'fa-spin' : ''}`}></i>
              <span>Refresh</span>
            </button>
          </div>

          {/* News Category Filter Chips */}
          <div className="football-chips-row">
            {NEWS_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`football-chip ${newsFilter === cat.id ? 'active' : ''}`}
                onClick={() => setNewsFilter(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Live Status indicator */}
          <div className="x-news-live-banner">
            <span className="x-news-live-dot"></span>
            <span>Live {activeCountryObj?.code === 'ALL' ? 'Mixed Countries' : (activeCountryObj?.name || 'Global')} Feed</span>
            <span className="x-news-source-hint">• Auto-updates</span>
          </div>

          {/* News Articles List */}
          {newsLoading ? (
            <div className="news-loading-spinner">
              <i className="fa-solid fa-circle-notch fa-spin"></i>
              <span>Fetching live headlines...</span>
            </div>
          ) : (
            <div className="x-news-feed-list">
              {newsList.map((article) => (
                <article
                  key={article.id}
                  className="x-post-card"
                  onClick={() => setSelectedArticle(article)}
                  title="Click to expand story preview"
                >
                  {/* Top row: Avatar + Outlet + Verified + Handle + Time */}
                  <div className="x-post-header">
                    <div className="x-post-avatar" title={article.source}>
                      {article.sourceLogo || '📰'}
                    </div>
                    <div className="x-post-user-info">
                      <span className="x-post-name">{article.source}</span>
                      {article.verified && (
                        <span className="x-post-verified" title="Verified News Outlet">
                          <i className="fa-solid fa-circle-check"></i>
                        </span>
                      )}
                      {article.country && article.country !== 'WORLD' && (
                        <span className="news-country-pill" title={`From ${article.country}`}>
                          {article.sourceLogo || '🌍'} {article.country}
                        </span>
                      )}
                      <span className="x-post-handle">{article.handle || '@news'}</span>
                      <span className="x-post-dot">·</span>
                      <span className="x-post-time">{article.timeAgo}</span>
                    </div>
                    <span className="x-post-cat-badge">{article.category}</span>
                  </div>

                  {/* X Post Content: Punchy Headline & Short Text */}
                  <div className="x-post-content">
                    <h4 className="x-post-headline">{article.title}</h4>
                    {article.summary && (
                      <p className="x-post-snippet">{article.summary}</p>
                    )}
                  </div>

                  {/* Optional Media Thumbnail */}
                  {article.imageUrl && (
                    <div className="x-post-media-wrap">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="x-post-media"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* X Post Action / Footer Row with Original Link */}
                  <div className="x-post-footer">
                    <div className="x-post-stats">
                      <span className="x-stat-item" title="Engagement">
                        <i className="fa-regular fa-heart"></i> {article.likes || 142}
                      </span>
                      <span className="x-stat-item" title="Reposts">
                        <i className="fa-solid fa-repeat"></i> {article.reposts || 38}
                      </span>
                    </div>

                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="x-post-link-btn"
                        title="Open original website article in new tab"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Read on {article.source?.split(' ')[0] || 'Web'}</span>
                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: COMMUNITY TRENDING
          ========================================================================= */}
      {activeTab === 'trends' && (
        <div className="trending-list">
          <div className="trending-item">
            <span className="trending-category">Technology • Trending Worldwide</span>
            <strong>#AITranslation</strong>
            <span className="trending-count">34.2K posts • Real-time dialect translation</span>
          </div>
          <div className="trending-item">
            <span className="trending-category">Football & Sports • Trending</span>
            <strong>#ChampionsLeague</strong>
            <span className="trending-count">148.5K posts • Quarter-final drama</span>
          </div>
          <div className="trending-item">
            <span className="trending-category">Social • Trending</span>
            <strong>#GioVideoMoments</strong>
            <span className="trending-count">22.8K posts • Video note reactions</span>
          </div>
          <div className="trending-item">
            <span className="trending-category">Community • Trending</span>
            <strong>#GlobalFriends</strong>
            <span className="trending-count">19.5K posts • Cross-border conversations</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: MATCH STATS & COMMENTARY DETAILS MODAL
          ========================================================================= */}
      {selectedMatch && (
        <div className="match-modal-backdrop" onClick={() => setSelectedMatch(null)}>
          <div className="match-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="match-modal-header">
              <div className="match-modal-title-group">
                <span className="match-modal-league">
                  {selectedMatch.leagueFlag} {selectedMatch.league}
                </span>
                <span className="match-modal-stadium">
                  <i className="fa-solid fa-location-dot"></i> {selectedMatch.stadium}
                </span>
              </div>
              <button
                type="button"
                className="match-modal-close-btn"
                onClick={() => setSelectedMatch(null)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Big Match Score Board */}
            <div className="match-modal-scoreboard">
              <div className="modal-team-block">
                <span className="modal-team-crest">{renderTeamCrest(selectedMatch.homeCrest)}</span>
                <strong className="modal-team-name">{selectedMatch.homeTeam}</strong>
              </div>

              <div className="modal-score-block">
                <span className={`modal-status-badge ${selectedMatch.isLive ? 'live-badge' : 'ft-badge'}`}>
                  {selectedMatch.isLive && <span className="status-live-dot" />}
                  {selectedMatch.status}
                </span>
                <div className="modal-big-score">
                  <span>{selectedMatch.homeScore}</span>
                  <span className="modal-score-sep">-</span>
                  <span>{selectedMatch.awayScore}</span>
                </div>
              </div>

              <div className="modal-team-block">
                <span className="modal-team-crest">{renderTeamCrest(selectedMatch.awayCrest)}</span>
                <strong className="modal-team-name">{selectedMatch.awayTeam}</strong>
              </div>
            </div>

            {/* Scorers Timeline */}
            {selectedMatch.scorers.length > 0 && (
              <div className="match-modal-section">
                <span className="match-section-title">Match Goals & Scorers</span>
                <div className="modal-scorers-list">
                  {selectedMatch.scorers.map((s, idx) => (
                    <div key={idx} className={`modal-scorer-pill ${s.team}`}>
                      <i className="fa-solid fa-futbol"></i>
                      <span>{s.player}</span>
                      <strong>{s.minute}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Match Statistics Bars */}
            <div className="match-modal-section">
              <span className="match-section-title">Live Match Statistics</span>
              <div className="match-stats-table">
                {/* Possession */}
                <div className="stat-row">
                  <span className="stat-val home">{selectedMatch.stats.possession[0]}%</span>
                  <span className="stat-label">Ball Possession</span>
                  <span className="stat-val away">{selectedMatch.stats.possession[1]}%</span>
                </div>
                <div className="stat-bar-track">
                  <div className="stat-bar-fill home" style={{ width: `${selectedMatch.stats.possession[0]}%` }}></div>
                  <div className="stat-bar-fill away" style={{ width: `${selectedMatch.stats.possession[1]}%` }}></div>
                </div>

                {/* Shots on Target */}
                <div className="stat-row">
                  <span className="stat-val home">{selectedMatch.stats.shotsOnTarget[0]}</span>
                  <span className="stat-label">Shots on Target</span>
                  <span className="stat-val away">{selectedMatch.stats.shotsOnTarget[1]}</span>
                </div>

                {/* Corner Kicks */}
                <div className="stat-row">
                  <span className="stat-val home">{selectedMatch.stats.corners[0]}</span>
                  <span className="stat-label">Corner Kicks</span>
                  <span className="stat-val away">{selectedMatch.stats.corners[1]}</span>
                </div>

                {/* Fouls */}
                <div className="stat-row">
                  <span className="stat-val home">{selectedMatch.stats.fouls[0]}</span>
                  <span className="stat-label">Fouls</span>
                  <span className="stat-val away">{selectedMatch.stats.fouls[1]}</span>
                </div>
              </div>
            </div>

            {/* Live Key Commentary */}
            <div className="match-modal-section">
              <span className="match-section-title">Key Match Events</span>
              <div className="match-commentary-feed">
                {selectedMatch.commentary.map((c, idx) => (
                  <div key={idx} className="commentary-item">
                    <span className="comm-min">{c.minute}</span>
                    <span className="comm-text">{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: FULL REAL-WORLD NEWS STORY MODAL
          ========================================================================= */}
      {selectedArticle && (
        <div className="match-modal-backdrop" onClick={() => setSelectedArticle(null)}>
          <div className="match-modal-card news-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="match-modal-header">
              <div className="news-modal-source-row">
                <span className="news-source-tag">
                  <span>{selectedArticle.sourceLogo}</span>
                  <strong>{selectedArticle.source}</strong>
                  {selectedArticle.handle && <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>{selectedArticle.handle}</span>}
                </span>
                <span className="news-cat-pill">{selectedArticle.category || selectedArticle.categoryTag}</span>
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

            <h3 className="news-modal-headline">{selectedArticle.title}</h3>
            <p className="news-modal-lead">{selectedArticle.summary}</p>

            {selectedArticle.imageUrl && (
              <div style={{ borderRadius: '12px', overflow: 'hidden', maxHeight: '200px' }}>
                <img
                  src={selectedArticle.imageUrl}
                  alt={selectedArticle.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            {Array.isArray(selectedArticle.keyPoints) && selectedArticle.keyPoints.length > 0 && (
              <div className="match-modal-section">
                <span className="match-section-title">Key Takeaways & Details</span>
                <div className="news-modal-points">
                  {selectedArticle.keyPoints.map((point, idx) => (
                    <div key={idx} className="news-point-item">
                      <i className="fa-solid fa-circle-check"></i>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
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
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: selectedArticle.title, text: selectedArticle.summary, url: selectedArticle.url || '' }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(`${selectedArticle.title}\n${selectedArticle.summary}\n${selectedArticle.url || ''}`);
                    alert('Story copied to clipboard!');
                  }
                }}
              >
                <i className="fa-solid fa-share-nodes"></i> Share Story
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: FULLSCREEN LIVE SCOREBOARD POPUP MODAL
          ========================================================================= */}
      {showScoresModal && (
        <LiveScoresModal
          isOpen={showScoresModal}
          onClose={() => setShowScoresModal(false)}
          initialFilter="live"
        />
      )}
    </div>
  );
}
