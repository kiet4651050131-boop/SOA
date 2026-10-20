# Hệ thống quản lý đồ án tốt nghiệp – kiến trúc SOA (v2)

Hệ thống gồm **nhiều dịch vụ độc lập**, giao tiếp qua **REST (đồng bộ)** và **Event Bus (bất đồng bộ)**,
tìm nhau qua **Service Registry**, đi vào qua **API Gateway** nơi thực thi các **chính sách**.

```
                        Trình duyệt / Postman
                                 │  (JWT)
                         ┌───────▼────────┐        ┌──────────────────┐
                         │  API Gateway   │◄──────►│ Service Registry │  dò tìm dịch vụ động
                         │ :3000          │        │ :3500            │  heartbeat + health check
                         │ policies.json  │        └────────▲─────────┘
                         └──┬───┬───┬───┬─┘                 │ đăng ký / heartbeat
        ┌───────────────────┘   │   │   └──────────────┐    │
 ┌──────▼─────┐ ┌───────▼──────┐│┌──▼───────────┐ ┌────▼────▼────────┐
 │auth :3001  │ │student :3002 │││topic  :3003  │ │registration:3004 │── gọi HTTP ──► student, topic
 │ soa_auth   │ │ soa_student  │││ soa_topic    │ │ soa_registration │
 └────────────┘ └──────┬───────┘│└──────┬───────┘ └────────┬─────────┘
                       │ publish│       │ publish          │ publish / subscribe
                  ┌────▼────────▼───────▼──────────────────▼────┐
                  │  Event Bus :3600 (hàng đợi bền, retry, DLQ)  │
                  └───────────────────────┬──────────────────────┘
                                          │ giao sự kiện
                                 ┌────────▼─────────┐
                                 │ notification:3005│ soa_notification
                                 └──────────────────┘
```

## Đối chiếu đề bài

> Khoa cần hệ thống quản lý đồ án tốt nghiệp theo SOA, các dịch vụ độc lập phối hợp qua HTTP/REST; CSDL gồm SINHVIEN, DETAI, DANGKY.

| Yêu cầu của đề | Hệ thống đáp ứng |
|---|---|
| Bảng SINHVIEN / DETAI / DANGKY | Mỗi bảng thuộc **một dịch vụ riêng** với database riêng: `student-service` (SINHVIEN), `topic-service` (DETAI), `registration-service` (DANGKY). Thêm `auth-service` (đăng nhập, phân quyền) và `notification-service` (thông báo). |
| Dịch vụ độc lập | Mỗi dịch vụ là một tiến trình Express riêng, cổng riêng, DB riêng; chạy/tắt/nhân bản độc lập. |
| Giao tiếp bằng giao thức chuẩn (HTTP/REST) | Mọi giao tiếp là REST + JSON (đồng bộ), kèm Event Bus (HTTP) cho bất đồng bộ. |
| Có thể tái sử dụng | Hợp đồng OpenAPI tại `/api-docs`; `student-service`/`topic-service` được web, `registration-service` và dashboard cùng gọi. |
| Chức năng cơ bản | CRUD sinh viên, đề tài, đăng ký; đăng ký đề tài, duyệt, chấm điểm; đăng nhập/phân quyền; thông báo. |

### Quy tắc nghiệp vụ

- Mỗi sinh viên chỉ có **01 đăng ký còn hiệu lực** (trạng thái khác `Da huy`, `Tu choi`). Bị từ chối/hủy thì được đăng ký đề tài khác.
- Trạng thái hợp lệ: `Cho duyet`, `Da duyet`, `Tu choi`, `Dang thuc hien`, `Hoan thanh`, `Da huy`. Điểm từ 0 đến 10.
- **Sinh viên** chỉ đăng ký cho chính mình (tên đăng nhập = mã sinh viên), đăng ký luôn ở trạng thái `Cho duyet`, không tự đặt điểm, chỉ xem được đăng ký của mình.
- **Giảng viên / admin** duyệt, từ chối, chấm điểm.

## Đối chiếu 7 tiêu chí SOA

