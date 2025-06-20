const Joi = require("joi");

const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Email không hợp lệ',
            'string.empty': 'Email không được để trống',
            'any.required': 'Email là bắt buộc'
        }),
    password: Joi.string()
        .required()
        .messages({
            'string.empty': 'Mật khẩu không được để trống',
            'any.required': 'Mật khẩu là bắt buộc'
        })
});

const passwordSchema = Joi.object({
    password: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .required()
        .messages({
            'string.min': 'Mật khẩu phải có ít nhất 8 ký tự',
            'string.pattern.base': 'Mật khẩu phải chứa ít nhất một chữ hoa, một chữ thường, một số và một ký tự đặc biệt (@$!%*?&)',
            'string.empty': 'Mật khẩu không được để trống',
            'any.required': 'Mật khẩu là bắt buộc'
        })
});

module.exports = { loginSchema, passwordSchema };