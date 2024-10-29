
'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const topics = require('../topics');
const plugins = require('../plugins');
const cache = require('../cache');
const meta = require('../meta');

const Urgencies = module.exports;

require('./data')(Urgencies);
require('./create')(Urgencies);
require('./search')(Urgencies);

Urgencies.exists = async function (urg_ids) {
	return await db.exists(
		Array.isArray(urg_ids) ? urg_ids.map(urg_id => `urgency:${urg_id}`) : `urgency:${urg_ids}`
	);
};

Urgencies.getUrgencyById = async function (data) {
	const urgencies = await Urgencies.getUrgencies([data.urg_id]);
	if (!urgencies[0]) {
		return null;
	}
	const urgency = urgencies[0];
	data.urgency = urgency;

	const result = await plugins.hooks.fire('filter:urgency.get', {
		urgency: urgency,
		...data,
	});
	return { ...result.urgency };
};

Urgencies.onNewPostMade = async function (postData, urg_id) {
	if (!postData) {
		return;
	}
	const promises = [
		db.sortedSetAdd(`urg_id:${urg_id}:pids`, postData.timestamp, postData.pid),
		db.incrObjectField(`urgency:${urg_id}`, 'post_count'),
	];
	await Promise.all(promises);
};

Urgencies.getAllUrgIdsFromSet = async function (key) {
	let urgIds = cache.get(key);
	if (urgIds) {
		return urgIds.slice();
	}
	console.log('getAllUrgIdsFromSet', key);
	urgIds = await db.getSortedSetRange(key, 0, -1);
	urgIds = urgIds.map(urg_id => parseInt(urg_id, 10));
	cache.set(key, urgIds);
	return urgIds.slice();
};

Urgencies.getAllUrgencies = async function () {
	const urg_ids = await Urgencies.getAllUrgIdsFromSet('urgencies:urg_id');
	return await Urgencies.getUrgencies(urg_ids);
};

Urgencies.getModerators = async function (urg_id) {
	const uids = await Urgencies.getModeratorUids([urg_id]);
	return await user.getUsersFields(uids[0], ['uid', 'username', 'userslug', 'picture']);
};

Urgencies.getUrgencies = async function (urg_ids) {
	if (!Array.isArray(urg_ids)) {
		throw new Error(`${urg_ids} is an invalid urg_id`);
	}

	if (!urg_ids.length) {
		return [];
	}

	const [urgencies, tagWhitelist] = await Promise.all([
		Urgencies.getUrgenciesData(urg_ids),
		Urgencies.getTagWhitelist(urg_ids),
	]);
	urgencies.forEach((urgency, i) => {
		if (urgency) {
			urgency.tagWhitelist = tagWhitelist[i];
		}
	});
	return urgencies;
};

Urgencies.setUnread = async function (tree, urg_id, uid) {
	if (uid <= 0) {
		return;
	}
	const { unreadUrgids } = await topics.getUnreadData({
		uid: uid,
		urg_id: urg_id,
	});
	if (!unreadUrgids.length) {
		return;
	}

	function setCategoryUnread(urgency) {
		if (urgency) {
			urgency.unread = false;
			if (unreadUrgids.includes(urgency.urg_id)) {
				urgency.unread = urgency.topic_count > 0 && true;
			} else if (urgency.children.length) {
				urgency.children.forEach(setCategoryUnread);
				urgency.unread = urgency.children.some(c => c && c.unread);
			}
			urgency['unread-class'] = urgency.unread ? 'unread' : '';
		}
	}
	tree.forEach(setCategoryUnread);
};

