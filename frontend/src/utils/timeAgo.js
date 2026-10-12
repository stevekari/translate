export function formatTimeAgo(dateInput) {
  if (!dateInput) return null;
  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;

  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `yesterday at ${timeStr}`;
  }

  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatLastSeenText(isOnline, lastSeenDate, customStatus) {
  if (isOnline) {
    if (customStatus === 'busy') return 'Busy (Do Not Disturb)';
    return 'Online';
  }
  const timeAgo = formatTimeAgo(lastSeenDate);
  if (!timeAgo) return 'Offline';
  return `Last seen ${timeAgo}`;
}

export function formatJoinedDate(dateInput) {
  if (!dateInput) return 'Joined recently';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Joined recently';
  const monthName = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `Joined ${monthName} ${year}`;
}

export function getUserActivitySummary(isOnline, lastSeen, customStatus) {
  if (isOnline) {
    return {
      statusText: 'Active now (Online)',
      badgeClass: 'online',
      isRecent: true,
      label: '🟢 Active now',
      color: '#10b981',
      warning: '⚠️ This user is currently ONLINE and using the app right now!'
    };
  }

  if (lastSeen) {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      const minText = diffMinutes <= 1 ? 'just now' : `${diffMinutes}m ago`;
      return {
        statusText: `Active ${minText}`,
        badgeClass: 'recent',
        isRecent: true,
        label: `🕒 Active ${minText}`,
        color: '#10b981',
        warning: `⚠️ This user was active ${minText}!`
      };
    }
    if (diffDays === 0) {
      return {
        statusText: `Active today (${diffHours}h ago)`,
        badgeClass: 'recent',
        isRecent: true,
        label: `🕒 Active ${diffHours}h ago`,
        color: '#10b981',
        warning: `⚠️ This user was active today (${diffHours} hours ago)!`
      };
    }
    if (diffDays <= 7) {
      return {
        statusText: `Active ${diffDays} day${diffDays > 1 ? 's' : ''} ago`,
        badgeClass: 'recent',
        isRecent: true,
        label: `🕒 Active ${diffDays}d ago`,
        color: '#f59e0b',
        warning: `⚠️ This user was active recently (${diffDays} day${diffDays > 1 ? 's' : ''} ago)!`
      };
    }
    return {
      statusText: `Inactive for ${diffDays} days`,
      badgeClass: 'inactive',
      isRecent: false,
      label: `⚪ Inactive (${diffDays}d ago)`,
      color: '#94a3b8',
      warning: `This user has been inactive for ${diffDays} days.`
    };
  }

  return {
    statusText: 'Never logged in / Inactive',
    badgeClass: 'inactive',
    isRecent: false,
    label: '⚪ Inactive',
    color: '#94a3b8',
    warning: 'This account has no recorded activity.'
  };
}


