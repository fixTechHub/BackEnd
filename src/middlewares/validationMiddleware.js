const Joi = require('joi');

/**
 * Middleware để xác thực dữ liệu request dựa trên một schema của Joi.
 * @param {Joi.Schema} schema - Schema của Joi để dùng cho việc validate.
 * @returns {function} - Một middleware của Express.
 */
const validate = (schema) => (req, res, next) => {
    // Chúng ta có thể linh hoạt hơn bằng cách kiểm tra cả body, params, và query
    const dataToValidate = { ...req.body, ...req.params, ...req.query };

    const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true // Loại bỏ các trường không xác định khỏi value
    });

    if (error) {
        const errors = error.details.reduce((acc, err) => {
            // Sử dụng err.context.key thay vì err.path[0] để lấy tên trường chính xác hơn
            acc[err.context.key] = err.message;
            return acc;
        }, {});

        return res.status(422).json({
            message: "Invalid Data",
            errors: errors
        });
    }

    // Gán dữ liệu đã được validate (và làm sạch) vào request
    // để controller có thể sử dụng dữ liệu an toàn.
    req.validatedData = value;

    return next();
};

module.exports = validate;
