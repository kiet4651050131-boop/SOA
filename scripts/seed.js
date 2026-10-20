// Nạp dữ liệu mẫu qua API Gateway (đi đúng đường của hệ thống: gateway -> dịch vụ -> DB riêng).
//   node scripts/seed.js            (hệ thống phải đang chạy: npm start)
// Chạy lại nhiều lần không sao: dữ liệu trùng (409) được bỏ qua.
require('../shared/env');
const BASE = process.env.GATEWAY_URL || `http://localhost:${process.env.GATEWAY_PORT || 3000}`;

async function call(method, path, body, token) {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
}

(async () => {
    const admin = process.env.ADMIN_USERNAME || 'admin';
    const login = await call('POST', '/api/auth/login', { TenDangNhap: admin, MatKhau: process.env.ADMIN_PASSWORD || 'admin123' });
    if (!login.json.token) { console.error('Không đăng nhập được tài khoản giảng viên (ADMIN_USERNAME trong .env):', login.json.message); process.exit(1); }
    const T = login.json.token;
    const put = async (label, method, path, body) => {
        const r = await call(method, path, body, T);
        console.log(`${r.status === 409 ? '=' : r.status < 300 ? '+' : '!'} ${label}${r.status >= 300 && r.status !== 409 ? ' -> ' + r.json.message : ''}`);
        return r;
    };

    const students = [
        ['SV001', 'Nguyễn Văn An', 'an.nv@example.edu.vn', 'DHKTPM20'], ['SV002', 'Trần Thị Bình', 'binh.tt@example.edu.vn', 'DHKTPM20'],
        ['SV003', 'Lê Minh Châu', 'chau.lm@example.edu.vn', 'DHKTPM20'], ['SV004', 'Phạm Quốc Dũng', 'dung.pq@example.edu.vn', 'DHHTTT20']
    ];
    for (const [MaSV, HoTen, Email, Lop] of students) await put(`Sinh viên ${MaSV}`, 'POST', '/api/students', { MaSV, HoTen, Email, Lop });

    const topics = [
        ['DT001', 'Xây dựng website bán hàng', 'Website thương mại điện tử', 'ThS. Hoàng Văn Em'],
        ['DT002', 'Hệ thống quản lý thư viện', 'Quản lý mượn trả sách', 'TS. Vũ Thị Phương'],
        ['DT003', 'Ứng dụng nhận diện khuôn mặt điểm danh', 'Thị giác máy tính', 'TS. Vũ Thị Phương']
    ];
    for (const [MaDT, TenDT, MoTa, GiangVienHuongDan] of topics) await put(`Đề tài ${MaDT}`, 'POST', '/api/topics', { MaDT, TenDT, MoTa, GiangVienHuongDan });

    // Thêm một tài khoản giảng viên thứ hai để demo
    await put('Tài khoản giảng viên gv01', 'POST', '/api/auth/register', { TenDangNhap: 'gv01', MatKhau: '123456', HoTen: 'Giảng viên Demo' });

    await put('Đăng ký SV001 - DT001 (đã duyệt)', 'POST', '/api/registrations', { MaSV: 'SV001', MaDT: 'DT001', TrangThai: 'Da duyet' });
    await put('Đăng ký SV002 - DT002 (chờ duyệt)', 'POST', '/api/registrations', { MaSV: 'SV002', MaDT: 'DT002' });

    console.log(`\nXong. Đăng nhập thử: ${admin}/${process.env.ADMIN_PASSWORD || 'admin123'} hoặc gv01/123456  ->  ${BASE}`);
})().catch((e) => { console.error('Seed lỗi:', e.message); process.exit(1); });
