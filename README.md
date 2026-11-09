# my-first-project
My first AI coding project

## Versi web berbayar (Percuma + Premium)

Folder [`web/`](web/) mengandungi versi yang boleh dijual: log masuk, data di awan, bajet keluarga,
penjejak pelepasan cukai LHDN dan bayaran Stripe. Panduan pemasangan langkah demi langkah ada dalam
[`web/README.md`](web/README.md).

## Tugas & Belanja (versi Claude)

Web app untuk iPhone: senarai tugas dan rekod belanja bulanan (RM), dengan bajet dan pecahan ikut kategori.

- **Buka app:** https://claude.ai/artifact/TyRRE5oEyeR1ZKvE4txnje
- **Kod sumber:** [`app/tugas-belanja.html`](app/tugas-belanja.html)

### Pasang di iPhone

1. Buka pautan di atas dalam **Safari** (pastikan sudah log masuk ke claude.ai).
2. Tekan butang **Kongsi** (petak dengan anak panah ke atas).
3. Pilih **Tambah ke Skrin Utama**, kemudian **Tambah**.

### Ciri-ciri

**Tugas**
- Tambah tugas dengan tarikh akhir (pilihan)
- Tanda "Lewat", "Hari ini" dan "Esok" secara automatik
- Tandakan selesai, padam (dengan butang Batal), kosongkan yang selesai

**Belanja**
- Rekod jumlah, keterangan, kategori dan tarikh
- Jumlah sebulan, tukar bulan dengan butang ‹ ›
- Bajet bulanan: baki dan anggaran belanja sehari untuk hari yang tinggal
- Pecahan ikut kategori: Makan, Dapur, Kenderaan, Bil, Peribadi, Lain-lain

### Simpanan data

- Bila dibuka dalam Claude oleh pemilik, data disimpan dalam akaun Claude dan hanya pemilik boleh membacanya.
- Kalau fail ini dibuka terus dalam pelayar (bukan melalui Claude), data disimpan dalam pelayar peranti itu sahaja.
