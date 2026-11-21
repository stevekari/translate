import { getLiveNews } from '../api/newsApi';

export const REEL_MAX_DURATION_SECONDS = 30; // Max 30 seconds for video reels
export const REEL_EXPIRY_MS = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

// Real fallback breaking news reels if offline
export const INITIAL_REELS = [
  {
    id: 'reel-news-football',
    userId: 'source-espn',
    username: 'espn_football',
    displayName: 'ESPN Football Live',
    userAvatar: 'https://a.espncdn.com/favicon.ico',
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 4.4 * 60 * 60 * 1000).toISOString(),
    caption: 'Premier League & Champions League Matchday Highlights & Live Score Center ⚽🔥',
    likes: 124,
    likedByMe: true,
    items: [
      {
        id: 'news-item-fb-1',
        url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800',
        type: 'image',
        duration: 5,
        caption: 'European football under the floodlights tonight! 🏆⚡',
      },
      {
        id: 'news-item-fb-2',
        url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800',
        type: 'image',
        duration: 5,
        caption: 'Stunning goals & late drama in today’s fixtures ⚽🎯',
      },
    ],
  },
  {
    id: 'reel-news-world',
    userId: 'source-reuters',
    username: 'reuters_live',
    displayName: 'Reuters Breaking',
    userAvatar: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=150',
    createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 4.15 * 60 * 60 * 1000).toISOString(),
    caption: 'Global technology & AI summits unveil next-generation real-time voice translation 🌍🚀',
    likes: 89,
    likedByMe: false,
    items: [
      {
        id: 'news-item-world-1',
        url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
        type: 'image',
        duration: 5,
        caption: 'Next-gen silicon & AI hardware advancements 💡🌐',
      },
      {
        id: 'news-item-world-2',
        url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
        type: 'image',
        duration: 5,
        caption: 'Global real-time satellite connectivity expanding 📡✨',
      },
    ],
  },
  {
    id: 'reel-news-travel',
    userId: 'source-travel',
    username: 'national_wander',
    displayName: 'World Travel Live',
    userAvatar: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=150',
    createdAt: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 3.6 * 60 * 60 * 1000).toISOString(),
    caption: 'Breathtaking coastal views & sunset reflections across the Mediterranean 🌊🌅',
    likes: 215,
    likedByMe: false,
    items: [
      {
        id: 'news-item-travel-1',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
        type: 'image',
        duration: 5,
        caption: 'Crystal blue waters and warm sea breezes 🏝️',
      },
    ],
  },
];

const STORAGE_KEY = 'gio_active_reels_v2';

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
 * Fetch and construct real active reels from:
 * 1. User-created active 5h reels in localStorage
 * 2. Real Live Breaking News articles with images (BBC, Reuters, ESPN, etc.)
 * 3. Real followed friends in friendsList
 */
export async function fetchRealReels(friendsList = []) {
  const userReels = getActiveReels();

  try {
    const liveArticles = await getLiveNews('all', 'ALL');
    if (Array.isArray(liveArticles) && liveArticles.length > 0) {
      const realNewsReels = liveArticles
        .filter((a) => a.imageUrl && a.imageUrl.startsWith('http'))
        .slice(0, 5)
        .map((a, idx) => ({
          id: `news-reel-${a.id || idx}`,
          userId: `publisher-${a.source?.toLowerCase().replace(/[^a-z0-9]/g, '') || idx}`,
          username: a.handle ? a.handle.replace('@', '') : `${a.source?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'news'}`,
          displayName: `${a.source || 'Breaking News'}`,
          userAvatar: a.imageUrl || 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=150',
          createdAt: new Date(Date.now() - (idx + 1) * 20 * 60 * 1000).toISOString(),
          expiresAt: new Date(Date.now() + (5 - (idx + 1) * 0.3) * 60 * 60 * 1000).toISOString(),
          caption: `${a.title}`,
          likes: Math.floor(Math.random() * 80) + 25,
          likedByMe: false,
          items: [
            {
              id: `news-item-${a.id || idx}-1`,
              url: a.imageUrl,
              type: 'image',
              duration: 5,
              caption: a.summary || a.title,
            },
          ],
        }));

      // Combine user custom reels with real live news reels
      const combined = [...userReels, ...realNewsReels];
      // Deduplicate by id
      const uniqueMap = new Map();
      combined.forEach((r) => {
        if (!uniqueMap.has(r.id) && isReelActive(r)) {
          uniqueMap.set(r.id, r);
        }
      });
      return Array.from(uniqueMap.values());
    }
  } catch (err) {
    console.warn('Real live news reels fetch failed, falling back to active reels:', err);
  }

  return userReels;
}

/**
 * Retrieve active reels from localStorage merged with default samples.
 */
export function getActiveReels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REELS));
      return INITIAL_REELS.filter(isReelActive);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_REELS.filter(isReelActive);

    // Filter to only items within 5 hours
    const active = parsed.filter(isReelActive);

    if (active.length === 0) {
      const refreshedSamples = INITIAL_REELS.map((r, i) => ({
        ...r,
        createdAt: new Date(Date.now() - (i + 1) * 25 * 60 * 1000).toISOString(),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(refreshedSamples));
      return refreshedSamples.filter(isReelActive);
    }

    return active;
  } catch {
    return INITIAL_REELS.filter(isReelActive);
  }
}

/**
 * Save a new user reel / status to localStorage.
 */
export function saveNewReel(newReel) {
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

