const Joi = require("joi");

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});
const passwordSchema = Joi.object({
    password: Joi.string().min(6).required(),

})
module.exports = { loginSchema,passwordSchema };