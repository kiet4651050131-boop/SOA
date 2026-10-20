const API_BASE = '/api';

// =========================
// TIỆN ÍCH
// =========================

// Escape mọi dữ liệu đưa vào innerHTML (chống XSS). Id truyền cho onclick dùng data-id + this.dataset.id.
const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUSES = ['Cho duyet', 'Da duyet', 'Tu choi', 'Dang thuc hien', 'Hoan thanh', 'Da huy'];

function toast(message, isError = false) {
    let box = document.getElementById('toastBox');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toastBox';
        box.style.cssText = 'position:fixed;right:20px;top:20px;z-index:9999;display:flex;flex-direction:column;gap:8px';
        document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.textContent = message;
    t.style.cssText = `padding:10px 16px;border-radius:4px;color:#fff;font-size:14px;max-width:360px;box-shadow:0 2px 8px rgba(0,0,0,.2);background:${isError ? '#b54a4a' : '#3e806a'}`;
    box.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// =========================
// ĐĂNG NHẬP / JWT / PHÂN QUYỀN
// =========================

const getToken = () => localStorage.getItem('token');

function getUser() {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

const role = () => (getUser() || {}).VaiTro || '';
const isStaff = () => role() === 'giangvien';          // hệ thống chỉ có giảng viên
const canManageStudents = () => isStaff();
const canManageTopics = () => isStaff();
const canEditRegistration = () => isStaff();
const canDeleteRegistration = () => isStaff();

const ROLE_LABEL = { giangvien: 'Giảng viên' };

function updateAuthUI() {
    const loggedIn = !!(getToken() && getUser());
    const loginBox = document.getElementById('loginBox');
    const userBox = document.getElementById('userBox');
    if (!loginBox || !userBox) return;

    loginBox.style.display = loggedIn ? 'none' : 'flex';
    userBox.style.display = loggedIn ? 'flex' : 'none';
    const u = getUser();
    const roleLabel = loggedIn ? (ROLE_LABEL[u.VaiTro] || u.VaiTro) : '';
    const name = loggedIn ? (u.HoTen || u.TenDangNhap) : '';
    document.getElementById('welcomeUser').textContent =
        loggedIn ? `Xin chào, ${name}${name === roleLabel ? '' : ` (${roleLabel})`}` : '';

    // Ẩn/hiện chức năng theo vai trò
    const show = (sel, on) => { const el = document.querySelector(sel); if (el) el.style.display = on ? '' : 'none'; };
    show('#students .add-btn', canManageStudents());
    show('#topics .add-btn', canManageTopics());
    show('#registrations .add-btn', loggedIn);
    show('#navSystem', isStaff());
}

function saveSession(result) {
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
}

function clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

async function login() {
    const TenDangNhap = document.getElementById('loginUsername').value.trim();
    const MatKhau = document.getElementById('loginPassword').value;
    if (!TenDangNhap || !MatKhau) return toast('Vui lòng nhập tên đăng nhập và mật khẩu', true);

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ TenDangNhap, MatKhau })
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) return toast(result.message || 'Đăng nhập thất bại', true);

        saveSession(result);
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        updateAuthUI();
        toast('Đăng nhập thành công');
    } catch (e) {
        console.error(e);
        toast('Không thể kết nối đến máy chủ', true);
    }
}

function logout() {
    clearSession();
    updateAuthUI();
    showSection('home');
    toast('Đã đăng xuất');
}

async function authFetch(url, options = {}) {
    const token = getToken();
    if (!token) {
        toast('Vui lòng đăng nhập trước', true);
        showSection('home');
        return null;
    }
    options.headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
    const response = await fetch(url, options);
    if (response.status === 401) {
        clearSession();
        updateAuthUI();
        toast('Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại', true);
        showSection('home');
        return null;
    }
    return response;
}

// Gọi API có JSON; trả về { ok, data, message } hoặc null nếu chưa đăng nhập
async function api(method, path, body) {
    const opts = { method };
    if (body !== undefined) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
    }
    const res = await authFetch(`${API_BASE}${path}`, opts);
    if (!res) return null;
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: json.data, message: json.message };
}

