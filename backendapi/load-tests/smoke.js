import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: [
    {
      name: 'auth-baseline',
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 2,
      maxVUs: 10,
      stages: [
        { duration: '30s', target: 2 },
        { duration: '30s', target: 5 },
        { duration: '30s', target: 0 },
      ],
    },
    {
      name: 'search-spike',
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 2,
      maxVUs: 20,
      stages: [
        { duration: '20s', target: 3 },
        { duration: '40s', target: 10 },
        { duration: '20s', target: 0 },
      ],
    },
    {
      name: 'booking-steady',
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 2,
      maxVUs: 10,
    },
  ],
  thresholds: {
    'http_req_duration{scenario:auth-baseline}': ['p(95)<500'],
    'http_req_duration{scenario:search-spike}': ['p(95)<700'],
    'http_req_duration{scenario:booking-steady}': ['p(95)<800'],
    'http_req_failed{scenario:auth-baseline}': ['rate<0.01'],
    'http_req_failed{scenario:search-spike}': ['rate<0.02'],
    'http_req_failed{scenario:booking-steady}': ['rate<0.01'],
  },
};

const BASE =
  __ENV.API_BASE_URL || 'http://localhost:3000/api/v1';

let authToken = '';
let bookingId = '';

export function setup() {
  const phone = '+919876543210';
  const otpRes = http.post(
    `${BASE}/auth/otp/request`,
    JSON.stringify({ phone }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(otpRes, { otpRequestOk: (r) => r.status === 201 || r.status === 200 });

  const loginRes = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ phone, otp: '123456', role: 'customer' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(loginRes, { loginOk: (r) => r.status === 200 });
  if (loginRes.status === 200) {
    const body = loginRes.json();
    authToken = body.accessToken || body.access_token || '';
  }
  return { authToken };
}

export default function (data: { authToken: string }) {
  if (!data.authToken) {
    sleep(1);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.authToken}`,
  };

  // Warm catalog
  const catRes = http.get(`${BASE}/services/categories`, { headers });
  check(catRes, { categoriesOk: (r) => r.status === 200 });

  // Nearby providers (geo query with bounded defaults)
  const searchRes = http.get(
    `${BASE}/services/nearby?lat=12.9716&lng=77.5946&radiusKm=5&page=1&limit=20`,
    { headers },
  );
  check(searchRes, { nearbyOk: (r) => r.status === 200 });

  // Create a booking
  const categoryId = catRes.status === 200 ? catRes.json()?.[0]?.id || '' : '';
  if (!categoryId) {
    sleep(1);
    return;
  }

  const providerRes = http.get(
    `${BASE}/services?categoryId=${categoryId}&page=1&limit=1`,
    { headers },
  );
  const providerId =
    providerRes.status === 200
      ? providerRes.json()?.providers?.[0]?.providerId ||
        providerRes.json()?.[0]?.providerId ||
        ''
      : '';

  const bookingRes = http.post(
    `${BASE}/bookings`,
    JSON.stringify({
      providerId,
      serviceCategoryId: categoryId,
      scheduledDate: new Date(Date.now() + 86400000).toISOString(),
      description: 'Load test booking',
      pricingModel: 'fixed',
      totalAmount: 500,
    }),
    { headers },
  );
  check(bookingRes, { bookingCreated: (r) => r.status === 201 || r.status === 200 });
  if (bookingRes.status < 300) {
    bookingId = bookingRes.json()?.id || bookingId;
  }

  sleep(1);
}

export function teardown(_data: { authToken: string }) {
  if (!bookingId || !authToken) return;
  const res = http.patch(
    `${BASE}/bookings/${bookingId}/status`,
    JSON.stringify({ status: 'cancelled' }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    },
  );
  check(res, { cancelOk: (r) => r.status === 200 });
}
