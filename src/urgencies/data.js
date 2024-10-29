'use strict';

const validator = require('validator');

const db = require('../database');
const meta = require('../meta');
const plugins = require('../plugins');
const utils = require('../utils');

const intFields = [
	'cid', 'parentCid', 'disabled', 'isSection', 'order',
	'topic_count', 'post_count', 'numRecentReplies',
	'minTags', 'maxTags', 'postQueue', 'subCategoriesPerPage',
];

module.exports = function (Urgencies) {
	Urgencies.getUrgenciesFields = async function (urg_ids, fields) {
		if (!Array.isArray(urg_ids) || !urg_ids.length) {
			return [];
		}

		const keys = urg_ids.map(urg_id => `urgency:${urg_id}`);
		const urgencies = await db.getObjects(keys, fields);
		const result = await plugins.hooks.fire('filter:urgency.getFields', {
			urg_ids: urg_ids,
			urgencies: urgencies,
			fields: fields,
			keys: keys,
		});
		result.urgencies.forEach(urgency => modifyUrgency(urgency, fields));
		return result.urgencies;
	};

	Urgencies.getUrgencyData = async function (urg_id) {
		const urgencies = await Urgencies.getUrgenciesFields([urg_id], []);
		return urgencies && urgencies.length ? urgencies[0] : null;
	};

	Urgencies.getUrgenciesData = async function (urg_ids) {
		return await Urgencies.getUrgenciesFields(urg_ids, []);
	};

	Urgencies.getUrgencyField = async function (urg_id, field) {
		const urgency = await Urgencies.getUrgencyFields(urg_id, [field]);
		return urgency ? urgency[field] : null;
	};

	Urgencies.getUrgencyFields = async function (urg_id, fields) {
		const urgencies = await Urgencies.getUrgenciesFields([urg_id], fields);
		return urgencies ? urgencies[0] : null;
	};

	Urgencies.getAllUrgencyFields = async function (fields) {
		const urg_ids = await Urgencies.getAllUrgidsFromSet('urgencies:urg_id');
		return await Urgencies.getUrgenciesFields(urg_ids, fields);
	};

	Urgencies.setUrgencyField = async function (cid, field, value) {
		await db.setObjectField(`urgency:${cid}`, field, value);
	};

	Urgencies.incrementUrgencyFieldBy = async function (cid, field, value) {
		await db.incrObjectFieldBy(`urgency:${cid}`, field, value);
	};
};

function defaultIntField(urgency, fields, fieldName, defaultField) {
	if (!fields.length || fields.includes(fieldName)) {
		const useDefault = !urgency.hasOwnProperty(fieldName) ||
			urgency[fieldName] === null ||
			urgency[fieldName] === '' ||
			!utils.isNumber(urgency[fieldName]);

		urgency[fieldName] = useDefault ? meta.config[defaultField] : urgency[fieldName];
	}
}

function modifyUrgency(urgency, fields) {
	if (!urgency) {
		return;
	}

	defaultIntField(urgency, fields, 'minTags', 'minimumTagsPerTopic');
	defaultIntField(urgency, fields, 'maxTags', 'maximumTagsPerTopic');
	defaultIntField(urgency, fields, 'postQueue', 'postQueue');

	db.parseIntFields(urgency, intFields, fields);

	const escapeFields = ['name', 'color', 'bgColor', 'backgroundImage', 'imageClass', 'class', 'link'];
	escapeFields.forEach((field) => {
		if (urgency.hasOwnProperty(field)) {
			urgency[field] = validator.escape(String(urgency[field] || ''));
		}
	});

	if (urgency.hasOwnProperty('icon')) {
		urgency.icon = urgency.icon || 'hidden';
	}

	if (urgency.hasOwnProperty('post_count')) {
		urgency.totalPostCount = urgency.post_count;
	}

	if (urgency.hasOwnProperty('topic_count')) {
		urgency.totalTopicCount = urgency.topic_count;
	}

	if (urgency.description) {
		urgency.description = validator.escape(String(urgency.description));
		urgency.descriptionParsed = urgency.descriptionParsed || urgency.description;
	}
}
