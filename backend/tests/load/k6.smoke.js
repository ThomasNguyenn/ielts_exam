import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    health_checks: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 30 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    checks: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const ORIGIN = __ENV.ORIGIN || 'https://localhost:3000';
const commonHeaders = { Origin: ORIGIN };

export default function () {
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    headers: commonHeaders,
    tags: { name: 'health' },
  });

  check(healthRes, {
    'GET /api/health status is 200|503': (r) => r.status === 200 || r.status === 503,
    'GET /api/health has json body': (r) => {
      try {
        return Boolean(r.json('status'));
      } catch {
        return false;
      }
    },
  });

  const dbHealthRes = http.get(`${BASE_URL}/api/health/db`, {
    headers: commonHeaders,
    tags: { name: 'health_db' },
  });

  check(dbHealthRes, {
    'GET /api/health/db status is 200|503': (r) => r.status === 200 || r.status === 503,
    'GET /api/health/db has db object': (r) => {
      try {
        return typeof r.json('db') === 'object';
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
