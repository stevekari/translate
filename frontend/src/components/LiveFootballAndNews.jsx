import { useState, useEffect } from 'react';
import { getLiveNews, FALLBACK_NEWS } from '../api/newsApi';
import '../styles/liveScoresAndNews.css';

// Initial realistic live football matches database
const INITIAL_MATCHES = [
  {
    id: 'ucl-1',
    league: 'UEFA Champions League',
    leagueFlag: '🏆',
    leagueCode: 'ucl',
    status: 'LIVE',
    minute: 78,
    isLive: true,
    homeTeam: 'Arsenal',
    homeCode: 'ARS',
    homeCrest: '🔴',
    homeScore: 2,
    awayTeam: 'Bayern Munich',
    awayCode: 'BAY',
    awayCrest: '⚪',
    awayScore: 1,
    scorers: [
      { player: 'Bukayo Saka', minute: "32'", team: 'home' },
      { player: 'Harry Kane (P)', minute: "45+2'", team: 'away' },
      { player: 'Declan Rice', minute: "74'", team: 'home' },
    ],
    stadium: 'Emirates Stadium, London',
    stats: {
      possession: [56, 44],
      shotsOnTarget: [7, 4],
      corners: [6, 3],
      fouls: [9, 11],
      yellowCards: [1, 2],
    },
    commentary: [
      { minute: "74'", text: '⚽ GOAL! Declan Rice scores a stunning curler from outside the penalty box!' },
      { minute: "68'", text: '🧤 Superb save by Raya denying Sané on the counter-attack.' },
      { minute: "45+2'", text: '⚽ GOAL! Harry Kane converts penalty into the bottom right corner.' },
      { minute: "32'", text: '⚽ GOAL! Bukayo Saka opens the scoring with a brilliant low strike!' },
    ],
  },
  {
    id: 'ucl-2',
    league: 'UEFA Champions League',
    leagueFlag: '🏆',
    leagueCode: 'ucl',
    status: 'LIVE',
    minute: 65,
    isLive: true,
    homeTeam: 'Real Madrid',
    homeCode: 'RMA',
    homeCrest: '👑',
    homeScore: 3,
    awayTeam: 'Manchester City',
    awayCode: 'MCI',
    awayCrest: '🩵',
    awayScore: 2,
    scorers: [
      { player: 'Bernardo Silva', minute: "2'", team: 'away' },
      { player: 'Camavinga', minute: "12'", team: 'home' },
      { player: 'Rodrygo', minute: "14'", team: 'home' },
      { player: 'Phil Foden', minute: "66'", team: 'away' },
      { player: 'Vinícius Jr', minute: "69'", team: 'home' },
    ],
    stadium: 'Santiago Bernabéu, Madrid',
    stats: {
      possession: [42, 58],
      shotsOnTarget: [8, 7],
      corners: [4, 8],
      fouls: [12, 8],
      yellowCards: [2, 1],
    },
    commentary: [
      { minute: "69'", text: '⚽ GOAL! Vinícius Jr restores Madrid’s lead after a blistering solo run!' },
      { minute: "66'", text: '⚽ GOAL! Phil Foden fires a thunderous rocket into the top corner!' },
      { minute: "14'", text: '⚽ GOAL! Rodrygo finishes a lightning-fast counter-attack!' },
      { minute: "12'", text: '⚽ GOAL! Camavinga shot deflects in for the equalizer!' },
      { minute: "2'", text: '⚽ GOAL! Bernardo Silva surprises the keeper with a clever free-kick!' },
    ],
  },
  {
    id: 'epl-1',
    league: 'Premier League',
    leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    leagueCode: 'epl',
    status: 'LIVE',
    minute: 85,
    isLive: true,
    homeTeam: 'Liverpool',
    homeCode: 'LIV',
    homeCrest: '🔴',
    homeScore: 3,
    awayTeam: 'Chelsea',
    awayCode: 'CHE',
    awayCrest: '🔵',
    awayScore: 1,
    scorers: [
      { player: 'Mohamed Salah', minute: "18'", team: 'home' },
      { player: 'Luis Díaz', minute: "54'", team: 'home' },
      { player: 'Nicolas Jackson', minute: "68'", team: 'away' },
      { player: 'Dominik Szoboszlai', minute: "82'", team: 'home' },
    ],
    stadium: 'Anfield, Liverpool',
    stats: {
      possession: [59, 41],
      shotsOnTarget: [9, 3],
      corners: [7, 2],
      fouls: [8, 14],
      yellowCards: [1, 3],
    },
    commentary: [
      { minute: "82'", text: '⚽ GOAL! Szoboszlai seals the points with a diving header!' },
      { minute: "68'", text: '⚽ GOAL! Jackson pulls one back for Chelsea after a swift break.' },
      { minute: "54'", text: '⚽ GOAL! Luis Díaz pounces on a loose rebound in the box.' },
      { minute: "18'", text: '⚽ GOAL! Mohamed Salah chips the keeper with sublime composure.' },
    ],
  },
  {
    id: 'epl-2',
    league: 'Premier League',
    leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    leagueCode: 'epl',
    status: 'TODAY 20:45',
    minute: null,
    isLive: false,
    homeTeam: 'Tottenham Hotspur',
    homeCode: 'TOT',
    homeCrest: '⚪',
    homeScore: 0,
    awayTeam: 'Aston Villa',
    awayCode: 'AVL',
    awayCrest: '🟣',
    awayScore: 0,
    scorers: [],
    stadium: 'Tottenham Hotspur Stadium, London',
    stats: {
      possession: [50, 50],
      shotsOnTarget: [0, 0],
      corners: [0, 0],
      fouls: [0, 0],
      yellowCards: [0, 0],
    },
    commentary: [
      { minute: 'Pre-Match', text: 'Teams have arrived. Warmups underway under the lights.' },
    ],
  },
  {
    id: 'laliga-1',
    league: 'La Liga EA Sports',
    leagueFlag: '🇪🇸',
    leagueCode: 'laliga',
    status: 'FT',
    minute: 90,
    isLive: false,
    homeTeam: 'Barcelona',
    homeCode: 'BAR',
    homeCrest: '🔵🔴',
    homeScore: 2,
    awayTeam: 'Atlético Madrid',
    awayCode: 'ATM',
    awayCrest: '🔴⚪',
    awayScore: 1,
    scorers: [
      { player: 'Robert Lewandowski', minute: "24'", team: 'home' },
      { player: 'Álvaro Morata', minute: "52'", team: 'away' },
      { player: 'Lamine Yamal', minute: "88'", team: 'home' },
    ],
    stadium: 'Estadi Olímpic Lluís Companys, Barcelona',
    stats: {
      possession: [63, 37],
      shotsOnTarget: [6, 4],
      corners: [5, 4],
      fouls: [10, 16],
      yellowCards: [2, 4],
    },
    commentary: [
      { minute: "90+5'", text: 'FULL TIME! Barcelona hold on for a thrilling 2-1 victory!' },
      { minute: "88'", text: '⚽ GOAL! 16-year-old sensation Lamine Yamal curls home the winner!' },
    ],
  },
];

