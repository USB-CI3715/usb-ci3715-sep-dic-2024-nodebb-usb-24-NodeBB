'use strict';

const assert = require('assert');

const db = require('./mocks/databasemock');
const User = require('../src/user');
const groups = require('../src/groups');
const privileges = require('../src/privileges');
const groupsController = require('../src/controllers/groups');

describe('Test global group access permissions', () => {
	let testAdmin;
	let testGlobalMod;
	let testTeacher;
	let testStudent;

	let testUid;

	let adminGroup;
	let teacherGroup;
	let globalModGroup;
	let groupData;

	before(async () => {
		testAdmin = {
			username: 'admin',
			fullname: 'eskere',
			password: 'asdf12345',
			email: 'testadmin@gmail.com',
			callback: undefined,
		};

		testGlobalMod = {
			username: 'globalmod',
			fullname: 'eskere',
			password: 'asdf12345',
			email: 'testglobalmod@gmail.com',
			callback: undefined,
		};

		testTeacher = {
			username: 'teacher',
			fullname: 'eskere',
			password: 'asdf12345',
			email: 'testeacher@gmail.com',
			isProfessor: true,
			callback: undefined,
		};

		testStudent = {
			username: 'teacher',
			fullname: 'eskere',
			password: 'asdf12345',
			email: 'teststudent@gmail.com',
			isProfessor: false,
			callback: undefined,
		};

		adminGroup = await groups.create({
			name: 'administrators',
			userTitle: 'administrators',
			description: 'we be adminin',
			hidden: 0,
			private: 1,
			system: true,
			disableJoinRequests: 1,
		});

		globalModGroup = await groups.create({
			name: 'Global Moderators',
			userTitle: 'Global Moderators',
			description: 'we be moddin',
			hidden: 0,
			private: 1,
			system: true,
			disableJoinRequests: 1,
		});

		teacherGroup = await groups.create({
			name: 'Teachers',
			userTitle: 'Teachers',
			description: 'we be teachin',
			hidden: 0,
			private: 1,
			system: true,
			disableJoinRequests: 1,
		});

		groupData = [adminGroup, globalModGroup, teacherGroup];
	});

	it('should show all groups', async () => {
		testUid = await User.create(testAdmin);
		await groups.join('administrators', testUid);
		assert.ok(testUid);
		const groupsFilteredMask = await privileges.users.hasGroupPerms(testUid, groupData);
		const groupsFiltered = groupData.filter((_, i) => groupsFilteredMask[i]);
		assert.equal(groupsFiltered.length, 3);
	});
	it('should show 2 groups', async () => {
		testUid = await User.create(testGlobalMod);
		await groups.join('Global Moderators', testUid);
		assert.ok(testUid);
		const groupsFilteredMask = await privileges.users.hasGroupPerms(testUid, groupData);
		const groupsFiltered = groupData.filter((_, i) => groupsFilteredMask[i]);
		assert.equal(groupsFiltered.length, 2);
	});
	it('should show only one group', async () => {
		testUid = await User.create(testTeacher);
		assert.ok(testUid);
		const groupsFilteredMask = await privileges.users.hasGroupPerms(testUid, groupData);
		const groupsFiltered = groupData.filter((_, i) => groupsFilteredMask[i]);
		assert.equal(groupsFiltered.length, 1);
	});
	it('should show no groups', async () => {
		testUid = await User.create(testStudent);
		groups.join('administrators', testUid);
		assert.ok(testUid);
		const groupsFilteredMask = await privileges.users.hasGroupPerms(testUid, groupData);
		const groupsFiltered = groupData.filter((_, i) => groupsFilteredMask[i]);
		assert.equal(groupsFiltered.length, 0);
	});
});
