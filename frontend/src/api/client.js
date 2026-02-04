const API_BASE = import.meta.env.VITE_API_URL || '';

// Get token from localStorage
function getToken() {
  return localStorage.getItem('token');
}

// Set token in localStorage
function setToken(token) {
  localStorage.setItem('token', token);
}

// Remove token from localStorage
function removeToken() {
  localStorage.removeItem('token');
}

// Get user from localStorage
function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

// Set user in localStorage
function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// Remove user from localStorage
function removeUser() {
  localStorage.removeItem('user');
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  // Auth
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getProfile: () => request('/api/auth/profile'),
  updateProfile: (body) => request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  verifyGiftcode: (data) => request('/api/auth/verify-giftcode', { method: 'POST', body: JSON.stringify(data) }),

  // Auth helpers
  getToken,
  setToken,
  removeToken,
  getUser,
  setUser,
  removeUser,
  isAuthenticated: () => !!getToken(),

  // Tests
  getTests: () => request('/api/tests'),
  getMyLatestTestAttempts: () => request('/api/tests/my-latest-attempts'),
  getMyAttemptSummary: () => request('/api/tests/my-attempts-summary'),
  getMyTestHistory: (id) => request(`/api/tests/${id}/attempts`),
  getTestById: (id) => request(`/api/tests/${id}`),
  getExam: (id) => request(`/api/tests/${id}/exam`),
  submitExam: (id, body) => request(`/api/tests/${id}/submit`, { method: 'POST', body: JSON.stringify(body) }),
  createTest: (body) => request('/api/tests', { method: 'POST', body: JSON.stringify(body) }),
  updateTest: (id, body) => request(`/api/tests/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTest: (id) => request(`/api/tests/${id}`, { method: 'DELETE' }),

  // Passages (Reading)
  getPassages: () => request('/api/passages'),
  getPassageById: (id) => request(`/api/passages/${id}`),
  createPassage: (body) => request('/api/passages', { method: 'POST', body: JSON.stringify(body) }),
  updatePassage: (id, body) => request(`/api/passages/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePassage: (id) => request(`/api/passages/${id}`, { method: 'DELETE' }),

  // Sections (Listening)
  getSections: () => request('/api/sections'),
  getSectionById: (id) => request(`/api/sections/${id}`),
  createSection: (body) => request('/api/sections', { method: 'POST', body: JSON.stringify(body) }),
  updateSection: (id, body) => request(`/api/sections/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSection: (id) => request(`/api/sections/${id}`, { method: 'DELETE' }),

  // Writing
  getWritings: () => request('/api/writings'),
  getWritingById: (id) => request(`/api/writings/${id}`),
  getWritingExam: (id) => request(`/api/writings/${id}/exam`),
  submitWriting: (id, body) => request(`/api/writings/${id}/submit`, { method: 'POST', body: JSON.stringify(body) }),
  createWriting: (body) => request('/api/writings', { method: 'POST', body: JSON.stringify(body) }),
  updateWriting: (id, body) => request(`/api/writings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteWriting: (id) => request(`/api/writings/${id}`, { method: 'DELETE' }),
  // Grading
  getPendingSubmissions: () => request('/api/writings/submissions/pending'),
  getSubmissionById: (id) => request(`/api/writings/submissions/${id}`),
  scoreSubmission: (id, body) => request(`/api/writings/submissions/${id}/score`, { method: 'POST', body: JSON.stringify(body) }),

  // Practice Flow
  getRandomQuestion: () => request('/api/practice/questions/random'),
  checkOutline: (body) => request('/api/practice/outline-check', { method: 'POST', body: JSON.stringify(body) }),
  getMaterials: (questionId) => request(`/api/practice/materials/${questionId}`),
  submitPracticeWriting: (body) => request('/api/practice/submit', { method: 'POST', body: JSON.stringify(body) }),
};