| # | Tiêu chí | Cách hệ thống đáp ứng | Xem ở đâu |
|---|---|---|---|
| 1 | **Loose coupling** | 5 dịch vụ chạy **tiến trình riêng**, mỗi dịch vụ **một database riêng** (`soa_auth`, `soa_student`, `soa_topic`, `soa_registration`, `soa_notification`). Không JOIN chéo, không khóa ngoại giữa DB. `registration-service` chỉ lưu `MaSV`, `MaDT` và **gọi HTTP** sang dịch vụ kia khi cần. Dịch vụ gọi nhau bằng **tên**, không biết URL/cổng của nhau. | `services/*`, `shared/client.js` |
| 2 | **Sử dụng lại dịch vụ** | Hợp đồng dịch vụ **OpenAPI** tại `/openapi.json` của từng dịch vụ, gateway tổng hợp tại `/api-docs`. `student-service` và `topic-service` được web, `registration-service` và gateway (dashboard) cùng dùng. `auth-service` có `/api/auth/verify` để dịch vụ khác tái sử dụng. Thư viện dùng chung `shared/`. | `shared/openapi.js`, `/api-docs` |
| 3 | **Dịch vụ bất đồng bộ** | **Event Bus** publish/subscribe: dịch vụ chỉ ném sự kiện (`registration.created`, `registration.status_changed`, `registration.graded`, `student.deleted`, `topic.deleted`, `user.registered`) rồi đi tiếp, không chờ. `notification-service` tạo thông báo; `registration-service` tự hủy đăng ký khi SV/đề tài bị xóa. Bus lưu hàng đợi xuống đĩa, giao **at-least-once** (ghi đĩa sau tối đa 300ms), consumer idempotent. | `event-bus/server.js`, `shared/events.js` |
| 4 | **Quản lý các chính sách** | Chính sách khai báo bằng **dữ liệu** trong `config/policies.json` (xác thực, phân quyền theo vai trò `admin/giangvien/sinhvien`, rate limit, giới hạn kích thước, CORS), **tự nạp lại khi sửa file** hoặc qua `PUT /api/system/policies`. Dịch vụ còn có chính sách riêng: khóa nội bộ (chỉ nhận request qua gateway), validation, chặn đăng ký trùng. | `config/policies.json`, `gateway/server.js` |
| 5 | **Khả năng cộng tác** | `registration-service` **điều phối** student + topic (xác minh tồn tại, lấy họ tên/tên đề tài). Gateway có dịch vụ **tổng hợp** `/api/dashboard`. Các dịch vụ phối hợp với nhau qua sự kiện (choreography). | `services/registration-service`, `/api/dashboard` |
| 6 | **Tự động dò tìm & ràng buộc động** | **Service Registry**: dịch vụ tự đăng ký khi khởi động + heartbeat. Gateway và các dịch vụ **tra cứu theo tên tại thời điểm gọi**, **cân bằng tải round-robin** nếu có nhiều instance. Chạy thêm instance không cần cấu hình gì. | `registry/server.js`, `shared/client.js`, `shared/registrar.js` |
| 7 | **Tự hồi phục** | Registry kiểm tra `/health` và **loại instance hỏng** khỏi định tuyến, khi khỏe lại tự quay về. Client có **timeout, retry exponential backoff, circuit breaker, failover** sang instance khác. Dịch vụ tự **đăng ký lại** khi registry restart; **chờ MySQL** và tự tạo bảng; Event Bus giữ + giao lại sự kiện; publisher có **outbox trong bộ nhớ** (tự gửi lại khi bus sập; sẽ mất nếu chính dịch vụ chết đúng lúc đó — hệ thống lớn nên dùng bảng outbox trong DB). Đăng ký vẫn xem được khi student/topic sập (**degraded mode**). `scripts/run-all.js` **tự khởi động lại** tiến trình chết; `docker-compose.yml` có `restart` + healthcheck. | `shared/client.js`, `scripts/run-all.js` |

## Chạy hệ thống

Yêu cầu: **Node.js ≥ 18**, **MySQL** đang chạy (XAMPP/MySQL đều được).

```bash
npm install
cp .env.example .env        # nếu đã có .env cũ: giữ nguyên, chỉ cần có DB_*, JWT_SECRET (xem ghi chú dưới)
npm start                   # chạy registry + event bus + 5 dịch vụ + gateway, tự restart khi lỗi
```

Mở **http://localhost:3000**. Tài khoản admin được tạo lần đầu theo `ADMIN_USERNAME` / `ADMIN_PASSWORD` trong `.env`
(mặc định `admin` / `admin123`, hãy đổi). Tài liệu API: **http://localhost:3000/api-docs**.

Ghi chú:
- Các database `soa_*` và bảng **tự được tạo** (tài khoản MySQL cần quyền `CREATE`). Biến `DB_NAME` cũ không còn dùng.
- **Có dữ liệu cũ** ở `graduation_project`? Chạy hệ thống 1 lần → tắt → chạy `database/migrate_from_monolith.sql` → chạy lại.
- Tài khoản đăng ký mới luôn là `sinhvien`. Admin đổi vai trò bằng `PUT /api/auth/users/:id/role`
  hoặc dùng tab **Tài khoản** trên giao diện (chỉ admin). Có form **Đăng ký** tài khoản ở thanh đăng nhập.
