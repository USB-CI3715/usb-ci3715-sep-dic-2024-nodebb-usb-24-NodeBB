'use strict';

const validator = require('validator');

const privileges = require('../privileges');
const events = require('../events');
const groups = require('../groups');
const user = require('../user');
const meta = require('../meta');
const notifications = require('../notifications');
const slugify = require('../slugify');
const categories = require('../categories');

// Funcion para buscar el CID de la categoria segun el nombre del grupo.
function getCategoryCIDByName(categories, targetName) {
	for (let i = 0; i < categories.length; i++) {
		if (categories[i].name === targetName) {
			return categories[i].cid;
		}
	}
	return null; // Retorna null si no se encuentra la categoría
}

const groupsAPI = module.exports;

groupsAPI.list = async (caller, data) => {
	const groupsPerPage = 10;
	const start = parseInt(data.after || 0, 10);
	const stop = start + groupsPerPage - 1;
	const groupData = await groups.getGroupsBySort(data.sort, start, stop);

	return { groups: groupData, nextStart: stop + 1 };
};

groupsAPI.create = async function (caller, data) {
	if (!caller.uid) {
		throw new Error('[[error:no-privileges]]');
	} else if (!data) {
		throw new Error('[[error:invalid-data]]');
	} else if (typeof data.name !== 'string' || groups.isPrivilegeGroup(data.name)) {
		throw new Error('[[error:invalid-group-name]]');
	}

	const canCreate = await privileges.global.can('group:create', caller.uid);
	if (!canCreate) {
		throw new Error('[[error:no-privileges]]');
	}
	data.ownerUid = caller.uid;
	data.system = false;
	data.creatorUid = caller.uid;
	const groupData = await groups.create(data);

	// Creación de categoria respectiva al grupo. Se crea la categoría si el grupo creado tiene el formato
	// `[codigo] | [Nombre] | [Trimestre y Año] | Sec. [# Seccion]`
	const courseData = groupData.name.split(' | ');
	if (courseData.length === 4) {
		const courseCode = courseData[0]; // Código del curso
		const courseName = courseData[1]; // Nombre del curso

		const timeCourseData = courseData[2].split(' '); // Momento en que se imparte el curso
		// Diccionario para transformar los códigos de trimestre a sus significados
		const trimesterDictionary = {
			EM: 'Enero-Marzo',
			AJ: 'Abril-Julio',
			SD: 'Septiembre-Diciembre',
			PI: 'Periodo Intensivo',
			SC: 'Periodo Intensivo',
		};
		const trimester = trimesterDictionary[timeCourseData[0]]; // Trimestre del curso
		const year = timeCourseData[1]; // Año del curso

		const section = courseData[3].split(' ')[1]; // Sección asociada al curso.

		const [fullDataGroup] = await Promise.all([groups.get(groupData.name, {})]);
		console.log(fullDataGroup);
		const teacher = await user.getUserFields(fullDataGroup.creatorUid, ['fullname']); // Profesor respectivo del curso.

		const descriptionCurse = `💬 ¡Bienvenidos al fascinante ambiente de preguntas y respuestas en "${courseName}" (${courseCode})! 
		Este espacio se lleva a cabo en el trimestre ${trimester} del año ${year}, en la sección ${section}. 
		Bajo la moderación experta de el/la Prof. ${teacher.fullname} 👨‍🏫👩‍🏫.`;

		// Inicialización de la categoría
		const dataCategory = {
			name: groupData.name,
			parentCid: null,
			order: null,
			description: descriptionCurse,
			descriptionParsed: descriptionCurse,
			icon: 'fa-book',
			bgColor: null,
			color: null,
			disabled: 0,
			link: null,
			class: null,
			backgroundImage: null,
			cloneFromCid: null,
			cloneChildren: null,
		};
		const categoryData = await categories.create(dataCategory);

		data.memberPostCids = `${categoryData.cid}`;
		await groups.update(groupData.name, data);
	}


	logGroupEvent(caller, 'group-create', {
		groupName: data.name,
	});

	return groupData;
};


groupsAPI.update = async function (caller, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	await isOwner(caller, groupName);

	delete data.slug;
	await groups.update(groupName, data);

	return await groups.getGroupData(data.name || groupName);
};

groupsAPI.delete = async function (caller, data) {
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	await isOwner(caller, groupName);
	if (
		groups.systemGroups.includes(groupName) ||
		groups.ephemeralGroups.includes(groupName)
	) {
		throw new Error('[[error:not-allowed]]');
	}

	const allCategories = await categories.getAllCategories();
	const targetName = groupName;
	const cid = getCategoryCIDByName(allCategories, targetName);
	if (cid) {
		// Eliminacion de la categoría asociada al grupo.
		await categories.purge(cid, caller.uid);
	}

	await groups.destroy(groupName);

	logGroupEvent(caller, 'group-delete', {
		groupName: groupName,
	});
};

