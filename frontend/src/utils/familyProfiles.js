/**
 * Family Language Profiles Service
 * Enables assigning familial relationships, honorifics, and tone guidelines
 * to friends and family members.
 */

const STORAGE_KEY = 'giochat_family_profiles';

export const FAMILY_ROLES = [
  { id: 'grandmother', label: 'Grandmother', icon: 'fa-solid fa-person-cane', tone: 'Respectful / Formal' },
  { id: 'grandfather', label: 'Grandfather', icon: 'fa-solid fa-person-cane', tone: 'Respectful / Formal' },
  { id: 'mother', label: 'Mother', icon: 'fa-solid fa-person-dress', tone: 'Respectful / Loving' },
  { id: 'father', label: 'Father', icon: 'fa-solid fa-person', tone: 'Respectful / Warm' },
  { id: 'elder', label: 'Elder / Mentor', icon: 'fa-solid fa-award', tone: 'Formal / Honorific' },
  { id: 'child', label: 'Child / Kid', icon: 'fa-solid fa-child', tone: 'Simple / Encouraging' },
  { id: 'sibling', label: 'Brother / Sister', icon: 'fa-solid fa-user-group', tone: 'Casual / Friendly' },
  { id: 'partner', label: 'Partner / Spouse', icon: 'fa-solid fa-heart', tone: 'Affectionate' },
  { id: 'friend', label: 'Friend', icon: 'fa-solid fa-face-smile', tone: 'Standard' },
];

export function getFamilyProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function getFriendFamilyProfile(friendId) {
  if (!friendId) return null;
  const profiles = getFamilyProfiles();
  return profiles[String(friendId)] || null;
}

export function saveFriendFamilyProfile(friendId, profileData) {
  if (!friendId) return;
  const profiles = getFamilyProfiles();
  profiles[String(friendId)] = {
    ...profileData,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Failed to save family profile', e);
  }
  return profiles[String(friendId)];
}
