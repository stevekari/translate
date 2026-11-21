import { useState, useEffect, useRef } from 'react';
import { INITIAL_MATCHES } from '../utils/liveMatchesData';
import '../styles/liveScoresAndNews.css';

export default function LiveScoresModal({ isOpen, onClose, initialFilter = 'live' }) {
  const [matches, setMatches] = useState(INITIAL_MATCHES);
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(initialFilter); // 'all' | 'live' | 'ft' | 'upcoming'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setStatusFilter(initialFilter || 'live');
    }
  }, [isOpen, initialFilter]);

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

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setMatches((prev) =>
        prev.map((m) => {
          if (m.isLive && m.minute) {
            const nextMin = Math.min(89, m.minute + 1);
            return {
              ...m,
              minute: nextMin,
              status: `LIVE ${nextMin}'`,
            };
          }
          return m;
        })
      );
      setIsRefreshing(false);
    }, 600);
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

  // Filter matches
  const filteredMatches = matches.filter((m) => {
    // League
    if (leagueFilter !== 'all' && m.leagueCode !== leagueFilter) {
      return false;
    }

    // Status
    if (statusFilter === 'live' && !m.isLive) return false;
    if (statusFilter === 'ft' && m.status !== 'FT') return false;
    if (statusFilter === 'upcoming' && (m.isLive || m.status === 'FT')) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchText = `${m.homeTeam} ${m.awayTeam} ${m.league} ${m.homeCode} ${m.awayCode} ${m.stadium}`.toLowerCase();
      const scorerText = m.scorers.map((s) => s.player).join(' ').toLowerCase();
      return matchText.includes(q) || scorerText.includes(q);
    }

    return true;
  });

  const liveMatchesCount = matches.filter((m) => m.isLive).length;
  const ftMatchesCount = matches.filter((m) => m.status === 'FT').length;
  const upcomingMatchesCount = matches.filter((m) => !m.isLive && m.status !== 'FT').length;

  return (
    <div className="scores-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="scores-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="scores-modal-header">
          <div className="scores-modal-title-group">
            <div className="scores-modal-icon-badge">
              <i className="fa-solid fa-futbol"></i>
            </div>
            <div>
              <div className="scores-modal-title">
                <span>Live Football Scoreboard</span>
                <span className="scores-modal-live-pill">
                  <span className="status-live-dot"></span>
                  {liveMatchesCount} LIVE NOW
                </span>
              </div>
              <div className="scores-modal-subtitle">
                Real-time scores, goal alerts & matchday statistics
              </div>
            </div>
          </div>

          <div className="scores-modal-header-actions">
            <button
              type="button"
              className="scores-modal-refresh-btn"
              onClick={handleRefresh}
              title="Refresh match scores"
              disabled={isRefreshing}
            >
              <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? 'fa-spin' : ''}`}></i>
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="scores-modal-close-btn"
              onClick={onClose}
              aria-label="Close"
              title="Close modal"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Filters */}
        <div className="scores-modal-toolbar">
          {/* Search Bar */}
          <div className="scores-modal-search">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              className="scores-modal-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team, league, stadium, or scorer..."
            />
            {searchQuery && (
              <button
                type="button"
                className="scores-search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          {/* Status Pills */}
          <div className="scores-modal-status-row">
            <button
              type="button"
              className={`scores-status-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All Matches ({matches.length})
            </button>
            <button
              type="button"
              className={`scores-status-pill live-pill ${statusFilter === 'live' ? 'active' : ''}`}
              onClick={() => setStatusFilter('live')}
            >
              🔴 Live ({liveMatchesCount})
            </button>
            <button
              type="button"
              className={`scores-status-pill ${statusFilter === 'ft' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ft')}
            >
              Finished ({ftCountMatches(matches)})
            </button>
            <button
              type="button"
              className={`scores-status-pill ${statusFilter === 'upcoming' ? 'active' : ''}`}
              onClick={() => setStatusFilter('upcoming')}
            >
              Upcoming ({upcomingMatchesCount})
            </button>
          </div>

          {/* League Filter Chips */}
          <div className="scores-modal-leagues-row">
            <button
              type="button"
              className={`scores-league-chip ${leagueFilter === 'all' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('all')}
            >
              All Competitions
            </button>
            <button
              type="button"
              className={`scores-league-chip ${leagueFilter === 'ucl' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('ucl')}
            >
              🏆 Champions League
            </button>
            <button
              type="button"
              className={`scores-league-chip ${leagueFilter === 'epl' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('epl')}
            >
              🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League
            </button>
            <button
              type="button"
              className={`scores-league-chip ${leagueFilter === 'laliga' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('laliga')}
            >
              🇪🇸 La Liga
            </button>
            <button
              type="button"
              className={`scores-league-chip ${leagueFilter === 'seriea' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('seriea')}
            >
              🇮🇹 Serie A
            </button>
            <button
              type="button"
              className={`scores-league-chip ${leagueFilter === 'bundesliga' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('bundesliga')}
            >
              🇩🇪 Bundesliga
            </button>
            <button
              type="button"
              className={`scores-league-chip ${leagueFilter === 'ligue1' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('ligue1')}
            >
              🇫🇷 Ligue 1
            </button>
            <button
              type="button"
              className={`scores-league-chip ${leagueFilter === 'intl' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('intl')}
            >
              🌍 World Matches
            </button>
          </div>
        </div>

        {/* Scrollable Matches Board Viewport */}
        <div
          className="scores-modal-scroll-area"
          ref={scrollRef}
          onScroll={handleScroll}
        >
          {filteredMatches.length === 0 ? (
            <div className="scores-modal-empty">
              <i className="fa-solid fa-futbol empty-ball"></i>
              <h3>No matches found</h3>
              <p>Try searching for a different club name or resetting the filters</p>
              <button
                type="button"
                className="scores-reset-btn"
                onClick={() => {
                  setLeagueFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="scores-modal-matches-grid">
              {filteredMatches.map((m) => {
                const homeLeading = m.homeScore > m.awayScore;
                const awayLeading = m.awayScore > m.homeScore;

                return (
                  <div
                    key={m.id}
                    className={`scores-popup-card ${m.isLive ? 'is-live-card' : ''}`}
                    onClick={() => setSelectedMatch(m)}
                    title="Click for full match stats, possession & commentary"
                  >
                    {/* Top League & Status Row */}
                    <div className="scores-card-top-row">
                      <span className="scores-card-league">
                        {m.leagueFlag} {m.league}
                      </span>
                      <span
                        className={`scores-card-status-badge ${
                          m.isLive ? 'live-badge' : m.status === 'FT' ? 'ft-badge' : 'upcoming-badge'
                        }`}
                      >
                        {m.isLive && <span className="status-live-dot"></span>}
                        {m.status}
                      </span>
                    </div>

                    {/* Team & Scoreline Row */}
                    <div className="scores-card-teams-row">
                      {/* Home */}
                      <div className={`scores-team-col home ${homeLeading ? 'leading' : ''}`}>
                        <span className="scores-team-crest">{m.homeCrest}</span>
                        <span className="scores-team-name">{m.homeTeam}</span>
                      </div>

                      {/* Score Pill */}
                      <div className="scores-center-pill-wrap">
                        {m.status.includes('TODAY') ? (
                          <span className="scores-time-tag">{m.status.replace('TODAY ', '')}</span>
                        ) : (
                          <div className={`scores-big-pill ${m.isLive ? 'live-pill' : ''}`}>
                            <span className={`scores-num ${homeLeading ? 'winner-num' : ''}`}>
                              {m.homeScore}
                            </span>
                            <span className="scores-divider">-</span>
                            <span className={`scores-num ${awayLeading ? 'winner-num' : ''}`}>
                              {m.awayScore}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Away */}
                      <div className={`scores-team-col away ${awayLeading ? 'leading' : ''}`}>
                        <span className="scores-team-crest">{m.awayCrest}</span>
                        <span className="scores-team-name">{m.awayTeam}</span>
                      </div>
                    </div>

                    {/* Scorers Summary */}
                    {m.scorers.length > 0 && (
                      <div className="scores-card-scorers">
                        <i className="fa-solid fa-futbol"></i>
                        <span className="scores-scorers-text">
                          {m.scorers.map((s, idx) => (
                            <span key={idx} className="scores-scorer-item">
                              {s.player} {s.minute}
                              {idx < m.scorers.length - 1 ? ' • ' : ''}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}

                    {/* Stadium location info */}
                    <div className="scores-card-stadium-row">
                      <i className="fa-solid fa-location-dot"></i>
                      <span>{m.stadium}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Floating Scroll to Top button */}
        {showScrollTop && (
          <button
            type="button"
            className="scores-modal-scroll-top"
            onClick={scrollToTop}
            title="Scroll to top"
            aria-label="Scroll to top"
          >
            <i className="fa-solid fa-arrow-up"></i>
          </button>
        )}

        {/* Footer info bar */}
        <div className="scores-modal-footer">
          <span>
            Displaying {filteredMatches.length} of {matches.length} matches • Auto-refreshes every 45s
          </span>
          <span className="scores-modal-footer-hint">Tap any match card for live stats & commentary</span>
        </div>
      </div>

      {/* Embedded Match Stats Details Drawer */}
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
    </div>
  );
}

function ftCountMatches(matches) {
  return matches.filter((m) => m.status === 'FT').length;
}
