> [!IMPORTANT]
> Sponsored with pride by [Hisoka.net](https://hisoka.net), your trusted partner for seamless hosting solutions.

## Requirements

Ensure you have the following:

-  **Node.js** version **20** or higher installed.
-  **ffmpeg** terinstal (untuk fitur stiker).

## Installation

Follow these simple steps to get started:

1. Install dependencies by running:
   ```bash
   npm install
   ```
2. Copy `.env.example` menjadi `.env` lalu isi nilainya:
   ```bash
   cp .env.example .env
   ```
3. Start the application with:
   ```bash
   npm start
   ```

Login via QR di terminal, atau isi `BOT_NUMBER_PAIR` dengan nomor WhatsApp (format: 6281234567890) untuk login pakai kode pairing.

## Fitur

- **Auto-read status** — otomatis melihat & memberi reaksi ke status. Status yang dibaca diteruskan ke chat WA kamu sendiri (`BOT_FORWARD_STATUS_WA`, default aktif) dan ke Telegram (kalau `TELEGRAM_TOKEN` & `TELEGRAM_CHAT_ID` diisi).
- **Custom react per kontak** — atur emoji reaksi per nomor di `react.json`, misal `{ "6281234567890": "❤️", "default": "🔥" }`. `"default"` kosong = acak dari `BOT_REACT_STATUS`. Status yang sudah di-react tidak di-react ulang (anti double-react).
- **Ringkasan status harian** — setiap jam 23:59 WIB, ringkasan semua status hari itu dikirim ke Telegram, lalu log dikosongkan.
- **Status saver** — semua foto/video status otomatis tersimpan di `./downloads/status/` (matikan dengan `BOT_SAVE_STATUS=false`).
- **Anti view-once** — foto/video sekali-lihat otomatis diteruskan ke nomor owner agar bisa dibuka ulang.
- **Pantau kontak penting** — pesan dari nomor di `watch.json` langsung diteruskan ke Telegram (teks + media).
- **TikTok downloader HD** — kirim link TikTok (atau pakai command `tt`) untuk mengunduh video kualitas terbaik lalu dikirim ke chat. File > 100MB dikirim sebagai dokumen.
- **Anti-delete** — pesan yang dihapus pengirim (teks/media) diteruskan ke nomor owner.
- **Auto-reply** — balas otomatis pesan dari non-owner di chat pribadi berdasarkan keyword di `autoreply.json`. Format: `{ "halo": "Halo juga!" }` (case-insensitive, 1 balasan per pesan). Edit file langsung, tanpa restart.
- **Sticker maker** — reply pesan gambar/video lalu kirim `s` untuk dijadikan stiker webp 512x512.
- **Auto-download media** — kalau `BOT_AUTODL_MEDIA=true`, semua media yang masuk otomatis tersimpan di `./downloads/`.
- **Command owner** — semua command hanya bisa dipakai owner (`BOT_NUMBER_OWNER`).

## Daftar Command

| Command | Fungsi |
|---|---|
| `tt` / `tiktok` / `dl` `<link>` | Download video TikTok HD |
| _(kirim link tiktok.com langsung)_ | Auto-download tanpa command |
| `s` / `sticker` / `stiker` | Buat stiker dari pesan yang di-reply |
| `react` `😍` | React manual ke status (reply status dulu) |
| `menu` / `help` | Tampilkan menu ini |
| `hidetag` / `ht` / `everyone` / `all` | Tag semua anggota grup |
| `q` / `quoted` | Forward pesan yang di-reply |
| `p` / `ping` | Cek latency & uptime |
| `>` / `eval` | Jalankan kode JavaScript |
| `$` / `exec` / `bash` | Jalankan perintah shell |
| `groups` / `contacts` | Daftar grup / kontak |

> [!IMPORTANT]
>
> If you need a WhatsApp Bot hosting, consider exploring [Hisoka.net's WhatsApp Bot hosting](https://hisoka.net) for reliable and efficient solutions.
>
> to help you grow your online presence. Check out our [URL shortener](https://kua.lat) for creating concise, shareable links, and our [bio page builder](https://kua.lat/bio-profiles) for crafting a professional online profile effortlessly.