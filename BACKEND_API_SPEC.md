
# Đặc tả API Backend - UniFlow Project

Tài liệu này liệt kê các điểm cuối (Endpoints) cần thiết để Frontend UniFlow kết nối với Cơ sở dữ liệu (Database).

## 1. Xác thực & Người dùng (Authentication & User)

| Phương thức | Endpoint | Mô tả | Body (JSON) |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới | `{ email, password, fullName, major }` |
| `POST` | `/api/auth/login` | Đăng nhập | `{ email, password }` |
| `POST` | `/api/auth/forgot-password` | Request password reset link | `{ email }` |
| `POST` | `/api/auth/reset-password` | Reset password using token | `{ token, password }` |
| `GET` | `/api/user/profile` | Lấy thông tin cá nhân | (Yêu cầu Token) |
| `PUT` | `/api/user/profile` | Cập nhật hồ sơ | `{ fullName, major, avatar }` |

## 2. Quản lý Thời khóa biểu (Events)

| Phương thức | Endpoint | Mô tả | Body (JSON) |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/events` | Lấy danh sách tất cả tiết học | - |
| `POST` | `/api/events` | Thêm mới một tiết học | `{ title, code, instructor, room, type, dayOfWeek, startTime, endTime, color }` |
| `PUT` | `/api/events/:id` | Cập nhật thông tin tiết học | `{ title, room, startTime, ... }` |
| `DELETE` | `/api/events/:id` | Xóa tiết học | - |

## 3. Quản lý Nhiệm vụ (Tasks)

| Phương thức | Endpoint | Mô tả | Body (JSON) |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tasks` | Lấy danh sách bài tập/nhiệm vụ | - |
| `POST` | `/api/tasks` | Tạo nhiệm vụ mới | `{ title, description, dueDate, priority, status }` |
| `PUT` | `/api/tasks/:id` | Cập nhật trạng thái/thông tin | `{ status, title, priority, ... }` |
| `DELETE` | `/api/tasks/:id` | Xóa nhiệm vụ | - |

## 4. Quản lý Ghi chú (Notes)

| Phương thức | Endpoint | Mô tả | Body (JSON) |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notes` | Lấy tất cả ghi chú | - |
| `GET` | `/api/notes/:eventId` | Lấy ghi chú theo môn học | - |
| `POST` | `/api/notes` | Lưu hoặc cập nhật ghi chú | `{ eventId, content }` |
| `DELETE` | `/api/notes/:id` | Xóa ghi chú | - |

## 5. Tổng quan & Thống kê (Dashboard)

| Phương thức | Endpoint | Mô tả | Phản hồi (JSON) |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/stats` | Lấy số liệu tổng hợp | `{ classesToday, activeTasks, completedTasks, studyHoursData: [] }` |

## Lưu ý về Bảo mật & Triển khai

1.  **JWT Authentication**: Tất cả các API (trừ Login/Register) nên yêu cầu Header `Authorization: Bearer <token>`.
2.  **Avatar**: Frontend chỉ gửi URL ảnh đại diện được chọn từ bộ sưu tập có sẵn. Backend lưu trữ URL này như một chuỗi String thông thường.
3.  **Tối giản**: Hệ thống không hỗ trợ upload file đính kèm trực tiếp lên server để đơn giản hóa quá trình phát triển Backend.

---
*Tài liệu này được cập nhật để phù hợp với kiến trúc không sử dụng tính năng upload ảnh.*
