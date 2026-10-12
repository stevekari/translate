import api from './axios';

export function getAllUsers() {
  return api.get('/users/all').then((res) => res.data);
}

export function searchUsers(query) {
  return api.get('/users/search', { params: { query } }).then((res) => res.data);
}

export function getMe() {
  return api.get('/users/me').then((res) => res.data);
}

export function getUserProfile(userId) {
  return api.get(`/users/${userId}/profile`).then((res) => res.data);
}

export function getPresenceMap() {
  return api.get('/users/presence').then((res) => res.data);
}

export function updateProfile(payload) {
  return api.put('/users/me', payload).then((res) => res.data);
}

export function deleteAccount(payload) {
  let body = {};
  if (typeof payload === 'string') {
    if (payload.trim().toUpperCase() === 'DELETE' || payload.includes('@')) {
      body = { confirmation: payload };
    } else {
      body = { password: payload };
    }
  } else if (payload && typeof payload === 'object') {
    body = payload;
  }
  return api.delete('/users/me', { data: body }).then((res) => res.data);
}

export function deleteUser(userId) {
  return api
    .delete(`/users/${userId}`)
    .then((res) => res.data)
    .catch((err) => {
      // If 404, the user account is already removed/unexisting in backend DB
      if (err.response?.status === 404) {
        return { message: 'User already removed from server', deletedUserId: userId };
      }
      throw err;
    });
}

export function deleteUserByUsername(username) {
  return api
    .delete(`/users/by-username/${encodeURIComponent(username)}`)
    .then((res) => res.data)
    .catch((err) => {
      if (err.response?.status === 404) {
        return { message: 'User already removed from server', deletedUsername: username };
      }
      throw err;
    });
}

export function cleanDuplicateUsers() {
  return api.post('/users/clean-duplicates').then((res) => res.data);
}

export function blockUser(userId) {
  return api.post(`/users/block/${userId}`).then((res) => res.data);
}

export function unblockUser(userId) {
  return api.post(`/users/unblock/${userId}`).then((res) => res.data);
}

export function getBlockedUsers() {
  return api.get('/users/blocked').then((res) => res.data);
}

export function checkIsBlocked(userId) {
  return api.get(`/users/is-blocked/${userId}`).then((res) => res.data);
}
