import api from './axios';

export const getPosts = async () => {
  return api.get('/api/posts').catch(() => api.get('/posts')).then((res) => res.data);
};

export const createPost = async (postData) => {
  return api.post('/api/posts', postData).catch(() => api.post('/posts', postData)).then((res) => res.data);
};

export const toggleLikePost = async (postId) => {
  return api.post(`/api/posts/${postId}/like`).catch(() => api.post(`/posts/${postId}/like`)).then((res) => res.data);
};

export const getPostComments = async (postId) => {
  return api.get(`/api/posts/${postId}/comments`).catch(() => api.get(`/posts/${postId}/comments`)).then((res) => res.data);
};

export const addPostComment = async (postId, content) => {
  return api.post(`/api/posts/${postId}/comments`, { content })
    .catch(() => api.post(`/posts/${postId}/comments`, { content }))
    .then((res) => res.data);
};

export const addComment = addPostComment;

export const deletePost = async (postId) => {
  return api.delete(`/api/posts/${postId}`).catch(() => api.delete(`/posts/${postId}`)).then((res) => res.data);
};
