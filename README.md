# Xây dựng Hệ thống Quản lý và Đặt thuê Xe Du lịch Trực tuyến

**Đồ án chuyên ngành Công nghệ phần mềm – Ngành Công nghệ thông tin**  
* **Trường:** Đại học Tài nguyên và Môi trường TP. Hồ Chí Minh  
* **Giảng viên hướng dẫn:** ThS. Từ Thanh Trí  
* **Sinh viên thực hiện:** Hoàng Tuấn Nguyên – **MSSV:** 1250080120 – **Lớp:** 12_ĐH_CNPM2  

---

## 1. Công nghệ & Thư viện sử dụng

* **Frontend (`frontend/package.json`):** ReactJS 18, Vite 5, React Router DOM v6, Axios, Recharts.
* **Backend (`backend/package.json`):** Node.js, ExpressJS, `mssql` (Connection Pool & Transaction), `jsonwebtoken` (JWT Auth), `bcryptjs`, `multer`, `dotenv`, `cors`, `morgan`.
* **Cơ sở dữ liệu (`database/`):** Microsoft SQL Server (`QuanLyThueXeDuLich`) – sử dụng Stored Procedures, Triggers, Views, Filtered Indexes và cơ chế khóa ứng dụng `sp_getapplock` kết hợp `UPDLOCK, HOLDLOCK` xử lý đặt xe đồng thời.

---

## 2. Cấu trúc thư mục dự án

```text
QuanLyThueXeDuLich/
├── database/
│   ├── 00_ResetCSDL.sql                 # Xoá CSDL cũ để khởi tạo lại từ đầu (tuỳ chọn)
│   ├── 01_CSDL_QuanLyThueXeDuLich.sql   # Tạo 16 bảng, ràng buộc, trigger, view, stored procedure
│   ├── 02_DuLieuDemo.sql                # Dữ liệu mẫu (4 tài khoản, 4 loại xe, 8 xe + ảnh, quy tắc phí, đơn mẫu)
│   └── 03_TestNghiepVu.sql              # Kịch bản kiểm thử nghiệp vụ trên SSMS
├── backend/
│   ├── src/
│   │   ├── config/db.js                 # Kết nối SQL Server (Connection Pool & Transaction helper)
│   │   ├── middlewares/                 # Xác thực JWT, kiểm tra quyền RBAC (requirePerm), xử lý lỗi SQL
│   │   ├── controllers/                 # auth, car, order, payment, notification, contract, user, admin
│   │   ├── routes/index.js              # Định tuyến toàn bộ REST API (/api/*)
│   │   ├── utils/                       # Công thức tính giá (pricing.js), ghi AuditLog (audit.js), validator
│   │   ├── app.js                       # Khởi tạo Express app
│   │   └── server.js                    # Chạy server + Job định kỳ nhắc lịch nhận xe (<24h)
│   ├── uploads/cars/                    # Hình ảnh phương tiện mẫu
│   ├── tests/
│   │   ├── business-tests.js            # Script tự động chạy kiểm thử nghiệp vụ end-to-end
│   │   └── KetQuaKiemThu.md             # Bảng kết quả kiểm thử Expected / Actual
│   ├── .env.example                     # File cấu hình môi trường mẫu cho Backend
│   └── package.json                     # Danh sách thư viện Backend
├── frontend/
│   ├── src/
│   │   ├── components/Navbar.jsx        # Thanh điều hướng theo vai trò + chuông thông báo
│   │   ├── context/AuthContext.jsx      # Quản lý phiên đăng nhập & danh sách quyền RBAC
│   │   ├── pages/
│   │   │   ├── HomePage.jsx             # UC04 - Tìm kiếm & lọc xe trống theo khoảng thời gian
│   │   │   ├── CarDetailPage.jsx        # UC05, UC06 - Chi tiết xe, kiểm tra trùng lịch, báo giá & đặt xe
│   │   │   ├── MyOrdersPage.jsx         # UC07 - Danh sách đơn thuê của khách hàng
│   │   │   ├── OrderDetailPage.jsx      # Quy trình End-to-End, Cổng Sandbox, Hợp đồng, Giao/Trả xe, Phụ phí
│   │   │   ├── StaffPage.jsx            # UC11->UC17 - Trung tâm vận hành dành cho Nhân viên
│   │   │   ├── AdminPage.jsx            # UC18->UC22 - Quản lý xe, người dùng, phân quyền, Audit Log, Báo cáo
│   │   │   ├── NotificationsPage.jsx    # UC10 - Danh sách thông báo & chạy Job nhắc lịch nhận xe
│   │   │   ├── RubricDemoPage.jsx       # Bảng minh chứng nghiệp vụ & Mô phỏng đặt xe đồng thời
│   │   │   ├── LoginPage.jsx            # UC02 - Đăng nhập hệ thống
│   │   │   ├── RegisterPage.jsx         # UC01 - Đăng ký tài khoản khách hàng
│   │   │   └── ProfilePage.jsx          # UC03 - Cập nhật hồ sơ & đổi mật khẩu
│   │   ├── api.js                       # Axios client kết nối Backend
│   │   └── utils/format.js              # Định dạng tiền tệ, ngày giờ, nhãn trạng thái
│   ├── .env.example                     # File cấu hình môi trường mẫu cho Frontend
│   ├── vite.config.js                   # Cấu hình Vite
│   └── package.json                     # Danh sách thư viện Frontend
├── .env.example                         # File cấu hình môi trường mẫu tổng hợp
├── .gitignore                           # Cấu hình loại trừ file tạm / node_modules
├── package.json                         # Danh sách thư viện & script điều phối dự án
└── README.md                            # Tài liệu hướng dẫn cài đặt và vận hành
```

