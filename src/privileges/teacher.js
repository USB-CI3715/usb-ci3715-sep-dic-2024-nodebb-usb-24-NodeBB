
'use strict';

const _ = require('lodash');

const user = require('../user');
const groups = require('../groups');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');

const privsTeacher = module.exports;

/**
 * Looking to add a new teacher privilege via plugin/theme? Attach a hook to
 * `static:privileges.teacher.init` and call .set() on the privilege map passed
 * in to your listener.
 */
const _privilegeTeacherMap = new Map([
	['teacher:dashboard', { label: '[[teacher/manage/privileges:teacher-dashboard]]', type: 'teacher' }],
	['teacher:categories', { label: '[[teacher/manage/privileges:teacher-categories]]', type: 'teacher' }],
	['teacher:privileges', { label: '[[teacher/manage/privileges:teacher-privileges]]', type: 'teacher' }],
	// ['teacher:teachers-mods', { label: '[[teacher/manage/privileges:teacher-teachers-mods]]', type: 'teacher' }],
	['teacher:users', { label: '[[teacher/manage/privileges:teacher-users]]', type: 'teacher' }],
	['teacher:groups', { label: '[[teacher/manage/privileges:teacher-groups]]', type: 'teacher' }],
	['teacher:tags', { label: '[[teacher/manage/privileges:teacher-tags]]', type: 'teacher' }],
	['teacher:settings', { label: '[[teacher/manage/privileges:teacher-settings]]', type: 'teacher' }],
]);

privsTeacher.init = async () => {
	await plugins.hooks.fire('static:privileges.teacher.init', {
		privileges: _privilegeTeacherMap,
	});

	for (const [, value] of _privilegeTeacherMap) {
		if (value && !value.type) {
			value.type = 'other';
		}
	}
};

privsTeacher.getUserPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.teacher.list', Array.from(_privilegeTeacherMap.keys()));
privsTeacher.getGroupPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.teacher.groups.list', Array.from(_privilegeTeacherMap.keys()).map(privilege => `groups:${privilege}`));
privsTeacher.getPrivilegeList = async () => {
	const [user, group] = await Promise.all([
		privsTeacher.getUserPrivilegeList(),
		privsTeacher.getGroupPrivilegeList(),
	]);
	return user.concat(group);
};

// Mapping for a page route (via direct match or regexp) to a privilege
privsTeacher.routeMap = {
	dashboard: 'teacher:dashboard',
	'manage/categories': 'teacher:categories',
	'manage/privileges': 'teacher:privileges',
	// 'manage/teachers-mods': 'teacher:teachers-mods',
	'manage/users': 'teacher:users',
	'manage/groups': 'teacher:groups',
	'manage/tags': 'teacher:tags',
	'settings/tags': 'teacher:tags',
	'extend/plugins': 'teacher:settings',
	'extend/widgets': 'teacher:settings',
	'extend/rewards': 'teacher:settings',
	// uploads
	'category/uploadpicture': 'teacher:categories',
	uploadfavicon: 'teacher:settings',
	uploadTouchIcon: 'teacher:settings',
	uploadMaskableIcon: 'teacher:settings',
	uploadlogo: 'teacher:settings',
	uploadOgImage: 'teacher:settings',
	uploadDefaultAvatar: 'teacher:settings',
};
privsTeacher.routePrefixMap = {
	'dashboard/': 'teacher:dashboard',
	'manage/categories/': 'teacher:categories',
	'manage/privileges/': 'teacher:privileges',
	'manage/groups/': 'teacher:groups',
	'settings/': 'teacher:settings',
	'appearance/': 'teacher:settings',
	'plugins/': 'teacher:settings',
};

// Mapping for socket call methods to a privilege
// In NodeBB v2, these socket calls will be removed in favour of xhr calls
privsTeacher.socketMap = {
	'teacher.rooms.getAll': 'teacher:dashboard',
	'teacher.analytics.get': 'teacher:dashboard',

	'teacher.categories.copySettingsFrom': 'teacher:categories',
	'teacher.categories.copyPrivilegesToChildren': 'teacher:privileges',
	'teacher.categories.copyPrivilegesFrom': 'teacher:privileges',
	'teacher.categories.copyPrivilegesToAllCategories': 'teacher:privileges',

	// 'teacher.user.maketeachers': 'teacher:teachers-mods',
	// 'teacher.user.removeteachers': 'teacher:teachers-mods',

	'teacher.user.loadGroups': 'teacher:users',
	'teacher.groups.join': 'teacher:users',
	'teacher.groups.leave': 'teacher:users',
	'teacher.user.resetLockouts': 'teacher:users',
	'teacher.user.validateEmail': 'teacher:users',
	'teacher.user.sendValidationEmail': 'teacher:users',
	'teacher.user.sendPasswordResetEmail': 'teacher:users',
	'teacher.user.forcePasswordReset': 'teacher:users',
	'teacher.user.invite': 'teacher:users',

	'teacher.tags.create': 'teacher:tags',
	'teacher.tags.rename': 'teacher:tags',
	'teacher.tags.deleteTags': 'teacher:tags',

	'teacher.getSearchDict': 'teacher:settings',
	'teacher.config.setMultiple': 'teacher:settings',
	'teacher.config.remove': 'teacher:settings',
	'teacher.themes.getInstalled': 'teacher:settings',
	'teacher.themes.set': 'teacher:settings',
	'teacher.reloadAllSessions': 'teacher:settings',
	'teacher.settings.get': 'teacher:settings',
	'teacher.settings.set': 'teacher:settings',
};

