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

			// Auto-hapus session jika kode tidak dimasukkan dalam 2 menit
			setTimeout(() => {
				const c = clones.get(cleanNum);
				if (c && c.status !== 'open') {
					console.log(`[jadibot] ${cleanNum} kode tidak dimasukkan, hapus session.`);
					try { c.sock.end(); } catch {}
					clones.delete(cleanNum);
					try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
				}
			}, 2 * 60 * 1000).unref?.();
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
	// Handler LENGKAP untuk clone: pakai message handler yang sama persis
	// seperti bot utama. Clone jadi bot penuh dengan semua fitur.
	const { injectClient } = await import('./inject.js');
	const cacheMsg = new Map();
	const contacts = { read: () => null, write: () => {} };
	const groups = { read: () => null, write: () => {} };
	const settings = { read: () => ({}), write: () => {} };
	const hisokaClone = injectClient(sock, cacheMsg, contacts, groups, settings);

	// Tandai sebagai clone agar handler tahu
	hisokaClone._isClone = true;
	hisokaClone._cloneNumber = number;

	// Import handler pesan utama
	const { default: handleMessage } = await import('../handler/message.js');

	console.log(`[jadibot:${number}] handler lengkap dipasang`);

	sock.ev.on('messages.upsert', async (upsert) => {
		try {
			// Teruskan ke handler utama dengan socket clone
			// Handler utama butuh { message, type } dan hisoka
			for (const WAMessage of (upsert.messages || [])) {
				await handleMessage({ message: WAMessage, type: upsert.type }, hisokaClone);
			}
		} catch (err) {
			console.error(`[jadibot:${number}]`, err?.message);
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

// Auto-restore semua clone yang punya session saat bot utama start.
// Hanya restore yang sudah terdaftar (registered); yang belum selesai pairing dilewati.
export async function restoreClones() {
	ensureDir();
	let dirs = [];
	try {
		dirs = fs.readdirSync(JADIBOT_DIR).filter(d => {
			const p = path.join(JADIBOT_DIR, d);
			return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'creds.json'));
		});
	} catch { return []; }
	const restored = [];
	for (const num of dirs) {
		// Cek apakah creds sudah registered
		try {
			const creds = JSON.parse(fs.readFileSync(path.join(JADIBOT_DIR, num, 'creds.json'), 'utf-8'));
			if (!creds.registered) {
				console.log(`[jadibot] lewati ${num} (belum selesai pairing)`);
				continue;
			}
		} catch { continue; }
		try {
			await startClone(num, null);
			restored.push(num);
			console.log(`[jadibot] restore ${num}`);
		} catch (err) {
			console.error(`[jadibot] restore ${num} gagal:`, err?.message);
		}
	}
	return restored;
}
