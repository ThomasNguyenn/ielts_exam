import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://ielts-exam-65pjc.ondigitalocean.app';
const ORIGIN = __ENV.ORIGIN || 'https://localhost:3000';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || ACCESS_TOKEN;

const commonHeaders = { Origin: ORIGIN };
const authHeaders = ACCESS_TOKEN
  ? { ...commonHeaders, Authorization: `Bearer ${ACCESS_TOKEN}` }
  : commonHeaders;
const adminHeaders = ADMIN_TOKEN
  ? { ...commonHeaders, Authorization: `Bearer ${ADMIN_TOKEN}` }
  : commonHeaders;

export const options = {
  scenarios: {
    rps_probe: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { target: 20, duration: '1m' },
        { target: 40, duration: '1m' },
        { target: 60, duration: '1m' },
        { target: 80, duration: '1m' },
        { target: 100, duration: '1m' },
        { target: 120, duration: '1m' },
        { target: 150, duration: '1m' },
        { target: 180, duration: '1m' },
        { target: 200, duration: '1m' },
      ],
      gracefulStop: '20s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<1200', 'p(99)<2500'],
    checks: ['rate>0.97'],
  },
};

function getMyProfile() {
  if (!ACCESS_TOKEN) return;
  const res = http.get(`${BASE_URL}/api/auth/profile`, {
    headers: authHeaders,
    tags: { name: 'auth_profile' },
  });
  check(res, {
    'profile status is 200': (r) => r.status === 200,
  });
}

function getUsers() {
  if (!ADMIN_TOKEN) return;
  const res = http.get(`${BASE_URL}/api/admin/users?page=1&limit=20`, {
    headers: adminHeaders,
    tags: { name: 'admin_users' },
  });
  check(res, {
    'admin users status is 200': (r) => r.status === 200,
  });
}

function getOnlineStudents() {
  if (!ADMIN_TOKEN) return;
  const res = http.get(`${BASE_URL}/api/admin/students/online?page=1&limit=20`, {
    headers: adminHeaders,
    tags: { name: 'admin_students_online' },
  });
  check(res, {
    'online students status is 200': (r) => r.status === 200,
  });
}

function getOnlineTests() {
  if (!ADMIN_TOKEN) return;
  const res = http.get(`${BASE_URL}/api/tests/test-1770654625105/exam`, {
    headers: adminHeaders,
    tags: { name: 'Do online test' },
  });
  check(res, {
    'Do online test status is 200': (r) => r.status === 200,
  });
}

export default function () {
  getMyProfile();
  getUsers();
  getOnlineStudents();
  getOnlineTests();
}
