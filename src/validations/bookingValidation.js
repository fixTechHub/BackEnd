const Joi = require('joi');

const createBookingSchema = Joi.object({
    technicianId: Joi.string().hex().length(24).required().messages({
        'any.required': 'Technician ID là trường bắt buộc.'
    }),
    serviceId: Joi.string().hex().length(24).required().messages({
        'any.required': 'Service ID là trường bắt buộc.'
    }),
    description: Joi.string().min(10).required().messages({
        'string.empty': 'Vui lòng nhập mô tả chi tiết.',
        'string.min': 'Mô tả phải có ít nhất {#limit} ký tự.',
        'any.required': 'Vui lòng nhập mô tả chi tiết.'
    }),
    schedule: Joi.date().iso().greater('now').required().messages({
        'date.base': 'Ngày đặt lịch không hợp lệ.',
        'date.format': 'Ngày đặt lịch phải theo định dạng chuẩn (YYYY-MM-DDTHH:mm:ss).',
        'date.greater': 'Không thể đặt lịch trong quá khứ.',
        'any.required': 'Vui lòng chọn ngày giờ đặt lịch.'
    }),
    location: Joi.object({
        type: Joi.string().valid('Point').required(),
        coordinates: Joi.array().items(Joi.number()).length(2).required()
    }).required().messages({
        'any.required': 'Vui lòng cung cấp vị trí.'
    }),
    images: Joi.array().items(Joi.string().uri()).messages({
        'array.base': 'Danh sách hình ảnh không hợp lệ.'
    })
});

const updateBookingSchema = Joi.object({
    // CÁC TRƯỜNG CÓ THỂ CẬP NHẬT -> chúng là OPTIONAL
    description: Joi.string().min(10).optional(), // Người dùng có thể cập nhật hoặc không
    schedule: Joi.date().iso().greater('now').optional(), // Có thể đổi lịch
    status: Joi.string().valid('CANCELLED').optional(), // Người dùng có thể chỉ được phép cập nhật status thành CANCELLED

    // CÁC TRƯỜNG BỊ CẤM CẬP NHẬT -> dùng Joi.forbidden()
    technicianId: Joi.any().forbidden(), // Không cho phép đổi thợ sau khi đã tạo booking
    serviceId: Joi.any().forbidden(), // Không cho phép đổi dịch vụ
    customerId: Joi.any().forbidden(), // Tuyệt đối không cho phép đổi người đặt
    bookingCode: Joi.any().forbidden() // Mã booking là bất biến
});

module.exports = {
    createBookingSchema,
    updateBookingSchema,
};
