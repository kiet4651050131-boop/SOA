-- Chuyển dữ liệu từ database cũ `graduation_project` (bản monolith) sang 4 database mới của từng dịch vụ.
-- CÁCH DÙNG:
--   1. Chạy hệ thống một lần (npm start) để các dịch vụ tự tạo database + bảng, rồi tắt (Ctrl+C).
--   2. Chạy file này trong phpMyAdmin / MySQL Workbench.
--   3. Chạy lại hệ thống.
-- Lưu ý: trên Windows tên bảng không phân biệt hoa/thường; trên Linux hãy khớp đúng tên bảng cũ của bạn.

INSERT IGNORE INTO soa_student.SINHVIEN (MaSV, HoTen, Email, Lop)
SELECT MaSV, HoTen, Email, Lop FROM graduation_project.SINHVIEN;

INSERT IGNORE INTO soa_topic.DETAI (MaDT, TenDT, MoTa, GiangVienHuongDan)
SELECT MaDT, TenDT, MoTa, GiangVienHuongDan FROM graduation_project.DETAI;

INSERT IGNORE INTO soa_registration.DANGKY (MaDK, MaSV, MaDT, NgayDangKy, TrangThai, Diem)
SELECT MaDK, MaSV, MaDT, NgayDangKy, TrangThai, Diem FROM graduation_project.DANGKY;

-- Tài khoản cũ: giữ nguyên mật khẩu đã mã hóa; mọi tài khoản trở thành 'sinhvien'
-- (admin sẽ được auth-service tự tạo/chỉ định theo ADMIN_USERNAME trong .env).
INSERT IGNORE INTO soa_auth.TAIKHOAN (MaTK, TenDangNhap, MatKhau, HoTen, Email, VaiTro)
SELECT MaTK, TenDangNhap, MatKhau, HoTen, Email,
       CASE WHEN VaiTro = 'admin' THEN 'admin' ELSE 'sinhvien' END
FROM graduation_project.TAIKHOAN;
