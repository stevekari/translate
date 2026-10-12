import { resolveBackendUrl } from './apiBaseUrl';

export function getFallbackAvatar(username) {
  const seed = encodeURIComponent(username || 'user');
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=1877f2&textColor=ffffff`;
}

export function resolveAvatarUrl(avatarUrl, username) {
  if (!avatarUrl || avatarUrl === 'null' || avatarUrl === 'undefined') {
    return getFallbackAvatar(username);
  }
  return resolveBackendUrl(avatarUrl);
}

export function handleAvatarError(e, username) {
  if (e && e.currentTarget) {
    e.currentTarget.onerror = null;
    e.currentTarget.src = getFallbackAvatar(username);
  }
}

