import { resolveBackendUrl } from './apiBaseUrl';

/**
 * Extracts 1-2 clean uppercase initials from a name or handle.
 * e.g. "Stephen Karikari" -> "SK", "Stephen" -> "ST", "@gio" -> "GI", "K" -> "K"
 */
export function getInitials(nameOrUsername) {
  if (!nameOrUsername || typeof nameOrUsername !== 'string') return 'U';
  const clean = nameOrUsername.replace(/^@+/, '').trim();
  if (!clean) return 'U';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, clean.length >= 2 ? 2 : 1).toUpperCase();
}

/**
 * Modern luxury gradient palette for avatars.
 */
const AVATAR_PALETTE = [
  ['#1877f2', '#0052cc'], // Facebook Blue
  ['#8b5cf6', '#6d28d9'], // Royal Violet
  ['#10b981', '#047857'], // Emerald
  ['#f59e0b', '#d97706'], // Amber Gold
  ['#ec4899', '#be185d'], // Pink Rose
  ['#06b6d4', '#0284c7'], // Cyan
  ['#6366f1', '#4338ca'], // Indigo
  ['#14b8a6', '#0f766e'], // Teal
  ['#f97316', '#c2410c'], // Coral Orange
  ['#3b82f6', '#1d4ed8'], // Electric Blue
];

/**
 * Generates a self-contained, 100% offline-resilient, vector SVG Data URL
 * with a perfectly round circle, deterministic vibrant gradient, subtle inner ring,
 * and bold centered initials.
 */
export function getInitialAvatarSvg(nameOrUsername, size = 128) {
  const initials = getInitials(nameOrUsername);
  
  // Deterministic string hash for consistent colors per user
  let hash = 0;
  const str = String(nameOrUsername || 'user');
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % AVATAR_PALETTE.length;
  const [startColor, endColor] = AVATAR_PALETTE[colorIndex];
  
  const fontSize = initials.length > 1 ? Math.round(size * 0.42) : Math.round(size * 0.50);
  const half = size / 2;
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs><linearGradient id="g_${colorIndex}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${startColor}"/><stop offset="100%" stop-color="${endColor}"/></linearGradient></defs><circle cx="${half}" cy="${half}" r="${half}" fill="url(#g_${colorIndex})"/><circle cx="${half}" cy="${half}" r="${half - 1}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/><text x="50%" y="50%" dy=".04em" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}px" letter-spacing="0.5px">${initials}</text></svg>`;
  
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates an offline-resilient circular initials avatar.
 */
export function getFallbackAvatar(username) {
  return getInitialAvatarSvg(username);
}

/**
 * Safely resolves avatar URL, falling back to well-rounded SVG initials if none exists.
 */
export function resolveAvatarUrl(avatarUrl, username) {
  if (!avatarUrl || avatarUrl === 'null' || avatarUrl === 'undefined' || (typeof avatarUrl === 'string' && avatarUrl.trim() === '')) {
    return getFallbackAvatar(username);
  }
  if (typeof avatarUrl === 'string' && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('blob:') || avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
    return avatarUrl;
  }
  return resolveBackendUrl(avatarUrl);
}

/**
 * Handles image load errors by swapping to an offline-resilient SVG initial circle.
 */
export function handleAvatarError(e, username) {
  if (e && e.currentTarget) {
    e.currentTarget.onerror = null;
    e.currentTarget.src = getFallbackAvatar(username);
  }
}
