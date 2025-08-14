const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

router.get('/public', categoryController.getPublicCategories);
router.get('/top', categoryController.getTopCategoriesReport);

module.exports = router;
