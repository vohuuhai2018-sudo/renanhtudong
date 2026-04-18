# Sơn Hải AI Render Pro

Ứng dụng desktop (.EXE) tự động hóa quy trình xử lý hình ảnh với ChatGPT.

## Tính năng
- Tự động lấy ảnh từ thư mục INPUT.
- Tự động gửi ảnh vào ChatGPT để lấy prompt chuyên sâu.
- Tự động dùng prompt để tạo ảnh mới (DALL-E 3) trong ChatGPT.
- Tự động tải ảnh về thư mục OUTPUT với tên file tương ứng.
- Giữ trạng thái đăng nhập thông qua Chrome User Profile.

## Yêu cầu hệ thống
- Windows OS
- Google Chrome đã cài đặt
- Node.js (để build từ source)

## Hướng dẫn cài đặt & Chạy
1. **Cấu hình:**
   - Mở ứng dụng.
   - Chọn thư mục INPUT (chứa ảnh .jpg, .png).
   - Chọn thư mục OUTPUT (nơi lưu kết quả).
   - Kiểm tra đường dẫn `chrome.exe`.
   - Cung cấp đường dẫn đến `User Data` của Chrome để giữ đăng nhập ChatGPT.
     - Thường là: `C:\Users\<Tên_User>\AppData\Local\Google\Chrome\User Data`

2. **Chạy ứng dụng:**
   - Nhấn **Bắt đầu Quy trình**.
   - Playwright sẽ tự động mở Chrome và thực hiện các bước.
   - Theo dõi trạng thái tại bảng **Console Logs**.

## Lệnh cho lập trình viên
- `npm install`: Cài đặt thư viện.
- `npm run dev`: Chạy thử ở chế độ development.
- `npm run package`: Đóng gói thành file .EXE.

---
© 2026 Sơn Hải Landscape. All rights reserved.
