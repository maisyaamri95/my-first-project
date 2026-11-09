import { toSen } from './money';

/**
 * Senarai pelepasan cukai individu yang memerlukan resit/bukti perbelanjaan.
 * Pelepasan automatik (diri sendiri RM9,000, pasangan, anak) tidak dimasukkan kerana tiada resit untuk dijejak.
 *
 * PENTING: angka ini MESTI disemak dengan senarai rasmi LHDN (hasil.gov.my) setiap tahun sebelum digunakan.
 * Tukar `verified` kepada true selepas disemak. App akan memaparkan amaran selagi `verified` ialah false.
 */
export interface ReliefCategory {
  code: string;
  name: string;
  limit: number; // RM, had maksimum setahun
  covers: string;
  note?: string;
}

export interface ReliefYear {
  year: number; // Tahun Taksiran (TT)
  verified: boolean;
  source: string;
  categories: ReliefCategory[];
}

export const RELIEF_YEARS: ReliefYear[] = [
  {
    year: 2026,
    verified: false,
    source: 'Disusun pada November 2026 daripada ringkasan Belanjawan 2026 oleh pihak ketiga. Belum disemak dengan senarai rasmi LHDN.',
    categories: [
      { code: 'gaya_hidup', name: 'Gaya hidup', limit: 2500, covers: 'Buku, majalah, komputer, telefon pintar, tablet, langganan internet, kursus kemahiran.' },
      { code: 'sukan', name: 'Sukan', limit: 1000, covers: 'Peralatan sukan, yuran gim, sewa fasiliti sukan, yuran pertandingan dan latihan sukan.' },
      { code: 'perubatan', name: 'Perubatan diri, pasangan & anak', limit: 10000, covers: 'Penyakit serius, rawatan kesuburan, vaksinasi, rawatan gigi, pemeriksaan kesihatan penuh, kesihatan mental, diagnosis dan intervensi awal anak kurang upaya pembelajaran.', note: 'Sesetengah perbelanjaan dalam kategori ini ada had kecil sendiri (contohnya vaksinasi, gigi dan pemeriksaan kesihatan).' },
      { code: 'ibu_bapa', name: 'Perubatan & penjagaan ibu bapa', limit: 8000, covers: 'Rawatan perubatan, gigi, keperluan khas, penjaga dan pemeriksaan kesihatan untuk ibu bapa.' },
      { code: 'pendidikan', name: 'Yuran pendidikan (diri sendiri)', limit: 7000, covers: 'Yuran pengajian peringkat tertentu dan kursus profesional.', note: 'Kursus peningkatan kemahiran ada had kecil sendiri.' },
      { code: 'insurans_kesihatan', name: 'Insurans pendidikan & perubatan', limit: 4000, covers: 'Premium insurans atau takaful pendidikan dan perubatan untuk diri, pasangan atau anak.' },
      { code: 'kwsp', name: 'KWSP', limit: 4000, covers: 'Caruman KWSP pekerja atau caruman sukarela.' },
      { code: 'insurans_hayat', name: 'Insurans hayat & takaful keluarga', limit: 3000, covers: 'Premium insurans hayat atau takaful keluarga.', note: 'Bersama KWSP, jumlah gabungan ialah RM7,000. Peraturan berbeza untuk penjawat awam berpencen.' },
      { code: 'prs', name: 'PRS & anuiti tertunda', limit: 3000, covers: 'Caruman Skim Persaraan Swasta (PRS) dan anuiti tertunda.' },
      { code: 'perkeso', name: 'PERKESO (SOCSO & SIP)', limit: 350, covers: 'Caruman pekerja kepada PERKESO dan Sistem Insurans Pekerjaan.' },
      { code: 'sspn', name: 'Simpanan SSPN', limit: 8000, covers: 'Simpanan bersih SSPN: jumlah simpanan tolak pengeluaran dalam tahun yang sama.' },
      { code: 'taska', name: 'Yuran taska & tadika', limit: 3000, covers: 'Yuran taska atau tadika berdaftar, termasuk pusat jagaan transit berdaftar untuk anak hingga 12 tahun.' },
      { code: 'penyusuan', name: 'Peralatan penyusuan susu ibu', limit: 1000, covers: 'Pam susu, beg sejuk dan peralatan berkaitan. Boleh dituntut sekali setiap 2 tahun.' },
      { code: 'oku_peralatan', name: 'Peralatan sokongan OKU', limit: 6000, covers: 'Peralatan sokongan asas untuk diri, pasangan, anak atau ibu bapa yang OKU.' },
      { code: 'ev_kompos', name: 'Pengecasan EV & mesin kompos', limit: 2500, covers: 'Peralatan pengecas kenderaan elektrik, langganan pengecasan EV dan mesin kompos sisa makanan.' },
      { code: 'pelancongan', name: 'Pelancongan domestik', limit: 1000, covers: 'Tiket masuk tempat tarikan pelancongan dan persembahan budaya dalam negara.' },
    ],
  },
];

export const LATEST_RELIEF_YEAR = Math.max(...RELIEF_YEARS.map(y => y.year));

export function reliefYear(year: number): ReliefYear {
  return RELIEF_YEARS.find(y => y.year === year) ?? RELIEF_YEARS.find(y => y.year === LATEST_RELIEF_YEAR)!;
}

export interface ClaimLike { category: string; amount: number }

export interface ReliefRow {
  category: ReliefCategory;
  claimedSen: number; // jumlah resit direkod
  countedSen: number; // jumlah yang boleh dituntut (dihadkan kepada had)
  remainingSen: number;
  overSen: number; // melebihi had
  count: number;
}

export interface ReliefSummary { rows: ReliefRow[]; totalClaimedSen: number; totalCountedSen: number; unknownSen: number }

export function summarizeRelief(claims: ClaimLike[], def: ReliefYear): ReliefSummary {
  const known = new Set(def.categories.map(c => c.code));
  const rows = def.categories.map(category => {
    const mine = claims.filter(c => c.category === category.code);
    const claimedSen = mine.reduce((s, c) => s + toSen(c.amount), 0);
    const limitSen = category.limit * 100;
    const countedSen = Math.min(claimedSen, limitSen);
    return { category, claimedSen, countedSen, remainingSen: limitSen - countedSen, overSen: Math.max(0, claimedSen - limitSen), count: mine.length };
  });
  const unknownSen = claims.filter(c => !known.has(c.category)).reduce((s, c) => s + toSen(c.amount), 0);
  return {
    rows,
    totalClaimedSen: rows.reduce((s, r) => s + r.claimedSen, 0),
    totalCountedSen: rows.reduce((s, r) => s + r.countedSen, 0),
    unknownSen,
  };
}