// Thực hiện thao tác ghi, báo kết quả bằng toast, trả về true nếu thành công
async function mutate(method, path, body, okMessage, failMessage) {
    try {
        const r = await api(method, path, body);
        if (!r) return false;
        if (!r.ok) { toast(r.message || failMessage, true); return false; }
        toast(okMessage);
        return true;
    } catch (e) {
        console.error(e);
        toast('Có lỗi xảy ra', true);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', updateAuthUI);

// =========================
// CHUYỂN TRANG
// =========================

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');

    if (sectionId === 'students') loadStudents();
    if (sectionId === 'topics') loadTopics();
    if (sectionId === 'registrations') loadRegistrations();
}

const emptyRow = (cols, text) => `<tr><td colspan="${cols}">${text}</td></tr>`;

// =========================
// SINH VIÊN
// =========================

async function loadStudents() {
    const tbody = document.getElementById('studentTableBody');
    try {
        const r = await api('GET', '/students');
        if (!r) return;
        if (!r.ok) { tbody.innerHTML = emptyRow(5, esc(r.message || 'Không tải được dữ liệu')); return; }
        if (!r.data || !r.data.length) { tbody.innerHTML = emptyRow(5, 'Chưa có dữ liệu sinh viên'); return; }
        const manage = canManageStudents();
        tbody.innerHTML = r.data.map((s) => `
            <tr>
                <td>${esc(s.MaSV)}</td><td>${esc(s.HoTen)}</td><td>${esc(s.Email)}</td><td>${esc(s.Lop)}</td>
                <td>${manage ? `
                    <button class="btn-edit" data-id="${esc(s.MaSV)}" onclick="editStudent(this.dataset.id)">Sửa</button>
                    <button class="btn-delete" data-id="${esc(s.MaSV)}" onclick="deleteStudent(this.dataset.id)">Xóa</button>` : ''}
                </td>
            </tr>`).join('');
    } catch (e) {
        console.error(e);
        toast('Không thể tải danh sách sinh viên', true);
    }
}

function showStudentForm(student = null) {
    const edit = student !== null;
    document.getElementById('studentForm').innerHTML = `
        <div class="form-container">
            <h3>${edit ? 'Sửa sinh viên' : 'Thêm sinh viên'}</h3>
            <div class="form-group"><label>Mã sinh viên</label>
                <input type="text" id="studentMaSV" value="${esc(student && student.MaSV)}" ${edit ? 'readonly' : ''}></div>
            <div class="form-group"><label>Họ tên</label>
                <input type="text" id="studentHoTen" value="${esc(student && student.HoTen)}"></div>
            <div class="form-group"><label>Email</label>
                <input type="email" id="studentEmail" value="${esc(student && student.Email)}"></div>
            <div class="form-group"><label>Lớp</label>
                <input type="text" id="studentLop" value="${esc(student && student.Lop)}"></div>
            <div class="form-buttons">
                <button class="btn-save" ${edit ? `data-id="${esc(student.MaSV)}" onclick="updateStudent(this.dataset.id)"` : 'onclick="createStudent()"'}>${edit ? 'Cập nhật' : 'Thêm'}</button>
                <button class="btn-cancel" onclick="closeStudentForm()">Hủy</button>
            </div>
        </div>`;
}

const field = (id) => document.getElementById(id).value.trim();

async function createStudent() {
    const body = { MaSV: field('studentMaSV'), HoTen: field('studentHoTen'), Email: field('studentEmail'), Lop: field('studentLop') };
    if (!body.MaSV || !body.HoTen) return toast('Vui lòng nhập Mã sinh viên và Họ tên', true);
    if (await mutate('POST', '/students', body, 'Thêm sinh viên thành công', 'Thêm sinh viên thất bại')) {
        closeStudentForm(); loadStudents();
    }
}

async function editStudent(id) {
    const r = await api('GET', `/students/${encodeURIComponent(id)}`);
    if (!r) return;
    if (!r.ok) return toast(r.message || 'Không tìm thấy sinh viên', true);
    showStudentForm(r.data);
}

async function updateStudent(id) {
    const body = { HoTen: field('studentHoTen'), Email: field('studentEmail'), Lop: field('studentLop') };
    if (!body.HoTen) return toast('Vui lòng nhập Họ tên', true);
    if (await mutate('PUT', `/students/${encodeURIComponent(id)}`, body, 'Cập nhật sinh viên thành công', 'Cập nhật thất bại')) {
        closeStudentForm(); loadStudents();
    }
}

async function deleteStudent(id) {
    if (!confirm(`Bạn có chắc muốn xóa sinh viên ${id}? Các đăng ký của sinh viên này sẽ bị hủy.`)) return;
    if (await mutate('DELETE', `/students/${encodeURIComponent(id)}`, undefined, 'Xóa sinh viên thành công', 'Xóa thất bại')) loadStudents();
}

function closeStudentForm() { document.getElementById('studentForm').innerHTML = ''; }

// =========================
// ĐỀ TÀI
// =========================

async function loadTopics() {
    const tbody = document.getElementById('topicTableBody');
    try {
        const r = await api('GET', '/topics');
        if (!r) return;
        if (!r.ok) { tbody.innerHTML = emptyRow(5, esc(r.message || 'Không tải được dữ liệu')); return; }
        if (!r.data || !r.data.length) { tbody.innerHTML = emptyRow(5, 'Chưa có dữ liệu đề tài'); return; }
        const manage = canManageTopics();
        tbody.innerHTML = r.data.map((t) => `
            <tr>
                <td>${esc(t.MaDT)}</td><td>${esc(t.TenDT)}</td><td>${esc(t.MoTa)}</td><td>${esc(t.GiangVienHuongDan)}</td>
                <td>${manage ? `
                    <button class="btn-edit" data-id="${esc(t.MaDT)}" onclick="editTopic(this.dataset.id)">Sửa</button>
                    <button class="btn-delete" data-id="${esc(t.MaDT)}" onclick="deleteTopic(this.dataset.id)">Xóa</button>` : ''}
                </td>
            </tr>`).join('');
    } catch (e) {
        console.error(e);
        toast('Không thể tải danh sách đề tài', true);
    }
}

function showTopicForm(topic = null) {
    const edit = topic !== null;
    document.getElementById('topicForm').innerHTML = `
        <div class="form-container">
            <h3>${edit ? 'Sửa đề tài' : 'Thêm đề tài'}</h3>
            <div class="form-group"><label>Mã đề tài</label>
                <input type="text" id="topicMaDT" value="${esc(topic && topic.MaDT)}" ${edit ? 'readonly' : ''}></div>
            <div class="form-group"><label>Tên đề tài</label>
                <input type="text" id="topicTenDT" value="${esc(topic && topic.TenDT)}"></div>
            <div class="form-group"><label>Mô tả</label>
                <input type="text" id="topicMoTa" value="${esc(topic && topic.MoTa)}"></div>
            <div class="form-group"><label>Giảng viên hướng dẫn</label>
                <input type="text" id="topicGiangVien" value="${esc(topic && topic.GiangVienHuongDan)}"></div>
            <div class="form-buttons">
                <button class="btn-save" ${edit ? `data-id="${esc(topic.MaDT)}" onclick="updateTopic(this.dataset.id)"` : 'onclick="createTopic()"'}>${edit ? 'Cập nhật' : 'Thêm'}</button>
                <button class="btn-cancel" onclick="closeTopicForm()">Hủy</button>
            </div>
        </div>`;
}

async function createTopic() {
    const body = { MaDT: field('topicMaDT'), TenDT: field('topicTenDT'), MoTa: field('topicMoTa'), GiangVienHuongDan: field('topicGiangVien') };
    if (!body.MaDT || !body.TenDT) return toast('Vui lòng nhập Mã đề tài và Tên đề tài', true);
    if (await mutate('POST', '/topics', body, 'Thêm đề tài thành công', 'Thêm đề tài thất bại')) {
        closeTopicForm(); loadTopics();
    }
}

async function editTopic(id) {
    const r = await api('GET', `/topics/${encodeURIComponent(id)}`);
    if (!r) return;
    if (!r.ok) return toast(r.message || 'Không tìm thấy đề tài', true);
    showTopicForm(r.data);
}

async function updateTopic(id) {
    const body = { TenDT: field('topicTenDT'), MoTa: field('topicMoTa'), GiangVienHuongDan: field('topicGiangVien') };
    if (!body.TenDT) return toast('Vui lòng nhập Tên đề tài', true);
    if (await mutate('PUT', `/topics/${encodeURIComponent(id)}`, body, 'Cập nhật đề tài thành công', 'Cập nhật thất bại')) {
        closeTopicForm(); loadTopics();
    }
}

async function deleteTopic(id) {
    if (!confirm(`Bạn có chắc muốn xóa đề tài ${id}? Các đăng ký đề tài này sẽ bị hủy.`)) return;
    if (await mutate('DELETE', `/topics/${encodeURIComponent(id)}`, undefined, 'Xóa đề tài thành công', 'Xóa thất bại')) loadTopics();
}

function closeTopicForm() { document.getElementById('topicForm').innerHTML = ''; }

// =========================
// ĐĂNG KÝ
// =========================

async function loadRegistrations() {
    const tbody = document.getElementById('registrationTableBody');
    try {
        const r = await api('GET', '/registrations');
        if (!r) return;
        if (!r.ok) { tbody.innerHTML = emptyRow(9, esc(r.message || 'Không tải được dữ liệu')); return; }
        if (!r.data || !r.data.length) { tbody.innerHTML = emptyRow(9, 'Chưa có dữ liệu đăng ký'); return; }
        tbody.innerHTML = r.data.map((x) => `
            <tr>
                <td>${Number(x.MaDK)}</td><td>${esc(x.MaSV)}</td><td>${esc(x.HoTen)}</td>
                <td>${esc(x.MaDT)}</td><td>${esc(x.TenDT)}</td>
                <td>${esc(formatDateDisplay(x.NgayDangKy))}</td><td>${esc(x.TrangThai)}</td>
                <td>${x.Diem !== null && x.Diem !== undefined ? esc(x.Diem) : '-'}</td>
                <td>
                    ${canEditRegistration() ? `<button class="btn-edit" data-id="${Number(x.MaDK)}" onclick="editRegistration(this.dataset.id)">Sửa</button>` : ''}
                    ${canDeleteRegistration() ? `<button class="btn-delete" data-id="${Number(x.MaDK)}" onclick="deleteRegistration(this.dataset.id)">Xóa</button>` : ''}
                </td>
            </tr>`).join('');
    } catch (e) {
        console.error(e);
        toast('Không thể tải danh sách đăng ký', true);
    }
}

async function showRegistrationForm(registration = null) {
    const edit = registration !== null;
    const me = getUser() || {};
    const student = role() === 'sinhvien';   // sinh viên chỉ đăng ký cho chính mình, không đặt trạng thái/điểm
    try {
        const [s, t] = await Promise.all([api('GET', '/students'), api('GET', '/topics')]);
        if (!s || !t) return;
        let students = s.data || [];
        const topics = t.data || [];
        if (student) students = students.filter((x) => x.MaSV === me.TenDangNhap);

        const opt = (value, label, selected) => `<option value="${esc(value)}" ${selected ? 'selected' : ''}>${esc(label)}</option>`;
        const studentOptions = students.map((x) => opt(x.MaSV, `${x.MaSV} - ${x.HoTen}`, registration ? registration.MaSV === x.MaSV : student)).join('');
        const topicOptions = topics.map((x) => opt(x.MaDT, `${x.MaDT} - ${x.TenDT}`, registration && registration.MaDT === x.MaDT)).join('');
        const current = registration && registration.TrangThai;
        const statusList = current && !STATUSES.includes(current) ? [current, ...STATUSES] : STATUSES;
        const statusOptions = statusList.map((x) => opt(x, x, (current || 'Cho duyet') === x)).join('');

        document.getElementById('registrationForm').innerHTML = `
            <div class="form-container">
                <h3>${edit ? 'Sửa đăng ký' : 'Thêm đăng ký'}</h3>
                ${student && !students.length ? '<p class="soa-note">Chưa có hồ sơ sinh viên trùng với tên đăng nhập của bạn. Hãy nhờ quản trị viên thêm sinh viên có mã trùng tên đăng nhập.</p>' : ''}
                <div class="form-group"><label>Sinh viên</label>
                    <select id="registrationMaSV"><option value="">-- Chọn sinh viên --</option>${studentOptions}</select></div>
                <div class="form-group"><label>Đề tài</label>
                    <select id="registrationMaDT"><option value="">-- Chọn đề tài --</option>${topicOptions}</select></div>
                ${student ? '' : `
                <div class="form-group"><label>Ngày đăng ký</label>
                    <input type="date" id="registrationNgayDangKy" value="${esc(registration ? formatDate(registration.NgayDangKy) : '')}"></div>
                <div class="form-group"><label>Trạng thái</label>
                    <select id="registrationTrangThai">${statusOptions}</select></div>
                <div class="form-group"><label>Điểm</label>
                    <input type="number" id="registrationDiem" min="0" max="10" step="0.01" placeholder="Ví dụ: 8.5"
                        value="${registration && registration.Diem !== null && registration.Diem !== undefined ? esc(registration.Diem) : ''}"></div>`}
                <div class="form-buttons">
                    <button class="btn-save" ${edit ? `data-id="${Number(registration.MaDK)}" onclick="updateRegistration(this.dataset.id)"` : 'onclick="createRegistration()"'}>${edit ? 'Cập nhật' : 'Thêm'}</button>
                    <button class="btn-cancel" onclick="closeRegistrationForm()">Hủy</button>
                </div>
            </div>`;
    } catch (e) {
        console.error(e);
        toast('Không thể tải dữ liệu sinh viên và đề tài', true);
    }
}

function readRegistrationForm() {
    const el = (id) => document.getElementById(id);
    const body = { MaSV: el('registrationMaSV').value, MaDT: el('registrationMaDT').value };
    if (el('registrationNgayDangKy')) {                 // sinh viên không có các trường này
        const diem = el('registrationDiem').value;
        if (el('registrationNgayDangKy').value) body.NgayDangKy = el('registrationNgayDangKy').value;
        body.TrangThai = el('registrationTrangThai').value;
        body.Diem = diem === '' ? null : Number(diem);
    }
    if (!body.MaSV || !body.MaDT) { toast('Vui lòng chọn sinh viên và đề tài', true); return null; }
    if (body.Diem !== undefined && body.Diem !== null && (body.Diem < 0 || body.Diem > 10)) {
        toast('Điểm phải nằm trong khoảng từ 0 đến 10', true); return null;
    }
    return body;
}

async function createRegistration() {
    const body = readRegistrationForm();
    if (!body) return;
    if (await mutate('POST', '/registrations', body, 'Thêm đăng ký thành công', 'Thêm đăng ký thất bại')) {
        closeRegistrationForm(); loadRegistrations();
    }
}

async function editRegistration(id) {
    const r = await api('GET', `/registrations/${Number(id)}`);
    if (!r) return;
    if (!r.ok) return toast(r.message || 'Không tìm thấy đăng ký', true);
    showRegistrationForm(r.data);
}

async function updateRegistration(id) {
    const body = readRegistrationForm();
    if (!body) return;
    if (await mutate('PUT', `/registrations/${Number(id)}`, body, 'Cập nhật đăng ký thành công', 'Cập nhật thất bại')) {
        closeRegistrationForm(); loadRegistrations();
    }
}

async function deleteRegistration(id) {
    if (!confirm(`Bạn có chắc muốn xóa đăng ký ${id}?`)) return;
    if (await mutate('DELETE', `/registrations/${Number(id)}`, undefined, 'Xóa đăng ký thành công', 'Xóa thất bại')) loadRegistrations();
}

function closeRegistrationForm() { document.getElementById('registrationForm').innerHTML = ''; }

// =========================
// HỖ TRỢ
// =========================

function formatDate(date) {
    return date ? String(date).substring(0, 10) : '';
}

// Hiển thị ngày theo định dạng Việt Nam: dd/mm/yyyy
function formatDateDisplay(date) {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}
