const { userSocketMap } = require('./socket');

module.exports = function bookingSocket(io) {
    io.on('connection', (socket) => {
        // 1. User tạo booking mới (gửi cho thợ)
        socket.on('booking:create', (data) => {
            // data: { bookingId, userId, technicianId, ... }
            const techSocketId = userSocketMap.get(data.technicianId);
            if (techSocketId) {
                io.to(techSocketId).emit('booking:new', data);
            }
        });

        // 2. Thợ xác nhận/ từ chối booking (gửi cho user)
        socket.on('booking:technicianResponse', (data) => {
            // data: { bookingId, userId, technicianId, status }
            const userSocketId = userSocketMap.get(data.userId);
            if (userSocketId) {
                io.to(userSocketId).emit('booking:technicianResponse', data);
            }
        });

        // 3. Thợ gửi báo giá (gửi cho user)
        socket.on('booking:sendQuotation', (data) => {
            // data: { bookingId, userId, technicianId, quotation, items }
            const userSocketId = userSocketMap.get(data.userId);
            if (userSocketId) {
                io.to(userSocketId).emit('booking:quotation', data);
            }
        });

        // 4. User đồng ý/ từ chối báo giá (gửi cho thợ)
        socket.on('booking:userQuotationResponse', (data) => {
            // data: { bookingId, userId, technicianId, accepted }
            const techSocketId = userSocketMap.get(data.technicianId);
            if (techSocketId) {
                io.to(techSocketId).emit('booking:userQuotationResponse', data);
            }
        });

        // 5. Thợ gửi phí phát sinh (gửi cho user)
        socket.on('booking:sendAdditionalFee', (data) => {
            // data: { bookingId, userId, technicianId, additionalFee }
            const userSocketId = userSocketMap.get(data.userId);
            if (userSocketId) {
                io.to(userSocketId).emit('booking:additionalFee', data);
            }
        });

        // 6. User đồng ý/ từ chối phí phát sinh (gửi cho thợ)
        socket.on('booking:userAdditionalFeeResponse', (data) => {
            // data: { bookingId, userId, technicianId, accepted }
            const techSocketId = userSocketMap.get(data.technicianId);
            if (techSocketId) {
                io.to(techSocketId).emit('booking:userAdditionalFeeResponse', data);
            }
        });

        // 7. Booking hoàn thành/hủy (gửi cho cả user và thợ)
        socket.on('booking:statusUpdate', (data) => {
            // data: { bookingId, userId, technicianId, status }
            const userSocketId = userSocketMap.get(data.userId);
            const techSocketId = userSocketMap.get(data.technicianId);
            if (userSocketId) io.to(userSocketId).emit('booking:statusUpdate', data);
            if (techSocketId) io.to(techSocketId).emit('booking:statusUpdate', data);
        });

        // 8. Thợ chấp nhận booking request (gửi cho user)
        socket.on('booking:requestAccepted', (data) => {
            // data: { bookingId, userId, technicianId, requestId }
            const userSocketId = userSocketMap.get(data.userId);
            if (userSocketId) {
                io.to(userSocketId).emit('booking:requestAccepted', data);
            }
        });

        // 9. Thợ từ chối booking request (gửi cho user)
        socket.on('booking:requestRejected', (data) => {
            // data: { bookingId, userId, technicianId, requestId }
            const userSocketId = userSocketMap.get(data.userId);
            if (userSocketId) {
                io.to(userSocketId).emit('booking:requestRejected', data);
            }
        });

        // 10. Cập nhật trạng thái booking request (gửi cho user)
        socket.on('booking:requestStatusUpdate', (data) => {
            // data: { bookingId, userId, technicianId, requestId, status }
            const userSocketId = userSocketMap.get(data.userId);
            if (userSocketId) {
                io.to(userSocketId).emit('booking:requestStatusUpdate', data);
            }
        });

        // 11. Thợ thêm thiết bị phát sinh (gửi cho user)
        socket.on('booking:additionalItemsAdded', (data) => {
            // data: { bookingId, userId, technicianId, items }
            const userSocketId = userSocketMap.get(data.userId);
            if (userSocketId) {
                io.to(userSocketId).emit('booking:additionalItemsAdded', data);
            }
        });

        // 12. Cập nhật trạng thái thiết bị phát sinh (gửi cho user và thợ)
        socket.on('booking:additionalItemsStatusUpdate', (data) => {
            // data: { bookingId, userId, technicianId, itemId, status }
            const userSocketId = userSocketMap.get(data.userId);
            const techSocketId = userSocketMap.get(data.technicianId);
            if (userSocketId) io.to(userSocketId).emit('booking:additionalItemsStatusUpdate', data);
            if (techSocketId) io.to(techSocketId).emit('booking:additionalItemsStatusUpdate', data);
        });

        // 13. User chấp nhận thiết bị phát sinh (gửi cho thợ)
        socket.on('booking:additionalItemsAccepted', (data) => {
            // data: { bookingId, userId, technicianId, itemId }
            const techSocketId = userSocketMap.get(data.technicianId);
            if (techSocketId) {
                io.to(techSocketId).emit('booking:additionalItemsAccepted', data);
            }
        });

        // 14. User từ chối thiết bị phát sinh (gửi cho thợ)
        socket.on('booking:additionalItemsRejected', (data) => {
            // data: { bookingId, userId, technicianId, itemId }
            const techSocketId = userSocketMap.get(data.technicianId);
            if (techSocketId) {
                io.to(techSocketId).emit('booking:additionalItemsRejected', data);
            }
        });
    });
};