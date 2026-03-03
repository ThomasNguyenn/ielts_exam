import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || ACCESS_TOKEN;

const authHeaders = ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {};
const adminHeaders = ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {};

export const options = {
  scenarios: {
    api_mix: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 40 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    checks: ['rate>0.98'],
  },
};

function getHealth() {
  const res = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } });
  check(res, { 'health status 200|503': (r) => r.status === 200 || r.status === 503 });
}

function getMyProfile() {
  if (!ACCESS_TOKEN) return;
  const res = http.get(`${BASE_URL}/api/auth/profile`, { headers: authHeaders, tags: { name: 'auth_profile' } });
  check(res, { 'profile status 200': (r) => r.status === 200 });
}

function getUsers() {
  if (!ADMIN_TOKEN) return;
  const res = http.get(`${BASE_URL}/api/admin/users?page=1&limit=20`, { headers: adminHeaders, tags: { name: 'admin_users' } });
  check(res, { 'admin/users status 200': (r) => r.status === 200 });
}

function getOnlineStudents() {
  if (!ADMIN_TOKEN) return;
  const res = http.get(`${BASE_URL}/api/admin/students/online?page=1&limit=20`, { headers: adminHeaders, tags: { name: 'admin_students_online' } });
  check(res, { 'admin/students/online status 200': (r) => r.status === 200 });
}

export default function () {
  getHealth();
  if (__ITER % 2 === 0) getMyProfile();
  if (__ITER % 3 === 0) getUsers();
  if (__ITER % 4 === 0) getOnlineStudents();
  sleep(1);
}
