# CV Blaster

Solusi cerdas buat yang lelah apply kerja manual satu per satu sampai jempol cantengan. CV Blaster adalah platform automasi pengiriman lamaran kerja massal terarah untuk LinkedIn, Glints, JobStreet, dan Indeed, ditenagai AI dan browser stealth tanpa drama captcha.

---

## Masalah Klasik Pencari Kerja

1. Buka puluhan tab browser setiap hari sampai RAM laptop menjerit.
2. Ngetik ulang nama, riwayat kerja, dan gaji yang diharapkan berulang-ulang di form yang sama.
3. Baru submit tiga lowongan, eh sudah kena blokir bot atau terjebak Cloudflare captcha tanpa ampun.
4. Nulis surat motivasi yang ujung-ujungnya cuma template *"Saya tertarik dengan posisi ini karena perusahaan bapak sangat visioner"*.

CV Blaster hadir agar bot yang bekerja lembur mengirim berkas, sementara Anda tinggal menunggu jadwal interview.

---

## Fitur Utama

### 1. Ekstensi Companion (Bypass Cloudflare & Anti-Login Manual)
Tidak perlu pusing input password atau menghadapi two-factor authentication berulang kali:
- Ekstensi Chrome CV Blaster Companion membaca sesi cookie resmi dari browser lokal Anda (menggunakan IP residential asli).
- Sinkronisasi satu kali klik mengirim cookie LinkedIn (`li_at`), Glints, JobStreet, dan Indeed langsung ke server.
- Bot Puppeteer otomatis berjalan menggunakan sesi akun Anda yang sudah terverifikasi tanpa trigger anti-bot.

### 2. Generator Surat Motivasi Kontekstual
Bukan sekadar template generik:
- Menghasilkan paragraf motivasi spesifik (70-110 kata) yang secara akurat menyebut nama perusahaan dan posisi yang dilamar.
- Mencocokkan kualifikasi profil dan portofolio Anda secara natural sesuai pertanyaan form perekrut.

### 3. Simulasi Ketikan Natural (Human Stealth)
Menggunakan algoritma jeda ketik manusia (variasi 40-120 milidetik per karakter) dan pergerakan kursor melengkung, meminimalkan kemungkinan deteksi automasi oleh portal kerja.

### 4. Filter Loker Relevan & Blacklist Dealbreaker
- Menyaring lowongan kerja berdasarkan ambang batas skor kualifikasi.
- Filter kata kunci terlarang (misal: syarat bahasa tertentu, lokasi luar jangkauan, atau level senioritas yang tidak cocok) otomatis dilewati sebelum tombol kirim ditekan.

### 5. Mode Simulasi (Dry-Run) vs Mode LIVE
- **Mode Simulasi**: Bot menjalankan navigasi form dan pengisian input tanpa menekan tombol kirim akhir, cocok untuk menguji kecocokan selector dan kriteria.
- **Mode LIVE**: Pengiriman lamaran resmi ke sistem portal kerja.

### 6. Panduan Interaktif Terbimbing
Dilengkapi spotlight tour pemandu interaktif pada dashboard dan popup ekstensi, memudahkan pengaturan awal profil, platform, dan batas kuota harian.

---

## Struktur Proyek

- `src/app`: Antarmuka dashboard Next.js dengan dark mode otomatis, layout sidebar terkunci, dan live monitor log.
- `src/lib/bots`: Mesin automasi Puppeteer untuk LinkedIn, Glints, JobStreet, dan Indeed.
- `src/lib/cookieHelper.ts`: Parser dan injektor cookie sesi browser.
- `src/lib/coverLetterGenerator.ts`: Generator surat pengantar dan jawaban esai motivasi via AI router.
- `src/lib/humanStealth.ts`: Modul jeda waktu acak dan interaksi ketikan manusia.
- `src/lib/jobMatcher.ts`: Modul penilaian relevansi kualifikasi dan penyaring kata kunci.
- `extension/`: Ekstensi Chrome Manifest V3 untuk sinkronisasi sesi browser sekali klik.

---

## Panduan Menjalankan Aplikasi

### 1. Menjalankan Dashboard Lokal

Pastikan Node.js v18+ sudah terpasang di perangkat Anda:

```bash
# Pasang dependensi
npm install

# Jalankan server pengembangan
npm run dev
```

Buka peramban di `http://localhost:3000`.

### 2. Memasang Ekstensi Chrome Companion

1. Buka peramban Chrome dan masuk ke alamat `chrome://extensions/`.
2. Aktifkan **Developer mode** di pojok kanan atas.
3. Klik **Load unpacked** dan pilih folder `extension/` dari repositori ini.
4. Klik ikon ekstensi CV Blaster Companion di toolbar, periksa status sesi portal kerja Anda, lalu klik tombol sinkronisasi.

---

## Alur Produksi (Deployment Server / VPS)

Ketika dashboard dijalankan di cloud (VPS / Docker / Railway):

1. **Dashboard Server**: Berjalan di container Docker dengan paket dependensi Chromium OS (`libnss3`, `libatk-bridge2.0-0`, `libx11-xcb1`, dsb).
2. **Koneksi Klien**: Masukkan URL domain hosting Anda pada kolom Server Target di popup ekstensi (contoh: `https://cvblaster.domainanda.com`).
3. **Eksekusi Bot**: Server menerima cookie sesi dari laptop Anda dan mengeksekusi tugas pelamaran di background secara terjadwal.

---

## Catatan Etika & Penggunaan

Gunakan kuota harian secara wajar (disarankan 30-80 lamaran per hari) agar profil Anda tetap terlihat organik oleh algoritma platform pencari kerja. Jangan lupa memantau tab Riwayat Lamaran untuk meninjau perusahaan yang sudah berhasil dilamar.
