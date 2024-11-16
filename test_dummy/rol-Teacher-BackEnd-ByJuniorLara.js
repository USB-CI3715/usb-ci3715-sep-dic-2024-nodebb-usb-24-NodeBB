'use strict';

const assert = require('assert');

const db = require('./mocks/databasemock');
const User = require('../src/user');
const groups = require('../src/groups');
const apiGroups = require('../src/api/groups');
const categories = require('../src/categories');

describe('Back-End: User Rol Teacher', () => {
	let testUserDataTeacher;
	let testUserDataStudent;
	let dataCourseTest1;
	let dataCourseTest2;

	let testUid;
	let adminDataUser;

	let teacherGroup;

	before(async () => {
		global.config = { userLang: 'en-GB' };

		adminDataUser = {
			username: 'juniorAdmin',
			fullname: 'Junior Miguel Lara Torres 3',
			password: 'admin1234!',
			email: 'juniorAdmin@gmail.com',
			callback: undefined,
		};

		testUserDataTeacher = {
			username: 'juniorTeacher',
			fullname: 'Junior Miguel Lara Torres 1',
			password: 'admin1234!',
			email: 'juniorTeacher@gmail.com',
			isProfessor: true,
			callback: undefined,
		};

		testUserDataStudent = {
			username: 'juniorStudent',
			fullname: 'Junior Miguel Lara Torres 2',
			password: 'admin1234!',
			email: 'juniorStudent@gmail.com',
			isProfessor: false,
			callback: undefined,
		};

		teacherGroup = await groups.create({
			name: 'Teachers',
			userTitle: 'Teacher',
			description: 'List of Professors',
			hidden: 0,
			private: 1,
			system: true,
			disableJoinRequests: 1,
		});
		dataCourseTest1 = {
			name: 'CI3715 | Ingenieria de Software I | SD 2024 | Sec. 1',
			userTitle: 'Ingenieria de Software I',
			description: '',
			hidden: 0,
			private: 1,
			disableJoinRequests: 0,
		};
		dataCourseTest2 = {
			name: 'CI4835 | Redes de Computadoras I | SD 2024 | Sec. 1',
			userTitle: 'Redes de Computadoras I',
			description: '',
			hidden: 0,
			private: 1,
			disableJoinRequests: 0,
		};
	});

	// ******************** Teachers ********************
	describe('Create user as Teacher', async () => {
		it('create a new', async () => {
			testUid = await User.create(testUserDataTeacher);
			assert.ok(testUid);
			User.getUserData(testUid, (err, userObj) => {
				assert.ifError(err);
				assert.strictEqual(userObj.username, testUserDataTeacher.username);
			});
		});

		it('should be a Teacher', async () => {
			groups.get('Teachers', {}, (err, groupObj) => {
				assert.ifError(err);
				assert.strictEqual(groupObj.name, teacherGroup.name);
				assert.strictEqual(groupObj.memberCount, 1);
				assert.strictEqual(groupObj.members[0].uid, testUid);
			});
		});

		it('should be only one Teacher', async () => {
			groups.getGroups('groups', 0, -1, (err, groupsObjs) => {
				assert.ifError(err);
				groupsObjs.forEach((groupObj) => {
					if (groupObj.memberCount !== 0) {
						groupObj.members.forEach((memberObj) => {
							if (groupObj.name === teacherGroup.name) {
								assert.strictEqual(groupObj.memberCount, 1);
								assert.strictEqual(memberObj.uid, testUid);
							} else {
								assert.notStrictEqual(memberObj.uid, testUid);
							}
						});
					}
				});
			});
		});

		it('teachers should be able to create a courses', async () => {
			const descriptionCategory = `💬 ¡Bienvenidos al fascinante ambiente de preguntas y respuestas en &quot;Ingenieria de Software I&quot; (CI3715)! 
		Este espacio se lleva a cabo en el trimestre Septiembre-Diciembre del año 2024, en la sección 1. 
		Bajo la moderación experta de el&#x2F;la Prof. ${testUserDataTeacher.fullname} 👨‍🏫👩‍🏫.`;

			apiGroups.create({ uid: testUid }, dataCourseTest1, (err, groupObj) => {
				assert.ifError(err);
				assert.strictEqual(groupObj.memberCount, 1);
				assert.strictEqual(groupObj.creatorUID, testUid);
				assert.strictEqual(groupObj.name, dataCourseTest1.name);

				categories.getAllCategories((err, allCategories) => {
					assert.ifError(err);
					assert.strictEqual(allCategories.lenght, 1);
					allCategories.forEach((categoryObj) => {
						if (categoryObj.name === dataCourseTest1.name) {
							assert.strictEqual(categoryObj.description, descriptionCategory);
						}
					});
				});
			});
		});

		it('teachers should be able to delete a course of their own', async () => {
			apiGroups.create({ uid: testUid }, dataCourseTest1, (err, groupObj) => {
				assert.ifError(err);
				assert.strictEqual(groupObj.memberCount, 1);
				assert.strictEqual(groupObj.creatorUID, testUid);
				assert.strictEqual(groupObj.name, dataCourseTest1.name);

				apiGroups.delete({ uid: testUid }, groupObj, (err) => {
					assert.ifError(err);

					groups.exists(dataCourseTest1.name, (err, exists) => {
						assert.ifError(err);
						assert.strictEqual(exists, false);

						categories.getAllCategories((err, allCategories) => {
							assert.ifError(err);
							assert.strictEqual(allCategories.lenght, 0);
						});
					});
				});
			});
		});

		it('the category associated with the course should be self-deleted if the owner leaves the course and there are no more owners', async () => {
			apiGroups.create({ uid: testUid }, dataCourseTest1, (err, groupObj) => {
				assert.ifError(err);
				assert.strictEqual(groupObj.memberCount, 1);
				assert.strictEqual(groupObj.creatorUID, testUid);
				assert.strictEqual(groupObj.name, dataCourseTest1.name);

				categories.getAllCategories((err, allCategories) => {
					assert.ifError(err);
					assert.strictEqual(allCategories.lenght, 1);

					apiGroups.leave({ uid: testUid }, groupObj, (err) => {
						assert.ifError(err);

						groups.exists(dataCourseTest1.name, (err, exists) => {
							assert.ifError(err);
							assert.strictEqual(exists, false);

							categories.getAllCategories((err, allCategories) => {
								assert.ifError(err);
								assert.strictEqual(allCategories.lenght, 0);
							});
						});
					});
				});
			});
		});
	});

	// ******************** Students ********************
	describe('Create user as Student', async () => {
		it('create a new user as Student', async () => {
			testUid = await User.create(testUserDataStudent);
			assert.ok(testUid);
			User.getUserData(testUid, (err, userObj) => {
				assert.ifError(err);
				assert.strictEqual(userObj.username, testUserDataStudent.username);
			});
		});

		it('should be a Student', async () => {
			groups.get('Teachers', {}, (err, groupObj) => {
				assert.ifError(err);
				assert.strictEqual(groupObj.name, teacherGroup.name);
				assert.strictEqual(groupObj.memberCount, 1); // Sólo existe un miembro y no es el recien creado.
				assert.notStrictEqual(groupObj.members[0].uid, testUid);
			});
		});

		it('should only be a student', async () => {
			groups.getGroups('groups', 0, -1, (err, groupsObjs) => {
				assert.ifError(err);
				groupsObjs.forEach((groupObj) => {
					if (groupObj.memberCount !== 0) {
						groupObj.members.forEach((memberObj) => {
							assert.notStrictEqual(memberObj.uid, testUid);
						});
					}
				});
			});
		});

		it('students should not be able to create a courses', async () => {
			try {
				await apiGroups.create({ uid: testUid }, dataCourseTest2);
			} catch (err) {
				return assert.strictEqual(err.message, '[[error:no-privileges]]');
			}
		});
	});

	describe('Actions of administrators', async () => {
		it('auto group deletion when admin deletes the associated category', async () => {
			User.create(adminDataUser, (err, userUid) => {
				assert.ifError(err);

				groups.join('administrators', userUid, (err) => {
					assert.ifError(err);

					groups.get('administrators', { uid: userUid }, (err, groupAdminObj) => {
						assert.ifError(err);
						assert.strictEqual(groupAdminObj.name, 'administrators');
						assert.strictEqual(groupAdminObj.memberCount, 1);

						apiGroups.create({ uid: userUid }, dataCourseTest2, (err, groupObj) => {
							assert.ifError(err);
							assert.strictEqual(groupObj.name, dataCourseTest2.name);
							assert.strictEqual(groupObj.memberCount, 1);

							categories.getAllCategories((err, allCategoriesObj1) => {
								assert.ifError(err);
								assert.strictEqual(allCategoriesObj1.lenght, 1);
								assert.strictEqual(allCategoriesObj1[0].name, dataCourseTest2.name);

								categories.purge(allCategoriesObj1[0].cid, userUid, (err) => {
									assert.ifError(err);

									categories.getAllCategories((err, allCategoriesObj2) => {
										assert.ifError(err);
										assert.strictEqual(allCategoriesObj2.lenght, 0);
									});
								});
							});
						});
					});
				});
			});
		});
	});
});