Urgencies.getTagWhitelist = async function (urg_ids) {
	const cachedData = {};

	const nonCachedUrgids = urg_ids.filter((urg_id) => {
		const data = cache.get(`urg_id:${urg_id}:tag:whitelist`);
		const isInCache = data !== undefined;
		if (isInCache) {
			cachedData[urg_id] = data;
		}
		return !isInCache;
	});

	if (!nonCachedUrgids.length) {
		return urg_ids.map(urg_id => cachedData[urg_id]);
	}

	const keys = nonCachedUrgids.map(urg_id => `urg_id:${urg_id}:tag:whitelist`);
	const data = await db.getSortedSetsMembers(keys);

	nonCachedUrgids.forEach((urg_id, index) => {
		cachedData[urg_id] = data[index];
		cache.set(`urg_id:${urg_id}:tag:whitelist`, data[index]);
	});
	return urg_ids.map(urg_id => cachedData[urg_id]);
};

// remove system tags from tag whitelist for non privileged user
Urgencies.filterTagWhitelist = function (tagWhitelist, isAdminOrMod) {
	const systemTags = (meta.config.systemTags || '').split(',');
	if (!isAdminOrMod && systemTags.length) {
		return tagWhitelist.filter(tag => !systemTags.includes(tag));
	}
	return tagWhitelist;
};

function calculateTopicPostCount(urgency) {
	if (!urgency) {
		return;
	}

	let postCount = urgency.post_count;
	let topicCount = urgency.topic_count;
	if (Array.isArray(urgency.children)) {
		urgency.children.forEach((child) => {
			calculateTopicPostCount(child);
			postCount += parseInt(child.totalPostCount, 10) || 0;
			topicCount += parseInt(child.totalTopicCount, 10) || 0;
		});
	}

	urgency.totalPostCount = postCount;
	urgency.totalTopicCount = topicCount;
}
Urgencies.calculateTopicPostCount = calculateTopicPostCount;

Urgencies.getParents = async function (urg_ids) {
	const urgenciesData = await Urgencies.getCategoriesFields(urg_ids, ['parentUrgid']);
	const parentUrgids = urgenciesData.filter(c => c && c.parentUrgid).map(c => c.parentUrgid);
	if (!parentUrgids.length) {
		return urg_ids.map(() => null);
	}
	const parentData = await Urgencies.getUrgenciesData(parentUrgids);
	const urgidToParent = _.zipObject(parentUrgids, parentData);
	return urgenciesData.map(category => urgidToParent[category.parentUrgid]);
};

Urgencies.getParentUrgids = async function (currentUrgid) {
	let cid = currentUrgid;
	const parents = [];
	while (parseInt(cid, 10)) {
		// eslint-disable-next-line
		cid = await Urgencies.getCategoryField(cid, 'parentUrgid');
		if (cid) {
			parents.unshift(cid);
		}
	}
	return parents;
};

Urgencies.getChildrenUrgids = async function (rootUrgid) {
	let allUrgids = [];
	async function recursive(keys) {
		let childrenUrgids = await db.getSortedSetRange(keys, 0, -1);

		childrenUrgids = childrenUrgids.filter(urg_id => !allUrgids.includes(parseInt(urg_id, 10)));
		if (!childrenUrgids.length) {
			return;
		}
		keys = childrenUrgids.map(urg_id => `urg_id:${urg_id}:children`);
		childrenUrgids.forEach(urg_id => allUrgids.push(parseInt(urg_id, 10)));
		await recursive(keys);
	}
	const key = `urg_id:${rootUrgid}:children`;
	const cacheKey = `${key}:all`;
	const childrenCids = cache.get(cacheKey);
	if (childrenCids) {
		return childrenCids.slice();
	}

	await recursive(key);
	allUrgids = _.uniq(allUrgids);
	cache.set(cacheKey, allUrgids);
	return allUrgids.slice();
};

Urgencies.flattenCategories = function (allUrgencies, urgencyData) {
	urgencyData.forEach((urgency) => {
		if (urgency) {
			allUrgencies.push(urgency);

			if (Array.isArray(urgency.children) && urgency.children.length) {
				Urgencies.flattenCategories(allUrgencies, urgency.children);
			}
		}
	});
};

