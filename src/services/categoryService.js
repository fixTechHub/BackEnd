const Category = require("../models/Category")

exports.getPublicCategories = async () => {
    return await Category.find({ isActive: true });
};