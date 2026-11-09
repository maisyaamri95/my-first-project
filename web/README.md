# Tugas & Belanja (versi web berbayar)

Web app untuk senarai tugas, rekod belanja, bajet keluarga dan penjejak pelepasan cukai LHDN.
Ada pelan **Percuma** dan **Premium** (bulanan, tahunan atau seumur hidup).

| Bahagian | Teknologi | Kos permulaan |
|---|---|---|
| Laman web | React + Vite, dihoskan di **Vercel** | Percuma |
| Akaun pengguna, pangkalan data, gambar resit | **Supabase** | Percuma (pelan Free) |
| Bayaran | **Stripe** (kad dan FPX) | Tiada yuran bulanan, hanya caj setiap transaksi |

Tanpa kunci Supabase, app berjalan dalam **mod demo** (data disimpan dalam pelayar sahaja). Jadi awak boleh deploy ke Vercel dan lihat app sekarang juga, sebelum langkah lain siap.

---

## Langkah 1: Supabase (pangkalan data dan log masuk)

1. Daftar di https://supabase.com, kemudian **New project**.
   - Region: pilih **Southeast Asia (Singapore)**, yang paling dekat dengan Malaysia.
   - Simpan kata laluan pangkalan data di tempat selamat.
2. Buka **SQL Editor**, kemudian **New query**.
   - Salin semua kandungan [`supabase/schema.sql`](supabase/schema.sql), tampal, dan tekan **Run**.
3. Buka **Authentication → URL Configuration**.
   - **Site URL**: alamat laman awak, contohnya `https://namaapp.my`, atau alamat Vercel buat sementara.
   - **Redirect URLs**: tambah `https://namaapp.my/**`.
4. Buka **Project Settings → API**. Salin tiga perkara:
   - **Project URL**
   - **anon / publishable key**: kunci ini selamat untuk pelayar.
   - **service_role / secret key**: kunci ini **RAHSIA**. Masukkan dalam Vercel sahaja dan jangan kongsi dengan sesiapa.
5. **Sebelum lancar:** buka **Authentication → Emails → SMTP Settings** dan sambungkan penghantar emel sendiri (contohnya Resend atau Brevo). Emel bawaan Supabase sangat terhad dan hanya sesuai untuk ujian.

## Langkah 2: Vercel (letak laman di internet)

1. Daftar di https://vercel.com menggunakan akaun GitHub awak.
2. Tekan **Add New → Project**, kemudian pilih repo `my-first-project`.
3. Isi tetapan berikut:
   - **Root Directory**: `web`
   - **Framework Preset**: Vite (biasanya dikesan sendiri)
4. Buka **Environment Variables** dan masukkan semua nama daripada [`.env.example`](.env.example). Pemboleh ubah Stripe boleh diisi kemudian.
5. Tekan **Deploy**.

Vercel deploy cawangan `main` sebagai laman utama. Kod ini sekarang berada di cawangan lain, jadi ia perlu digabungkan ke `main` dahulu.

## Langkah 3: Stripe (terima bayaran)

1. Daftar di https://stripe.com dan pilih negara **Malaysia**.
   - Untuk aktifkan akaun, Stripe akan minta butiran perniagaan (SSM), IC dan akaun bank.
2. Mulakan dalam **Test mode** dahulu.
3. Buka **Product catalog → Add product**, namakan "Premium", dan buat **3 harga**:
   - RM 4.90, **Recurring**, Monthly. Salin ID harga ke `STRIPE_PRICE_MONTHLY`.
   - RM 39.90, **Recurring**, Yearly. Salin ID harga ke `STRIPE_PRICE_YEARLY`.
   - RM 79.90, **One-off**. Salin ID harga ke `STRIPE_PRICE_LIFETIME`.
4. Buka **Settings → Payment methods** dan hidupkan **Cards** dan **FPX**. FPX hanya untuk bayaran sekali, iaitu pelan Seumur Hidup.
5. Buka **Settings → Billing → Customer portal** dan benarkan:
   - batal langganan
   - tukar kad
   - lihat invois
