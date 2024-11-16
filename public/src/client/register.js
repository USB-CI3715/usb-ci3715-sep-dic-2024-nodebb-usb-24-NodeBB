'use strict';


define('forum/register', [
	'translator', 'slugify', 'api', 'bootbox', 'forum/login', 'zxcvbn', 'jquery-form',
], function (translator, slugify, api, bootbox, Login, zxcvbn) {
	const Register = {};
	let validationError = false;
	const successIcon = '';

	Register.init = function () {
		const username = $('#username');
		const password = $('#password');
		const password_confirm = $('#password-confirm');
		const fullname = $('#fullname');
		const register = $('#register');

		handleLanguageOverride();

		$('#content #noscript').val('false');

		const query = utils.params();
		if (query.token) {
			$('#token').val(query.token);
		}

		// Update the "others can mention you via" text
		username.on('keyup', function () {
			$('#yourUsername').text(this.value.length > 0 ? slugify(this.value) : 'username');
		});

		username.on('blur', function () {
			if (username.val().length) {
				validateUsername(username.val());
			}
		});

		fullname.on('blur', function () {
			if (fullname.val().length) {
				validateFullname(fullname.val());
			}
		});

		password.on('blur', function () {
			if (password.val().length) {
				validatePassword(password.val(), password_confirm.val());
			}
		});

		password_confirm.on('blur', function () {
			if (password_confirm.val().length) {
				validatePasswordConfirm(password.val(), password_confirm.val());
			}
		});

		function validateForm(callback) {
			validationError = false;
			$('[aria-invalid="true"]').removeAttr('aria-invalid');

			validateFullname(fullname.val());
			validatePassword(password.val(), password_confirm.val());
			validatePasswordConfirm(password.val(), password_confirm.val());
			validateUsername(username.val(), callback);
		}

		// Guard against caps lock
		Login.capsLockCheck(document.querySelector('#password'), document.querySelector('#caps-lock-warning'));

		register.on('click', function (e) {
			const registerBtn = $(this);
			const errorEl = $('#register-error-notify');

			errorEl.addClass('hidden');
			e.preventDefault();
			validateForm(function () {
				if (validationError) {
					return;
				}

				registerBtn.addClass('disabled');

				registerBtn.parents('form').ajaxSubmit({
					headers: {
						'x-csrf-token': config.csrf_token,
					},
					success: function (data) {
						registerBtn.removeClass('disabled');
						if (!data) {
							return;
						}
						if (data.next) {
							const pathname = utils.urlToLocation(data.next).pathname;

							const params = utils.params({ url: data.next });
							params.registered = true;
							const qs = decodeURIComponent($.param(params));

							window.location.href = pathname + '?' + qs;
						} else if (data.message) {
							translator.translate(data.message, function (msg) {
								bootbox.alert(msg);
								ajaxify.go('/');
							});
						}
					},
					error: function (data) {
						translator.translate(data.responseText, config.defaultLang, function (translated) {
							if (data.status === 403 && data.responseText === 'Forbidden') {
								window.location.href = config.relative_path + '/register?error=csrf-invalid';
							} else {
								errorEl.find('p').text(translated);
								errorEl.removeClass('hidden');
								registerBtn.removeClass('disabled');
							}
						});
					},
				});
			});
		});

		// Set initial focus
		$('#username').trigger('focus');
	};

	function validateUsername(username, callback) {
		callback = callback || function () {};

		const username_notify = $('#username-notify');
		username_notify.text('');
		const usernameInput = $('#username');
		const userslug = slugify(username);
		if (username.length < ajaxify.data.minimumUsernameLength || userslug.length < ajaxify.data.minimumUsernameLength) {
			showError(usernameInput, username_notify, '[[error:username-too-short]]');
		} else if (username.length > ajaxify.data.maximumUsernameLength) {
			showError(usernameInput, username_notify, '[[error:username-too-long]]');
		} else if (!utils.isUserNameValid(username) || !userslug) {
			showError(usernameInput, username_notify, '[[error:invalid-username]]');
		} else {
			Promise.allSettled([
				api.head(`/users/bySlug/${userslug}`, {}),
				api.head(`/groups/${username}`, {}),
			]).then((results) => {
				if (results.every(obj => obj.status === 'rejected')) {
					showSuccess(usernameInput, username_notify, successIcon);
				} else {
					showError(usernameInput, username_notify, '[[error:username-taken]]');
				}

				callback();
			});
		}
	}

	function validateFullname(fullname) {
		const fullname_notify = $('#fullname-notify');
		const fullnameInput = $('#fullname');
		fullname_notify.text('');

		if (fullname.length > 120) {
			showError(fullnameInput, fullname_notify, '[[error:fullname-too-long]]');
		} else if (fullname.length < 2) {
			showError(fullnameInput, fullname_notify, '[[error:fullname-too-short]]');
		} else if (!/^[A-Za-zÀ-ÿ\s]+$/.test(fullname)) {
			showError(fullnameInput, fullname_notify, '[[error:fullname-with-invalid-characters]]');
		} else {
			showSuccess(fullnameInput, fullname_notify, successIcon);
		}
	}

	function validatePassword(password, password_confirm) {
		const passwordInput = $('#password');
		const password_notify = $('#password-notify');
		const password_confirm_notify = $('#password-confirm-notify');
		password_notify.text('');
		password_confirm_notify.text('');
		try {
			utils.assertPasswordValidity(password, zxcvbn);

			if (password === $('#username').val()) {
				throw new Error('[[user:password-same-as-username]]');
			}

			showSuccess(passwordInput, password_notify, successIcon);
		} catch (err) {
			showError(passwordInput, password_notify, err.message);
		}

		if (password !== password_confirm && password_confirm !== '') {
			showError(passwordInput, password_confirm_notify, '[[user:change-password-error-match]]');
		}
	}

	function validatePasswordConfirm(password, password_confirm) {
		const passwordConfirmInput = $('#password-confirm');
		const password_notify = $('#password-notify');
		const password_confirm_notify = $('#password-confirm-notify');
		password_confirm_notify.text('');
		if (!password || password_notify.hasClass('alert-error')) {
			return;
		}

		if (password !== password_confirm) {
			showError(passwordConfirmInput, password_confirm_notify, '[[user:change-password-error-match]]');
		} else {
			showSuccess(passwordConfirmInput, password_confirm_notify, successIcon);
		}
	}

	function showError(input, element, msg) {
		translator.translate(msg, function (msg) {
			input.attr('aria-invalid', 'true');
			element.html(msg);
			element.parent()
				.removeClass('register-success')
				.addClass('register-danger');
			element.show();
		});
		validationError = true;
	}

	function showSuccess(input, element, msg) {
		translator.translate(msg, function (msg) {
			input.removeAttr('aria-invalid');
			element.html(msg);
			element.parent()
				.removeClass('register-danger')
				.addClass('register-success');
			element.show();
		});
	}

	function handleLanguageOverride() {
		if (!app.user.uid && config.defaultLang !== config.userLang) {
			const formEl = $('[component="register/local"]');
			const langEl = $('<input type="hidden" name="userLang" value="' + config.userLang + '" />');

			formEl.append(langEl);
		}
	}

	return Register;
});
