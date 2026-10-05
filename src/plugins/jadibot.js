'use strict';
// Command: jadibot — toggle mode bot publik (owner only)
// .jadibot on  -> bot bisa dipakai orang lain (whitelist command)
// .jadibot off -> bot hanya untuk owner (self-bot)

import * as shared from './_shared.js';

	const {
		isJidGroup, jidNormalizedUser, jidDecode, generateWAMessageFromContent,
		exec, execFile, fileURLToPath, util, fs, path, os,
		glitch, msToTime,
		downloadTikTok, cleanupTikTok,
		downloadYouTubeAudio, cleanupYouTubeAudio,
		searchPinterest, downloadPinterestPin, cleanupPinterest,
		searchPixiv, downloadPixivArtwork, cleanupPixiv,
		searchHentaidad, downloadHentaidadGallery, cleanupHentaidad,
		searchHanime, getHanimeStreams, pickHanimeStream, downloadHanimeStream, shortNum,
		getStickerPack, downloadStickerPack, cleanupStickerPack,
		getTelegramPack, downloadTelegramPack, cleanupTelegramPack,
		readSwConfig, writeSwConfig, extractEmojis,
		loadStoryCfg, saveStoryCfg, downloadTikTokHD, postToStatus,
		handleBusyReply, loadBusyCfg, saveBusyCfg,
		telegram, execFileAsync,
		PROJECT_ROOT, MENU_BANNER, GC_JSON,
		hanimeSearchCache, bokepSearchCache, cosplay18SearchCache,
		manhwaSearchCache, manhwaChapterCache,
		readGcLink, handleTikTokDownload, sendAlbum, handleSticker,
	} = shared;

const CONFIG_PATH = path.join(process.cwd(), 'publicmode.json');

function loadCfg() {
	try {
		return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8') || '{}');
	} catch {
		return { enabled: false, whitelist: [], ratelimit_per_hour: 15 };
	}
}

function saveCfg(cfg) {
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 0));
}

export default {
	name: 'jadibot',
	aliases: ['publicmode', 'modebot'],
	category: 'owner',
	desc: 'Toggle mode bot publik',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
		const arg = (query || '').trim().toLowerCase();
		const cfg = loadCfg();

		if (arg === 'on') {
			cfg.enabled = true;
			saveCfg(cfg);
			await m.reply('✅ *Mode bot publik AKTIF*\n\nOrang lain sekarang bisa pakai:\n• ' + (cfg.whitelist || []).join(', ') + '\n\nMatikan dengan: .jadibot off');
			return;
		}
		if (arg === 'off') {
			cfg.enabled = false;
			saveCfg(cfg);
			await m.reply('✅ *Mode bot publik MATI*\n\nBot kembali jadi self-bot (hanya owner).');
			return;
		}
		// Tampilkan status
		const status = cfg.enabled ? '🟢 AKTIF' : '🔴 MATI';
		await m.reply(
			`🤖 *Mode Bot Publik:* ${status}\n\n` +
			`• .jadibot on — aktifkan\n` +
			`• .jadibot off — matikan\n\n` +
			`Command publik: ${(cfg.whitelist || []).join(', ')}`
		);
		return;
	},
};
