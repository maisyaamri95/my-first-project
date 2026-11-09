import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { APP_NAME, BUSINESS, LEGAL_EFFECTIVE_DATE } from '../config';
import { PLANS } from '../lib/plans';
import { fmtRM } from '../lib/money';

const isDraft = BUSINESS.name.startsWith('[');

function Doc({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="page-solo legal">
      <div className="solo-top"><button type="button" className="back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}><Icon name="left" size={18} stroke={2.2} /> Kembali</button></div>
      {isDraft && (
        <p className="notice dev">Draf: isi butiran perniagaan dalam <code>src/config.ts</code> dan minta peguam semak dokumen ini sebelum app dilancarkan.</p>
      )}
      <h1>{title}</h1>
      <p className="muted small">Berkuat kuasa: {LEGAL_EFFECTIVE_DATE}</p>
      {children}
      <p className="muted small">Hubungi kami: {BUSINESS.email} · {BUSINESS.name} ({BUSINESS.ssm}), {BUSINESS.address}</p>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <Doc title="Polisi Privasi">
      <p>Polisi ini menerangkan cara {BUSINESS.name} (“kami”) mengumpul, menggunakan dan melindungi data peribadi anda semasa menggunakan {APP_NAME}, selaras dengan Akta Perlindungan Data Peribadi 2010 (PDPA).</p>
      <h2>Data yang kami kumpul</h2>
      <ul>
        <li><b>Akaun:</b> alamat emel, kata laluan (disimpan dalam bentuk cincangan, kami tidak boleh membacanya) dan nama paparan.</li>
        <li><b>Kandungan anda:</b> tugas, rekod belanja, bajet, rekod pelepasan cukai dan gambar resit yang anda muat naik.</li>
        <li><b>Langganan:</b> status langganan dan ID pelanggan Stripe. Butiran kad dan perbankan diproses oleh Stripe dan tidak disimpan oleh kami.</li>
        <li><b>Teknikal:</b> log pelayan asas (contohnya alamat IP dan masa capaian) untuk keselamatan dan penyelesaian masalah.</li>
      </ul>
      <h2>Tujuan penggunaan</h2>
      <ul>
        <li>Menyediakan app dan menyegerakkan data anda antara peranti.</li>
        <li>Memproses langganan dan bayaran.</li>
        <li>Menghantar emel penting akaun (pengesahan emel, set semula kata laluan, resit).</li>
        <li>Menjawab pertanyaan dan menyelesaikan masalah teknikal.</li>
      </ul>
      <p>Kami <b>tidak menjual</b> data anda dan tidak menggunakannya untuk iklan.</p>
      <h2>Perkongsian data</h2>
      <ul>
        <li><b>Ruang keluarga:</b> ahli ruang yang sama boleh melihat tugas, belanja dan bajet dalam ruang itu, serta nama paparan anda. Rekod cukai dan gambar resit anda tidak dikongsi.</li>
        <li><b>Penyedia perkhidmatan:</b> Supabase (pangkalan data dan storan fail), Vercel (pengehosan laman) dan Stripe (pembayaran). Mereka memproses data bagi pihak kami. Data mungkin disimpan di pusat data di luar Malaysia.</li>
        <li>Jika dikehendaki oleh undang-undang atau perintah mahkamah.</li>
      </ul>
      <h2>Keselamatan</h2>
      <p>Data dihantar melalui sambungan yang disulitkan (HTTPS). Pangkalan data menggunakan kawalan akses supaya setiap pengguna hanya boleh membaca data mereka sendiri atau data ruang keluarga yang mereka sertai.</p>
      <h2>Tempoh simpanan dan pemadaman</h2>
      <p>Data disimpan selagi akaun anda aktif. Anda boleh memadam akaun bila-bila masa di Akaun → “Padam akaun saya”. Semua data anda akan dipadam, kecuali rekod transaksi yang perlu disimpan oleh Stripe atau oleh kami di bawah undang-undang cukai.</p>
      <h2>Hak anda</h2>
      <p>Anda berhak meminta akses kepada data anda, membetulkannya, mendapatkan salinan (gunakan Eksport di Akaun), menarik balik persetujuan dan meminta pemadaman. Hubungi kami di {BUSINESS.email}.</p>
      <h2>Umur</h2>
      <p>App ini ditujukan untuk pengguna berumur 18 tahun ke atas.</p>
      <h2>Perubahan polisi</h2>
      <p>Kami akan memaklumkan perubahan penting melalui emel atau di dalam app sebelum ia berkuat kuasa.</p>
    </Doc>
  );
}

