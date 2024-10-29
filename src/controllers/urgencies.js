'use strict';

const urgencies = require('../urgencies');

const categoriesController = module.exports;

categoriesController.list = async function (req, res) {
	const data = await urgencies.getAllUrgencies();

	res.render('urgencies', data);
};
