import { formatReelTimeRemaining } from '../utils/reelsData';
import { resolveAvatarUrl, handleAvatarError } from '../utils/avatarUrl';
import '../styles/reels.css';

export default function StoriesReelsTray({
  user,
  reels = [],
  watchedReelIds = [],
  onOpenCreate,
  onSelectReel,
}) {
  const userAvatar = resolveAvatarUrl(user?.avatarUrl, user?.displayName || user?.username || 'You');

  return (
    <section className="stories-reels-tray" aria-label="Reels and Statuses (5 Hours)">
      {/* 1. Add Story / Reel Card */}
      <div
        className="create-story-card"
        onClick={onOpenCreate}
        role="button"
        tabIndex={0}
        title="Share a 5-hour status reel (photos or short video up to 30s)"
      >
        <img
          src={userAvatar}
          alt={user?.displayName || 'You'}
          className="create-story-user-avatar"
          onError={(e) => handleAvatarError(e, user?.displayName || 'You')}
        />
        <div className="create-story-plus-badge">
          <i className="fa-solid fa-plus" />
        </div>
        <div className="create-story-text-group">
          <span className="create-story-title">Add Reel</span>
          <span className="create-story-badge">5h Status</span>
        </div>
      </div>

      {/* 2. Active Reels Cards from You & Followed Friends */}
      {reels.map((reel, index) => {
        const firstItem = reel.items?.[0] || {};
        const isVideo = firstItem.type === 'video' || reel.type === 'video';
        const isMulti = reel.items && reel.items.length > 1;
        const timeRemaining = formatReelTimeRemaining(reel.createdAt);
        const avatar = resolveAvatarUrl(reel.userAvatar, reel.displayName || reel.username);
        const bgThumbnail = firstItem.url || avatar;
        const isWatched = Array.isArray(watchedReelIds) && watchedReelIds.includes(reel.id);

        return (
          <div
            key={reel.id}
            className={`story-reel-card ${isWatched ? 'is-watched' : ''}`}
            onClick={() => onSelectReel(index)}
            role="button"
            tabIndex={0}
            title={`${reel.displayName || reel.username}'s Status • ${timeRemaining}${isWatched ? ' (Already viewed)' : ''}`}
          >
            {/* Background Thumbnail */}
            {isVideo ? (
              <video
                src={firstItem.url}
                className="story-reel-bg"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={bgThumbnail}
                alt=""
                className="story-reel-bg"
                loading="lazy"
              />
            )}

            <div className="story-reel-gradient-overlay" />

            {/* User Avatar with Rainbow Gradient Ring (or muted faded ring when watched) */}
            <div className="story-reel-avatar-wrap">
              <img
                src={avatar}
                alt={reel.displayName || reel.username}
                className="story-reel-avatar"
                onError={(e) => handleAvatarError(e, reel.displayName || reel.username)}
              />
            </div>

            {/* 5-Hour Expiry Tag */}
            <div className="reel-expiry-pill" title={`Disappears in ${timeRemaining}`}>
              <i className="fa-regular fa-clock" />
              <span>5h</span>
            </div>

            {/* Watched / Viewed Badge */}
            {isWatched && (
              <div className="reel-watched-indicator" title="Already watched">
                <i className="fa-solid fa-check" />
                <span>Seen</span>
              </div>
            )}

            {/* Multi-photo or Video Indicator */}
            {isVideo ? (
              <div className="reel-type-badge">
                <i className="fa-solid fa-video" />
                <span>30s</span>
              </div>
            ) : isMulti ? (
              <div className="reel-type-badge">
                <i className="fa-solid fa-clone" />
                <span>{reel.items.length}</span>
              </div>
            ) : null}

            {/* Username label */}
            <span className="story-reel-username">
              {reel.displayName || `@${reel.username}`}
            </span>
          </div>
        );
      })}

      {/* 3. Empty placeholder hint if no friend reels yet */}
      {reels.length === 0 && (
        <div
          className="stories-empty-hint"
          onClick={onOpenCreate}
          role="button"
          tabIndex={0}
          title="Share a 5-hour reel with friends"
        >
          <i className="fa-regular fa-clock" />
          <div className="empty-hint-text">
            <strong>Friend Reels</strong>
            <span>Tap + to share photos or video with friends!</span>
          </div>
        </div>
      )}
    </section>
  );
}
