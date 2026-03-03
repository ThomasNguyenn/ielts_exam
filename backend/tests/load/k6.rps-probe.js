import http from 'k6/http';
import { check, sleep, fail } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://ielts-exam-65pjc.ondigitalocean.app';
const ORIGIN = __ENV.ORIGIN || 'https://ieltshub.online';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || ACCESS_TOKEN;
const STRICT_AUTH = String(__ENV.STRICT_AUTH || 'false').toLowerCase() === 'true';

const commonHeaders = { Origin: ORIGIN };
const authHeaders = ACCESS_TOKEN
  ? { ...commonHeaders, Authorization: `Bearer ${ACCESS_TOKEN}` }
  : commonHeaders;
const adminHeaders = ADMIN_TOKEN
  ? { ...commonHeaders, Authorization: `Bearer ${ADMIN_TOKEN}` }
  : commonHeaders;

export const options = {
  scenarios: {
    users_1000_probe: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { target: 200, duration: '1m' },
        { target: 500, duration: '1m' },
        { target: 750, duration: '1m' },
        { target: 1000, duration: '1m' },
        { target: 1000, duration: '1m' },
        { target: 0, duration: '1m' },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<1200', 'p(99)<2500'],
    checks: ['rate>0.97'],
  },
};

export function setup() {
  const missing = [];
  if (!ACCESS_TOKEN) missing.push('ACCESS_TOKEN');
  if (!ADMIN_TOKEN) missing.push('ADMIN_TOKEN');

  if (missing.length === 0) return;

  const message = `[k6.rps-probe] Missing ${missing.join(
    ', '
  )}. Auth/admin endpoints will be skipped. Pass -e STRICT_AUTH=true to fail fast.`;
  if (STRICT_AUTH) fail(message);
  console.warn(message);
}

function getHealth() {
  const res = http.get(`${BASE_URL}/api/health`, {
    headers: commonHeaders,
    tags: { name: 'health' },
  });
  check(res, {
    'health status is 200|503': (r) => r.status === 200 || r.status === 503,
  });
}

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
  const page = (__ITER % 50) + 1;
  const res = http.get(`${BASE_URL}/api/admin/users?page=${page}&limit=20&include_total=false`, {
    headers: adminHeaders,
    tags: { name: 'admin_users' },
  });
  check(res, {
    'admin users status is 200': (r) => r.status === 200,
  });
}

function getOnlineStudents() {
  if (!ADMIN_TOKEN) return;
  const page = (__ITER % 50) + 1;
  const res = http.get(`${BASE_URL}/api/admin/students/online?page=${page}&limit=20&include_total=false`, {
    headers: adminHeaders,
    tags: { name: 'admin_students_online' },
  });
  check(res, {
    'online students status is 200': (r) => r.status === 200,
  });
}

export default function () {
  getHealth();
  getMyProfile();
  getUsers();
  getOnlineStudents();
  sleep(1);
}
