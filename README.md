# UVA Agency

Ứng dụng web quản lý dự án, tên miền, hosting và máy chủ VPS. Giao diện tiếng Việt, hỗ trợ máy tính và điện thoại; không cần cài thư viện.

## Cấu trúc dự án

```text
.
├── index.html              # Khung ứng dụng và các khu vực điều hướng
├── manifest.webmanifest    # Thông tin ứng dụng cài lên màn hình chính
├── service-worker.js       # Service worker cho ứng dụng web cài đặt
├── server.ps1              # Máy chủ localhost và proxy API 123HOST an toàn
├── assets/
│   ├── css/
│   │   └── app.css         # Giao diện tối và bố cục responsive
│   ├── icons/
│   │   ├── uva-logo.png          # Logo UVA Website Development
│   │   ├── uva-app-icon-512.png  # Biểu tượng ứng dụng
│   │   └── apple-touch-icon.png  # Biểu tượng màn hình chính iOS
│   └── js/
│       └── app.js          # Màn hình, thao tác và dữ liệu mẫu
└── README.md
```

## Chạy trên máy tính

Mở PowerShell trong thư mục dự án và chạy:

```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

Mở <http://127.0.0.1:8000>. Giữ cửa sổ PowerShell mở trong khi sử dụng ứng dụng; nhấn `Ctrl+C` để dừng máy chủ.

Không dùng `py -m http.server` nếu cần kết nối 123HOST: lệnh đó chỉ phục vụ tệp tĩnh, không có API proxy bảo vệ thông tin đăng nhập.

## Tính năng hiện có

- Chuyển qua lại giữa Trang Chủ, Dự Án, Tên Miền, Hosting và Cài Đặt.
- Tạo, chỉnh sửa và xóa dự án có xác nhận; thêm, sửa, xóa, đánh dấu công việc; lọc trạng thái và hoàn tất dự án.
- Tìm kiếm, thêm tên miền, chỉnh DNS, gia hạn tên miền và lưu yêu cầu chuyển tên miền.
- Thêm VPS, xem thống kê máy chủ và dung lượng tài khoản hosting.
- Điều chỉnh tùy chọn thông báo và nhắc gia hạn.
- Cài ứng dụng lên màn hình chính; số cảnh báo tên miền và thông báo 123HOST được đồng bộ lên biểu tượng trên trình duyệt/thiết bị có hỗ trợ App Badging API. Số chỉ cập nhật khi ứng dụng mở hoặc đồng bộ; nhận cập nhật nền khi ứng dụng đóng cần tích hợp dịch vụ push.
- Lưu dữ liệu trên trình duyệt bằng `localStorage`, không mất khi tải lại trang.
- Kết nối API 123HOST qua máy chủ localhost; đồng bộ tên miền, hồ sơ và thông báo khi khôi phục phiên; chỉ tải dịch vụ/hóa đơn khi mở Hosting.
- Danh sách tên miền, thẻ cảnh báo trang chủ, huy hiệu chuông và nhóm hạn trong hộp thông báo dùng chung bộ phân loại từ 123HOST `GET /domain` (`expires`, `daytoexpire`); tự đồng bộ danh sách đầy đủ khi mở màn Tên Miền & DNS hoặc chuông. Thông báo portal mới được tải khi khôi phục phiên và làm mới khi mở chuông; `GET /notifications/new` chỉ cung cấp danh sách portal, không thay thế danh sách hạn tên miền.
- Ngày tháng trên giao diện dùng định dạng `dd/mm/yyyy`; giao diện điện thoại có điều hướng dưới cùng, vùng chạm lớn và hộp thoại dạng trang trượt.
- Lọc, tìm kiếm và xem tổng số tên miền; mở chi tiết từng hóa đơn trực tiếp từ danh sách.
- Chỉ đánh dấu tên miền sắp hết hạn trong tháng hiện tại hoặc tháng kế tiếp; các hạn xa hơn vẫn hiển thị là đang hoạt động. Tiền hóa đơn được phân nhóm hàng nghìn theo định dạng Việt Nam, ví dụ `200.000 VND`.
- Hiện màn hình chờ logo khi mở ứng dụng và lời chào buổi sáng, chiều hoặc tối theo giờ địa phương.
- Quản lý máy chủ tên miền và thêm, sửa, xóa bản ghi DNS; mở danh sách bản ghi trước, tải loại bản ghi nền và cập nhật giao diện ngay sau thao tác thành công. Cập nhật/xóa bản ghi dùng đúng endpoint 123HOST `/domain/@id/dns/@index`. Dùng danh sách loại do API cung cấp hoặc danh sách tương thích trong tài liệu khi API loại DNS không trả dữ liệu.

## Kết nối 123HOST

### Chạy trên máy tính

1. Chạy ứng dụng qua `server.ps1` như hướng dẫn bên trên.
2. Mở **Cài Đặt → Kết Nối 123HOST** và nhập email/mật khẩu của tài khoản bạn có quyền sử dụng.
3. API đăng nhập và làm mới JWT gửi JSON trong thân POST theo ví dụ chính thức của 123HOST (Swagger cũng liệt kê các trường này dưới dạng query). Nếu endpoint JWT bị giới hạn HTTP 429, ứng dụng thử Basic Authentication dự phòng được tài liệu 123HOST hỗ trợ. Thông tin xác thực được giữ trong bộ nhớ máy chủ PowerShell khi cần dùng Basic, không ghi vào `localStorage` hoặc trả về cho giao diện.
4. Ngắt kết nối trong ứng dụng trước khi đóng để yêu cầu 123HOST thu hồi phiên đăng nhập.

### Chạy trên Vercel

Vercel dùng hàm serverless trong `api/[...path].js`. Rewrite trong `vercel.json` chuyển các API nhiều cấp `/api/123host/...` tới proxy 123HOST.

1. Thêm biến môi trường `DEVHQ_SESSION_SECRET` trong **Vercel → Project → Settings → Environment Variables**. Dùng giá trị ngẫu nhiên dài ít nhất 32 ký tự; có thể tạo bằng PowerShell:

   ```powershell
   $bytes = New-Object byte[] 32
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   ```

2. Đảm bảo Vercel dùng thư mục gốc của repository, bật biến này cho môi trường cần dùng (Production/Preview), lưu lại rồi triển khai lại project.
3. Mở ứng dụng tại tên miền Vercel và đăng nhập từ **Cài Đặt → Kết Nối 123HOST**.

Biến môi trường này dùng để mã hóa phiên đăng nhập trong cookie `HttpOnly`; không đặt nó trong mã frontend hoặc commit vào Git. Nếu thiếu cấu hình, API sẽ trả lỗi nêu rõ cần thêm biến môi trường. Các phiên cũ sẽ mất hiệu lực khi thay giá trị secret.

Ứng dụng hỗ trợ xem dịch vụ, hóa đơn, số dư, thông báo; cấu hình máy chủ tên miền; thêm, sửa, xóa bản ghi DNS; và gửi yêu cầu gia hạn. Gia hạn có thể phát sinh thanh toán và chỉ được gửi sau khi người dùng chọn thời hạn/phương thức rồi xác nhận. Thay đổi DNS có thể ảnh hưởng website hoặc email. Chỉ thực hiện các thao tác trên tài khoản/tên miền bạn được ủy quyền.

Thông tin dự án ban đầu vẫn lưu trên trình duyệt. Tên miền và dịch vụ thật thay thế dữ liệu minh họa tương ứng khi đã kết nối. API nhà cung cấp không cung cấp thao tác sao lưu/khôi phục mật khẩu; ứng dụng không đọc hoặc hiển thị trường mật khẩu dịch vụ.
