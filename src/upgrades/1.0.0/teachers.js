'use strict';

module.exports = {
	name: 'Creating Teachers group',
	timestamp: Date.UTC(2024, 0, 27),
	method: async function () {
		const groups = require('../../groups');
		const exists = await groups.exists('Teachers');
		if (exists) {
			return;
		}
		await groups.create({
			name: 'Teachers',
			userTitle: 'Teacher',
			description: 'List of Professors',
			hidden: 0,
			private: 1,
			disableJoinRequests: 1,
		});
		await groups.show('Teachers');
	},
};