- Sinh viên đăng nhập bằng tên đăng nhập **trùng mã sinh viên** sẽ nhận thông báo cá nhân (xem `notification-service`).
- Chạy riêng từng thành phần: `npm run start:registry`, `start:student`, … Chạy bằng Docker: `docker compose up --build`.

Dữ liệu mẫu để demo: `npm run seed` (khi hệ thống đang chạy) → tạo 4 sinh viên, 3 đề tài, 2 đăng ký và các tài khoản
`gv01` (giảng viên), `SV001`, `SV002` (mật khẩu `123456`). Lưu ý `/api/auth/register` bị giới hạn 5 lần/phút/IP.

## Phân quyền (config/policies.json)

| Tài nguyên | Xem | Thêm / sửa | Xóa |
|---|---|---|---|
| Sinh viên | mọi người dùng | admin | admin |
| Đề tài | mọi người dùng | admin, giangvien | admin, giangvien |
| Đăng ký | admin/giảng viên: tất cả; sinh viên: chỉ của mình | thêm: mọi người dùng (sinh viên chỉ cho mình); sửa: admin, giangvien | admin |
| Thông báo | của chính mình | – | – |

Gateway trả **401** khi chưa đăng nhập/token hết hạn, **403** khi không đủ quyền, **429** khi vượt giới hạn, **503** khi dịch vụ đích không khả dụng.

## Kịch bản demo cho giảng viên

1. **Dò tìm động:** vào tab *Hệ thống SOA* → thấy các dịch vụ và trạng thái `UP`.
2. **Cân bằng tải:** `node scripts/instance.js student-service 3012` → thấy thêm một instance student-service.
   Tắt instance gốc (Ctrl+C) mà web vẫn hoạt động (failover).
3. **Tự hồi phục:** tắt `registration-service` → tab Đăng ký báo 503 nhưng các tab khác vẫn chạy → `supervisor` tự bật lại sau ~1 giây.
   Tắt `student-service` → danh sách đăng ký vẫn hiện (họ tên hiển thị "(không khả dụng)").
4. **Bất đồng bộ:** tạo/duyệt/chấm điểm một đăng ký → tab *Thông báo* xuất hiện thông báo. Tắt `notification-service`, thao tác tiếp, bật lại → thông báo vẫn về đủ (Event Bus giữ và giao lại).
5. **Chính sách:** đăng nhập bằng tài khoản sinh viên thử xóa sinh viên → 403. Sửa `config/policies.json` (ví dụ đổi `rateLimit`) → có hiệu lực không cần restart.
6. **Phối hợp dịch vụ:** đăng ký đề tài cho mã sinh viên không tồn tại → 400; sinh viên đăng ký thêm đề tài thứ hai → 409; xóa sinh viên → các đăng ký của sinh viên đó tự chuyển "Da huy".

## Kiểm thử

- `npm test` – kiểm thử **hạ tầng** bằng tiến trình thật (registry, event bus, gateway + dịch vụ giả; không cần MySQL): dò tìm,
  RBAC, rate limit, cân bằng tải, dashboard, giao lại sự kiện, failover, registry restart, tổng hợp API docs.
- `npm run test:e2e` – kiểm thử **đầu-cuối trên hệ thống thật** (cần `npm start` + MySQL): phân quyền, quy tắc 1 SV – 1 đề tài,
  sinh viên không tự chấm điểm, thông báo qua Event Bus, xóa sinh viên → hủy đăng ký qua sự kiện, 413, dò tìm dịch vụ, dashboard.
  Test tạo dữ liệu có tiền tố ngẫu nhiên (không xóa, có thể dọn thủ công).

## Hạn chế đã biết

- Outbox của dịch vụ nằm trong bộ nhớ; Event Bus, Registry, Gateway là điểm đơn (chạy 1 bản) — phù hợp đồ án, chưa phải mức production.
- Kiểm tra "1 sinh viên – 1 đăng ký" làm ở tầng ứng dụng (chưa có ràng buộc UNIQUE trong DB), hai request đồng thời vẫn có thể lọt.
- Thông báo nhóm `staff` dùng chung một cờ "đã đọc" cho mọi giảng viên/admin.
- Liên kết tài khoản – sinh viên dựa vào quy ước tên đăng nhập = mã sinh viên.
- Chưa có phân trang/tìm kiếm; token JWT sống 2 giờ, không có thu hồi.

## Cấu trúc

```
gateway/  registry/  event-bus/        thành phần hạ tầng (Node thuần, không phụ thuộc thư viện)
services/ auth | student | topic | registration | notification     (Express + MySQL)
shared/   client (retry/breaker/discovery) · registrar · events · db · service-base · jwt · openapi
config/policies.json   chính sách   |   public/  giao diện   |   scripts/  supervisor, instance
tests/    database/migrate_from_monolith.sql   Dockerfile  docker-compose.yml
```
