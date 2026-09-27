const API_BASE = '/api';

// =========================
// CHUYỂN TRANG
// =========================

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    document.getElementById(sectionId).classList.add('active');

    if (sectionId === 'students') {
        loadStudents();
    }

    if (sectionId === 'topics') {
        loadTopics();
    }

    if (sectionId === 'registrations') {
        loadRegistrations();
    }
}


// =========================
// SINH VIÊN
// =========================

async function loadStudents() {
    try {
        const response = await fetch(`${API_BASE}/students`);
        const result = await response.json();

        const tbody = document.getElementById('studentTableBody');
        tbody.innerHTML = '';

        if (!result.data || result.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">Chưa có dữ liệu sinh viên</td>
                </tr>
            `;
            return;
        }

        result.data.forEach(student => {
            tbody.innerHTML += `
                <tr>
                    <td>${student.MaSV}</td>
                    <td>${student.HoTen}</td>
                    <td>${student.Email || ''}</td>
                    <td>${student.Lop || ''}</td>
                    <td>
                        <button class="btn-edit"
                            onclick="editStudent('${student.MaSV}')">
                            Sửa
                        </button>

                        <button class="btn-delete"
                            onclick="deleteStudent('${student.MaSV}')">
                            Xóa
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error(error);
        alert('Không thể tải danh sách sinh viên!');
    }
}


function showStudentForm(student = null) {
    const form = document.getElementById('studentForm');

    const isEdit = student !== null;

    form.innerHTML = `
        <div class="form-container">

            <h3>${isEdit ? 'Sửa sinh viên' : 'Thêm sinh viên'}</h3>

            <div class="form-group">
                <label>Mã sinh viên</label>
                <input
                    type="text"
                    id="studentMaSV"
                    value="${student ? student.MaSV : ''}"
                    ${isEdit ? 'readonly' : ''}
                >
            </div>

            <div class="form-group">
                <label>Họ tên</label>
                <input
                    type="text"
                    id="studentHoTen"
                    value="${student ? student.HoTen : ''}"
                >
            </div>

            <div class="form-group">
                <label>Email</label>
                <input
                    type="email"
                    id="studentEmail"
                    value="${student ? student.Email || '' : ''}"
                >
            </div>

            <div class="form-group">
                <label>Lớp</label>
                <input
                    type="text"
                    id="studentLop"
                    value="${student ? student.Lop || '' : ''}"
                >
            </div>

            <div class="form-buttons">

                <button class="btn-save"
                    onclick="${isEdit
                        ? `updateStudent('${student.MaSV}')`
                        : 'createStudent()'}">
                    ${isEdit ? 'Cập nhật' : 'Thêm'}
                </button>

                <button class="btn-cancel"
                    onclick="closeStudentForm()">
                    Hủy
                </button>

            </div>

        </div>
    `;
}


async function createStudent() {
    const MaSV = document.getElementById('studentMaSV').value.trim();
    const HoTen = document.getElementById('studentHoTen').value.trim();
    const Email = document.getElementById('studentEmail').value.trim();
    const Lop = document.getElementById('studentLop').value.trim();

    if (!MaSV || !HoTen) {
        alert('Vui lòng nhập Mã sinh viên và Họ tên!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/students`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                MaSV,
                HoTen,
                Email,
                Lop
            })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Thêm sinh viên thất bại!');
            return;
        }

        alert('Thêm sinh viên thành công!');

        closeStudentForm();
        loadStudents();

    } catch (error) {
        console.error(error);
        alert('Có lỗi xảy ra!');
    }
}


async function editStudent(id) {
    try {
        const response = await fetch(`${API_BASE}/students/${id}`);
        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Không tìm thấy sinh viên!');
            return;
        }

        showStudentForm(result.data);

    } catch (error) {
        console.error(error);
        alert('Không thể tải thông tin sinh viên!');
    }
}