privsTeacher.resolve = (path) => {
	if (privsTeacher.routeMap.hasOwnProperty(path)) {
		return privsTeacher.routeMap[path];
	}

	const found = Object.entries(privsTeacher.routePrefixMap)
		.filter(entry => path.startsWith(entry[0]))
		.sort((entry1, entry2) => entry2[0].length - entry1[0].length);
	if (!found.length) {
		return undefined;
	}
	return found[0][1]; // [0] is path [1] is privilege
};

privsTeacher.list = async function (uid) {
	const privilegeLabels = Array.from(_privilegeTeacherMap.values()).map(data => data.label);
	const userPrivilegeList = await privsTeacher.getUserPrivilegeList();
	const groupPrivilegeList = await privsTeacher.getGroupPrivilegeList();

	// Restrict privileges column to superteachers
	if (!(await user.isTeacher(uid))) {
		const idx = Array.from(_privilegeTeacherMap.keys()).indexOf('teacher:privileges');
		privilegeLabels.splice(idx, 1);
		userPrivilegeList.splice(idx, 1);
		groupPrivilegeList.splice(idx, 1);
	}

	const labels = await utils.promiseParallel({
		users: plugins.hooks.fire('filter:privileges.teacher.list_human', privilegeLabels.slice()),
		groups: plugins.hooks.fire('filter:privileges.teacher.groups.list_human', privilegeLabels.slice()),
	});

	const keys = {
		users: userPrivilegeList,
		groups: groupPrivilegeList,
	};

	const payload = await utils.promiseParallel({
		labels,
		labelData: Array.from(_privilegeTeacherMap.values()),
		users: helpers.getUserPrivileges(0, keys.users),
		groups: helpers.getGroupPrivileges(0, keys.groups),
	});
	payload.keys = keys;

	return payload;
};

privsTeacher.get = async function (uid) {
	const userPrivilegeList = await privsTeacher.getUserPrivilegeList();
	const [userPrivileges, isteacheristrator] = await Promise.all([
		helpers.isAllowedTo(userPrivilegeList, uid, 0),
		user.isteacheristrator(uid),
	]);

	const combined = userPrivileges.map(allowed => allowed || isteacheristrator);
	const privData = _.zipObject(userPrivilegeList, combined);

	privData.superteacher = isteacheristrator;
	return await plugins.hooks.fire('filter:privileges.teacher.get', privData);
};

privsTeacher.can = async function (privilege, uid) {
	const [isUserAllowedTo, isteacheristrator] = await Promise.all([
		helpers.isAllowedTo(privilege, uid, [0]),
		user.isTeacher(uid),
	]);
	return isteacheristrator || isUserAllowedTo[0];
};

privsTeacher.canGroup = async function (privilege, groupName) {
	return await groups.isMember(groupName, `cid:0:privileges:groups:${privilege}`);
};

privsTeacher.give = async function (privileges, groupName) {
	await helpers.giveOrRescind(groups.join, privileges, 0, groupName);
	plugins.hooks.fire('action:privileges.teacher.give', {
		privileges: privileges,
		groupNames: Array.isArray(groupName) ? groupName : [groupName],
	});
};

privsTeacher.rescind = async function (privileges, groupName) {
	await helpers.giveOrRescind(groups.leave, privileges, 0, groupName);
	plugins.hooks.fire('action:privileges.teacher.rescind', {
		privileges: privileges,
		groupNames: Array.isArray(groupName) ? groupName : [groupName],
	});
};

privsTeacher.userPrivileges = async function (uid) {
	const userPrivilegeList = await privsTeacher.getUserPrivilegeList();
	return await helpers.userOrGroupPrivileges(0, uid, userPrivilegeList);
};

privsTeacher.groupPrivileges = async function (groupName) {
	const groupPrivilegeList = await privsTeacher.getGroupPrivilegeList();
	return await helpers.userOrGroupPrivileges(0, groupName, groupPrivilegeList);
};

privsTeacher.getUidsWithPrivilege = async function (privilege) {
	const uidsByCid = await helpers.getUidsWithPrivilege([0], privilege);
	return uidsByCid[0];
};
