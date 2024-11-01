'use strict';

module.exports = {
	// Create the group 'Profesores' by default
	name: 'Creating Profesores group',
	timestamp: Date.UTC(2024, 10, 28),
	method: async function () {
		const groups = require('../../groups');
		const exists = await groups.exists('Profesores');
		if (exists) {
			return;
		}
		await groups.create({
			name: 'Profesores',
			userTitle: 'Profesores',
			description: 'Grupo para profesores',
			hidden: 0,
			private: 1,
			disableJoinRequests: 1,
			disableLeave: 1,
		});
		await groups.show('Profesores');
	},
};
