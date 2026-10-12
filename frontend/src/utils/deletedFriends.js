const STORAGE_KEY = 'tranchat_deleted_friends';

export function getDeletedFriendIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

export function markFriendAsDeleted(friendId, username = null) {
  try {
    const set = getDeletedFriendIds();
    if (friendId != null) set.add(String(friendId));
    if (username) set.add(`user:${username.trim().toLowerCase()}`);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch (err) {
    console.error('Failed to save deleted friend:', err);
  }
}

export function unmarkFriendDeleted(friendId, username = null) {
  try {
    const set = getDeletedFriendIds();
    let modified = false;
    if (friendId != null && set.has(String(friendId))) {
      set.delete(String(friendId));
      modified = true;
    }
    if (username && set.has(`user:${username.trim().toLowerCase()}`)) {
      set.delete(`user:${username.trim().toLowerCase()}`);
      modified = true;
    }
    if (modified) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    }
  } catch (err) {
    console.error('Failed to unmark deleted friend:', err);
  }
}

export function isFriendDeleted(friend) {
  if (!friend) return false;
  const set = getDeletedFriendIds();
  const id = friend.id || friend.userId || friend._id;
  if (id != null && set.has(String(id))) return true;
  if (friend.username && set.has(`user:${friend.username.trim().toLowerCase()}`)) return true;
  return false;
}

export function clearDeletedFriendsCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