groupsAPI.listMembers = async (caller, data) => {
	// v4 wishlist — search should paginate (with lru caching I guess) to match index listing behaviour
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);

	await canSearchMembers(caller.uid, groupName);
	if (!await privileges.global.can('search:users', caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	const { query } = data;
	const after = parseInt(data.after || 0, 10);
	let response;
	if (query && query.length) {
		response = await groups.searchMembers({
			uid: caller.uid,
			query,
			groupName,
		});
		response.nextStart = null;
	} else {
		response = {
			users: await groups.getOwnersAndMembers(groupName, caller.uid, after, after + 19),
			nextStart: after + 20,
			matchCount: null,
			timing: null,
		};
	}

	return response;
};

async function canSearchMembers(uid, groupName) {
	const [isHidden, isMember, hasAdminPrivilege, isGlobalMod, viewGroups] = await Promise.all([
		groups.isHidden(groupName),
		groups.isMember(uid, groupName),
		privileges.admin.can('admin:groups', uid),
		user.isGlobalModerator(uid),
		privileges.global.can('view:groups', uid),
	]);

	if (!viewGroups || (isHidden && !isMember && !hasAdminPrivilege && !isGlobalMod)) {
		throw new Error('[[error:no-privileges]]');
	}
}

groupsAPI.join = async function (caller, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	if (caller.uid <= 0 || !data.uid) {
		throw new Error('[[error:invalid-uid]]');
	}

	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	if (!groupName) {
		throw new Error('[[error:no-group]]');
	}

	const isCallerAdmin = await privileges.admin.can('admin:groups', caller.uid);
	if (!isCallerAdmin && (
		groups.systemGroups.includes(groupName) ||
		groups.isPrivilegeGroup(groupName)
	)) {
		throw new Error('[[error:not-allowed]]');
	}

	const [groupData, userExists] = await Promise.all([
		groups.getGroupData(groupName),
		user.exists(data.uid),
	]);

	if (!userExists) {
		throw new Error('[[error:invalid-uid]]');
	}

	const isSelf = parseInt(caller.uid, 10) === parseInt(data.uid, 10);
	if (!meta.config.allowPrivateGroups && isSelf) {
		// all groups are public!
		await groups.join(groupName, data.uid);
		logGroupEvent(caller, 'group-join', {
			groupName: groupName,
			targetUid: data.uid,
		});
		return;
	}

	if (!isCallerAdmin && isSelf && groupData.private && groupData.disableJoinRequests) {
		throw new Error('[[error:group-join-disabled]]');
	}

	if ((!groupData.private && isSelf) || isCallerAdmin) {
		await groups.join(groupName, data.uid);
		logGroupEvent(caller, `group-${isSelf ? 'join' : 'add-member'}`, {
			groupName: groupName,
			targetUid: data.uid,
		});
	} else if (isSelf) {
		await groups.requestMembership(groupName, caller.uid);
		logGroupEvent(caller, 'group-request-membership', {
			groupName: groupName,
			targetUid: data.uid,
		});
	} else {
		throw new Error('[[error:not-allowed]]');
	}
};

groupsAPI.leave = async function (caller, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	if (caller.uid <= 0) {
		throw new Error('[[error:invalid-uid]]');
	}
	const isSelf = parseInt(caller.uid, 10) === parseInt(data.uid, 10);
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	if (!groupName) {
		throw new Error('[[error:no-group]]');
	}

	if (typeof groupName !== 'string') {
		throw new Error('[[error:invalid-group-name]]');
	}

	if (groupName === 'administrators' && isSelf) {
		throw new Error('[[error:cant-remove-self-as-admin]]');
	}

	const [groupData, isCallerOwner, userExists, isMember] = await Promise.all([
		groups.getGroupData(groupName),
		isOwner(caller, groupName, false),
		user.exists(data.uid),
		groups.isMember(data.uid, groupName),
	]);

	if (!isMember) {
		throw new Error('[[error:group-not-member]]');
	}

	if (!userExists) {
		throw new Error('[[error:invalid-uid]]');
	}

	if (groupData.disableLeave && isSelf) {
		throw new Error('[[error:group-leave-disabled]]');
	}

	if (isSelf || isCallerOwner) {
		await groups.leave(groupName, data.uid);
	} else {
		throw new Error('[[error:no-privileges]]');
	}

	const { displayname } = await user.getUserFields(data.uid, ['username']);

	const notification = await notifications.create({
		type: 'group-leave',
		bodyShort: `[[groups:membership.leave.notification-title, ${displayname}, ${groupName}]]`,
		nid: `group:${validator.escape(groupName)}:uid:${data.uid}:group-leave`,
		path: `/groups/${slugify(groupName)}`,
		from: data.uid,
	});
	const uids = await groups.getOwners(groupName);
	await notifications.push(notification, uids);

	// Eliminar grupo en caso de quedar sin propietarios
	if (isCallerOwner && uids.length === 0) {
		const allCategories = await categories.getAllCategories();
		const targetName = groupName;
		const cid = getCategoryCIDByName(allCategories, targetName);

		if (cid) {
			await groups.destroy(groupName); // Eliminacion del grupo.
			await categories.purge(cid, caller.uid); // Eliminacion de la categoría asociada al grupo.
		}
	}

	logGroupEvent(caller, `group-${isSelf ? 'leave' : 'kick'}`, {
		groupName: groupName,
		targetUid: data.uid,
	});
};

groupsAPI.grant = async (caller, data) => {
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	await isOwner(caller, groupName);

	await groups.ownership.grant(data.uid, groupName);
	logGroupEvent(caller, 'group-owner-grant', {
		groupName: groupName,
		targetUid: data.uid,
	});
};

groupsAPI.rescind = async (caller, data) => {
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	await isOwner(caller, groupName);

	await groups.ownership.rescind(data.uid, groupName);
	logGroupEvent(caller, 'group-owner-rescind', {
		groupName,
		targetUid: data.uid,
	});
};

groupsAPI.getPending = async (caller, { slug }) => {
	const groupName = await groups.getGroupNameByGroupSlug(slug);
	await isOwner(caller, groupName);

	return await groups.getPending(groupName);
};

groupsAPI.accept = async (caller, { slug, uid }) => {
	const groupName = await groups.getGroupNameByGroupSlug(slug);

	await isOwner(caller, groupName);
	const isPending = await groups.isPending(uid, groupName);
	if (!isPending) {
		throw new Error('[[error:group-user-not-pending]]');
	}

	await groups.acceptMembership(groupName, uid);
	logGroupEvent(caller, 'group-accept-membership', {
		groupName,
		targetUid: uid,
	});
};

groupsAPI.reject = async (caller, { slug, uid }) => {
	const groupName = await groups.getGroupNameByGroupSlug(slug);

	await isOwner(caller, groupName);
	const isPending = await groups.isPending(uid, groupName);
	if (!isPending) {
		throw new Error('[[error:group-user-not-pending]]');
	}

	await groups.rejectMembership(groupName, uid);
	logGroupEvent(caller, 'group-reject-membership', {
		groupName,
		targetUid: uid,
	});
};

groupsAPI.getInvites = async (caller, { slug }) => {
	const groupName = await groups.getGroupNameByGroupSlug(slug);
	await isOwner(caller, groupName);

	return await groups.getInvites(groupName);
};

groupsAPI.issueInvite = async (caller, { slug, uid }) => {
	const groupName = await groups.getGroupNameByGroupSlug(slug);
	await isOwner(caller, groupName);

	await groups.invite(groupName, uid);
	logGroupEvent(caller, 'group-invite', {
		groupName,
		targetUid: uid,
	});
};

groupsAPI.acceptInvite = async (caller, { slug, uid }) => {
	const groupName = await groups.getGroupNameByGroupSlug(slug);

	// Can only be called by the invited user
	const invited = await groups.isInvited(uid, groupName);
	if (caller.uid !== parseInt(uid, 10)) {
		throw new Error('[[error:not-allowed]]');
	}
	if (!invited) {
		throw new Error('[[error:not-invited]]');
	}

	await groups.acceptMembership(groupName, uid);
	logGroupEvent(caller, 'group-invite-accept', { groupName });
};

groupsAPI.rejectInvite = async (caller, { slug, uid }) => {
	const groupName = await groups.getGroupNameByGroupSlug(slug);

	// Can be called either by invited user, or group owner
	const owner = await isOwner(caller, groupName, false);
	const invited = await groups.isInvited(uid, groupName);

	if (!owner && caller.uid !== parseInt(uid, 10)) {
		throw new Error('[[error:not-allowed]]');
	}
	if (!invited) {
		throw new Error('[[error:not-invited]]');
	}

	await groups.rejectMembership(groupName, uid);
	if (!owner) {
		logGroupEvent(caller, 'group-invite-reject', { groupName });
	}
};

async function isOwner(caller, groupName, throwOnFalse = true) {
	if (typeof groupName !== 'string') {
		throw new Error('[[error:invalid-group-name]]');
	}
	const [hasAdminPrivilege, isGlobalModerator, isOwner, group] = await Promise.all([
		privileges.admin.can('admin:groups', caller.uid),
		user.isGlobalModerator(caller.uid),
		groups.ownership.isOwner(caller.uid, groupName),
		groups.getGroupData(groupName),
	]);

	const check = isOwner || hasAdminPrivilege || (isGlobalModerator && !group.system);
	if (!check && throwOnFalse) {
		throw new Error('[[error:no-privileges]]');
	}

	return check;
}

function logGroupEvent(caller, event, additional) {
	events.log({
		type: event,
		uid: caller.uid,
		ip: caller.ip,
		...additional,
	});
}
