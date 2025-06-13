const Joi = require('joi');
const { generateToken } = require('../utils/jwt');

const createUserSchema = Joi.object({
  fullName: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-ZÀ-ỹ\s]+$/)
    .required()
    .messages({
      'string.empty': 'Họ và tên không được để trống',
      'string.min': 'Họ và tên phải có ít nhất 2 ký tự',
      'string.max': 'Họ và tên không được vượt quá 50 ký tự',
      'string.pattern.base': 'Họ và tên chỉ được chứa chữ cái và khoảng trắng',
      'any.required': 'Họ và tên là bắt buộc'
    }),
  emailOrPhone: Joi.string()
    .custom((value, helpers) => {
      // Kiểm tra nếu là email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      // Kiểm tra nếu là số điện thoại (Việt Nam)
      const phoneRegex = /^0[0-9]{9}$/;
      
      if (emailRegex.test(value)) {
        return value;
      }
      if (phoneRegex.test(value)) {
        return value;
      }
      return helpers.error('any.custom', { 
        message: 'Vui lòng nhập email hoặc số điện thoại hợp lệ' 
      });
    })
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
      'string.empty': 'Mật khẩu không được để trống',
      'string.min': 'Mật khẩu phải có ít nhất 8 ký tự',
      'string.pattern.base': 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt',
      'any.required': 'Mật khẩu là bắt buộc'
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'string.empty': 'Xác nhận mật khẩu không được để trống',
      'any.only': 'Xác nhận mật khẩu không khớp',
      'any.required': 'Xác nhận mật khẩu là bắt buộc'
    })
});

module.exports = { createUserSchema };
