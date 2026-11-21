import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { INITIAL_MATCHES, LEAGUES } from '../utils/liveMatchesData';
import { getRealFootballScores } from '../api/footballApi';
import '../styles/liveScoresAndNews.css';

export default function LiveScoresModal({ isOpen, onClose, initialFilter = 'live' }) {
  const [matches, setMatches] = useState(INITIAL_MATCHES);
  const [activeDateTab, setActiveDateTab] = useState('today'); // 'yesterday' | 'today' | 'tomorrow'
  const [liveOnly, setLiveOnly] = useState(initialFilter === 'live');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('gio_favorite_matches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedLeague, setSelectedLeague] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('overview'); // 'overview' | 'stats' | 'lineups'
  const [collapsedLeagues, setCollapsedLeagues] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef(null);

  // Helper to render team crest (supports real ESPN image logos and emoji fallbacks)
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

  useEffect(() => {
    if (isOpen) {
      if (initialFilter === 'live') {
        setLiveOnly(true);
      }
    }
  }, [isOpen, initialFilter]);

  // Load real matches for the selected date (Today, Yesterday, Tomorrow)
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsRefreshing(true);
    getRealFootballScores(activeDateTab, true)
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setMatches(data);
        }
      })
      .catch((err) => console.warn('Real scores error:', err))
      .finally(() => {
        if (isMounted) setIsRefreshing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeDateTab]);

  // Live match minute increment ticker (every 45s)
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setMatches((prev) =>
        prev.map((m) => {
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
    }, 45000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleFavorite = (e, matchId) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId];
      try {
        localStorage.setItem('gio_favorite_matches', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggleLeagueCollapse = (leagueCode) => {
    setCollapsedLeagues((prev) => ({
      ...prev,
      [leagueCode]: !prev[leagueCode],
    }));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await getRealFootballScores(activeDateTab, true);
      if (Array.isArray(data) && data.length > 0) {
        setMatches(data);
      }
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop > 220) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Filter matches based on Date, Live toggle, Favorites, League, and Search
  const filteredMatches = matches.filter((m) => {
    // Live toggle
    if (liveOnly && !m.isLive) return false;

    // Favorites
    if (favoritesOnly && !favorites.includes(m.id)) return false;

    // League
    if (selectedLeague !== 'all' && m.leagueCode !== selectedLeague) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchText = `${m.homeTeam} ${m.awayTeam} ${m.league} ${m.homeCode} ${m.awayCode} ${m.stadium}`.toLowerCase();
      const scorerText = m.scorers.map((s) => s.player).join(' ').toLowerCase();
      return matchText.includes(q) || scorerText.includes(q);
    }

    return true;
  });

  // Group matches by league dynamically (supporting all real ESPN competitions)
  const groupedByLeague = useMemo(() => {
    const knownLeagues = [...LEAGUES];
    filteredMatches.forEach((m) => {
      if (m.leagueCode && !knownLeagues.some((l) => l.code === m.leagueCode)) {
        knownLeagues.push({
          code: m.leagueCode,
          name: m.league || 'Other League',
          flag: m.leagueFlag || '⚽',
          country: m.round || 'World',
          round: 'League',
        });
      }
    });

    return knownLeagues
      .map((league) => {
        const leagueMatches = filteredMatches
          .filter((m) => m.leagueCode === league.code)
          .sort((a, b) => {
            // Live matches first (highest priority)
            if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
            // Finished matches with scores
            if (a.status === 'FT' && b.status !== 'FT') return -1;
            if (b.status === 'FT' && a.status !== 'FT') return 1;
            return 0;
          });
        return {
          ...league,
          matches: leagueMatches,
        };
      })
      .filter((group) => group.matches.length > 0);
  }, [filteredMatches]);

  const totalLiveMatches = matches.filter((m) => m.isLive).length;

  return createPortal(
    <div className="sofascore-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sofascore-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* =========================================================================
            SOFASCORE TOP NAV BAR
            ========================================================================= */}
        <header className="sofascore-header">
          {/* Logo & Brand */}
          <div className="sofascore-brand-group">
            <div className="sofascore-logo-badge">
              <i className="fa-solid fa-futbol"></i>
            </div>
            <div className="sofascore-brand-text">
              <span className="sofascore-title">
                SOFASCORE <span className="sofascore-live-tag">{totalLiveMatches > 0 ? `${totalLiveMatches} LIVE` : 'LIVE'}</span>
              </span>
              <span className="sofascore-subtitle">Live Scores &amp; Real-Time Statistics</span>
            </div>
          </div>

          {/* Date Selector Tabs */}
          <div className="sofascore-date-picker">
            <button
              type="button"
              className={`sofascore-date-tab ${activeDateTab === 'yesterday' ? 'active' : ''}`}
              onClick={() => setActiveDateTab('yesterday')}
            >
              Yesterday
            </button>
            <button
              type="button"
              className={`sofascore-date-tab today ${activeDateTab === 'today' ? 'active' : ''}`}
              onClick={() => setActiveDateTab('today')}
            >
              <span className="sofascore-live-dot"></span>
              TODAY
            </button>
            <button
              type="button"
              className={`sofascore-date-tab ${activeDateTab === 'tomorrow' ? 'active' : ''}`}
              onClick={() => setActiveDateTab('tomorrow')}
            >
              Tomorrow
            </button>
          </div>

          {/* Action Tools */}
          <div className="sofascore-header-actions">
            <button
              type="button"
              className="sofascore-icon-btn refresh-btn"
              onClick={handleRefresh}
              title="Refresh match feeds"
              disabled={isRefreshing}
            >
              <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? 'fa-spin' : ''}`}></i>
            </button>
            <button
              type="button"
              className="sofascore-icon-btn close-btn"
              onClick={onClose}
              aria-label="Close"
              title="Close modal"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        {/* =========================================================================
            SOFASCORE CONTROL SUBBAR: LIVE SWITCH, FAVORITES & SEARCH
            ========================================================================= */}
        <div className="sofascore-subbar">
          <div className="sofascore-quick-toggles">
            {/* All Matches (Normal View) */}
            <button
              type="button"
              className={`sofascore-view-tab ${!liveOnly && !favoritesOnly ? 'active' : ''}`}
              onClick={() => {
                setLiveOnly(false);
                setFavoritesOnly(false);
              }}
              title="Return to normal: show all scheduled and finished matches"
            >
              <i className="fa-solid fa-list-ul"></i>
              <span>All Matches</span>
              <span className="view-tab-count">{matches.length}</span>
            </button>

            {/* LIVE Matches Filter */}
            <button
              type="button"
              className={`sofascore-view-tab live-tab ${liveOnly ? 'active' : ''}`}
              onClick={() => {
                setLiveOnly(true);
                setFavoritesOnly(false);
              }}
              title="Show only currently live matches"
            >
              <span className="status-live-dot" />
              <span>LIVE</span>
              <span className="view-tab-count live-count">{totalLiveMatches}</span>
            </button>

            {/* Favorites Filter */}
            <button
              type="button"
              className={`sofascore-view-tab ${favoritesOnly ? 'active' : ''}`}
              onClick={() => {
                setFavoritesOnly(true);
                setLiveOnly(false);
              }}
              title="Filter by bookmarked matches"
            >
              <i className={`fa-${favoritesOnly ? 'solid' : 'regular'} fa-star`}></i>
              <span>Favorites</span>
              <span className="view-tab-count">{favorites.length}</span>
            </button>

            {/* Return to Normal / Clear Filters */}
            {(liveOnly || favoritesOnly || selectedLeague !== 'all' || searchQuery) && (
              <button
                type="button"
                className="sofascore-reset-filters-btn"
                onClick={() => {
                  setLiveOnly(false);
                  setFavoritesOnly(false);
                  setSelectedLeague('all');
                  setSearchQuery('');
                }}
                title="Return to normal: clear all filters"
              >
                <i className="fa-solid fa-rotate-left"></i>
                <span>Return to Normal</span>
              </button>
            )}
          </div>

          {/* Sofascore Search Box */}
          <div className="sofascore-search-box">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              className="sofascore-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team, league, player or stadium..."
            />
            {searchQuery && (
              <button
                type="button"
                className="sofascore-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        {/* =========================================================================
            SOFASCORE HORIZONTAL LEAGUE SELECTOR
            ========================================================================= */}
        <div className="sofascore-leagues-scroll">
          <button
            type="button"
            className={`sofascore-league-item ${selectedLeague === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedLeague('all')}
          >
            All Leagues
          </button>
          {LEAGUES.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`sofascore-league-item ${selectedLeague === l.code ? 'active' : ''}`}
              onClick={() => setSelectedLeague(l.code)}
            >
              <span>{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>

        {/* =========================================================================
            SOFASCORE LEAGUE-GROUPED MATCH LIST (Scrollable Viewport)
            ========================================================================= */}
        <div
          className="sofascore-matches-scroll-area"
          ref={scrollRef}
          onScroll={handleScroll}
        >
          {groupedByLeague.length === 0 ? (
            <div className="sofascore-empty-state">
              <i className="fa-solid fa-futbol empty-ball"></i>
              <h3>No matches found</h3>
              <p>No games matched your current filters or search terms.</p>
              <button
                type="button"
                className="sofascore-reset-action-btn"
                onClick={() => {
                  setLiveOnly(false);
                  setFavoritesOnly(false);
                  setSelectedLeague('all');
                  setSearchQuery('');
                }}
              >
                <i className="fa-solid fa-rotate-left"></i> Return to Normal Matches ({matches.length})
              </button>
            </div>
          ) : (
            groupedByLeague.map((group) => {
              const isCollapsed = Boolean(collapsedLeagues[group.code]);

              return (
                <div key={group.code} className="sofascore-league-block">
                  {/* Sofascore League Section Header */}
                  <div
                    className="sofascore-league-header"
                    onClick={() => toggleLeagueCollapse(group.code)}
                    title={isCollapsed ? `Click to open ${group.name}` : `Click to close ${group.name}`}
                  >
                    <div className="sofascore-league-info">
                      <span className="league-flag">{group.flag}</span>
                      <div className="league-titles">
                        <span className="league-name">{group.name}</span>
                        <span className="league-country">{group.country} • {group.round}</span>
                      </div>
                    </div>

                    <div className="sofascore-league-actions">
                      <span className="league-match-count">
                        {group.matches.length} {group.matches.length === 1 ? 'match' : 'matches'}
                      </span>
                      <button
                        type="button"
                        className="league-close-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLeagueCollapse(group.code);
                        }}
                        aria-label={isCollapsed ? `Expand ${group.name}` : `Collapse ${group.name}`}
                        title={isCollapsed ? 'Expand league' : 'Collapse league'}
                      >
                        <i className={`fa-solid fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
                        <span>{isCollapsed ? 'Show' : 'Hide'}</span>
                      </button>
                    </div>
                  </div>

                  {/* League Matches Table (Sofascore Rows) */}
                  {!isCollapsed && (
                    <div className="sofascore-matches-table">
                      {group.matches.map((m) => {
                        const isFav = favorites.includes(m.id);
                        const homeWinner = m.homeScore > m.awayScore;
                        const awayWinner = m.awayScore > m.homeScore;

                        return (
                          <div
                            key={m.id}
                            className={`sofascore-match-row ${m.isLive ? 'is-live-row' : ''}`}
                            onClick={() => {
                              setSelectedMatch(m);
                              setActiveDetailTab('overview');
                            }}
                            title="Click for Sofascore match center & ratings"
                          >
                            {/* Left Column: Match Status & Minute */}
                            <div className="sofascore-status-col">
                              {m.isLive ? (
                                <div className="sofascore-live-badge">
                                  <span className="sofascore-minute">{m.minute}'</span>
                                  <span className="status-live-dot"></span>
                                </div>
                              ) : m.status === 'FT' ? (
                                <span className="sofascore-ft-badge">FT</span>
                              ) : (
                                <span className="sofascore-time-badge">
                                  {m.status.replace('TODAY ', '')}
                                </span>
                              )}
                            </div>

                            {/* Center Column: Teams & Scores (2 Clean Rows) */}
                            <div className="sofascore-teams-col">
                              {/* Home Team Row */}
                              <div className={`sofascore-team-line ${homeWinner ? 'is-leading' : ''}`}>
                                <div className="team-meta">
                                  {renderTeamCrest(m.homeCrest)}
                                  <span className="team-name">{m.homeTeam}</span>
                                </div>
                                <span className={`team-score ${homeWinner ? 'leading-score' : ''}`}>
                                  {m.status.includes('TODAY') ? '-' : m.homeScore}
                                </span>
                              </div>

                              {/* Away Team Row */}
                              <div className={`sofascore-team-line ${awayWinner ? 'is-leading' : ''}`}>
                                <div className="team-meta">
                                  {renderTeamCrest(m.awayCrest)}
                                  <span className="team-name">{m.awayTeam}</span>
                                </div>
                                <span className={`team-score ${awayWinner ? 'leading-score' : ''}`}>
                                  {m.status.includes('TODAY') ? '-' : m.awayScore}
                                </span>
                              </div>
                            </div>

                            {/* Right Column: xG Badge, Scorers preview & Star */}
                            <div className="sofascore-meta-col">
                              {/* xG pill */}
                              {m.stats?.expectedGoals && !m.status.includes('TODAY') && (
                                <span className="sofascore-xg-pill" title="Expected Goals (xG)">
                                  xG: {m.stats.expectedGoals[0]} - {m.stats.expectedGoals[1]}
                                </span>
                              )}

                              {/* Scorers Preview */}
                              {m.scorers?.length > 0 && (
                                <span className="sofascore-scorers-preview" title="Goalscorers">
                                  ⚽ {m.scorers[m.scorers.length - 1].player} {m.scorers[m.scorers.length - 1].minute}
                                  {m.scorers.length > 1 && ` (+${m.scorers.length - 1})`}
                                </span>
                              )}

                              {/* Bookmark Star */}
                              <button
                                type="button"
                                className={`sofascore-star-btn ${isFav ? 'starred' : ''}`}
                                onClick={(e) => toggleFavorite(e, m.id)}
                                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                aria-label="Favorite"
                              >
                                <i className={`fa-${isFav ? 'solid' : 'regular'} fa-star`}></i>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Floating Scroll to Top button */}
        {showScrollTop && (
          <button
            type="button"
            className="sofascore-scroll-top-btn"
            onClick={scrollToTop}
            title="Scroll to top"
            aria-label="Scroll to top"
          >
            <i className="fa-solid fa-arrow-up"></i>
          </button>
        )}

        {/* Sofascore Footer */}
        <footer className="sofascore-footer">
          <div className="sofascore-footer-stats">
            <span>
              <strong>{filteredMatches.length}</strong> matches shown • <strong>{totalLiveMatches}</strong> live now
            </span>
          </div>
          <span className="sofascore-footer-brand">
            Powered by Sofascore-style Live Engine • Real-time Ticker
          </span>
        </footer>
      </div>

      {/* =========================================================================
          SOFASCORE MATCH CENTER MODAL (Overview, Stats Comparison, Lineups)
          ========================================================================= */}
      {selectedMatch && (
        <div className="sofascore-center-backdrop" onClick={() => setSelectedMatch(null)}>
          <div className="sofascore-center-card" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sofascore-center-header">
              <div className="center-header-info">
                <span className="center-league">
                  {selectedMatch.leagueFlag} {selectedMatch.league} • {selectedMatch.round}
                </span>
                <span className="center-venue">
                  <i className="fa-solid fa-location-dot"></i> {selectedMatch.stadium} • Ref: {selectedMatch.referee || 'Official'}
                </span>
              </div>
              <button
                type="button"
                className="sofascore-center-close"
                onClick={() => setSelectedMatch(null)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Sofascore Scoreboard Hero */}
            <div className="sofascore-center-scoreboard">
              {/* Home Team Block */}
              <div className="center-team-block home">
                <span className="center-crest">{renderTeamCrest(selectedMatch.homeCrest)}</span>
                <strong className="center-team-name">{selectedMatch.homeTeam}</strong>
                <span className="center-team-code">{selectedMatch.homeCode}</span>
              </div>

              {/* Big Score Block */}
              <div className="center-score-block">
                <span className={`center-live-pill ${selectedMatch.isLive ? 'is-live' : ''}`}>
                  {selectedMatch.isLive && <span className="status-live-dot" />}
                  {selectedMatch.status}
                </span>
                <div className="center-score-numbers">
                  <span className={selectedMatch.homeScore > selectedMatch.awayScore ? 'winner' : ''}>
                    {selectedMatch.homeScore}
                  </span>
                  <span className="center-sep">-</span>
                  <span className={selectedMatch.awayScore > selectedMatch.homeScore ? 'winner' : ''}>
                    {selectedMatch.awayScore}
                  </span>
                </div>
                {selectedMatch.stats?.expectedGoals && (
                  <span className="center-xg-sub">
                    xG: {selectedMatch.stats.expectedGoals[0]} - {selectedMatch.stats.expectedGoals[1]}
                  </span>
                )}
              </div>

              {/* Away Team Block */}
              <div className="center-team-block away">
                <span className="center-crest">{renderTeamCrest(selectedMatch.awayCrest)}</span>
                <strong className="center-team-name">{selectedMatch.awayTeam}</strong>
                <span className="center-team-code">{selectedMatch.awayCode}</span>
              </div>
            </div>

            {/* Sofascore Navigation Tabs */}
            <div className="sofascore-center-tabs">
              <button
                type="button"
                className={`sofascore-tab-item ${activeDetailTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('overview')}
              >
                📊 Overview
              </button>
              <button
                type="button"
                className={`sofascore-tab-item ${activeDetailTab === 'stats' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('stats')}
              >
                📈 Statistics
              </button>
              <button
                type="button"
                className={`sofascore-tab-item ${activeDetailTab === 'lineups' ? 'active' : ''}`}
                onClick={() => setActiveDetailTab('lineups')}
              >
                👥 Lineups & Ratings
              </button>
            </div>

            {/* Tab 1: Overview */}
            {activeDetailTab === 'overview' && (
              <div className="sofascore-tab-content">
                {/* Goals Timeline */}
                {selectedMatch.scorers?.length > 0 && (
                  <div className="center-section">
                    <span className="center-section-heading">Goals & Scorers</span>
                    <div className="center-goals-list">
                      {selectedMatch.scorers.map((s, idx) => (
                        <div key={idx} className={`center-goal-pill ${s.team}`}>
                          <i className="fa-solid fa-futbol"></i>
                          <span className="goal-player">{s.player}</span>
                          <span className="goal-min">{s.minute}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sofascore Attack Momentum Visualizer */}
                <div className="center-section">
                  <div className="momentum-heading-row">
                    <span className="center-section-heading">Attack Momentum</span>
                    <span className="momentum-legend">Pressure throughout match</span>
                  </div>
                  <div className="sofascore-momentum-graph">
                    <div className="momentum-axis-center"></div>
                    {/* Simulated momentum bars */}
                    <div className="momentum-bars-track">
                      {[40, -25, 60, 30, -50, 70, 45, -30, 80, 20, -40, 65, 50, -20, 85, 30].map((val, i) => (
                        <div
                          key={i}
                          className={`momentum-bar ${val > 0 ? 'home' : 'away'}`}
                          style={{
                            height: `${Math.abs(val) * 0.7}px`,
                            alignSelf: val > 0 ? 'flex-end' : 'flex-start',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Key Match Commentary Feed */}
                <div className="center-section">
                  <span className="center-section-heading">Key Match Events</span>
                  <div className="center-commentary-feed">
                    {selectedMatch.commentary?.map((c, idx) => (
                      <div key={idx} className="center-commentary-row">
                        <span className="commentary-min">{c.minute}</span>
                        <span className="commentary-text">{c.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Statistics Comparison Bars (Sofascore Signature!) */}
            {activeDetailTab === 'stats' && (
              <div className="sofascore-tab-content">
                <div className="sofascore-stat-bars-container">
                  {/* Expected Goals (xG) */}
                  {selectedMatch.stats?.expectedGoals && (
                    <SofascoreStatBar
                      label="Expected Goals (xG)"
                      homeVal={selectedMatch.stats.expectedGoals[0]}
                      awayVal={selectedMatch.stats.expectedGoals[1]}
                      homeRatio={selectedMatch.stats.expectedGoals[0] / (selectedMatch.stats.expectedGoals[0] + selectedMatch.stats.expectedGoals[1])}
                    />
                  )}

                  {/* Ball Possession */}
                  <SofascoreStatBar
                    label="Ball Possession"
                    homeVal={`${selectedMatch.stats.possession[0]}%`}
                    awayVal={`${selectedMatch.stats.possession[1]}%`}
                    homeRatio={selectedMatch.stats.possession[0] / 100}
                  />

                  {/* Shots on Target */}
                  <SofascoreStatBar
                    label="Shots on Target"
                    homeVal={selectedMatch.stats.shotsOnTarget[0]}
                    awayVal={selectedMatch.stats.shotsOnTarget[1]}
                    homeRatio={selectedMatch.stats.shotsOnTarget[0] / (selectedMatch.stats.shotsOnTarget[0] + selectedMatch.stats.shotsOnTarget[1] || 1)}
                  />

                  {/* Total Shots */}
                  {selectedMatch.stats?.totalShots && (
                    <SofascoreStatBar
                      label="Total Shots"
                      homeVal={selectedMatch.stats.totalShots[0]}
                      awayVal={selectedMatch.stats.totalShots[1]}
                      homeRatio={selectedMatch.stats.totalShots[0] / (selectedMatch.stats.totalShots[0] + selectedMatch.stats.totalShots[1] || 1)}
                    />
                  )}

                  {/* Big Chances */}
                  {selectedMatch.stats?.bigChances && (
                    <SofascoreStatBar
                      label="Big Chances"
                      homeVal={selectedMatch.stats.bigChances[0]}
                      awayVal={selectedMatch.stats.bigChances[1]}
                      homeRatio={selectedMatch.stats.bigChances[0] / (selectedMatch.stats.bigChances[0] + selectedMatch.stats.bigChances[1] || 1)}
                    />
                  )}

                  {/* Corners */}
                  <SofascoreStatBar
                    label="Corner Kicks"
                    homeVal={selectedMatch.stats.corners[0]}
                    awayVal={selectedMatch.stats.corners[1]}
                    homeRatio={selectedMatch.stats.corners[0] / (selectedMatch.stats.corners[0] + selectedMatch.stats.corners[1] || 1)}
                  />

                  {/* Fouls */}
                  <SofascoreStatBar
                    label="Fouls"
                    homeVal={selectedMatch.stats.fouls[0]}
                    awayVal={selectedMatch.stats.fouls[1]}
                    homeRatio={selectedMatch.stats.fouls[0] / (selectedMatch.stats.fouls[0] + selectedMatch.stats.fouls[1] || 1)}
                  />

                  {/* Yellow Cards */}
                  <SofascoreStatBar
                    label="Yellow Cards"
                    homeVal={selectedMatch.stats.yellowCards[0]}
                    awayVal={selectedMatch.stats.yellowCards[1]}
                    homeRatio={selectedMatch.stats.yellowCards[0] / (selectedMatch.stats.yellowCards[0] + selectedMatch.stats.yellowCards[1] || 1)}
                  />

                  {/* Goalkeeper Saves */}
                  {selectedMatch.stats?.goalkeeperSaves && (
                    <SofascoreStatBar
                      label="Goalkeeper Saves"
                      homeVal={selectedMatch.stats.goalkeeperSaves[0]}
                      awayVal={selectedMatch.stats.goalkeeperSaves[1]}
                      homeRatio={selectedMatch.stats.goalkeeperSaves[0] / (selectedMatch.stats.goalkeeperSaves[0] + selectedMatch.stats.goalkeeperSaves[1] || 1)}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Lineups & Player Ratings */}
            {activeDetailTab === 'lineups' && (
              <div className="sofascore-tab-content">
                <div className="center-lineups-grid">
                  {/* Home Team Lineup */}
                  <div className="lineup-side-col">
                    <div className="lineup-header">
                      <strong>{selectedMatch.homeTeam}</strong>
                      <span className="formation-badge">{selectedMatch.lineups?.homeFormation || '4-3-3'}</span>
                    </div>
                    <div className="ratings-list">
                      {selectedMatch.lineups?.homeRatings?.map((p, idx) => (
                        <div key={idx} className="player-rating-item">
                          <span className="player-name">{p.name} ({p.pos})</span>
                          <span className={`sofascore-rating-pill ${p.rating >= 8.0 ? 'exceptional' : p.rating >= 7.0 ? 'good' : 'average'}`}>
                            {p.rating.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Away Team Lineup */}
                  <div className="lineup-side-col">
                    <div className="lineup-header">
                      <strong>{selectedMatch.awayTeam}</strong>
                      <span className="formation-badge">{selectedMatch.lineups?.awayFormation || '4-2-3-1'}</span>
                    </div>
                    <div className="ratings-list">
                      {selectedMatch.lineups?.awayRatings?.map((p, idx) => (
                        <div key={idx} className="player-rating-item">
                          <span className="player-name">{p.name} ({p.pos})</span>
                          <span className={`sofascore-rating-pill ${p.rating >= 8.0 ? 'exceptional' : p.rating >= 7.0 ? 'good' : 'average'}`}>
                            {p.rating.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

// Sofascore-style Comparison Bar Helper
function SofascoreStatBar({ label, homeVal, awayVal, homeRatio }) {
  const safeRatio = Math.max(0.08, Math.min(0.92, homeRatio || 0.5));
  const homePercent = (safeRatio * 100).toFixed(1);
  const awayPercent = (100 - safeRatio * 100).toFixed(1);

  return (
    <div className="sofascore-stat-row">
      <div className="stat-label-numbers">
        <span className="stat-num home">{homeVal}</span>
        <span className="stat-desc">{label}</span>
        <span className="stat-num away">{awayVal}</span>
      </div>
      <div className="stat-dual-bar">
        <div className="bar-fill home" style={{ width: `${homePercent}%` }}></div>
        <div className="bar-fill away" style={{ width: `${awayPercent}%` }}></div>
      </div>
    </div>
  );
}