async function updateStudent(id) {
    const HoTen = document.getElementById('studentHoTen').value.trim();
    const Email = document.getElementById('studentEmail').value.trim();
    const Lop = document.getElementById('studentLop').value.trim();

    if (!HoTen) {
        alert('Vui lòng nhập Họ tên!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/students/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                HoTen,
                Email,
                Lop
            })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Cập nhật thất bại!');
            return;
        }

        alert('Cập nhật sinh viên thành công!');

        closeStudentForm();
        loadStudents();

    } catch (error) {
        console.error(error);
        alert('Có lỗi xảy ra!');
    }
}


async function deleteStudent(id) {
    if (!confirm(`Bạn có chắc muốn xóa sinh viên ${id}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/students/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Xóa thất bại!');
            return;
        }

        alert('Xóa sinh viên thành công!');

        loadStudents();

    } catch (error) {
        console.error(error);
        alert('Có lỗi xảy ra!');
    }
}


function closeStudentForm() {
    document.getElementById('studentForm').innerHTML = '';
}


// =========================
// ĐỀ TÀI
// =========================

async function loadTopics() {
    try {
        const response = await fetch(`${API_BASE}/topics`);
        const result = await response.json();

        const tbody = document.getElementById('topicTableBody');
        tbody.innerHTML = '';

        if (!result.data || result.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">Chưa có dữ liệu đề tài</td>
                </tr>
            `;
            return;
        }

        result.data.forEach(topic => {
            tbody.innerHTML += `
                <tr>
                    <td>${topic.MaDT}</td>
                    <td>${topic.TenDT}</td>
                    <td>${topic.MoTa || ''}</td>
                    <td>${topic.GiangVienHuongDan || ''}</td>
                    <td>
                        <button class="btn-edit"
                            onclick="editTopic('${topic.MaDT}')">
                            Sửa
                        </button>

                        <button class="btn-delete"
                            onclick="deleteTopic('${topic.MaDT}')">
                            Xóa
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error(error);
        alert('Không thể tải danh sách đề tài!');
    }
}


function showTopicForm(topic = null) {
    const form = document.getElementById('topicForm');

    const isEdit = topic !== null;

    form.innerHTML = `
        <div class="form-container">

            <h3>${isEdit ? 'Sửa đề tài' : 'Thêm đề tài'}</h3>

            <div class="form-group">
                <label>Mã đề tài</label>
                <input
                    type="text"
                    id="topicMaDT"
                    value="${topic ? topic.MaDT : ''}"
                    ${isEdit ? 'readonly' : ''}
                >
            </div>

            <div class="form-group">
                <label>Tên đề tài</label>
                <input
                    type="text"
                    id="topicTenDT"
                    value="${topic ? topic.TenDT : ''}"
                >
            </div>

            <div class="form-group">
                <label>Mô tả</label>
                <input
                    type="text"
                    id="topicMoTa"
                    value="${topic ? topic.MoTa || '' : ''}"
                >
            </div>

            <div class="form-group">
                <label>Giảng viên hướng dẫn</label>
                <input
                    type="text"
                    id="topicGiangVien"
                    value="${topic ? topic.GiangVienHuongDan || '' : ''}"
                >
            </div>

            <div class="form-buttons">

                <button class="btn-save"
                    onclick="${isEdit
                        ? `updateTopic('${topic.MaDT}')`
                        : 'createTopic()'}">
                    ${isEdit ? 'Cập nhật' : 'Thêm'}
                </button>

                <button class="btn-cancel"
                    onclick="closeTopicForm()">
                    Hủy
                </button>

            </div>

        </div>
    `;
}


async function createTopic() {
    const MaDT = document.getElementById('topicMaDT').value.trim();
    const TenDT = document.getElementById('topicTenDT').value.trim();
    const MoTa = document.getElementById('topicMoTa').value.trim();
    const GiangVienHuongDan =
        document.getElementById('topicGiangVien').value.trim();

    if (!MaDT || !TenDT) {
        alert('Vui lòng nhập Mã đề tài và Tên đề tài!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/topics`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                MaDT,
                TenDT,
                MoTa,
                GiangVienHuongDan
            })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Thêm đề tài thất bại!');
            return;
        }

        alert('Thêm đề tài thành công!');

        closeTopicForm();
        loadTopics();

    } catch (error) {
        console.error(error);
        alert('Có lỗi xảy ra!');
    }
}