6. Buka **Developers → Webhooks → Add endpoint**.
   - URL: `https://namaapp.my/api/stripe-webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Salin **Signing secret** ke `STRIPE_WEBHOOK_SECRET`.
7. Salin **Secret key** ke `STRIPE_SECRET_KEY`. Isi `APP_URL` dengan alamat laman awak. Kemudian deploy semula di Vercel.
8. Uji pembayaran dengan kad ujian `4242 4242 4242 4242`, tarikh tamat mana-mana tarikh akan datang, dan CVC `123`.

Harga yang dipaparkan dalam app terletak dalam `src/lib/plans.ts`. Pastikan harga di situ sama dengan harga dalam Stripe.

---

## Senarai semak sebelum lancar

- [ ] **Semak had pelepasan cukai** dalam `src/lib/taxRelief.ts` dengan senarai rasmi LHDN untuk TT 2026. Selepas itu tukar `verified: false` kepada `true`.
  - Angka sekarang disusun daripada panduan pihak ketiga, kerana laman hasil.gov.my tidak dapat dicapai semasa app dibina.
- [ ] Isi butiran perniagaan (nama, SSM, emel dan alamat) dan tarikh berkuat kuasa dalam `src/config.ts`.
- [ ] Minta peguam semak Polisi Privasi, Terma dan Polisi Bayaran Balik dalam `src/pages/Legal.tsx`.
- [ ] Sambungkan SMTP sendiri dalam Supabase.
- [ ] Beli domain dan sambungkan ke Vercel (**Settings → Domains**). Kemas kini Site URL Supabase, URL webhook Stripe dan `APP_URL`.
- [ ] Uji dalam Stripe Test mode:
  - langgan bulanan
  - batal melalui "Urus langganan"
  - beli seumur hidup dengan FPX ujian
- [ ] Uji ruang keluarga dengan 2 akaun: jemput, sertai, kongsi belanja, buang ahli.
- [ ] Tukar Stripe ke **Live mode**, kemudian ganti semua kunci dan ID harga dengan versi live.
- [ ] Kalau nama app bertukar, kemas kini nama di empat tempat:
  - `src/config.ts`
  - `index.html` (`<title>` dan `apple-mobile-web-app-title`)
  - `public/manifest.webmanifest`

---

## Untuk pembangun

```bash
cd web
npm install
npm run dev        # http://localhost:5173 (mod demo jika tiada .env)
npm test           # ujian logik + ujian keselamatan pangkalan data (Postgres dalam memori)
npm run typecheck  # semak jenis untuk app dan fungsi /api
npm run build
```

Struktur kod:

```
web/
  api/                 Fungsi pelayan Vercel (Stripe checkout, webhook, portal, padam akaun)
  supabase/schema.sql  Jadual, peraturan keselamatan (RLS), storan resit
  src/config.ts        Nama app, butiran perniagaan, had pelan percuma
  src/lib/             Logik: wang, tarikh, pelan, langganan, pelepasan cukai
  src/data/            Sambungan Supabase + mod demo
  src/pages/           Halaman: Tugas, Belanja, Cukai, Akaun, Premium, Log masuk, Undang-undang
  tests/schema.test.ts Menguji peraturan RLS pada Postgres sebenar
```

### Pembahagian Percuma dan Premium

| Ciri | Percuma | Premium |
|---|---|---|
| Tugas, belanja dan bajet bulanan | ✓ | ✓ |
| Sejarah belanja | 3 bulan | Tanpa had |
| Penjejak pelepasan cukai LHDN dan gambar resit | ✗ | ✓ |
| Ruang keluarga (maksimum 6 orang, ahli turut dapat Premium) | ✗ | ✓ |
| Eksport CSV | ✗ | ✓ |

Ciri Premium yang penting juga dikunci di dalam pangkalan data, bukan di skrin sahaja:
- rekod cukai
- muat naik resit
- ruang keluarga
- kod jemputan

Jadi kunci ini tidak boleh dielak dengan mengubah kod dalam pelayar.