---

## 3. Hướng dẫn cài đặt và chạy hệ thống

### Bước 1: Khởi tạo Cơ sở dữ liệu SQL Server
Chạy lần lượt các file trong thư mục `database/` trên **SQL Server Management Studio (SSMS)** hoặc dùng `sqlcmd`:
```powershell
sqlcmd -S localhost -U thuexe_app -P 123456 -f 65001 -b -i database/00_ResetCSDL.sql -i database/01_CSDL_QuanLyThueXeDuLich.sql -i database/02_DuLieuDemo.sql
```

### Bước 2: Cấu hình biến môi trường (`.env`)
Sao chép file cấu hình mẫu `.env.example` trong thư mục `backend/` thành file `.env` và cập nhật thông tin kết nối SQL Server:
```powershell
cd backend
copy .env.example .env
```

### Bước 3: Cài đặt thư viện và chạy Backend (Cổng `5000`)
```powershell
cd backend
npm install
npm start
```

### Bước 4: Cài đặt thư viện và chạy Frontend (Cổng `5173`)
```powershell
cd frontend
npm install
npm run dev
```
Sau đó mở trình duyệt tại địa chỉ: `http://localhost:5173`

---

## 4. Tài khoản Demo (Mật khẩu chung: `123456`)

| Vai trò | Email | Mật khẩu | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (`ADMIN`)** | `admin@demo.vn` | `123456` | Quản lý xe, loại xe, quy tắc phí, tài khoản, phân quyền RBAC, Audit Log, thống kê doanh thu |
| **Nhân viên (`EMPLOYEE`)** | `nhanvien@demo.vn` | `123456` | Kiểm tra lịch, xác nhận/từ chối đơn, lập hợp đồng, giao xe, nhận trả xe, tính phụ phí, xử lý thanh toán |
| **Khách hàng 1 (`CUSTOMER`)** | `khachhang@demo.vn` | `123456` | Tìm xe, kiểm tra trùng lịch, đặt xe, thanh toán Sandbox, xem hợp đồng, hủy đơn |
| **Khách hàng 2 (`CUSTOMER`)** | `khachhang2@demo.vn` | `123456` | Dùng để kiểm thử chống trùng lịch và đặt xe đồng thời |