export function TermsPage() {
  return (
    <Doc title="Terma Penggunaan">
      <p>Dengan mendaftar atau menggunakan {APP_NAME}, anda bersetuju dengan terma ini.</p>
      <h2>Akaun</h2>
      <p>Anda bertanggungjawab menjaga kerahsiaan kata laluan dan semua aktiviti dalam akaun anda. Berikan maklumat yang benar semasa mendaftar.</p>
      <h2>Pelan percuma dan Premium</h2>
      <ul>
        <li>Pelan percuma boleh digunakan tanpa bayaran, dengan ciri yang terhad.</li>
        <li>Premium Bulanan (RM {fmtRM(PLANS.monthly.price)}) dan Tahunan (RM {fmtRM(PLANS.yearly.price)}) <b>diperbaharui secara automatik</b> pada akhir setiap tempoh sehingga dibatalkan.</li>
        <li>Anda boleh membatalkan bila-bila masa di Akaun → “Urus langganan”. Akses Premium kekal hingga akhir tempoh yang telah dibayar.</li>
        <li>Premium Seumur Hidup (RM {fmtRM(PLANS.lifetime.price)}) ialah bayaran sekali untuk akses Premium selama app ini terus beroperasi.</li>
        <li>Kami mungkin mengubah harga. Perubahan harga langganan akan dimaklumkan sekurang-kurangnya 30 hari sebelum ia dikenakan.</li>
      </ul>
      <h2>Ruang keluarga</h2>
      <p>Pemilik ruang bertanggungjawab ke atas siapa yang dijemput. Ahli ruang mendapat ciri Premium selagi langganan pemilik aktif.</p>
      <h2>Penafian cukai</h2>
      <p>Ciri pelepasan cukai ialah alat untuk menyimpan rekod sahaja dan <b>bukan nasihat cukai</b>. Had dan syarat pelepasan ditetapkan oleh Lembaga Hasil Dalam Negeri (LHDN) dan boleh berubah. Anda bertanggungjawab menyemak kelayakan dan membuat tuntutan dengan betul.</p>
      <h2>Penggunaan yang dilarang</h2>
      <p>Jangan cuba mengakses data pengguna lain, mengganggu perkhidmatan atau menggunakan app untuk aktiviti yang menyalahi undang-undang.</p>
      <h2>Had liabiliti</h2>
      <p>App disediakan “sebagaimana adanya”. Setakat yang dibenarkan undang-undang, kami tidak bertanggungjawab atas kerugian tidak langsung, termasuk kehilangan data atau keputusan kewangan yang dibuat berdasarkan app ini. Liabiliti kami terhad kepada jumlah yang anda bayar dalam 12 bulan terakhir.</p>
      <h2>Penamatan</h2>
      <p>Anda boleh berhenti menggunakan app dan memadam akaun bila-bila masa. Kami boleh menggantung akaun yang melanggar terma ini.</p>
      <h2>Undang-undang</h2>
      <p>Terma ini tertakluk kepada undang-undang Malaysia.</p>
    </Doc>
  );
}

export function RefundPage() {
  return (
    <Doc title="Polisi Bayaran Balik">
      <h2>Langganan Bulanan dan Tahunan</h2>
      <ul>
        <li>Anda boleh membatalkan bila-bila masa. Pembatalan menghentikan pembaharuan seterusnya; akses Premium kekal hingga akhir tempoh semasa.</li>
        <li><b>Jaminan 7 hari:</b> jika ini pembayaran pertama anda dan anda tidak berpuas hati, hubungi kami dalam masa 7 hari untuk bayaran balik penuh.</li>
        <li>Selepas 7 hari, bayaran untuk tempoh semasa tidak dikembalikan, kecuali jika dikehendaki oleh undang-undang.</li>
      </ul>
      <h2>Premium Seumur Hidup</h2>
      <p>Bayaran balik penuh boleh diminta dalam masa 7 hari selepas pembelian.</p>
      <h2>Caj tidak sengaja atau berganda</h2>
      <p>Jika anda dicaj dua kali atau ada kesilapan bayaran, hubungi kami dan kami akan membetulkannya.</p>
      <h2>Cara meminta</h2>
      <p>Emel {BUSINESS.email} dengan alamat emel akaun anda dan tarikh bayaran. Bayaran balik dibuat ke kaedah bayaran asal dalam tempoh 5 hingga 10 hari bekerja.</p>
      <p>Untuk pembelian melalui App Store atau Google Play (jika ada pada masa hadapan), bayaran balik diuruskan oleh Apple atau Google mengikut polisi mereka.</p>
      <p className="muted small"><Link to="/terma">Terma Penggunaan</Link></p>
    </Doc>
  );
}
