// Chạy thêm một instance của dịch vụ trên cổng khác để demo cân bằng tải / failover.
//   node scripts/instance.js student-service 3012
const path = require('path');
const { spawn } = require('child_process');

const [name, port] = process.argv.slice(2);
if (!name || !port) {
    console.error('Cách dùng: node scripts/instance.js <tên-dịch-vụ> <cổng>\nVí dụ: node scripts/instance.js student-service 3012');
    process.exit(1);
}
const file = path.resolve(__dirname, '..', 'services', name, 'index.js');
const child = spawn(process.execPath, [file], { stdio: 'inherit', env: { ...process.env, PORT: port } });
child.on('exit', (code) => process.exit(code || 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
