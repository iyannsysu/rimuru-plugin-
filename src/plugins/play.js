'use strict';
// Auto-generated dari message.js — command: play
// Kategori: other

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

export default {
	name: 'play',
	aliases: [],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const q = (query || '').trim();
						if (!q) {
							await m.reply('Kasih judul lagunya. Contoh: .play iqroo');
							return;
						}

						const { startLoading: slPlay } = await import('../helper/loading.js');
						const { saveButtonChoice } = await import('../helper/buttons.js');
						const playLoad = await slPlay(hisoka, m, 'Mencari lagu');

						try {
							// Cari info video dulu (tanpa download)
							const { searchViaYtDlp, CLIENTS } = await import('../helper/youtube.js').catch(() => ({}));
							// Gunakan Neoxr untuk info cepat
							const NEOXR_APIKEY = process.env.NEOXR_APIKEY || 'Fahridev12Z';
							const apiRes = await fetch(`https://api.neoxr.eu/api/play?q=${encodeURIComponent(q)}&apikey=${NEOXR_APIKEY}`, {
								headers: { 'User-Agent': 'Mozilla/5.0' },
								signal: AbortSignal.timeout(20000),
							});
							const info = await apiRes.json();
							if (!info?.status || !info?.data?.url) {
								throw new Error('Lagu tidak ketemu, coba kata kunci lain.');
							}

							await playLoad.stop();

							const vid = info.id || `play_${Date.now()}`;
							const title = info.title || q;
							const duration = info.duration || '-';
							const views = info.views || '-';
							const channel = info.channel || '-';
							const thumb = info.thumbnail;
							const audioUrl = info.data.url;

							// Simpan pilihan tombol (kedaluwarsa 2 menit)
							const audioId = `play_a_${vid}_${Date.now()}`;
							const videoId = `play_v_${vid}_${Date.now()}`;
							saveButtonChoice(audioId, { type: 'play_audio', title, audioUrl, query: q });
							saveButtonChoice(videoId, { type: 'play_video', title, query: q, videoUrl: info.id ? `https://www.youtube.com/watch?v=${info.id}` : null });

							const caption = `┌─〔 🎵 PLAY MUSIC 〕─┐\n│\n│ 📌 *${title}*\n│ ⏱️ Durasi : ${duration}\n│ 👁️ Views  : ${views}\n│ 👤 Channel: ${channel}\n│ 🔗 Link   : https://www.youtube.com/watch?v=${info.id || ''}\n│\n│ Pilih format di bawah 👇\n└───────────────\n\n⏳ _Pilihan hangus dalam 2 menit_`;

							const buttons = [
								{ buttonId: audioId, buttonText: { displayText: '🎵 Audio MP3' }, type: 1 },
								{ buttonId: videoId, buttonText: { displayText: '🎬 Video MP4' }, type: 1 },
							];

							const msgOpts = { quoted: m };
							if (thumb) {
								await hisoka.sendMessage(m.from, {
									image: { url: thumb },
									caption,
									footer: 'Pilih format audio atau video',
									buttons,
									headerType: 4,
								}, msgOpts);
							} else {
								await hisoka.sendMessage(m.from, {
									text: caption,
									footer: 'Pilih format audio atau video',
									buttons,
									headerType: 1,
								}, msgOpts);
							}
						} catch (err) {
							const emsg = err?.message || 'Gagal mencari lagu.';
							await playLoad.fail('❌ ' + emsg);
						}
					}
					return;
	},
};
