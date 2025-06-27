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

const finalizeRegistrationSchema = Joi.object({
    fullName: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.min': 'Họ tên phải có ít nhất 2 ký tự',
            'string.max': 'Họ tên không được quá 50 ký tự',
            'string.empty': 'Họ tên không được để trống',
            'any.required': 'Họ tên là bắt buộc'
        }),
    emailOrPhone: Joi.string()
        .required()
        .messages({
            'string.empty': 'Email hoặc số điện thoại không được để trống',
            'any.required': 'Email hoặc số điện thoại là bắt buộc'
        }),
    password: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .required()
        .messages({
            'string.min': 'Mật khẩu phải có ít nhất 8 ký tự',
            'string.pattern.base': 'Mật khẩu phải chứa ít nhất một chữ hoa, một chữ thường, một số và một ký tự đặc biệt (@$!%*?&)',
            'string.empty': 'Mật khẩu không được để trống',
            'any.required': 'Mật khẩu là bắt buộc'
        }),
    role: Joi.string()
        .valid('CUSTOMER', 'TECHNICIAN')
        .required()
        .messages({
            'any.only': 'Vai trò phải là CUSTOMER hoặc TECHNICIAN',
            'string.empty': 'Vai trò không được để trống',
            'any.required': 'Vai trò là bắt buộc'
        })
});

module.exports = { loginSchema, passwordSchema, finalizeRegistrationSchema };