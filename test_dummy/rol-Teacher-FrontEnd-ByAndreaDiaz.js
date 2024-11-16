'use strict';

const assert = require('assert');
const db = require('./mocks/databasemock');
const User = require('../src/user');
const Categories = require('../src/categories');
const groups = require('../src/groups');

describe('User', () => {
	let userData;
	let testUid;
	let testCid;


	before(() => {
		userData = {
			username: 'John Smith',
			fullname: 'John Smith McNamara',
			password: 'swordfish',
			email: 'john@example.com',
			callback: undefined,
		};
	});


	describe('isProfessor', () => {
		// Este test verifica que un usuario pueda ser creado con el rol de profesor
		it('should be able to create an user with teacher role', async () => {
			testUid = await User.create({ username: 'Profesor', password: 'profesor', isProfessor: 'true' });
			assert.ok(testUid);
			const teacher = await groups.isMember(testUid, 'Teachers');
			assert.strictEqual(teacher, true);
		});

		// Este test verifica que un usuario pueda ser creado sin el rol de profesor
		it('should not be in teachers group, if not selected teacher role', async () => {
			testUid = await User.create({ username: userData.username, password: userData.password });
			const student = await groups.isMember(testUid, 'Teachers');
			assert.strictEqual(student, false);
		});

		// Este test verifica que un usuario creado con el rol de profesor no pueda ser parte del grupo de administradores
		it('should not be in administrator group, if teacher', async () => {
			// Se crea un admin primero
			const admin = await User.create({ username: 'Admin', password: 'admin1235' });
			testUid = await User.create({ username: 'Profesor', password: 'profesor', isProfessor: 'true' });
			const teacher = await groups.isMember(testUid, 'administrators');
			assert.strictEqual(teacher, false);
		});

		// Este test verifica que un usuario creado con el rol de profesor
		// no pueda ser parte del grupo de moderadores globales
		it('should not be in global moderator group, if teacher', async () => {
			testUid = await User.create({ username: 'Profesor', password: 'profesor', isProfessor: 'true' });
			const teacher = await groups.isMember(testUid, 'Global Moderators');
			assert.strictEqual(teacher, false);
		});
	});
});
