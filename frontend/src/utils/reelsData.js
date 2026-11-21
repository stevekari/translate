// Utility for Instagram/Facebook-style 5-Hour Reels and Statuses

export const REEL_MAX_DURATION_SECONDS = 30; // Max 30 seconds for video reels
export const REEL_EXPIRY_MS = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

// Sample initial active reels with real photos and short clips
export const INITIAL_REELS = [
  {
    id: 'reel-community-1',
    userId: 'user-elena',
    username: 'elena_travel',
    displayName: 'Elena Rostova',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45m ago
    expiresAt: new Date(Date.now() + 4.25 * 60 * 60 * 1000).toISOString(),
    caption: 'Sunset in Florence 🇮🇹 Golden hour was unreal tonight!',
    likes: 42,
    likedByMe: false,
    items: [
      {
        id: 'item-1-1',
        url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800',
        type: 'image',
        duration: 5,
        caption: 'Ponte Vecchio at golden hour ✨',
      },
      {
        id: 'item-1-2',
        url: 'https://images.unsplash.com/photo-1543429776-2782fc8e1acd?w=800',
        type: 'image',
        duration: 5,
        caption: 'Gelato stop before catching the train 🍨',
      },
      {
        id: 'item-1-3',
        url: 'https://images.unsplash.com/photo-1520175480921-4edfa2983e0f?w=800',
        type: 'image',
        duration: 5,
        caption: 'Duomo from the rooftop view 🏛️',
      },
    ],
  },
  {
    id: 'reel-community-2',
    userId: 'user-marcus',
    username: 'marcus_football',
    displayName: 'Marcus Sterling',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 1.5h ago
    expiresAt: new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString(),
    caption: 'Matchday warmups! Incredible stadium energy ⚽🔥',
    likes: 88,
    likedByMe: true,
    items: [
      {
        id: 'item-2-1',
        url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800',
        type: 'image',
        duration: 5,
        caption: 'Under the lights tonight 🏟️⚡',
      },
      {
        id: 'item-2-2',
        url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800',
        type: 'image',
        duration: 5,
        caption: 'Focused on the 3 points! ⚽💪',
      },
    ],
  },
  {
    id: 'reel-community-3',
    userId: 'user-chloe',
    username: 'chloe_tech',
    displayName: 'Chloe Martin',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15m ago
    expiresAt: new Date(Date.now() + 4.75 * 60 * 60 * 1000).toISOString(),
    caption: 'Testing the new GioAI live speech translation on mobile 🎙️✨',
    likes: 29,
    likedByMe: false,
    items: [
      {
        id: 'item-3-1',
        url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800',
        type: 'image',
        duration: 5,
        caption: 'Coding session with GioAI assistant 💻🚀',
      },
      {
        id: 'item-3-2',
        url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800',
        type: 'image',
        duration: 5,
        caption: 'Instant language switches working smoothly! 🌍',
      },
    ],
  },
  {
    id: 'reel-community-4',
    userId: 'user-david',
    username: 'david_k',
    displayName: 'David Kwesi',
    userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // 2h ago
    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    caption: 'Accra beach vibes this afternoon 🌊🇬🇭',
    likes: 64,
    likedByMe: false,
    items: [
      {
        id: 'item-4-1',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
        type: 'image',
        duration: 5,
        caption: 'Ocean breeze & fresh coconuts 🥥🌊',
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
 * Retrieve active reels from localStorage merged with default samples.
 */
export function getActiveReels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed with sample reels
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REELS));
      return INITIAL_REELS.filter(isReelActive);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_REELS.filter(isReelActive);

    // Filter to only items within 5 hours
    const active = parsed.filter(isReelActive);

    // If all user items expired, keep fresh sample reels active
    if (active.length === 0) {
      const refreshedSamples = INITIAL_REELS.map((r, i) => ({
        ...r,
        createdAt: new Date(Date.now() - (i + 1) * 30 * 60 * 1000).toISOString(),
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
