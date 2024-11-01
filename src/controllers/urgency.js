'use strict';

const urgencies = require('../urgencies');

const urgencyController = module.exports;

urgencyController.get = async function (req, res, next) {
	const { urg_id } = req.params;

	const categoryData = await urgencies.getUrgencyById({
		urg_id: urg_id,
		uid: req.uid,
	});
	if (!categoryData) {
		return next();
	}

	res.render('category', categoryData);
};
