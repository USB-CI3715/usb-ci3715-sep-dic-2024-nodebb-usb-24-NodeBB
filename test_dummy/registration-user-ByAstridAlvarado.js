'use strict';

const assert = require('assert');
const { JSDOM } = require('jsdom');
const db = require('./mocks/databasemock');
const User = require('../src/user');

describe('User  Registration', () => {
	let user;

	before(() => {
		// Simulación de un nuevo usuario para las pruebas
		user = {
			username: 'newUser',
			password: 'password123',
			fullname: 'New User',
			email: 'newuser@example.com', // Agregamos un email para la creación del usuario
			gdpr_consent: true,
			acceptTos: true,
		};
	});

	it('should create a user with fullname and showfullname setting by default', async () => {
		const uid = await User.create(user);
		const createdUser = await User.getUserData(uid); // Obtenemos el usuario creado usando su UID
		const settings = await User.getSettings(uid); // Obtenemos las configuraciones del usuario creado


		assert.strictEqual(createdUser.fullname, 'New User');
		assert.strictEqual(createdUser.username, 'newUser');
		assert.strictEqual(createdUser.uid, uid); // Verifica que el UID sea correcto
		assert.strictEqual(settings.showfullname, true);
	});

	describe('Full Name Validation', () => {
		let fullnameInput;
		let fullnameNotify;

		before(() => {
			const dom = new JSDOM('<html><body></body></html>');
			global.window = dom.window;
			global.document = dom.window.document;

			global.jQuery = require('jquery');
			global.$ = global.jQuery;
			const { $ } = global;

			// DOM para las pruebas
			global.document.body.innerHTML = `
                <input id="fullname" type="text" />
                <div id="fullname-notify"></div>
            `;

			global.define = function (moduleName, dependencies, factory) {
				global[moduleName] = factory(...dependencies.map(dep => global[dep]));
			};

			const register = require('../public/src/client/register');
			register.init;

			fullnameInput = $('#fullname');
			fullnameNotify = $('#fullname-notify');
		});

		it('should show an error if fullname is too short', () => {
			fullnameInput.val('A', (err) => {
				assert.ifError(err);
				fullnameInput.trigger('blur', (err) => {
					assert.ifError(err);

					assert.equal(fullnameNotify.html(), '[[error:fullname-too-short]]');
					assert.equal(fullnameInput.attr('aria-invalid'), 'true', 'El atributo aria-invalid debería ser true');
				});
			});
		});

		it('should show an error if fullname is too long', () => {
			fullnameInput.val('A'.repeat(121), (err) => {
				assert.ifError(err);
				fullnameInput.trigger('blur', (err) => {
					assert.ifError(err);

					assert.equal(fullnameNotify.html(), '[[error:fullname-too-long]]', 'Fullname should not be too long');
					assert.equal(fullnameInput.attr('aria-invalid'), 'true', 'El atributo aria-invalid debería ser true');
				});
			});
		});

		it('should show an error if fullname contains invalid characters', () => {
			fullnameInput.val('John123', (err) => {
				assert.ifError(err);
				fullnameInput.trigger('blur', (err) => {
					assert.ifError(err);

					assert.equal(fullnameNotify.html(), '[[error:fullname-with-invalid-characters]]', 'Fullname should not contain invalid characters');
					assert.equal(fullnameInput.attr('aria-invalid'), 'true', 'El atributo aria-invalid debería ser true');
				});
			});
		});
	});
});