// Real-world curated breaking news database
const INITIAL_NEWS = [
  {
    id: 'news-1',
    source: 'BBC World News',
    sourceLogo: '🌐',
    category: 'World',
    categoryTag: 'Climate & Energy',
    title: 'Historic Green Transition Accord Signed Across 80 Nations at Global Summit',
    summary: 'World leaders and energy ministers finalized a multibillion-dollar framework to accelerate global clean electricity and interconnect continental power grids.',
    timeAgo: '14m ago',
    readTime: '3 min read',
    keyPoints: [
      'Agreement establishes a global renewable fund targeting underserved developing markets.',
      'Over 80 countries committed to phased reductions in carbon dependency by 2035.',
      'Digital energy management and microgrids highlighted as core pillars.',
    ],
  },
  {
    id: 'news-2',
    source: 'Sky Sports',
    sourceLogo: '⚽',
    category: 'Football',
    categoryTag: 'Champions League',
    title: 'Thrilling European Night: Late Drama Sets Up Monumental Second Legs Across Continent',
    summary: 'A breathtaking evening of UEFA Champions League football produced 12 goals across the top fixtures as European heavyweights battle for semifinal spots.',
    timeAgo: '28m ago',
    readTime: '4 min read',
    keyPoints: [
      'Real Madrid and Manchester City trade sensational strikes in five-goal thriller.',
      'Arsenal edge Bayern Munich at the Emirates behind Declan Rice wonder strike.',
      'Managers emphasize that second-leg ties remain wide open heading into next week.',
    ],
  },
  {
    id: 'news-3',
    source: 'Reuters',
    sourceLogo: '📡',
    category: 'Tech & AI',
    categoryTag: 'Artificial Intelligence',
    title: 'Next-Generation Neural Speech Synthesis Smashes Cross-Dialect Translation Barriers',
    summary: 'New breakthroughs in on-device AI voice modeling now translate regional accents, African dialects, and multilingual audio with near-zero latency and natural intonation.',
    timeAgo: '42m ago',
    readTime: '3 min read',
    keyPoints: [
      'Breakthrough models understand cultural nuances and vernacular slang effortlessly.',
      'Enables true real-time voice translation across consumer messaging platforms like Giochat.',
      'Significantly lowers computational footprint for mobile phones and low-bandwidth networks.',
    ],
  },
  {
    id: 'news-4',
    source: 'The Athletic',
    sourceLogo: '🏆',
    category: 'Football',
    categoryTag: 'Premier League',
    title: 'Tightest Title Race in Decades: Single Point Separates Top Three Contenders',
    summary: 'With only eight fixtures remaining, Arsenal, Liverpool, and Manchester City find themselves locked in an unprecedented three-way fight for the Premier League crown.',
    timeAgo: '1h ago',
    readTime: '5 min read',
    keyPoints: [
      'Goal difference could prove decisive as all three teams maintain high offensive outputs.',
      'Key head-to-head clashes and European fatigue loom large over remaining fixtures.',
      'Pundits hail this season as the most competitive in English football history.',
    ],
  },
  {
    id: 'news-5',
    source: 'Associated Press',
    sourceLogo: '📰',
    category: 'Global',
    categoryTag: 'Economy & Tech',
    title: 'Cross-Border Mobile Platforms See 40% Surge in Multilingual Family Communication',
    summary: 'Studies reveal diaspora communities and international families are adopting AI-powered translation apps to stay tightly connected with relatives across language divides.',
    timeAgo: '2h ago',
    readTime: '3 min read',
    keyPoints: [
      'Grandparents and youth increasingly communicate across native and acquired languages.',
      'Cultural dictionaries and voice note translation named the most loved features.',
      'PWA and offline-capable mobile tools lead growth in West Africa and Latin America.',
    ],
  },
];

