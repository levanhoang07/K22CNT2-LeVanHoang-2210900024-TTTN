# 🍜 MyCay_Oder – Hệ thống đặt món bằng mã QR cho quán Mì Cay Hoangchef
MyCay_Oder là hệ thống hỗ trợ đặt món ăn bằng mã QR dành cho nhà hàng/quán ăn, giúp khách hàng gọi món trực tiếp trên điện thoại thông minh mà không cần gọi nhân viên phục vụ.  
Hệ thống đồng thời hỗ trợ bộ phận bếp và thu ngân theo dõi, xử lý đơn hàng theo thời gian thực, góp phần nâng cao hiệu quả quản lý và chất lượng phục vụ.
Đề tài được xây dựng trong khuôn khổ đồ án chuyên đề với mục tiêu ứng dụng công nghệ thông tin vào hoạt động kinh doanh nhà hàng, giảm thiểu thao tác thủ công và hạn chế sai sót trong quá trình phục vụ khách hàng.
---
## 📌 Mục lục
1. [Giới thiệu](#1️⃣-giới-thiệu)
2. [Chức năng chính](#2️⃣-chức-năng-chính)
3. [Công nghệ sử dụng](#3️⃣-công-nghệ-sử-dụng)
4. [Cấu trúc thư mục](#4️⃣-cấu-trúc-thư-mục)
5. [Hướng dẫn cài đặt](#5️⃣-hướng-dẫn-cài-đặt)
6. [Cấu hình cơ sở dữ liệu](#6️⃣-cấu-hình-cơ-sở-dữ-liệu)
7. [Hướng dẫn chạy chương trình](#7️⃣-hướng-dẫn-chạy-chương-trình)
8. [Tài khoản đăng nhập demo](#8️⃣-tài-khoản-đăng-nhập-demo)
9. [Hướng phát triển](#9️⃣-hướng-phát-triển)
10. [Tác giả & Ghi chú](#🔟-tác-giả--ghi-chú)
---
## 1️⃣ Giới thiệu
Trong bối cảnh chuyển đổi số hiện nay, việc áp dụng hệ thống đặt món tự động bằng mã QR giúp các nhà hàng, quán ăn nâng cao hiệu quả vận hành và trải nghiệm khách hàng.
Hệ thống **MyCay_Oder** cho phép:
- Khách hàng quét mã QR tại bàn để xem menu và đặt món  
- Đơn hàng được gửi trực tiếp đến bếp và thu ngân theo thời gian thực  
- Nhân viên dễ dàng theo dõi trạng thái đơn hàng và thanh toán  
Hệ thống được xây dựng cho mô hình quán **Mì Cay Hoangchef** với đầy đủ các chức năng cơ bản của một hệ thống đặt món hiện đại
---
## 2️⃣ Chức năng chính
### 🔹 Đối với khách hàng
- Quét mã QR tại bàn để truy cập menu  
- Xem danh sách món ăn, giá tiền, hình ảnh, trạng thái món  
- Chọn món, số lượng, mức độ cay và đặt món  
- Gửi yêu cầu hỗ trợ / gọi nhân viên  
- Gửi đánh giá dịch vụ  
### 🔹 Đối với bếp
- Nhận danh sách đơn hàng theo thời gian thực  
- Xem chi tiết từng món trong đơn  
- Cập nhật trạng thái đơn hàng: đang chế biến – hoàn thành  
### 🔹 Đối với thu ngân
- Theo dõi danh sách đơn hàng cần thanh toán  
- Xem tổng tiền và chi tiết đơn hàng  
- Thanh toán tiền mặt, chuyển khoản QR  
- Nhập thông tin xuất hóa đơn VAT  
### 🔹 Đối với quản trị viên (Admin)
- Quản lý danh mục và menu món ăn (thêm / sửa / xóa / cập nhật giá, trạng thái)  
- Quản lý bàn ăn và mã QR  
- Quản lý người dùng (bếp, thu ngân, admin)  
- Quản lý khách hàng và tích điểm  
- Quản lý khuyến mãi  
- Xem báo cáo doanh thu theo ngày, tuần, tháng và danh mục  
--
## 3️⃣ Công nghệ sử dụng
### Backend
- **Python 3.11+**  
- **Flask 3.0.3** – Xây dựng REST API  
- **Flask-SocketIO** – Giao tiếp thời gian thực (Realtime)  
- **Flask-CORS** – Hỗ trợ truy cập API từ frontend  
- **pyodbc** – Kết nối cơ sở dữ liệu SQL Server  
- **requests** – Gọi API bên ngoài  
### Cơ sở dữ liệu
- **Microsoft SQL Server**
### Frontend
- HTML, CSS, JavaScript  
- Bootstrap 5 
---
## 4️⃣ Cấu trúc thư mục
```
SMASORDER/
│
├── backend/
│ ├── pycache/ # File cache của Python
│ │ └── db.cpython-311.pyc
│ │
│ ├── static/ # Tài nguyên giao diện (CSS, JS, hình ảnh, âm thanh)
│ │ ├── css/
│ │ │ ├── admin.css # Giao diện admin
│ │ │ ├── bep.css # Giao diện bếp
│ │ │ ├── index.css # Giao diện khách hàng
│ │ │ ├── login.css # Giao diện đăng nhập
│ │ │ └── thungan.css # Giao diện thu ngân
│ │ │
│ │ ├── js/
│ │ │ ├── admin.js # Xử lý chức năng admin
│ │ │ ├── bep.js # Xử lý chức năng bếp
│ │ │ ├── client.js # Xử lý chức năng khách hàng
│ │ │ ├── lang-switcher.js # Chuyển đổi ngôn ngữ
│ │ │ ├── login.js # Xử lý đăng nhập
│ │ │ └── thungan.js # Xử lý chức năng thu ngân
│ │ │
│ │ ├── image/ # Thư mục hình ảnh
│ │ ├── images/ # Thư mục hình ảnh bổ sung
│ │ └── sounds/ # Âm thanh thông báo
│ │
│ ├── templates/ # Giao diện HTML
│ │ ├── admin.html # Trang quản trị
│ │ ├── bep.html # Trang bếp
│ │ ├── index.html # Trang khách hàng (đặt món)
│ │ ├── login.html # Trang đăng nhập
│ │ ├── test.html # Trang test
│ │ └── thungan.html # Trang thu ngân
│ │
│ ├── app.py # File chạy chính của backend Flask
│ ├── db.py # Kết nối và xử lý cơ sở dữ liệu
│ ├── utils.py # Các hàm tiện ích dùng chung
│ ├── models.sql # File script tạo cơ sở dữ liệu
│ ├── mycay_oder.log # File log hệ thống
│ └── requirements.txt # Danh sách thư viện cần cài đặt
--
## 5️⃣ Hướng dẫn cài đặt
### Bước 1: Clone project từ GitHub
```bash
git clone <(https://github.com/levanhoang07/K22CNT2-LeVanHoang-2210900024-TTTN)>
```

### Bước 2: Tạo và kích hoạt môi trường ảo (khuyến nghị)
```bash
python -m venv venv
venv\Scripts\activate
```
### Bước 3: Cài đặt các thư viện cần thiết
```bash
pip install -r requirements.txt
```
---
## 6️⃣ Cấu hình cơ sở dữ liệu
Hệ thống sử dụng cơ sở dữ liệu Microsoft SQL Server được cung cấp sẵn trong project.
### 🔹 Bước 1: Import database vào SQL Server
1. Mở **SQL Server Management Studio (SSMS)**
2. Tạo database mới (ví dụ: `MyCay_Oder`)
3. Chạy file script SQL trong thư mục `database/` để tạo bảng và dữ liệu mẫu
### 🔹 Bước 2: Cấu hình kết nối trong file `app.py`
Mở file `app.py` và chỉnh lại thông tin kết nối:
```python
conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost;"
    "DATABASE=MyCay_Oder;"
    "UID=sa;"
    "PWD=123456;"
)
```
⚠️ **Lưu ý:**
- Thay đổi `SERVER`, `UID`, `PWD` cho đúng với cấu hình SQL Server trên máy
- Đảm bảo đã cài **ODBC Driver for SQL Server**
---
## 7️⃣ Hướng dẫn chạy chương trình
Chạy backend bằng lệnh:
```bash
cd backen
python app.py
```
Nếu chạy thành công, truy cập hệ thống tại:
```
http://127.0.0.1:5000
```
🔹 Các đường dẫn truy cập theo vai trò
Vai trò	Đường dẫn
👤 Khách hàng (đặt món tại bàn)	http://localhost:5000/?ban=1
🍳 Bếp	http://localhost:5000/bep
💰 Thu ngân	http://localhost:5000/thungan
🛠️ Quản trị viên (Admin)	http://localhost:5000/admin

⚠️ Ghi chú:
Tham số ban=1 đại diện cho số bàn. Có thể thay đổi ban=2, ban=3, … tùy theo bàn ăn trong hệ thống.
---
## 8️⃣ Tài khoản đăng nhập demo
### 🔹 Tài khoản quản trị (Admin)
- **Tên đăng nhập:** `admin`
- **Mật khẩu:** `123456`
Tài khoản dùng để truy cập giao diện quản trị và quản lý toàn bộ hệ thống.
---
## 9️⃣ Hướng phát triển
Trong các phiên bản tiếp theo, hệ thống có thể được mở rộng thêm:
- Cải thiện và bảo trì các lỗi phát sinh ở các chức năng hiện tại
- Nâng cấp giao diện thân thiện và hiện đại hơn
- Phát triển chức năng AI hỗ trợ gợi ý món ăn cho khách hàng
- Tích hợp thanh toán trực tuyến (VNPay, Momo, ZaloPay, …)
- Xây dựng ứng dụng mobile cho khách hàng và nhân viên
---
## 🔟 Tác giả & Ghi chú
- Sinh viên thực hiện:Lê Văn Hoàng
- MSSV: 2210900024
- Lớp: CNT3 - Khoa Công Nghệ Thông Tin
- Trường:Đại học Nguyễn Trãi
- Đề tài:Hệ thống đặt món ăn bằng mã QR cho quán Mì Cay Hoangchef với Flask Framework và SQL Server

## 📄 License
Dự án được phát triển cho mục đích học tập và nghiên cứu.
---
## 📧 Liên hệ
Nếu có bất kỳ thắc mắc hoặc góp ý nào, vui lòng liên hệ qua email:levanhoang742004@gmail.com hoặc tạo issue trên GitHub.
---

**© 2025 MyCay_Oder - Hệ thống đặt món bằng mã QR**
