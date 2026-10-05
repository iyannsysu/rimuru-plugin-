'use strict';
// Auto-generated dari message.js — command: menu (aliases: help, ?)
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
	name: 'menu',
	aliases: ['help', '?'],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const ownerName = process.env.BOT_OWNER_NAME || 'Iyan';
						const quotes = [
							'Jangan menunggu sempurna, buat momenmu sempurna.',
							'Berani mencoba adalah awal kesuksesan.',
							'Hari ini lelah, besok bangga.',
							'Fokus proses, hasil mengikuti.',
							'Mimpi tanpa aksi hanyalah angan.',
							'Maju sedikit tiap hari itu cukup.',
							'Gagal itu guru, asal mau belajar.',
							'Jadilah versi terbaik dirimu.',
							'Waktu terbaik mulai adalah sekarang.',
							'Kerja keras kalahkan bakat malas.',
							'Pelan tak apa, asal jangan diam.',
							'Hal besar mulai dari langkah kecil.',
						];
						const quote = quotes[Math.floor(Math.random() * quotes.length)];
						const gcLink = readGcLink();
						const _up = Math.floor(process.uptime());
						const _uh = Math.floor(_up / 3600), _um = Math.floor((_up % 3600) / 60);
						const uptimeStr = _uh > 0 ? `${_uh}j ${_um}m` : `${_um}m`;

						// Menu compact untuk caption foto (limit WA 1024 byte!) —
						// foto + menu jadi SATU pesan seperti kartu.
						// Guard byte-length: kalau jebol, kirim terpisah (anti-hang).
						const menuCaption =
							`👋 *${ownerName}* — *adawong* 🤖\n` +
							`⏱️ _Online ${uptimeStr}_\n` +
							`💭 _"${quote}"_\n\n` +
							`📥 *DOWNLOADER*\n` +
							`├ .play\n` +
							`├ .ytsearch\n` +
							`├ .sfile\n` +
							`├ .tt\n` +
							`├ .tiktokv2\n` +
							`├ .pin\n` +
							`├ .ppcouple\n` +
							`├ .cosplay\n` +
							`├ .pixiv\n` +
							`└ .hentai\n\n` +
							`🔞 *18+ ZONE*\n` +
							`├ .cewe\n` +
							`├ .cewekat\n` +
							`├ .cewevid\n` +
							`├ .chara\n` +
							`├ .hanime\n` +
							`├ .bokep\n` +
							`├ .cosplay18\n` +
							`├ .nekopoi\n` +
							`├ .manhwa\n` +
							`└ .manhua\n\n` +
							`🎨 *STIKER*\n` +
							`├ .s\n` +
							`├ .spack\n` +
							`└ .tpack\n\n` +
							`👁️ *STATUS*\n` +
							`├ .sw\n` +
							`├ .swread\n` +
							`├ .swreact\n` +
							`├ .swreply\n` +
							`├ .swreacttext\n` +
							`├ .swemoji\n` +
							`└ .uptimebio\n\n` +
							`😂 *FUN*\n` +
							`├ .khodam\n` +
							`├ .alay\n` +
							`├ .hacker\n` +
							`├ .menfess\n` +
							`└ .afk\n\n` +
							`🎮 *GAME*\n` +
							`├ .tebakgambar\n` +
							`├ .tebakkata\n` +
							`├ .tebakbendera\n` +
							`├ .susunkata\n` +
							`├ .tekateki\n` +
							`├ .asahotak\n` +
							`├ .caklontong\n` +
							`├ .family100\n` +
							`├ .siapakahaku\n` +
							`├ .tebakkalimat\n` +
							`├ .math\n` +
							`└ .nyerah\n\n` +
							`🔧 *TOOLS*\n` +
							`├ .tts\n` +
							`├ .translate\n` +
							`├ .ssweb\n` +
							`└ .cuaca\n\n` +
							`🕌 *ISLAMI & PRIMBON*\n` +
							`├ .jadwalsholat\n` +
							`├ .doaharian\n` +
							`├ .artinama\n` +
							`├ .ramalanjodoh\n` +
							`└ .zodiak\n\n` +
							(gcLink ? `👥 *GRUP WA*\n🔗 ${gcLink}\n\n` : '') +
							`👑 *${ownerName}* • ⚙️ readsw`;
						// Banner via URL (GitHub raw) — lebih ringan, tanpa baca file lokal.
						// Fallback ke file lokal kalau URL gagal.
						const BANNER_URL = 'https://raw.githubusercontent.com/iyannsysu/iyan-x-m/main/assets/menu-adawong.jpg';
						const sendMenu = async (useCaption) => {
							const payload = useCaption
								? { image: { url: BANNER_URL }, caption: menuCaption }
								: { image: { url: BANNER_URL } };
							try {
								await hisoka.sendMessage(m.from, payload, { quoted: m });
							} catch {
								const banner = fs.readFileSync(MENU_BANNER);
								await hisoka.sendMessage(m.from,
									useCaption ? { image: banner, caption: menuCaption } : { image: banner },
									{ quoted: m });
							}
						};
						try {
							if (Buffer.byteLength(menuCaption, 'utf8') > 1000) {
								// kepanjangan -> kirim gambar + teks terpisah
								await sendMenu(false);
								await m.reply(menuCaption);
							} else {
								await sendMenu(true);
							}
						} catch {
							// banner gagal total -> kirim teks saja
							await m.reply(menuCaption);
						}
					}
					return;
	},
};
