'use strict';
// Auto-generated dari message.js — command: hanime (aliases: hv, han)
// Kategori: 18+ ZONE

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
	name: 'hanime',
	aliases: ['hv', 'han'],
	category: '18+ ZONE',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const raw = (query || '').trim();
						if (!raw) {
							await m.reply('Kasih kata kuncinya. Contoh: .hanime succubus\nLalu pilih nomor: .hanime 2');
							return;
						}

						// .hanime <nomor> -> unduh dari hasil pencarian terakhir
						const numPick = raw.match(/^(\d{1,2})$/);
						if (numPick) {
							const cache = hanimeSearchCache.get(m.sender);
							if (!cache || !cache.length) {
								await m.reply('Belum ada hasil pencarian. Cari dulu: .hanime <kata kunci>');
								return;
							}
							const idx = parseInt(numPick[1]) - 1;
							if (idx < 0 || idx >= cache.length) {
								await m.reply(`Nomor 1-${cache.length} aja.`);
								return;
							}
							const item = cache[idx];
							let tmpDir = '';
							try {
								await m.reply(`📺 *${item.name}*\n⏳ Lagi download videonya, sabar ya... (bisa beberapa menit)`);
								const { title, streams } = await getHanimeStreams(item.slug);
								const stream = pickHanimeStream(streams);
								tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-'));
								const safeName = title.replace(/[^\w\- ]+/g, '').slice(0, 60) || 'hanime';
								const outFile = path.join(tmpDir, `${safeName}.mp4`);
								await downloadHanimeStream(stream.url, outFile);
								const size = fs.statSync(outFile).size;
								const data = fs.readFileSync(outFile);
								const caption = `📺 *${title}*\n🎞️ ${stream.quality}`;
								// Video WA max ~64MB, selebihnya kirim sebagai dokumen
								if (size > 64 * 1024 * 1024) {
									await hisoka.sendMessage(m.from, { document: data, fileName: path.basename(outFile), mimetype: 'video/mp4', caption }, { quoted: m });
								} else {
									await hisoka.sendMessage(m.from, { video: data, mimetype: 'video/mp4', caption }, { quoted: m });
								}
							} catch (err) {
								await m.reply('❌ ' + (err?.message || 'Gagal mengunduh video.'));
							} finally {
								if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
							}
							return;
						}

						// .hanime <kata kunci> -> cari & tampilkan daftar
						try {
							await m.reply(`🔎 Mencari *${raw}*...`);
							const results = await searchHanime(raw, 8);
							hanimeSearchCache.set(m.sender, results);
							// Tombol untuk 3 teratas
							const { saveButtonChoice } = await import('../helper/buttons.js');
							const btnData = results.slice(0, 3).map((v, i) => {
								const bid = `dl_hanime_${Date.now()}_${i}`;
								saveButtonChoice(bid, { type: 'dl_hanime', idx: i });
								return { id: bid, text: `📺 ${v.name.slice(0, 25)}` };
							});
							let txt = `📺 *Hasil: ${raw}*\n\n`;
							results.forEach((v, i) => {
								txt += `${i + 1}. *${v.name}*\n   👁️ ${shortNum(v.views)} | 👍 ${shortNum(v.likes)}\n`;
							});
							txt += `\n👇 _Tap untuk tonton langsung:_`;
							const { sendButtons } = await import('../helper/sendbuttons.js');
							await sendButtons(hisoka, m.from, txt, btnData, {
								quoted: m, footer: 'Pilihan hangus dalam 2 menit',
							});
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal mencari video.'));
						}
					}
					return;
	},
};
