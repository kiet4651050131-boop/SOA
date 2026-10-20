// Kiểm thử hạ tầng SOA bằng tiến trình thật: registry, event bus, gateway + dịch vụ giả.
// Chạy: node --test tests/
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const jwt = require('../shared/jwt');
const SECRET = 'test-secret';
const GW = 'http://localhost:4000';
const BUS = 'http://localhost:4600';
const REG = 'http://localhost:4500';

const env = {
    ...process.env, JWT_SECRET: SECRET,
    REGISTRY_URL: REG, EVENT_BUS_URL: BUS, REGISTRY_PORT: '4500', EVENT_BUS_PORT: '4600', GATEWAY_PORT: '4000',
    HEARTBEAT_MS: '500', REGISTRY_TTL_MS: '2000', REGISTRY_SWEEP_MS: '500', DISCOVERY_CACHE_MS: '300',
    BREAKER_OPEN_MS: '1500', BUS_RETRY_BASE_MS: '150',
    EVENT_BUS_DATA: path.join(os.tmpdir(), `bus-${process.pid}.json`)
};

const procs = {};
function start(key, file, extra = {}) {
    const p = spawn(process.execPath, [path.join(ROOT, file)], { env: { ...env, ...extra }, stdio: 'ignore' });
    procs[key] = p;
    return p;
}
const fake = (key, name, port, extra = {}) => start(key, 'tests/fake-service.js', { FAKE_NAME: name, PORT: String(port), ...extra });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = require('node:crypto').createHash('sha256').update('internal:' + SECRET).digest('hex');
const token = (VaiTro, name = 'u1') => jwt.sign({ MaTK: 1, TenDangNhap: name, VaiTro }, SECRET);
const api = (p, { method = 'GET', role, body, headers = {} } = {}) => fetch(GW + p, {
    method,
    headers: { 'content-type': 'application/json', ...(role ? { authorization: 'Bearer ' + token(role) } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
});
async function waitFor(fn, ms = 8000) {
    const end = Date.now() + ms;
    for (;;) {
        try { const v = await fn(); if (v) return v; } catch { /* thử lại */ }
        if (Date.now() > end) throw new Error('waitFor hết thời gian');
        await sleep(150);
    }
}
const instancesOf = async (name) => (await (await fetch(`${REG}/services/${name}`, { headers: { 'x-internal-key': KEY } })).json()).instances;

before(async () => {
    start('registry', 'registry/server.js');
    start('bus', 'event-bus/server.js');
    await waitFor(async () => (await fetch(REG + '/health')).ok && (await fetch(BUS + '/health')).ok);
    fake('s1', 'student-service', 4101);
    fake('s2', 'student-service', 4102);
    fake('t1', 'topic-service', 4103);
    fake('r1', 'registration-service', 4104);
    fake('a1', 'auth-service', 4105);
    fake('n1', 'notification-service', 4106, { FAIL_FIRST: '2', SUBSCRIBE: 'registration.*,user.registered' });
    start('gw', 'gateway/server.js');
    await waitFor(async () => (await fetch(GW + '/health')).ok);
    await waitFor(async () => (await instancesOf('student-service')).length === 2);
    await waitFor(async () => (await instancesOf('notification-service')).length === 1);
});

after(() => { for (const p of Object.values(procs)) p.kill('SIGKILL'); });

test('1. Dò tìm động: registry thấy 2 instance student-service', async () => {
    assert.equal((await instancesOf('student-service')).length, 2);
});

test('2. Chính sách: không token -> 401, token sai -> 401', async () => {
    assert.equal((await api('/api/students')).status, 401);
    assert.equal((await api('/api/students', { headers: { authorization: 'Bearer abc.def.ghi' } })).status, 401);
});

test('3. Chính sách RBAC: chỉ giảng viên truy cập được; vai trò khác bị 403', async () => {
    assert.equal((await api('/api/students', { role: 'sinhvien' })).status, 403);
    assert.equal((await api('/api/students', { method: 'POST', role: 'sinhvien', body: { a: 1 } })).status, 403);
    assert.equal((await api('/api/students', { role: 'giangvien' })).status, 200);
    assert.equal((await api('/api/students', { method: 'POST', role: 'giangvien', body: { a: 1 } })).status, 200);
    assert.equal((await api('/api/topics', { method: 'POST', role: 'giangvien', body: { a: 1 } })).status, 200);
});

test('4. Gateway chuyển thông tin người dùng xuống dịch vụ (x-user)', async () => {
    const j = await (await api('/api/students', { role: 'giangvien' })).json();
    assert.equal(j.user.VaiTro, 'giangvien');
});

test('5. Cân bằng tải: request được chia đều cho 2 instance', async () => {
    const seen = new Set();
    for (let i = 0; i < 8; i++) seen.add((await (await api('/api/students', { role: 'giangvien' })).json()).instance);
    assert.deepEqual([...seen].sort(), [4101, 4102]);
});

test('6. Tổng hợp dịch vụ: /api/dashboard gom dữ liệu 3 dịch vụ', async () => {
    const j = await (await api('/api/dashboard', { role: 'giangvien' })).json();
    assert.equal(j.data.students, 2);
    assert.equal(j.data.topics, 2);
    assert.equal(j.data.registrations, 3);
    assert.equal(j.data.registrationsByStatus['Cho duyet'], 2);
    assert.deepEqual(j.data.degraded, []);
});

test('7. Rate limit: login quá 10 lần/phút bị 429', async () => {
    const codes = [];
    for (let i = 0; i < 13; i++) codes.push((await api('/api/auth/login', { method: 'POST', body: { x: 1 } })).status);
    assert.equal(codes.filter((c) => c === 200).length, 10);
    assert.ok(codes.includes(429));
});

test('8. Bất đồng bộ + tự giao lại: sự kiện tới subscriber dù 2 lần đầu bị lỗi', async () => {
    const r = await fetch(BUS + '/publish', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-key': KEY },
        body: JSON.stringify({ id: 'evt-1', topic: 'registration.created', payload: { MaSV: 'SV1' }, source: 'test' })
    });
    assert.equal(r.status, 202);
    const got = await waitFor(async () => {
        const j = await (await fetch('http://localhost:4106/received', { headers: { 'x-internal-key': KEY } })).json();
        return j.received.find((e) => e.id === 'evt-1');
    }, 8000);
    assert.equal(got.payload.MaSV, 'SV1');
    const stats = await (await fetch(BUS + '/stats', { headers: { 'x-internal-key': KEY } })).json();
    assert.equal(stats.pending, 0);
    assert.equal(stats.deadLetters, 0);
});

test('9. Sự kiện trùng id bị bỏ qua (idempotent ở bus)', async () => {
    const r = await fetch(BUS + '/publish', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-key': KEY },
        body: JSON.stringify({ id: 'evt-1', topic: 'registration.created', payload: {} })
    });
    assert.equal((await r.json()).duplicate, true);
});

