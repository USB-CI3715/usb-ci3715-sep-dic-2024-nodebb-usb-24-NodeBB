'use strict';

/*
	*******************************************************************************
	************************  Universidad Simon Bolivar  **************************
	*********  Departamento de Computacion y Tecnologia de la Informacion  ********
	*                                                                             *
	* - Trimestre: Septiembre-Diciembre 2024                                      *
	* - Materia: Ingenieria de Software 1                                         *
	* - Profesor: Eduardo Feo Flushing                                            *
	*                                                                             *
	* - Author: Junior Lara (17-10303)                                            *
	*                                                                             *
	* Proyecto 1B: Traducción a TypeScript o Incremento de Cobertura de Código    *
	*                                                                             *
	*******************************************************************************
*/

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

/* Seccion: IMPORTACIONES */
const meta = require('../meta');
const user = require('../user');
const plugins = require('../plugins');
const privileges = require('../privileges');
const sockets = require('../socket.io');

/* Seccion: FUNCIONES */
module.exports = function (Messaging) {
	Messaging.editMessage = (uid, mid, roomId, content) => __awaiter(this, undefined, undefined, function* () {
		yield Messaging.checkContent(content);

		const raw = yield Messaging.getMessageField(mid, 'content');

		if (raw === content) return;

		const payload = yield plugins.hooks.fire('filter:messaging.edit', { content: content, edited: Date.now() });
		if (!String(payload.content).trim()) throw new Error('[[error:invalid-chat-message]]');

		yield Messaging.setMessageFields(mid, payload);

		// Propagate this change to users in the room
		const messages = yield Messaging.getMessagesData([mid], uid, roomId, true);
		if (messages[0]) {
			const roomName = messages[0].deleted ? `uid_${uid}` : `chat_room_${roomId}`;
			sockets.in(roomName).emit('event:chats.edit', { messages: messages });
		}

		yield plugins.hooks.fire('action:messaging.edit', { message: { ...messages[0], content: payload.content } });
	});

	const canEditDelete = (messageId, uid, type) => __awaiter(this, undefined, undefined, function* () {
		let durationConfig = '';
		if (type === 'edit') {
			durationConfig = 'chatEditDuration';
		} else if (type === 'delete') {
			durationConfig = 'chatDeleteDuration';
		}

		const exists = yield Messaging.messageExists(messageId);
		if (!exists) throw new Error('[[error:invalid-mid]]');

		const isAdminOrGlobalMod = yield user.isAdminOrGlobalMod(uid);

		if (meta.config.disableChat) {
			throw new Error('[[error:chat-disabled]]');
		} else if (!isAdminOrGlobalMod && meta.config.disableChatMessageEditing) {
			throw new Error('[[error:chat-message-editing-disabled]]');
		}

		const userData = yield user.getUserFields(uid, ['banned']);

		if (userData.banned) throw new Error('[[error:user-banned]]');

		const canChat = yield privileges.global.can(['chat', 'chat:privileged'], uid);

		if (!canChat.includes(true)) throw new Error('[[error:no-privileges]]');

		const messageData = yield Messaging.getMessageFields(messageId, ['fromuid', 'timestamp', 'system']);
		if (isAdminOrGlobalMod && !messageData.system) return;

		const chatConfigDuration = meta.config[durationConfig];
		if (chatConfigDuration && Date.now() - messageData.timestamp > chatConfigDuration * 1000) {
			throw new Error(`[[error:chat-${type}-duration-expired, ${chatConfigDuration}]]`);
		}

		if (messageData.fromuid === parseInt(uid.toString(), 10) && !messageData.system) return;

		throw new Error(`[[error:cant-${type}-chat-message]]`);
	});

	Messaging.canEdit = (messageId, uid) => __awaiter(this, undefined, undefined, function* () { return yield canEditDelete(messageId, uid, 'edit'); });
	Messaging.canDelete = (messageId, uid) => __awaiter(this, undefined, undefined, function* () { return yield canEditDelete(messageId, uid, 'delete'); });
	Messaging.canPin = (roomId, uid) => __awaiter(this, undefined, undefined, function* () {
		const [isAdmin, isGlobalMod, inRoom, isRoomOwner] = yield Promise.all([
			user.isAdministrator(uid), user.isGlobalModerator(uid),
			Messaging.isUserInRoom(uid, roomId), Messaging.isRoomOwner(uid, roomId),
		]);
		if (!isAdmin && !isGlobalMod && (!inRoom || !isRoomOwner)) throw new Error('[[error:no-privileges]]');
	});
};
