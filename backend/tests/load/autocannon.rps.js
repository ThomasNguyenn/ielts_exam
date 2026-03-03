import process from 'node:process';

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
};

const normalizeBaseUrl = (url) => String(url || '').replace(/\/+$/, '');

const toPath = (path) => {
  const raw = String(path || '/');
  if (raw.startsWith('/')) return raw;
  return `/${raw}`;
};

const requireEnv = (name, value) => {
  if (!String(value || '').trim()) {
    throw new Error(`${name} is required for this scenario`);
  }
  return String(value).trim();
};

const BASE_URL = normalizeBaseUrl(process.env.BASE_URL || 'https://ielts-exam-65pjc.ondigitalocean.app');
const ORIGIN = process.env.ORIGIN || 'https://ieltshub.online';
const SCENARIO = String(process.env.SCENARIO || 'health').trim().toLowerCase();
const CONNECTIONS = toPositiveInt(process.env.CONNECTIONS, 1000);
const DURATION_SEC = toPositiveInt(process.env.DURATION_SEC, 120);
const PIPLINING = toPositiveInt(process.env.PIPELINING, 1);
const TIMEOUT_SEC = toPositiveInt(process.env.TIMEOUT_SEC, 60);
const ACCESS_TOKEN = String(process.env.ACCESS_TOKEN || '').trim();
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || ACCESS_TOKEN).trim();

const commonHeaders = {
  Origin: ORIGIN,
};

const authHeaders = ACCESS_TOKEN
  ? { ...commonHeaders, Authorization: `Bearer ${ACCESS_TOKEN}` }
  : commonHeaders;

const adminHeaders = ADMIN_TOKEN
  ? { ...commonHeaders, Authorization: `Bearer ${ADMIN_TOKEN}` }
  : commonHeaders;

const buildRequests = () => {
  switch (SCENARIO) {
    case 'health':
      return [{ method: 'GET', path: '/api/health', headers: commonHeaders }];
    case 'profile':
      requireEnv('ACCESS_TOKEN', ACCESS_TOKEN);
      return [{ method: 'GET', path: '/api/auth/profile', headers: authHeaders }];
    case 'admin_users':
      requireEnv('ADMIN_TOKEN', ADMIN_TOKEN);
      return [{ method: 'GET', path: '/api/admin/users?page=1&limit=20', headers: adminHeaders }];
    case 'online_students':
      requireEnv('ADMIN_TOKEN', ADMIN_TOKEN);
      return [{ method: 'GET', path: '/api/admin/students/online?page=1&limit=20', headers: adminHeaders }];
    case 'mixed':
      requireEnv('ACCESS_TOKEN', ACCESS_TOKEN);
      requireEnv('ADMIN_TOKEN', ADMIN_TOKEN);
      return [
        { method: 'GET', path: '/api/health', headers: commonHeaders },
        { method: 'GET', path: '/api/auth/profile', headers: authHeaders },
        { method: 'GET', path: '/api/admin/users?page=1&limit=20', headers: adminHeaders },
        { method: 'GET', path: '/api/admin/students/online?page=1&limit=20', headers: adminHeaders },
      ];
    case 'custom': {
      const customPath = toPath(requireEnv('TARGET_PATH', process.env.TARGET_PATH));
      const method = String(process.env.METHOD || 'GET').trim().toUpperCase();
      const useAdmin = String(process.env.USE_ADMIN_TOKEN || 'false').trim().toLowerCase() === 'true';
      const headers = useAdmin ? adminHeaders : authHeaders;
      return [{ method, path: customPath, headers }];
    }
    default:
      throw new Error(
        `Unsupported SCENARIO="${SCENARIO}". Use one of: health, profile, admin_users, online_students, mixed, custom.`
      );
  }
};

const run = async () => {
  let autocannon;
  try {
    ({ default: autocannon } = await import('autocannon'));
  } catch {
    console.error('[autocannon] Missing dependency "autocannon".');
    console.error('Install with: npm i -D autocannon');
    process.exit(1);
  }

  const requests = buildRequests();
  const benchmarkOptions = {
    url: BASE_URL,
    connections: CONNECTIONS,
    duration: DURATION_SEC,
    pipelining: PIPLINING,
    timeout: TIMEOUT_SEC,
    requests,
  };

  console.log('[autocannon] Starting benchmark with options:');
  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        scenario: SCENARIO,
        connections: CONNECTIONS,
        durationSec: DURATION_SEC,
        pipelining: PIPLINING,
        timeoutSec: TIMEOUT_SEC,
        requestCountInScenario: requests.length,
      },
      null,
      2
    )
  );

  const result = await new Promise((resolve, reject) => {
    const instance = autocannon(benchmarkOptions, (error, summary) => {
      if (error) return reject(error);
      return resolve(summary);
    });

    autocannon.track(instance, {
      renderProgressBar: true,
      renderLatencyTable: true,
      renderResultsTable: true,
    });
  });

  const totalRequests = Number(result?.requests?.total || 0);
  const success2xx = Number(result?.['2xx'] || 0);
  const successRate = totalRequests > 0 ? (success2xx / totalRequests) * 100 : 0;

  console.log('\n[autocannon] Summary');
  console.log(`req/s avg: ${Number(result?.requests?.average || 0).toFixed(2)}`);
  console.log(`req/s p99: ${Number(result?.requests?.p99 || 0).toFixed(2)}`);
  console.log(`latency avg(ms): ${Number(result?.latency?.average || 0).toFixed(2)}`);
  console.log(`latency p95(ms): ${Number(result?.latency?.p95 || 0).toFixed(2)}`);
  console.log(`latency p99(ms): ${Number(result?.latency?.p99 || 0).toFixed(2)}`);
  console.log(`2xx success rate: ${successRate.toFixed(2)}% (${success2xx}/${totalRequests})`);
  console.log(`errors/timeouts: ${Number(result?.errors || 0)}/${Number(result?.timeouts || 0)}`);
};

run().catch((error) => {
  console.error('[autocannon] Benchmark failed:', error?.message || error);
  process.exit(1);
});
