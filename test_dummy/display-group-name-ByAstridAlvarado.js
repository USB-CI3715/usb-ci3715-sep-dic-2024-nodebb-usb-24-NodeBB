'use strict';

const assert = require('assert');
const db = require('./mocks/databasemock');
const createHelpers = require('../public/src/modules/helpers.common');

// Simulamos un objeto utils y Benchpress para la creación de helpers
const utils = {
	escapeHTML: str => str, // Simulamos la función de escape
	stripHTMLTags: str => str, // Simulamos la función de strip
};

const Benchpress = {
	setGlobal: () => {},
	registerHelper: () => {},
};

const relative_path = '';

const helpers = createHelpers(utils, Benchpress, relative_path);

const membersObj = {
	members: [
		{ uid: '1', fullname: 'John Doe' },
		{ uid: '2', fullname: 'Jane Smith' },
	],
	creatorUid: '1', // Suponemos que el creador es John Doe
};
describe('Group Name Display', () => {
	describe('showGroupNameList', () => {
		it('should return "administrators" without creator name', () => {
			const result = helpers.showGroupNameList('administrators', membersObj);
			assert(result.includes('administrators'), 'Displayed name should be "administrators"');
		});

		it('should return "Global Moderators" without creator name', () => {
			const result = helpers.showGroupNameList('Global Moderators', membersObj);
			assert(result.includes('Global Moderators'), 'Displayed name should be "Global Moderators"');
		});

		it('should return "Teachers" without creator name', () => {
			const result = helpers.showGroupNameList('Teachers', membersObj);
			assert(result.includes('Teachers'), 'Displayed name should be "Teachers"');
		});

		it('should return group name with creator name for other groups', () => {
			const result = helpers.showGroupNameList('Other Group', membersObj);
			assert(result.includes('Other Group | Prof. John Doe'), 'Displayed name should be "Other Group | Prof. John Doe"');
		});
	});

	describe('showGroupNameDetails', () => {
		it('should return "administrators" without creator name', () => {
			const result = helpers.showGroupNameDetails('administrators', membersObj);
			assert(result.includes('administrators'), 'Displayed name should be "administrators"');
		});

		it('should return "Global Moderators" without creator name', () => {
			const result = helpers.showGroupNameDetails('Global Moderators', membersObj);
			assert(result.includes('Global Moderators'), 'Displayed name should be "Global Moderators"');
		});

		it('should return "Teachers" without creator name', () => {
			const result = helpers.showGroupNameDetails('Teachers', membersObj);
			assert(result.includes('Teachers'), 'Displayed name should be "Teachers"');
		});

		it('should return group name with creator name for other groups', () => {
			const result = helpers.showGroupNameDetails('Other Group', membersObj);
			assert(result.includes('Other Group | Prof. John Doe'), 'Displayed name should be "Other Group | Prof. John Doe"');
		});
	});
});
