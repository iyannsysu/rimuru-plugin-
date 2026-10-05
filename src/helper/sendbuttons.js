'use strict';

// Helper untuk kirim pesan dengan tombol interaktif (tap).
// Menggunakan format interactiveMessage (standar WhatsApp terbaru).

/**
 * Kirim pesan teks dengan tombol quick-reply.
 * @param {object} hisoka - socket Baileys
 * @param {string} jid - target JID
 * @param {string} text - isi pesan
 * @param {Array<{id: string, text: string}>} buttons - daftar tombol (max 3)
 * @param {object} opts - { quoted, footer, image }
 */
export async function sendButtons(hisoka, jid, text, buttons, opts = {}) {
	const { quoted, footer, image } = opts;

	// Jika ada gambar, kirim gambar dulu terpisah (interactive header image bermasalah)
	if (image) {
		try {
			await hisoka.sendMessage(jid, {
				image: { url: image },
				caption: text.split('\n').slice(0, 6).join('\n'),
			}, quoted ? { quoted } : {});
		} catch {}
	}

	// Format tombol untuk nativeFlowMessage
	const btnList = buttons.slice(0, 3).map(b => ({
		name: 'quick_reply',
		buttonParamsJson: JSON.stringify({
			display_text: b.text,
			id: b.id,
		}),
	}));

	const interactiveMessage = {
		body: { text: image ? text : text },
		nativeFlowMessage: { buttons: btnList },
	};

	if (footer) interactiveMessage.footer = { text: footer };

	const msg = { interactiveMessage };
	return hisoka.sendMessage(jid, msg, quoted ? { quoted } : {});
}