const NEWS_CATEGORIES = [
  { id: 'all', label: 'All ⚡' },
  { id: 'Spain', label: 'Spain 🇪🇸' },
  { id: 'World', label: 'World 🌍' },
  { id: 'Football', label: 'Football ⚽' },
  { id: 'Tech', label: 'Tech 🚀' },
];

export default function LiveFootballAndNews() {
  const [activeTab, setActiveTab] = useState('football'); // 'football' | 'news' | 'trends'
  const [matches, setMatches] = useState(INITIAL_MATCHES);
  const [newsList, setNewsList] = useState(FALLBACK_NEWS);
  const [newsLoading, setNewsLoading] = useState(false);
  const [leagueFilter, setLeagueFilter] = useState('all'); // 'all' | 'ucl' | 'epl' | 'laliga'
  const [newsFilter, setNewsFilter] = useState('all'); // 'all' | 'Spain' | 'World' | 'Football' | 'Tech'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Just now');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Live match minute increment ticker (updates live matches realistically)
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
    }, 45000); // realistic 45s tick

    return () => clearInterval(interval);
  }, []);

  // Fetch live breaking news whenever filter changes or tab is accessed
  useEffect(() => {
    let isMounted = true;
    const fetchNews = async () => {
      setNewsLoading(true);
      try {
        const data = await getLiveNews(newsFilter);
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setNewsList(data);
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
  }, [newsFilter]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      sessionStorage.removeItem(`gio_news_cache_${newsFilter}`);
      const data = await getLiveNews(newsFilter);
      if (data && data.length > 0) {
        setNewsList(data);
      }
      setLastUpdated('Just now');
      // Randomly simulate fresh live match ticker
      setMatches((prev) =>
        prev.map((m) => {
          if (m.isLive && m.minute) {
            return {
              ...m,
              minute: Math.min(89, m.minute + 1),
            };
          }
          return m;
        })
      );
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredMatches = matches.filter((m) => {
    if (leagueFilter === 'all') return true;
    if (leagueFilter === 'live') return m.isLive;
    return m.leagueCode === leagueFilter;
  });

  const liveMatchesCount = matches.filter((m) => m.isLive).length;

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
            <span className="live-tab-badge pulse-red">{liveMatchesCount} LIVE</span>
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

      {/* Subheader with Refresh Tool */}
      <div className="live-hub-subbar">
        <span className="live-hub-updated-text">
          <i className="fa-solid fa-clock"></i> {lastUpdated}
        </span>
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

      {/* =========================================================================
          TAB 1: LIVE FOOTBALL SCORES & MATCHES
          ========================================================================= */}
      {activeTab === 'football' && (
        <div className="football-feed-section">
          {/* League Filter Chips */}
          <div className="football-chips-row">
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'all' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('all')}
            >
              All Matches
            </button>
            <button
              type="button"
              className={`football-chip live-chip ${leagueFilter === 'live' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('live')}
            >
              🔴 Live ({liveMatchesCount})
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'ucl' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('ucl')}
            >
              🏆 UCL
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
          </div>

          {/* Matches List */}
          <div className="football-matches-list">
            {filteredMatches.map((m) => (
              <div
                key={m.id}
                className={`football-match-card ${m.isLive ? 'is-live-card' : ''}`}
                onClick={() => setSelectedMatch(m)}
                title="Click for full match stats, lineups & commentary"
              >
                {/* Competition Bar */}
                <div className="match-comp-row">
                  <span className="match-league-name">
                    {m.leagueFlag} {m.league}
                  </span>
                  <span className={`match-status-badge ${m.isLive ? 'live-badge' : m.status === 'FT' ? 'ft-badge' : 'upcoming-badge'}`}>
                    {m.isLive && <span className="status-live-dot" />}
                    {m.status}
                  </span>
                </div>

                {/* Teams & Live Score Row */}
                <div className="match-score-board">
                  {/* Home Team */}
                  <div className="team-col home-col">
                    <span className="team-crest">{m.homeCrest}</span>
                    <span className="team-name">{m.homeTeam}</span>
                  </div>

                  {/* Score */}
                  <div className="score-center-col">
                    {m.status.includes('TODAY') ? (
                      <span className="match-time-upcoming">{m.status.replace('TODAY ', '')}</span>
                    ) : (
                      <div className="score-pill">
                        <span className="score-num">{m.homeScore}</span>
                        <span className="score-divider">-</span>
                        <span className="score-num">{m.awayScore}</span>
                      </div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="team-col away-col">
                    <span className="team-crest">{m.awayCrest}</span>
                    <span className="team-name">{m.awayTeam}</span>
                  </div>
                </div>

                {/* Scorers Summary Bar */}
                {m.scorers.length > 0 && (
                  <div className="match-scorers-ticker">
                    <i className="fa-solid fa-futbol"></i>
                    <span className="scorers-text">
                      {m.scorers.map((s, idx) => (
                        <span key={idx} className="scorer-item">
                          {s.player} {s.minute}{idx < m.scorers.length - 1 ? ' • ' : ''}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: REAL-WORLD BREAKING NEWS (X-STYLE FEED)
          ========================================================================= */}
      {activeTab === 'news' && (
        <div className="news-feed-section">
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
            <span>Live {newsFilter === 'Spain' ? 'Spain & European' : newsFilter === 'World' ? 'Global World' : 'Breaking'} Feed</span>
            <span className="x-news-source-hint">• Tap card or link to read original</span>
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
                <span className="modal-team-crest">{selectedMatch.homeCrest}</span>
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
                <span className="modal-team-crest">{selectedMatch.awayCrest}</span>
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
    </div>
  );
}