test('10. Tự hồi phục: chết 1 instance -> request vẫn thành công (failover)', async () => {
    procs.s1.kill('SIGKILL');
    await sleep(100);
    for (let i = 0; i < 6; i++) assert.equal((await api('/api/students', { role: 'giangvien' })).status, 200);
});

test('11. Chết hết instance -> 503 có thông báo rõ ràng; instance sống lại thì tự dùng được', async () => {
    procs.s2.kill('SIGKILL');
    await sleep(2500);
    const r = await api('/api/students', { role: 'giangvien' });
    assert.equal(r.status, 503);
    assert.equal((await r.json()).service, 'student-service');
    fake('s1', 'student-service', 4101);     // "supervisor" khởi động lại
    await waitFor(async () => (await api('/api/students', { role: 'giangvien' })).status === 200, 10000);
});

test('12. Registry restart: dịch vụ tự đăng ký lại', async () => {
    procs.registry.kill('SIGKILL');
    await sleep(300);
    start('registry', 'registry/server.js');
    await waitFor(async () => (await instancesOf('topic-service')).length === 1, 8000);
    assert.equal((await api('/api/topics', { role: 'giangvien' })).status, 200);
});

test('13. Tổng hợp tài liệu API từ các dịch vụ đang chạy', async () => {
    await waitFor(async () => Object.keys((await (await api('/api-docs.json')).json()).paths).length >= 4);
    const j = await (await api('/api-docs.json')).json();
    assert.ok(j.paths['/api/student-service']);
});
