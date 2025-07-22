const Joi = require('joi');

const proposeAdditionalItemsSchema = Joi.object({
    items: Joi.array().items(
        Joi.object({
            name: Joi.string().required().messages({
                'string.empty': 'Tên thiết bị không được để trống',
                'any.required': 'Tên thiết bị là bắt buộc'
            }),
            description: Joi.string().optional(),
            price: Joi.number().positive().required().messages({
                'number.base': 'Giá phải là số',
                'number.positive': 'Giá phải lớn hơn 0',
                'any.required': 'Giá là bắt buộc'
            }),
            quantity: Joi.number().integer().min(1).default(1).messages({
                'number.base': 'Số lượng phải là số',
                'number.integer': 'Số lượng phải là số nguyên',
                'number.min': 'Số lượng phải lớn hơn 0'
            }),
            reason: Joi.string().required().messages({
                'string.empty': 'Lý do phát sinh không được để trống',
                'any.required': 'Lý do phát sinh là bắt buộc'
            })
        })
    ).min(1).required().messages({
        'array.min': 'Phải có ít nhất 1 item',
        'any.required': 'Danh sách items là bắt buộc'
    }),
    note: Joi.string().optional()
});

const approveRejectItemsSchema = Joi.object({
    itemIds: Joi.array().items(
        Joi.string().required()
    ).min(1).required().messages({
        'array.min': 'Phải chọn ít nhất 1 item',
        'any.required': 'Danh sách item IDs là bắt buộc'
    }),
    note: Joi.string().optional().max(500).messages({
        'string.max': 'Ghi chú không được quá 500 ký tự'
    })
});

module.exports = {
    proposeAdditionalItemsSchema,
    approveRejectItemsSchema
};
