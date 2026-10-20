// SUPERVISOR – khởi động toàn bộ hệ thống và TỰ KHỞI ĐỘNG LẠI tiến trình nào bị chết (tự hồi phục).
// Dùng:  node scripts/run-all.js            (chạy tất cả)
//        node scripts/run-all.js --only=registry,event-bus,student-service
require('../shared/env');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COMPONENTS = [
    ['registry', 'registry/server.js'],
    ['event-bus', 'event-bus/server.js'],
    ['auth-service', 'services/auth-service/index.js'],
    ['student-service', 'services/student-service/index.js'],
    ['topic-service', 'services/topic-service/index.js'],
    ['registration-service', 'services/registration-service/index.js'],
    ['notification-service', 'services/notification-service/index.js'],
    ['gateway', 'gateway/server.js']
];

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).split(',') : null;
const COLORS = ['\x1b[36m', '\x1b[32m', '\x1b[33m', '\x1b[35m', '\x1b[34m', '\x1b[91m', '\x1b[92m', '\x1b[93m'];
const children = new Map();
let stopping = false;

function pipeLines(stream, prefix, out) {
    let buf = '';
    stream.on('data', (d) => {
        buf += d.toString();
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        for (const l of lines) if (l.trim()) out.write(`${prefix} ${l}\n`);
    });
}

function launch(name, file, idx, attempt = 0) {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [path.join(ROOT, file)], { cwd: ROOT, env: process.env });
    children.set(name, child);
    const prefix = `${COLORS[idx % COLORS.length]}[${name}]\x1b[0m`;
    pipeLines(child.stdout, prefix, process.stdout);
    pipeLines(child.stderr, prefix, process.stderr);

    child.on('exit', (code, signal) => {
        if (stopping) return;
        const ranFor = Date.now() - startedAt;
        const nextAttempt = ranFor > 60000 ? 0 : attempt + 1;          // chạy ổn định > 1 phút thì reset backoff
        const delay = Math.min(30000, 1000 * 2 ** attempt);
        console.log(`${prefix} đã dừng (code=${code} signal=${signal}) -> khởi động lại sau ${delay / 1000}s`);
        setTimeout(() => !stopping && launch(name, file, idx, nextAttempt), delay);
    });
}

const list = COMPONENTS.filter(([n]) => !only || only.includes(n));
list.forEach(([name, file], idx) => setTimeout(() => launch(name, file, idx), idx * 400));

function stopAll() {
    if (stopping) return;
    stopping = true;
    console.log('\nĐang tắt toàn bộ hệ thống...');
    for (const c of children.values()) c.kill('SIGTERM');
    setTimeout(() => process.exit(0), 1500);
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