/**
 * build tree from flat list of categories
 *
 * @param urgencies {array} flat list of categories
 * @param parentUrgid {number} start from 0 to build full tree
 */
Urgencies.getTree = function (urgencies, parentUrgid) {
	parentUrgid = parentUrgid || 0;
	const cids = urgencies.map(urgency => urgency && urgency.cid);
	const cidToCategory = {};
	const parents = {};
	cids.forEach((urg_id, index) => {
		if (urg_id) {
			urgencies[index].children = undefined;
			cidToCategory[urg_id] = urgencies[index];
			parents[urg_id] = { ...urgencies[index] };
		}
	});

	const tree = [];

	urgencies.forEach((urgency) => {
		if (urgency) {
			urgency.children = urgency.children || [];
			if (!urgency.cid) {
				return;
			}
			if (!urgency.hasOwnProperty('parentUrgid') || urgency.parentUrgid === null) {
				urgency.parentUrgid = 0;
			}
			if (urgency.parentUrgid === parentUrgid) {
				tree.push(urgency);
				urgency.parent = parents[parentUrgid];
			} else {
				const parent = cidToCategory[urgency.parentUrgid];
				if (parent && parent.cid !== urgency.cid) {
					urgency.parent = parents[urgency.parentUrgid];
					parent.children = parent.children || [];
					parent.children.push(urgency);
				}
			}
		}
	});
	function sortTree(tree) {
		tree.sort((a, b) => {
			if (a.order !== b.order) {
				return a.order - b.order;
			}
			return a.cid - b.cid;
		});
		tree.forEach((urgency) => {
			if (urgency && Array.isArray(urgency.children)) {
				sortTree(urgency.children);
			}
		});
	}
	sortTree(tree);

	urgencies.forEach(c => calculateTopicPostCount(c));
	return tree;
};

Urgencies.buildForSelect = async function (uid, privilege, fields) {
	const cids = await Urgencies.getCidsByPrivilege('categories:cid', uid, privilege);
	return await getSelectData(cids, fields);
};

Urgencies.buildForSelectAll = async function (fields) {
	const cids = await Urgencies.getAllUrgIdsFromSet('categories:cid');
	return await getSelectData(cids, fields);
};

async function getSelectData(cids, fields) {
	const categoryData = await Urgencies.getUrgenciesData(cids);
	const tree = Urgencies.getTree(categoryData);
	return Urgencies.buildForSelectUrgencies(tree, fields);
}

Urgencies.buildForSelectUrgencies = function (urgencies, fields, parentUrgid) {
	function recursive({ ...urgency }, urgenciesData, level, depth) {
		const bullet = level ? '&bull; ' : '';
		urgency.value = urgency.cid;
		urgency.level = level;
		urgency.text = level + bullet + urgency.name;
		urgency.depth = depth;
		urgenciesData.push(urgency);
		if (Array.isArray(urgency.children)) {
			urgency.children.forEach(child => recursive(child, urgenciesData, `&nbsp;&nbsp;&nbsp;&nbsp;${level}`, depth + 1));
		}
	}
	parentUrgid = parentUrgid || 0;
	const urgenciesData = [];

	const rootUrgencies = urgencies.filter(urgency => urgency && urgency.parentUrgid === parentUrgid);

	rootUrgencies.sort((a, b) => {
		if (a.order !== b.order) {
			return a.order - b.order;
		}
		return a.cid - b.cid;
	});

	rootUrgencies.forEach(urgency => recursive(urgency, urgenciesData, '', 0));

	const pickFields = [
		'cid', 'name', 'level', 'icon', 'parentUrgid',
		'color', 'bgColor', 'backgroundImage', 'imageClass',
	];
	fields = fields || [];
	if (fields.includes('text') && fields.includes('value')) {
		return urgenciesData.map(category => _.pick(category, fields));
	}
	if (fields.length) {
		pickFields.push(...fields);
	}

	return urgenciesData.map(category => _.pick(category, pickFields));
};

require('../promisify')(Urgencies);
