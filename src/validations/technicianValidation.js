const Joi = require('joi');
const bankAccountSchema = Joi.object({
    bankName: Joi.string().required(),
    accountNumber: Joi.string().required(),
    accountHolder: Joi.string().required(),
    branch: Joi.string().required()
});
const createTechnicianSchema = Joi.object({
    identification: Joi.number().required(),
   
    specialties: Joi.string().optional(),
    certificate: Joi.array().items(Joi.string()).optional()
});
module.exports = { bankAccountSchema,createTechnicianSchema };
