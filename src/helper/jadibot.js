'use strict';
// Manager untuk jadibot (clone bot via pairing code).
// Setiap clone punya session sendiri di sessions/jadibot/<nomor>/

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

// Map: nomor -> { sock, status }
const clones = new Map();

const JADIBOT_DIR = path.join(process.cwd(), 'sessions', 'jadibot');

function ensureDir() {
	if (!fs.existsSync(JADIBOT_DIR)) fs.mkdirSync(JADIBOT_DIR, { recursive: true });
}

export function listClones() {
	return Array.from(clones.entries()).map(([num, c]) => ({
		number: num,
		status: c.status || 'unknown',
	}));
}

export function getClone(number) {
	return clones.get(number);
}

export async function startClone(number, onCode) {
	ensureDir();
	const cleanNum = String(number).replace(/[^0-9]/g, '');
	if (!cleanNum) throw new Error('Nomor tidak valid.');

	if (clones.has(cleanNum)) {
		const c = clones.get(cleanNum);
		if (c.status === 'open') throw new Error('Nomor ini sudah jadi bot.');
		// Coba reconnect
		clones.delete(cleanNum);
	}

	const sessionDir = path.join(JADIBOT_DIR, cleanNum);

	// Import Baileys secara dinamis
	const baileys = await import('baileys');
	const makeWASocket = baileys.default;
	const { useMultiFileAuthState, DisconnectReason, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, delay } = baileys;
	const pino = (await import('pino')).default;
	const { HttpsProxyAgent } = await import('https-proxy-agent');
	const { Boom } = await import('@hapi/boom');

	const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
	const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1027934701] }));

	const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || '';
	const wsAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
	if (proxyUrl) process.env.NODE_USE_ENV_PROXY = '1';

	const logger = pino({ level: 'silent' });

	const sock = makeWASocket({
		version,
		logger,
		agent: wsAgent,
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
		},
		browser: Browsers.appropriate('Chrome'),
		syncFullHistory: false,
	});

	const cloneInfo = { sock, status: 'connecting', number: cleanNum };
	clones.set(cleanNum, cloneInfo);

	sock.ev.on('creds.update', saveCreds);

	// Minta pairing code jika belum terdaftar
	if (!sock.authState.creds.registered) {
		await delay(8000); // tunggu handshake (dikurangi dari 15s)
		try {
			const code = await sock.requestPairingCode(cleanNum);
			const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
			if (onCode) await onCode(formatted);
		} catch (err) {
			clones.delete(cleanNum);
			throw new Error('Gagal minta pairing code: ' + (err?.message || 'error'));
		}
	} else if (onCode) {
		// Sudah terdaftar, langsung hubungkan
		await onCode(null);
	}

	sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
		if (connection === 'open') {
			cloneInfo.status = 'open';
			console.log(`[jadibot] ${cleanNum} terhubung!`);
			// Attach message handler (sama seperti bot utama, tapi sederhana)
			attachCloneHandler(sock, cleanNum);
		}
		if (connection === 'close') {
			const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
			cloneInfo.status = 'close';
			if (reason === DisconnectReason.loggedOut) {
				console.log(`[jadibot] ${cleanNum} logout, hapus session.`);
				clones.delete(cleanNum);
				try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
			} else {
				// Reconnect otomatis setelah 10 detik
				setTimeout(() => {
					if (clones.has(cleanNum)) startClone(cleanNum, null).catch(() => {});
				}, 10000);
			}
		}
	});

	return cloneInfo;
}

async function attachCloneHandler(sock, number) {
	// Handler untuk clone: jalankan plugin yang sama seperti bot utama.
	// Clone dianggap sebagai "owner" untuk nomornya sendiri.
	let pluginMap = null;
	try {
		const { loadPlugins } = await import('../plugins/_loader.js');
		const pluginsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'plugins');
		const loaded = await loadPlugins(pluginsDir);
		pluginMap = loaded.map;
		console.log(`[jadibot:${number}] ${loaded.list.length} plugin dimuat`);
	} catch (err) {
		console.error(`[jadibot:${number}] gagal load plugin:`, err?.message);
		return;
	}

	sock.ev.on('messages.upsert', async ({ messages, type }) => {
		if (type !== 'notify') return;
		for (const WAMessage of messages) {
			try {
				if (!WAMessage.message || WAMessage.key.fromMe) continue;

				// Buat objek m seperti bot utama (pakai inject)
				const { injectMessage } = await import('./inject.js');
				// injectMessage butuh hisoka dengan method tertentu; buat wrapper minimal
				const hisokaClone = wrapCloneSocket(sock, number);
				const m = await injectMessage(hisokaClone, WAMessage);
				if (!m || !m.message || !m.text) continue;

				// Clone: pemilik nomor dianggap owner
				m.isOwner = true;

				const cmd = (m.command || '').toLowerCase();
				if (!cmd) continue;

				const plugin = pluginMap.get(cmd);
				if (!plugin) continue;

				// Jangan izinkan jadibot di dalam clone (hindari loop)
				if (cmd === 'jadibot' || cmd === 'clonebot') {
					await m.reply('❌ Fitur jadibot tidak tersedia di clone.');
					continue;
				}

				const quoted = m.isMedia ? m : m.isQuoted ? m.quoted : m;
				const text = m.text;
				const query = m.query || quoted.query;
				const ctx = { hisoka: hisokaClone, m, query, text, quoted, message: WAMessage, messagesType: type };
				await plugin.run(ctx);
			} catch (err) {
				console.error(`[jadibot:${number}]`, err?.message);
			}
		}
	});
}

// Wrapper socket clone agar kompatibel dengan helper plugin (m.reply, dll).
// injectMessage memanggil method di hisoka; teruskan ke sock asli.
function wrapCloneSocket(sock, number) {
	return new Proxy(sock, {
		get(target, prop) {
			if (prop === 'sendMessage') return target.sendMessage.bind(target);
			const v = target[prop];
			if (typeof v === 'function') return v.bind(target);
			return v;
		}
	});
}

export async function stopClone(number) {
	const cleanNum = String(number).replace(/[^0-9]/g, '');
	const c = clones.get(cleanNum);
	if (!c) throw new Error('Clone tidak ditemukan.');
	try { c.sock.end(); } catch {}
	clones.delete(cleanNum);
	return true;
}
