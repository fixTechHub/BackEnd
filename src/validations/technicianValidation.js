const Joi = require('joi');

const findNearbySchema = Joi.object({
    // Validate dữ liệu từ req.query
    latitude: Joi.number().min(-90).max(90).required().messages({
        'number.base': 'Vĩ độ phải là một con số.',
        'any.required': 'Vui lòng cung cấp vĩ độ (latitude).'
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
        'number.base': 'Kinh độ phải là một con số.',
        'any.required': 'Vui lòng cung cấp kinh độ (longitude).'
    }),
    // Bộ lọc tùy chọn
    categoryId: Joi.string().hex().length(24).optional()
});

module.exports = {
    findNearbySchema,
};