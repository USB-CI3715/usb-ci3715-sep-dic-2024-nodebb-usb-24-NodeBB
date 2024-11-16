'use strict';

const __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
	function adopt(value) { return value instanceof P ? value : new P((resolve) => { resolve(value); }); }
	P = P || Promise;
	return new P((resolve, reject) => {
		function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
		function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
		function step(result) {
			if (result.done) {
				resolve(result.value);
			} else {
				adopt(result.value).then(fulfilled, rejected);
			}
		}
		step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
};
/* eslint-disable import/no-import-module-exports */
const db = require('../database');
const io = require('../socket.io');
// Codigo principal
module.exports = function (Messaging) {
	Messaging.getUnreadCount = uid => __awaiter(this, undefined, undefined, function* () {
		if (!(parseInt(uid, 10) > 0)) {
			return 0;
		}
		// eslint-disable-next-line max-len
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
		return yield db.sortedSetCard(`uid:${uid}:chat:rooms:unread`);
	});
	Messaging.pushUnreadCount = (uids, data = null) => {
		if (!Array.isArray(uids)) {
			uids = [uids];
		}
		uids = uids.filter(uid => parseInt(uid, 10) > 0);
		if (!uids.length) {
			return;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		uids.forEach((uid) => { io.in(`uid_${uid}`).emit('event:unread.updateChatCount', data); });
	};
	Messaging.markRead = (uid, roomId) => __awaiter(this, undefined, undefined, function* () {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		yield Promise.all([db.sortedSetRemove(`uid:${uid}:chat:rooms:unread`, roomId), db.setObjectField(`uid:${uid}:chat:rooms:read`, roomId, Date.now()),
		]);
	});
	Messaging.hasRead = (uids, roomId) => __awaiter(this, undefined, undefined, function* () {
		if (!uids.length) {
			return [];
		}
		const roomData = yield Messaging.getRoomData(roomId);
		if (!roomData) {
			return uids.map(() => false);
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if (roomData.public) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const [userTimestamps, mids] = yield Promise.all([db.getObjectsFields(uids.map(uid => `uid:${uid}:chat:rooms:read`), [roomId]), db.getSortedSetRevRangeWithScores(`chat:room:${roomId}:mids`, 0, 0)]);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const lastMsgTimestamp = (mids.length > 0 && mids[0].score) ? mids[0].score : 0;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			return uids.map((uid, index) => !userTimestamps[index] || !userTimestamps[index][roomId] ||
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                parseInt(userTimestamps[index][roomId], 10) > lastMsgTimestamp);
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		const isMembers = yield db.isMemberOfSortedSets(uids.map(uid => `uid:${uid}:chat:rooms:unread`), roomId);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		return uids.map((uid, index) => !isMembers[index]);
	});
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
	Messaging.markAllRead = uid => __awaiter(this, undefined, undefined, function* () { yield db.delete(`uid:${uid}:chat:rooms:unread`); });
	Messaging.markUnread = (uids, roomId) => __awaiter(this, undefined, undefined, function* () {
		const exists = yield Messaging.roomExists(roomId);
		if (!exists) {
			return;
		}
		const keys = uids.map(uid => `uid:${uid}:chat:rooms:unread`);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		yield db.sortedSetsAdd(keys, Date.now(), roomId);
	});
};
