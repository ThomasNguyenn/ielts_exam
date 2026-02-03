const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  // Tests
  getTests: () => request('/api/tests'),
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
};
