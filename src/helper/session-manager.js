/**
 * BotSessionManager — arsitektur multi-session yang aman dan terisolasi.
 *
 * Struktur:
 *   sessions/
 *   ├── <main>/          (bot utama, TIDAK PERNAH disentuh manager clone)
 *   └── clones/
 *       ├── <nomor1>/
 *       └── <nomor2>/
 *
 * Jaminan:
 * - Setiap session punya folder, auth state, socket, dan lock sendiri.
 * - Operasi clone TIDAK PERNAH menyentuh session bot utama.
 * - Lock per-session: dua proses tidak bisa menulis session yang sama.
 * - Reconnect per-session: satu session error tidak mengganggu yang lain.
 * - Session "teracuni" (creds.me diset tapi registered=false) otomatis dibersihkan.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import makeWASocket, {
	useMultiFileAuthState,
	DisconnectReason,
	fetchLatestBaileysVersion,
	makeCacheableSignalKeyStore,
	Browsers,
} from 'baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { HttpsProxyAgent } from 'https-proxy-agent';

const logger = pino({ level: 'silent' });
const delay = ms => new Promise(r => setTimeout(r, ms));

// Proxy (sama seperti bot utama)
let wsAgent;
try {
	const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
	if (proxyUrl) wsAgent = new HttpsProxyAgent(proxyUrl);
} catch {}

// Session ID bot utama — TIDAK BOLEH dipakai/disentuh oleh clone.
const MAIN_SESSION_ID = process.env.BOT_SESSION_NAME || 'iyan';

function sessionsRoot() {
	return path.join(process.cwd(), 'sessions');
}

function sessionPath(botId) {
	return path.join(sessionsRoot(), 'clones', botId);
}

function lockPath(botId) {
	return path.join(sessionPath(botId), '.session.lock');
}

/**
 * Lock per-session memakai file lock + PID.
 * Sederhana dan aman: tulis PID ke file, cek apakah PID masih hidup.
 * Return true jika lock didapat, false jika dipakai proses lain.
 */
function acquireLock(botId) {
	const dir = sessionPath(botId);
	fs.mkdirSync(dir, { recursive: true });
	const lp = lockPath(botId);
	try {
		if (fs.existsSync(lp)) {
			const pid = parseInt(fs.readFileSync(lp, 'utf-8').trim(), 10);
			if (pid && pid > 0) {
				try {
					// Cek apakah PID masih hidup
					process.kill(pid, 0);
					return null; // masih dipakai
				} catch {
					// PID mati, lock basi — ambil alih
				}
			}
		}
		fs.writeFileSync(lp, String(process.pid));
		return true;
	} catch {
		return null;
	}
}

function releaseLock(botId) {
	try {
		const lp = lockPath(botId);
		if (fs.existsSync(lp)) {
			const pid = parseInt(fs.readFileSync(lp, 'utf-8').trim(), 10);
			if (pid === process.pid) fs.unlinkSync(lp);
		}
	} catch {}
}

/** Cek apakah creds "teracuni": me diset tapi belum registered. */
function isPoisoned(botId) {
	try {
		const creds = JSON.parse(fs.readFileSync(path.join(sessionPath(botId), 'creds.json'), 'utf-8'));
		return !!(creds.me && !creds.registered);
	} catch {
		return false;
	}
}

export class BotSessionManager {
	constructor() {
		/** Map<botId, { sock, status, reconnectTimer, onCode, onAttach }> */
		this.sessions = new Map();
		this.shuttingDown = false;
	}

	/** Validasi botId: hanya digit, dan BUKAN session utama. */
	validateBotId(botId) {
		const id = String(botId).replace(/[^0-9]/g, '');
		if (!id || id.length < 8 || id.length > 16) {
			throw new Error(`Bot ID tidak valid: ${botId}`);
		}
		if (id === MAIN_SESSION_ID || sessionPath(id).startsWith(path.join(sessionsRoot(), MAIN_SESSION_ID))) {
			throw new Error('Dilarang menyentuh session bot utama.');
		}
		return id;
	}

	get(botId) {
		return this.sessions.get(String(botId).replace(/[^0-9]/g, ''));
	}

	list() {
		return [...this.sessions.entries()].map(([botId, s]) => ({
			botId,
			status: s.status,
		}));
	}

