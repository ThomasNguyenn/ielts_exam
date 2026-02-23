const API_BASE = import.meta.env.VITE_API_URL || '';

// Get token from localStorage
function getToken() {
  const token = localStorage.getItem('token');
  if (!token || token === 'undefined' || token === 'null') return null;
  return token;
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
  if (!user || user === 'undefined' || user === 'null') return null;
  try {
    return JSON.parse(user);
  } catch {
    removeUser();
    return null;
  }
}

// Set user in localStorage
function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-user-updated', { detail: user }));
  }
}

// Remove user from localStorage
function removeUser() {
  localStorage.removeItem('user');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-user-updated', { detail: null }));
  }
}

function toQueryString(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return '';
  return new URLSearchParams(entries).toString();
}

function isTokenExpired(token) {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    if (!payload?.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function handleUnauthorized(path) {
  const publicAuthPaths = new Set([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/verify-giftcode',
    '/api/auth/verify-email',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
  ]);

  if (publicAuthPaths.has(path)) return;

  removeToken();
  removeUser();

  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/register') {
      window.location.href = '/login';
    }
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const token = getToken();

  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  // Remove keys with undefined values to allow browser defaults (e.g. for FormData)
  Object.keys(headers).forEach(key => headers[key] === undefined && delete headers[key]);

  const res = await fetch(url, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized(path);
    }

    const message =
      data?.error?.message ||
      data?.message ||
      `Request failed: ${res.status}`;

    throw new Error(message);
  }

  // Intercept achievements and XP events globally
  const achievements =
    data?.data?.achievements ||
    data?.data?.newlyUnlocked ||
    data?.achievements ||
    data?.newlyUnlocked ||
    [];
  const xpResult = data?.data?.xpResult || data?.xpResult || null;

  if ((Array.isArray(achievements) && achievements.length > 0) || xpResult) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('achievements-unlocked', {
        detail: {
          achievements,
          xpResult
        }
      }));
    }
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  verifyEmail: (token) => request('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, newPassword) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  getProfile: () => request('/api/auth/profile'),
  updateProfile: (body) => request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  validateInvitation: (token) => request(`/api/auth/invite/${token}`),

  // Auth helpers
  getToken,
  setToken,
  removeToken,
  getUser,
  setUser,
  removeUser,
  logout: () => {
    removeToken();
    removeUser();
  },
  isAuthenticated: () => {
    const token = getToken();
    if (!token) return false;
    if (isTokenExpired(token)) {
      removeToken();
      removeUser();
      return false;
    }
    return true;
  },

  // Tests
  getTests: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/tests${query ? `?${query}` : ''}`);
  },
  getTestCategories: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/tests/categories${query ? `?${query}` : ''}`);
  },
  getMyLatestTestAttempts: () => request('/api/tests/my-latest-attempts'),
  getMyAttemptSummary: () => request('/api/tests/my-attempts-summary'),
  getMyTestHistory: (id) => request(`/api/tests/${id}/attempts`),
  getTestById: (id) => request(`/api/tests/${id}`),
  getExam: (id) => request(`/api/tests/${id}/exam`),
  submitExam: (id, body) => request(`/api/tests/${id}/submit`, { method: 'POST', body: JSON.stringify(body) }),
  createTest: (body) => request('/api/tests', { method: 'POST', body: JSON.stringify(body) }),
  updateTest: (id, body) => request(`/api/tests/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTest: (id) => request(`/api/tests/${id}`, { method: 'DELETE' }),
  renumberTestQuestions: (id) => request(`/api/tests/${id}/renumber`, { method: 'POST' }),


  // Passages (Reading)
  getPassages: () => request('/api/passages'),
  getPassageById: (id) => request(`/api/passages/${id}`),
  createPassage: (body) => request('/api/passages', { method: 'POST', body: JSON.stringify(body) }),
  updatePassage: (id, body) => request(`/api/passages/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePassage: (id) => request(`/api/passages/${id}`, { method: 'DELETE' }),
  generatePassageQuestionInsights: (body) =>
    request('/api/passages/ai/question-insights', { method: 'POST', body: JSON.stringify(body) }),

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
  uploadImage: (formData) => request('/api/writings/upload-image', {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': undefined } // Let browser set boundary
  }),
  parseContent: (data) => request('/api/content-gen/parse', { method: 'POST', body: JSON.stringify(data) }),
  // Grading
  getSubmissions: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/writings/submissions${query ? `?${query}` : ''}`);
  },
  getSubmissionById: (id) => request(`/api/writings/submissions/${id}`),
  getSubmissionStatus: (id) => request(`/api/writings/submissions/${id}/status`),
  scoreSubmission: (id, body) => request(`/api/writings/submissions/${id}/score`, { method: 'POST', body: JSON.stringify(body) }),
  scoreSubmissionAI: (id) => request(`/api/writings/submissions/${id}/ai-score`, { method: 'POST' }),

  // Practice Flow
  getRandomQuestion: () => request('/api/practice/questions/random'),
  checkOutline: (body) => request('/api/practice/outline-check', { method: 'POST', body: JSON.stringify(body) }),
  getMaterials: (questionId) => request(`/api/practice/materials/${questionId}`),
  submitPracticeWriting: (body) => request('/api/practice/submit', { method: 'POST', body: JSON.stringify(body) }),

  // Study Plan
  createStudyPlan: (body) => request('/api/study-plan', { method: 'POST', body: JSON.stringify(body) }),
  updateStudyPlan: (body) => request('/api/study-plan', { method: 'PUT', body: JSON.stringify(body) }),
  getMyPlan: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/study-plan${query ? `?${query}` : ''}`);
  },
  getStudyHistory: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/study-plan/history${query ? `?${query}` : ''}`);
  },
  updateTaskStatus: (taskOrId, status) => {
    const isTaskObject = taskOrId && typeof taskOrId === 'object';
    const idValue = isTaskObject ? (taskOrId._id || taskOrId.taskKey || '') : taskOrId;
    const safeId = encodeURIComponent(String(idValue || ''));
    const body = isTaskObject
      ? {
        status,
        task: {
          _id: taskOrId._id,
          taskKey: taskOrId.taskKey,
          date: taskOrId.date,
          type: taskOrId.type,
          referenceId: taskOrId.referenceId,
          title: taskOrId.title,
          link: taskOrId.link,
        }
      }
      : { status };

    return request(`/api/study-plan/tasks/${safeId}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  // Vocabulary
  getVocabulary: (params) => request(`/api/vocabulary${params ? `?${new URLSearchParams(params)}` : ''}`),
  getDueVocabulary: () => request('/api/vocabulary/due'),
  getVocabularyStats: () => request('/api/vocabulary/stats'),
  addVocabulary: (body) => request('/api/vocabulary', { method: 'POST', body: JSON.stringify(body) }),
  updateVocabulary: (id, body) => request(`/api/vocabulary/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  reviewVocabulary: (id, difficulty) => request(`/api/vocabulary/${id}/review`, { method: 'PUT', body: JSON.stringify({ difficulty }) }),
  deleteVocabulary: (id) => request(`/api/vocabulary/${id}`, { method: 'DELETE' }),

  getAdminUsersScores: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/admin/scores${query ? `?${query}` : ''}`);
  },
  getAdminUserAttempts: (userId, params = {}) => {
    const query = toQueryString(params);
    return request(`/api/admin/users/${userId}/attempts${query ? `?${query}` : ''}`);
  },

  // Analytics
  getAnalyticsDashboard: () => request('/api/analytics/dashboard'),
  getAdminStudentAnalyticsDashboard: (studentId) => request(`/api/analytics/admin/${studentId}/dashboard`),
  getAnalyticsSkills: () => request('/api/analytics/skills'),
  getAnalyticsWeaknesses: () => request('/api/analytics/weaknesses'),
  getAnalyticsHistory: () => request('/api/analytics/history'),
  getAdminStudentAnalytics: (studentId) => request(`/api/analytics/admin/${studentId}`),

  // Leaderboard & Achievements
  getLeaderboard: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/leaderboard${query ? `?${query}` : ''}`);
  },
  getMyRank: () => request('/api/leaderboard/me'),
  getAchievementDefinitions: () => request('/api/achievements'),
  getMyAchievements: () => request('/api/achievements/me'),
  checkAchievements: () => request('/api/achievements/check', { method: 'POST' }),

  // Admin - Students
  getPendingStudents: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/admin/students/pending${query ? `?${query}` : ''}`);
  },
  approveStudent: (userId) => request(`/api/admin/students/${userId}/approve`, { method: 'PUT' }),

  // Admin - Users
  getUsers: (options = {}) => {
    const params = typeof options === 'string' ? { role: options } : (options || {});
    const query = toQueryString(params);
    return request(`/api/admin/users${query ? `?${query}` : ''}`);
  },
  deleteUser: (userId) => request(`/api/admin/users/${userId}`, { method: 'DELETE' }),
  changeUserRole: (userId, role) => request(`/api/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

  // Admin - Invitations
  sendInvitation: (data) => request('/api/admin/invitations', { method: 'POST', body: JSON.stringify(data) }),
  getInvitations: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/admin/invitations${query ? `?${query}` : ''}`);
  },

  // Speaking
  getSpeakings: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/speaking${query ? `?${query}` : ''}`);
  },
  getRandomSpeaking: async () => {
    const res = await request('/api/speaking/random');
    return res?.data || res;
  },
  getSpeakingById: async (id) => {
    const res = await request(`/api/speaking/${id}`);
    return res?.data || res;
  },
  getSpeakingSession: (sessionId) => request(`/api/speaking/sessions/${sessionId}`),
  preGeneratePart3SpeakingAudio: () =>
    request('/api/speaking/admin/pre-generate-part3-audio', {
      method: 'POST',
    }),
  runMockExaminerTurn: (sessionId, body = {}) =>
    request(`/api/speaking/sessions/${sessionId}/mock-examiner/turn`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createSpeaking: async (data) => {
    const res = await request('/api/speaking', { method: 'POST', body: JSON.stringify(data) });
    return res?.data || res;
  },
  updateSpeaking: async (id, data) => {
    const res = await request(`/api/speaking/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res?.data || res;
  },
  deleteSpeaking: (id) => request(`/api/speaking/${id}`, { method: 'DELETE' }),
  submitSpeaking: (body) => {
    // body should be FormData
    return request('/api/speaking/submit', {
      method: 'POST',
      body,
      headers: { 'Content-Type': undefined } // Let browser set boundary
    });
  },

  // Skill Modules (New Practice Flow)
  getSkillModules: () => request('/api/skills/modules'),
  getSkillModule: (id) => request(`/api/skills/modules/${id}`),
  completeSkillModule: (id) => request(`/api/skills/modules/${id}/complete`, { method: 'POST' }),
  submitSkillQuiz: (id, answers) => request(`/api/skills/modules/${id}/quiz`, { method: 'POST', body: JSON.stringify({ answers }) }),
  getManageSkillModules: (includeInactive = true) => request(`/api/skills/admin/modules?includeInactive=${includeInactive ? 'true' : 'false'}`),
  getManageSkillModuleById: (id) => request(`/api/skills/admin/modules/${id}`),
  createSkillModule: (body) => request('/api/skills/admin/modules', { method: 'POST', body: JSON.stringify(body) }),
  updateSkillModule: (id, body) => request(`/api/skills/admin/modules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSkillModule: (id) => request(`/api/skills/admin/modules/${id}`, { method: 'DELETE' }),
  reorderSkillModules: (moduleIds) => request('/api/skills/admin/modules/reorder', { method: 'POST', body: JSON.stringify({ moduleIds }) }),

  // Student Progress (New Practice Flow)
  getMyProgress: () => request('/api/progress/me'),
  getSkillBreakdown: () => request('/api/progress/skills'),
  updateSkillScores: (skillScores) => request('/api/progress/update-skills', { method: 'POST', body: JSON.stringify({ skillScores }) }),
  markModuleComplete: (moduleId, quizScore) => request('/api/progress/module-complete', { method: 'POST', body: JSON.stringify({ moduleId, quizScore }) }),
  getBadges: () => request('/api/progress/badges'),
  getStreak: () => request('/api/progress/streak'),

  // Model Essays (New Practice Flow)
  getModelEssays: (params = {}) => {
    const query = toQueryString(params);
    return request(`/api/model-essays${query ? `?${query}` : ''}`);
  },
  getModelEssay: (id) => request(`/api/model-essays/${id}`),
  submitEssayAnalysis: (id, taskType, answer) => request(`/api/model-essays/${id}/analyze`, { method: 'POST', body: JSON.stringify({ taskType, answer }) }),
};
