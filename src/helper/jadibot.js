/**
 * jadibot — clone bot ke nomor lain via pairing code.
 *
 * Menggunakan BotSessionManager (src/helper/session-manager.js):
 * - Session terisolasi per nomor di sessions/clones/<nomor>/
 * - TIDAK PERNAH menyentuh session bot utama (sessions/<main>/)
 * - Lock per-session, reconnect per-session, auto-cleanup session teracuni
 */

import { sessionManager } from './session-manager.js';
import { injectClient } from './inject.js';

const cleanNum = n => String(n).replace(/[^0-9]/g, '');

/** Pasang handler LENGKAP (sama seperti bot utama) ke socket clone. */
async function attachFullHandler(sock, botId) {
	const cacheMsg = new Map();
	const contacts = { read: () => null, write: () => {}, find: () => null };
	const groups = { read: () => null, write: () => {}, find: () => null };
	const settings = { read: () => ({}), write: () => {} };
	const hisokaClone = injectClient(sock, cacheMsg, contacts, groups, settings);
	hisokaClone._isClone = true;
	hisokaClone._cloneNumber = botId;

	const { default: handleMessage } = await import('../handler/message.js');
	console.log(`[jadibot:${botId}] handler lengkap dipasang`);

	sock.ev.on('messages.upsert', async upsert => {
		try {
			for (const WAMessage of upsert.messages || []) {
				await handleMessage({ message: WAMessage, type: upsert.type }, hisokaClone);
			}
		} catch (err) {
			console.error(`[jadibot:${botId}]`, err?.message);
		}
	});
}

export async function startClone(number, onCode) {
	const id = cleanNum(number);
	const entry = await sessionManager.create(id, onCode);
	entry.onAttach = (sock, botId) => attachFullHandler(sock, botId);
	// Jika sudah langsung open (session lama), pasang handler sekarang
	if (entry.status === 'open') {
		await attachFullHandler(entry.sock, id);
	}
	return { number: id, status: entry.status };
}

export async function stopClone(number) {
	const id = cleanNum(number);
	const s = sessionManager.get(id);
	if (!s) throw new Error('Clone tidak ditemukan.');
	await sessionManager.destroy(id);
	return true;
}

export function listClones() {
	return sessionManager.list().map(s => ({ number: s.botId, status: s.status }));
}

export function getClone(number) {
	const s = sessionManager.get(cleanNum(number));
	return s ? { number: cleanNum(number), status: s.status } : null;
}

export async function restoreClones() {
	return sessionManager.restoreAll((sock, botId) => attachFullHandler(sock, botId));
}
