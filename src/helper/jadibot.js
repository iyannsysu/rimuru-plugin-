/**
 * jadibot — clone bot ke nomor lain via pairing code.
 *
 * Menggunakan BotSessionManager dengan initializeBotSession() PENUH:
 *   createClient → initializeClient → registerMessageHandler
 *   → registerCommandHandler → registerEventHandler → registerMiddleware
 *   → registerAllFeatures → connect → ready
 *
 * Setiap clone mendapat SEMUA handler yang sama seperti bot utama.
 */

import { sessionManager, sessionLog } from './session-manager.js';

const cleanNum = n => String(n).replace(/[^0-9]/g, '');

export async function startClone(number, onCode) {
	const id = cleanNum(number);
	const ctx = await sessionManager.initializeBotSession(id, { onCode });
	sessionLog(id, 'startClone OK, status:', ctx.status);
	return { number: id, status: ctx.status };
}

export async function stopClone(number) {
	const id = cleanNum(number);
	const ctx = sessionManager.get(id);
	if (!ctx) throw new Error('Clone tidak ditemukan.');
	await sessionManager.destroy(id);
	return true;
}

export function listClones() {
	return sessionManager.list().map(s => ({
		number: s.botId,
		status: s.status,
		handlers: s.handlers,
	}));
}

export function getClone(number) {
	const ctx = sessionManager.get(cleanNum(number));
	if (!ctx) return null;
	return {
		number: cleanNum(number),
		status: ctx.status,
		handlers: ctx.handlers,
		commands: ctx.commandCount || 0,
		plugins: ctx.pluginCount || 0,
	};
}

export async function restoreClones() {
	return sessionManager.restoreAll();
}

/** Info diagnostik untuk .debug */
export function getCloneDebug(number) {
	const id = cleanNum(number);
	const s = sessionManager.status(id);
	if (!s) return null;
	return {
		sessionId: `bot_${id}`,
		status: s.status === 'ready' || s.status === 'open' ? 'ONLINE' : s.status.toUpperCase(),
		messageHandler: s.handlers?.message ? 'ON' : 'OFF',
		commandHandler: s.handlers?.command ? 'ON' : 'OFF',
		eventHandler: s.handlers?.event ? 'ON' : 'OFF',
		middleware: s.handlers?.middleware ? 'ON' : 'OFF',
		features: s.handlers?.features ? 'ON' : 'OFF',
		commands: s.commands || 0,
		plugins: s.plugins || 0,
	};
}
