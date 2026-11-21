export const REEL_MAX_DURATION_SECONDS = 30; // Max 30 seconds for video reels
export const REEL_EXPIRY_MS = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

// Strictly empty initial reels: all fake/mock posts are deleted!
export const INITIAL_REELS = [];

const STORAGE_KEY = 'gio_active_reels_v2';
const WATCHED_STORAGE_KEY = 'gio_watched_reels_v1';

/**
 * Filter out any fake news or mock sample reels.
 */
export function isFakeReel(reel) {
  if (!reel) return true;
  const id = String(reel.id || '');
  const userId = String(reel.userId || '');
  const username = String(reel.username || '').toLowerCase();
  const displayName = String(reel.displayName || '').toLowerCase();

  return (
    id.startsWith('reel-news-') ||
    id.startsWith('news-reel-') ||
    id.startsWith('news-item-') ||
    userId.startsWith('source-') ||
    userId.startsWith('publisher-') ||
    username.includes('espn') ||
    username.includes('reuters') ||
    username.includes('wander') ||
    displayName.includes('espn') ||
    displayName.includes('reuters') ||
    displayName.includes('world travel')
  );
}

/**
 * Filter out any reel that is older than 5 hours (300 minutes).
 */
export function isReelActive(reel) {
  if (!reel || !reel.createdAt) return false;
  const createdTime = new Date(reel.createdAt).getTime();
  if (isNaN(createdTime)) return false;
  const ageMs = Date.now() - createdTime;
  return ageMs >= 0 && ageMs < REEL_EXPIRY_MS;
}

/**
 * Format remaining time for a 5-hour reel (e.g. "4h 20m left", "25m left").
 */
export function formatReelTimeRemaining(createdAt) {
  if (!createdAt) return '5h left';
  const createdTime = new Date(createdAt).getTime();
  const expiresAt = createdTime + REEL_EXPIRY_MS;
  const remainingMs = expiresAt - Date.now();

  if (remainingMs <= 0) return 'Expired';

  const totalMinutes = Math.floor(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
}

/**
 * Get watched reel IDs from localStorage.
 */
export function getWatchedReelIds() {
  try {
    const raw = localStorage.getItem(WATCHED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Mark a reel as watched and persist in localStorage.
 */
export function markReelAsWatched(reelId) {
  if (!reelId) return getWatchedReelIds();
  try {
    const current = getWatchedReelIds();
    if (!current.includes(reelId)) {
      const updated = [...current, reelId];
      localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    }
    return current;
  } catch {
    return [];
  }
}

/**
 * Check if a reel has already been watched by the user.
 */
export function isReelWatched(reelId) {
  if (!reelId) return false;
  const watched = getWatchedReelIds();
  return watched.includes(reelId);
}

/**
 * Fetch and construct real active reels from:
 * 1. User-created active 5h reels in localStorage (strictly non-fake, only me & followed friends)
 * 2. Recent media posts (photos/videos) created within 5h by followed friends or user
 */
export function fetchRealReels(friendsList = [], posts = [], currentUser = null) {
  const userReels = getActiveReels();

  // Build sets of allowed friend IDs and usernames
  const allowedUserIds = new Set();
  const allowedUsernames = new Set();

  const myId = currentUser?.userId || currentUser?.id;
  const myUsername = (currentUser?.username || '').trim().toLowerCase();
  if (myId) {
    allowedUserIds.add(String(myId));
    allowedUserIds.add(Number(myId));
  }
  if (myUsername) allowedUsernames.add(myUsername);
  allowedUserIds.add('me');

  if (Array.isArray(friendsList)) {
    friendsList.forEach((f) => {
      if (f.id) {
        allowedUserIds.add(String(f.id));
        allowedUserIds.add(Number(f.id));
      }
      if (f.username) {
        allowedUsernames.add(f.username.trim().toLowerCase());
      }
    });
  }

  // 1. Filter user-created reels: exclude any fake posts & only show me or followed friends
  const filteredUserReels = userReels.filter((r) => {
    if (isFakeReel(r) || !isReelActive(r)) return false;
    const rUserId = String(r.userId || '');
    const rUsername = (r.username || '').trim().toLowerCase();
    return (
      allowedUserIds.has(rUserId) ||
      allowedUserIds.has(r.userId) ||
      allowedUsernames.has(rUsername)
    );
  });

  // 2. Synthesize 5-hour reels from followed friends' recent media posts (image/video)
  const friendPostReels = [];
  if (Array.isArray(posts) && posts.length > 0) {
    posts.forEach((p) => {
      if (!p || !p.mediaUrl) return;
      if (!p.createdAt) return;
      const createdTime = new Date(p.createdAt).getTime();
      if (isNaN(createdTime)) return;
      const ageMs = Date.now() - createdTime;
      // Must be within 5 hours
      if (ageMs < 0 || ageMs > REEL_EXPIRY_MS) return;

      const pUserId = String(p.userId || '');
      const pUsername = (p.username || '').trim().toLowerCase();
      const isAllowed =
        allowedUserIds.has(pUserId) ||
        allowedUserIds.has(p.userId) ||
        allowedUsernames.has(pUsername);

      if (!isAllowed) return;

      const isVideo = p.mediaType === 'video';
      friendPostReels.push({
        id: `post-reel-${p.id}`,
        postId: p.id,
        userId: p.userId,
        username: p.username || 'friend',
        displayName: p.displayName || p.username || 'Friend',
        userAvatar: p.avatarUrl || null,
        createdAt: p.createdAt,
        expiresAt: new Date(createdTime + REEL_EXPIRY_MS).toISOString(),
        type: isVideo ? 'video' : 'image',
        caption: p.content || '',
        likes: p.likeCount || 0,
        likedByMe: !!p.likedByMe,
        items: [
          {
            id: `post-reel-item-${p.id}`,
            url: p.mediaUrl,
            type: isVideo ? 'video' : 'image',
            duration: isVideo ? 15 : 5,
            caption: p.content || '',
          },
        ],
      });
    });
  }

  // Combine user-created reels and friend post reels
  const combined = [...filteredUserReels, ...friendPostReels];

  // Deduplicate by reel ID
  const uniqueMap = new Map();
  combined.forEach((r) => {
    if (!uniqueMap.has(r.id)) {
      uniqueMap.set(r.id, r);
    }
  });

  // Sort newest first
  return Array.from(uniqueMap.values()).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Retrieve active reels from localStorage, purging any fake/mock posts.
 */
export function getActiveReels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Strictly purge fake reels and expired reels
    const active = parsed.filter((r) => !isFakeReel(r) && isReelActive(r));

    // If fake or expired reels were present, clean up localStorage
    if (active.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
    }

    return active;
  } catch {
    return [];
  }
}

/**
 * Save a new user reel / status to localStorage.
 */
export function saveNewReel(newReel) {
  if (!newReel || isFakeReel(newReel)) return getActiveReels();
  try {
    const current = getActiveReels();
    const updated = [newReel, ...current.filter((r) => r.id !== newReel.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save reel:', err);
    return [];
  }
}

/**
 * Toggle like on a reel.
 */
export function toggleLikeReel(reelId) {
  try {
    const current = getActiveReels();
    const updated = current.map((r) => {
      if (r.id === reelId) {
        const liked = !r.likedByMe;
        return {
          ...r,
          likedByMe: liked,
          likes: liked ? r.likes + 1 : Math.max(0, r.likes - 1),
        };
      }
      return r;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}
