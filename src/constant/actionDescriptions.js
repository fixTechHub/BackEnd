
module.exports = {
  'POST /api/bookings': 'Người dùng tạo đơn đặt lịch',
  'PUT /api/bookings/:id/confirm': 'Kỹ thuật viên xác nhận hoàn thành',
  'POST /api/auth/login': 'Người dùng đăng nhập',
  'PUT /api/users/:id': 'Người dùng cập nhật hồ sơ',
  'POST /api/booking-prices': 'Kỹ thuật viên gửi báo giá',
  'PUT /api/booking-prices/:id/approve': 'Khách hàng chấp nhận báo giá',
  'DELETE /api/bookings/:id': 'Người dùng hủy lịch đặt',
  'GET /api/roles': 'Admin xem tất cả vai trò',
  'GET /api/test': 'Người dùng vào trang test API',
  // ... thêm route khác tại đây
};
