'use strict';

const async = require('async');

const db = require('../database');
const plugins = require('../plugins');
// const privileges = require('../privileges');
const utils = require('../utils');
const slugify = require('../slugify');
const cache = require('../cache');

module.exports = function (Urgencies) {
	Urgencies.create = async function (data) {
		const parentCid = data.parentCid ? data.parentCid : 0;
		const [urgentId, firstChild] = await Promise.all([
			db.incrObjectField('global', 'nextUrgId'),
			db.getSortedSetRangeWithScores(`urg_id:${parentCid}:children`, 0, 0),
		]);

		data.name = String(data.name || `Urgency ${urgentId}`);
		const slug = `${urgentId}/${slugify(data.name)}`;
		const smallestOrder = firstChild.length ? firstChild[0].score - 1 : 1;
		const order = data.order || smallestOrder; // If no order provided, place it at the top
		const colours = Urgencies.assignColours();

		let urgencyInfo = {
			urg_id: urgentId || order,
			name: data.name,
			description: data.description ? data.description : '',
			descriptionParsed: data.descriptionParsed ? data.descriptionParsed : '',
			icon: data.icon ? data.icon : '',
			bgColor: data.bgColor || colours[0],
			color: data.color || colours[1],
			slug: slug,
			parentCid: parentCid,
			topic_count: 0,
			post_count: 0,
			disabled: data.disabled ? 1 : 0,
			order: order,
			link: data.link || '',
			numRecentReplies: 1,
			class: (data.class ? data.class : 'col-md-3 col-6'),
			imageClass: 'cover',
			isSection: 0,
			subCategoriesPerPage: 10,
		};

		if (data.backgroundImage) {
			urgencyInfo.backgroundImage = data.backgroundImage;
		}

		const defaultPrivileges = [
			'groups:find',
			'groups:read',
			'groups:topics:read',
			'groups:topics:create',
			'groups:topics:reply',
			'groups:topics:tag',
			'groups:posts:edit',
			'groups:posts:history',
			'groups:posts:delete',
			'groups:posts:upvote',
			'groups:posts:downvote',
			'groups:topics:delete',
		];
		const modPrivileges = defaultPrivileges.concat([
			'groups:topics:schedule',
			'groups:posts:view_deleted',
			'groups:purge',
		]);
		const guestPrivileges = ['groups:find', 'groups:read', 'groups:topics:read'];

		const result = await plugins.hooks.fire('filter:urgency.create', {
			urgency: urgencyInfo,
			data: data,
			defaultPrivileges: defaultPrivileges,
			modPrivileges: modPrivileges,
			guestPrivileges: guestPrivileges,
		});
		urgencyInfo = result.urgency;

		await db.setObject(`urgency:${urgencyInfo.cid}`, urgencyInfo);
		if (!urgencyInfo.descriptionParsed) {
			await Urgencies.parseDescription(urgencyInfo.cid, urgencyInfo.description);
		}

		await db.sortedSetAddBulk([
			['urgencies:urg_id', urgencyInfo.order, urgencyInfo.cid],
			[`urg_id:${parentCid}:children`, urgencyInfo.order, urgencyInfo.cid],
			['urgencies:name', 0, `${data.name.slice(0, 200).toLowerCase()}:${urgencyInfo.cid}`],
		]);

		// await privileges.categories.give(result.defaultPrivileges, urgencyInfo.cid, 'registered-users');
		// await privileges.categories.give(result.modPrivileges, urgencyInfo.cid, ['administrators', 'Global Moderators']);
		// await privileges.categories.give(result.guestPrivileges, urgencyInfo.cid, ['guests', 'spiders']);

		cache.del('urgencies:cid');
		await clearParentCategoryCache(parentCid);

		if (data.cloneFromCid && parseInt(data.cloneFromCid, 10)) {
			urgencyInfo = await Urgencies.copySettingsFrom(data.cloneFromCid, urgencyInfo.cid, !data.parentCid);
		}

		if (data.cloneChildren) {
			await duplicateCategoriesChildren(urgencyInfo.cid, data.cloneFromCid, data.uid);
		}

		plugins.hooks.fire('action:urgency.create', { category: urgencyInfo });
		return urgencyInfo;
	};

	async function clearParentCategoryCache(parentUrgid) {
		while (parseInt(parentUrgid, 10) >= 0) {
			cache.del([
				`urg_id:${parentUrgid}:children`,
				`urg_id:${parentUrgid}:children:all`,
			]);

			if (parseInt(parentUrgid, 10) === 0) {
				return;
			}
			// clear all the way to root
			// eslint-disable-next-line no-await-in-loop
			parentUrgid = await Urgencies.getCategoryField(parentUrgid, 'parentUrgid');
		}
	}

	async function duplicateCategoriesChildren(parentUrgid, urg_id, uid) {
		let children = await Urgencies.getChildren([urg_id], uid);
		if (!children.length) {
			return;
		}

		children = children[0];

		children.forEach((child) => {
			child.parentCid = parentUrgid;
			child.cloneFromCid = child.cid;
			child.cloneChildren = true;
			child.name = utils.decodeHTMLEntities(child.name);
			child.description = utils.decodeHTMLEntities(child.description);
			child.uid = uid;
		});

		await async.each(children, Urgencies.create);
	}

	Urgencies.assignColours = function () {
		const backgrounds = ['#AB4642', '#DC9656', '#F7CA88', '#A1B56C', '#86C1B9', '#7CAFC2', '#BA8BAF', '#A16946'];
		const text = ['#ffffff', '#ffffff', '#333333', '#ffffff', '#333333', '#ffffff', '#ffffff', '#ffffff'];
		const index = Math.floor(Math.random() * backgrounds.length);
		return [backgrounds[index], text[index]];
	};
};