async function editTopic(id) {
    try {
        const response = await fetch(`${API_BASE}/topics/${id}`);
        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Không tìm thấy đề tài!');
            return;
        }

        showTopicForm(result.data);

    } catch (error) {
        console.error(error);
        alert('Không thể tải thông tin đề tài!');
    }
}


async function updateTopic(id) {
    const TenDT = document.getElementById('topicTenDT').value.trim();
    const MoTa = document.getElementById('topicMoTa').value.trim();
    const GiangVienHuongDan =
        document.getElementById('topicGiangVien').value.trim();

    if (!TenDT) {
        alert('Vui lòng nhập Tên đề tài!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/topics/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                TenDT,
                MoTa,
                GiangVienHuongDan
            })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Cập nhật thất bại!');
            return;
        }

        alert('Cập nhật đề tài thành công!');

        closeTopicForm();
        loadTopics();

    } catch (error) {
        console.error(error);
        alert('Có lỗi xảy ra!');
    }
}


async function deleteTopic(id) {
    if (!confirm(`Bạn có chắc muốn xóa đề tài ${id}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/topics/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Xóa thất bại!');
            return;
        }

        alert('Xóa đề tài thành công!');

        loadTopics();

    } catch (error) {
        console.error(error);
        alert('Có lỗi xảy ra!');
    }
}


function closeTopicForm() {
    document.getElementById('topicForm').innerHTML = '';
}


// =========================
// ĐĂNG KÝ
// =========================

async function loadRegistrations() {
    try {
        const response = await fetch(`${API_BASE}/registrations`);
        const result = await response.json();

        const tbody = document.getElementById('registrationTableBody');
        tbody.innerHTML = '';

        if (!result.data || result.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8">Chưa có dữ liệu đăng ký</td>
                </tr>
            `;
            return;
        }

        result.data.forEach(registration => {
            tbody.innerHTML += `
                <tr>
                    <td>${registration.MaDK}</td>
                    <td>${registration.MaSV}</td>
                    <td>${registration.HoTen || ''}</td>
                    <td>${registration.MaDT}</td>
                    <td>${registration.TenDT || ''}</td>
                    <td>${registration.NgayDangKy || ''}</td>
                    <td>${registration.TrangThai || ''}</td>
                    <td>
                        <button class="btn-edit"
                            onclick="editRegistration(${registration.MaDK})">
                            Sửa
                        </button>

                        <button class="btn-delete"
                            onclick="deleteRegistration(${registration.MaDK})">
                            Xóa
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error(error);
        alert('Không thể tải danh sách đăng ký!');
    }
}


async function showRegistrationForm(registration = null) {
    const form = document.getElementById('registrationForm');

    const isEdit = registration !== null;

    try {
        const [studentsResponse, topicsResponse] = await Promise.all([
            fetch(`${API_BASE}/students`),
            fetch(`${API_BASE}/topics`)
        ]);

        const studentsResult = await studentsResponse.json();
        const topicsResult = await topicsResponse.json();

        const students = studentsResult.data || [];
        const topics = topicsResult.data || [];

        const studentOptions = students.map(student => `
            <option
                value="${student.MaSV}"
                ${registration && registration.MaSV === student.MaSV
                    ? 'selected'
                    : ''}>
                ${student.MaSV} - ${student.HoTen}
            </option>
        `).join('');

        const topicOptions = topics.map(topic => `
            <option
                value="${topic.MaDT}"
                ${registration && registration.MaDT === topic.MaDT
                    ? 'selected'
                    : ''}>
                ${topic.MaDT} - ${topic.TenDT}
            </option>
        `).join('');

        form.innerHTML = `
            <div class="form-container">

                <h3>${isEdit ? 'Sửa đăng ký' : 'Thêm đăng ký'}</h3>

                <div class="form-group">
                    <label>Sinh viên</label>

                    <select id="registrationMaSV">
                        <option value="">-- Chọn sinh viên --</option>
                        ${studentOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label>Đề tài</label>

                    <select id="registrationMaDT">
                        <option value="">-- Chọn đề tài --</option>
                        ${topicOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label>Ngày đăng ký</label>

                    <input
                        type="date"
                        id="registrationNgayDangKy"
                        value="${registration
                            ? formatDate(registration.NgayDangKy)
                            : ''}"
                    >
                </div>

                <div class="form-group">
                    <label>Trạng thái</label>

                    <input
                        type="text"
                        id="registrationTrangThai"
                        value="${registration
                            ? registration.TrangThai || ''
                            : ''}"
                        placeholder="Ví dụ: Đang thực hiện"
                    >
                </div>

                <div class="form-buttons">

                    <button class="btn-save"
                        onclick="${isEdit
                            ? `updateRegistration(${registration.MaDK})`
                            : 'createRegistration()'}">
                        ${isEdit ? 'Cập nhật' : 'Thêm'}
                    </button>

                    <button class="btn-cancel"
                        onclick="closeRegistrationForm()">
                        Hủy
                    </button>

                </div>

            </div>
        `;

    } catch (error) {
        console.error(error);
        alert('Không thể tải dữ liệu sinh viên và đề tài!');
    }
}


async function createRegistration() {
    const MaSV =
        document.getElementById('registrationMaSV').value;

    const MaDT =
        document.getElementById('registrationMaDT').value;

    const NgayDangKy =
        document.getElementById('registrationNgayDangKy').value;

    const TrangThai =
        document.getElementById('registrationTrangThai').value.trim();

    if (!MaSV || !MaDT) {
        alert('Vui lòng chọn sinh viên và đề tài!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/registrations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                MaSV,
                MaDT,
                NgayDangKy,
                TrangThai
            })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Thêm đăng ký thất bại!');
            return;
        }

        alert('Thêm đăng ký thành công!');

        closeRegistrationForm();
        loadRegistrations();

    } catch (error) {
        console.error(error);
        alert('Có lỗi xảy ra!');
    }
}


async function editRegistration(id) {
    try {
        const response =
            await fetch(`${API_BASE}/registrations/${id}`);

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Không tìm thấy đăng ký!');
            return;
        }

        showRegistrationForm(result.data);

    } catch (error) {
        console.error(error);
        alert('Không thể tải thông tin đăng ký!');
    }
}


async function updateRegistration(id) {
    const MaSV =
        document.getElementById('registrationMaSV').value;

    const MaDT =
        document.getElementById('registrationMaDT').value;

    const NgayDangKy =
        document.getElementById('registrationNgayDangKy').value;

    const TrangThai =
        document.getElementById('registrationTrangThai').value.trim();

    if (!MaSV || !MaDT) {
        alert('Vui lòng chọn sinh viên và đề tài!');
        return;
    }

    try {
        const response =
            await fetch(`${API_BASE}/registrations/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    MaSV,
                    MaDT,
                    NgayDangKy,
                    TrangThai
                })
            });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Cập nhật thất bại!');
            return;
        }

        alert('Cập nhật đăng ký thành công!');

        closeRegistrationForm();
        loadRegistrations();

    } catch (error) {
        console.error(error);
        alert('Có lỗi xảy ra!');
    }
}


async function deleteRegistration(id) {
    if (!confirm(`Bạn có chắc muốn xóa đăng ký ${id}?`)) {
        return;
    }

    try {
        const response =
            await fetch(`${API_BASE}/registrations/${id}`, {
                method: 'DELETE'
            });

        const result = await response.json();

        if (!response.ok) {
            alert(result.message || 'Xóa thất bại!');
            return;
        }

        alert('Xóa đăng ký thành công!');

        loadRegistrations();

    } catch (error) {
        console.error(error);
        alert('Có lỗi xảy ra!');
    }
}


function closeRegistrationForm() {
    document.getElementById('registrationForm').innerHTML = '';
}


// =========================
// HỖ TRỢ
// =========================

function formatDate(date) {
    if (!date) {
        return '';
    }

    return String(date).substring(0, 10);
}