	/** 1. Buat session baru + minta pairing code. */
	async create(botId, onCode) {
		const id = this.validateBotId(botId);
		if (this.sessions.has(id)) {
			const s = this.sessions.get(id);
			if (s.status === 'open') throw new Error(`Bot ${id} sudah aktif.`);
			// Ada tapi belum connect — bersihkan dulu
			await this.destroy(id);
		}

		// Bersihkan session teracuni sebelum mulai
		if (isPoisoned(id)) {
			console.log(`[session:${id}] creds teracuni, hapus.`);
			fs.rmSync(sessionPath(id), { recursive: true, force: true });
		}

		if (!acquireLock(id)) {
			throw new Error(`Session ${id} sedang dipakai proses lain.`);
		}

		const { state, saveCreds } = await useMultiFileAuthState(sessionPath(id));
		const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1027934701] }));

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

		const entry = { sock, status: 'connecting', reconnectTimer: null, onCode, onAttach: null };
		this.sessions.set(id, entry);

		sock.ev.on('creds.update', saveCreds);

		// Minta pairing code jika belum terdaftar
		if (!sock.authState.creds.registered) {
			await delay(8000);
			try {
				const code = await sock.requestPairingCode(id);
				const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
				if (onCode) await onCode(formatted);

				// Auto-hapus jika kode tidak dimasukkan dalam 2 menit
				setTimeout(() => {
					const e = this.sessions.get(id);
					if (e && e.status !== 'open') {
						console.log(`[session:${id}] kode tidak dimasukkan, hapus session.`);
						this.destroy(id).catch(() => {});
					}
				}, 2 * 60 * 1000).unref?.();
			} catch (err) {
				await this.destroy(id).catch(() => {});
				throw new Error('Gagal minta pairing code: ' + (err?.message || 'error'));
			}
		} else if (onCode) {
			await onCode(null); // sudah terdaftar
		}

		sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
			this.handleConnectionUpdate(id, connection, lastDisconnect);
		});

		return entry;
	}

	/** 2/3. Muat kembali session tertentu (tanpa pairing ulang). */
	async load(botId) {
		const id = this.validateBotId(botId);
		if (this.sessions.has(id)) return this.sessions.get(id);

		// Hanya load yang sudah terdaftar
		const credsPath = path.join(sessionPath(id), 'creds.json');
		if (!fs.existsSync(credsPath)) throw new Error(`Session ${id} tidak ditemukan.`);
		const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
		if (!creds.registered) throw new Error(`Session ${id} belum selesai pairing.`);

		return this.create(id, null);
	}

	/** 4. Hapus session tertentu tanpa memengaruhi yang lain. */
	async destroy(botId) {
		const id = String(botId).replace(/[^0-9]/g, '');
		const e = this.sessions.get(id);
		if (e) {
			if (e.reconnectTimer) clearTimeout(e.reconnectTimer);
			try { e.sock.end(); } catch {}
			releaseLock(id);
			this.sessions.delete(id);
		}
		// Hapus folder session (TIDAK PERNAH menyentuh session utama)
		const sp = sessionPath(id);
		const mainPath = path.join(sessionsRoot(), MAIN_SESSION_ID);
		if (sp === mainPath || mainPath.startsWith(sp)) {
			throw new Error('Dilarang menghapus session bot utama.');
		}
		try { fs.rmSync(sp, { recursive: true, force: true }); } catch {}
		return true;
	}

	/** 5. Restart satu bot tanpa restart bot utama. */
	async restart(botId) {
		const id = this.validateBotId(botId);
		const e = this.sessions.get(id);
		const onCode = e?.onCode || null;
		// Jangan hapus folder, hanya reconnect (session tetap)
		if (e) {
			if (e.reconnectTimer) clearTimeout(e.reconnectTimer);
			try { e.sock.end(); } catch {}
			releaseLock(id);
			this.sessions.delete(id);
		}
		return this.create(id, onCode);
	}

	/** 6. Status setiap session. */
	status(botId) {
		if (botId) {
			const e = this.get(botId);
			return e ? { botId: String(botId), status: e.status } : null;
		}
		return this.list();
	}

	/** Reconnect per-session: hanya session ini yang reconnect. */
	handleConnectionUpdate(botId, connection, lastDisconnect) {
		const e = this.sessions.get(botId);
		if (!e) return;

		if (connection === 'open') {
			e.status = 'open';
			console.log(`[session:${botId}] terhubung!`);
			if (e.onAttach) e.onAttach(e.sock, botId);
		}

		if (connection === 'close') {
			const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
			e.status = 'close';
			if (reason === DisconnectReason.loggedOut || this.shuttingDown) {
				console.log(`[session:${botId}] logout, hapus session.`);
				this.destroy(botId).catch(() => {});
			} else {
				// Reconnect HANYA session ini setelah 10 detik
				if (e.reconnectTimer) clearTimeout(e.reconnectTimer);
				e.reconnectTimer = setTimeout(() => {
					if (this.sessions.has(botId) && !this.shuttingDown) {
						console.log(`[session:${botId}] reconnect...`);
						this.restart(botId).catch(err =>
							console.error(`[session:${botId}] reconnect gagal:`, err?.message)
						);
					}
				}, 10000);
				e.reconnectTimer.unref?.();
			}
		}
	}

	/** Daftarkan callback saat session connect (untuk pasang handler). */
	onConnect(botId, fn) {
		const e = this.get(botId);
		if (e) {
			e.onAttach = fn;
			if (e.status === 'open') fn(e.sock, botId);
		}
	}

	/** Restore semua session clone yang sudah terdaftar (dipanggil saat startup). */
	async restoreAll(onAttach) {
		const clonesDir = path.join(sessionsRoot(), 'clones');
		let dirs = [];
		try {
			dirs = fs.readdirSync(clonesDir).filter(d => {
				const p = path.join(clonesDir, d);
				return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'creds.json'));
			});
		} catch { return []; }
		const restored = [];
		for (const id of dirs) {
			try {
				const creds = JSON.parse(fs.readFileSync(path.join(clonesDir, id, 'creds.json'), 'utf-8'));
				if (!creds.registered) {
					console.log(`[session:${id}] lewati (belum selesai pairing)`);
					continue;
				}
				const entry = await this.create(id, null);
				if (onAttach) entry.onAttach = onAttach;
				restored.push(id);
			} catch (err) {
				console.error(`[session:${id}] restore gagal:`, err?.message);
			}
		}
		return restored;
	}

	/** Graceful shutdown: tutup semua session clone, JANGAN sentuh bot utama. */
	async shutdown() {
		this.shuttingDown = true;
		for (const [id] of this.sessions) {
			await this.destroy(id).catch(() => {});
		}
		console.log('[session-manager] semua session clone ditutup.');
	}
}

// Singleton
export const sessionManager = new BotSessionManager();
