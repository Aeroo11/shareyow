/**
 * Memeriksa bahwa proyek Supabase siap dipakai — tanpa perlu membuka aplikasi.
 *
 *   npm run check:backend
 *
 * Yang diperiksa bukan sekadar "servernya hidup", melainkan hal yang paling
 * menentukan: apakah Row Level Security benar-benar menutup. Tabel yang ada tapi
 * tertutup menjawab 200 dengan array kosong; tabel yang tidak ada menjawab 404
 * berkode PGRST205. Perbedaan itulah yang membuat satu permintaan menguji dua hal
 * sekaligus — skemanya terpasang, dan RLS-nya aktif.
 *
 * Tidak menulis apa pun yang bertahan, dan tidak pernah mencetak kuncinya.
 */

import { readFileSync } from 'node:fs';

const envPath = process.argv[2] ?? '.env';

let envText = '';
try {
  envText = readFileSync(envPath, 'utf8');
} catch {
  console.log(`Tidak ada ${envPath}. Salin .env.example menjadi .env lalu isi kuncinya.`);
  process.exit(1);
}

const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const kind =
  key.startsWith('sb_secret_') ? 'SECRET - BAHAYA'
  : key.startsWith('sb_publishable_') ? 'publishable (benar)'
  : key.startsWith('eyJ') ? 'JWT anon lama (masih berlaku)'
  : key.length === 0 ? 'KOSONG'
  : 'tidak dikenali';

console.log('url       :', url || '(kosong)');
console.log('jenis key :', kind);
console.log('');

if (key.startsWith('sb_secret_')) {
  console.log('HENTIKAN. Itu secret key — ia melewati seluruh RLS dan akan ikut terbundel');
  console.log('ke aplikasi yang dipasang orang lain. Cabut di dasbor, ganti dengan');
  console.log('publishable key.');
  process.exit(1);
}
if (!url || !key) {
  console.log('.env belum lengkap.');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
let gagal = 0;

async function check(label, run) {
  let verdict;
  try {
    verdict = await run();
  } catch (e) {
    verdict = `gagal menghubungi: ${e instanceof Error ? e.message : String(e)}`;
  }
  const ok = verdict.startsWith('ok');
  if (!ok) gagal += 1;
  console.log(`${ok ? '[ok]' : '[!!]'}  ${label}`);
  console.log(`      ${verdict}`);
}

async function tableClosed(name) {
  const res = await fetch(`${url}/rest/v1/${name}?select=*&limit=1`, { headers });
  const body = (await res.text()).slice(0, 200);

  if (res.status === 404 || body.includes('PGRST205')) return 'TABEL TIDAK ADA - jalankan supabase/migrations/0001_init.sql';
  if (res.status === 401 || res.status === 403) return 'ok - ditolak langsung';
  if (res.status === 200 && body.trim() === '[]') return 'ok - tabelnya ada dan RLS menutupnya rapat';
  if (res.status === 200) return `BAHAYA - tabel ini terbaca tanpa akun: ${body}`;
  return `PERIKSA - status ${res.status}, isi ${body}`;
}

for (const table of ['ops', 'groups', 'group_access', 'group_invites', 'profiles']) {
  await check(`${table}: ada dan tertutup RLS`, () => tableClosed(table));
}

// Dipanggil dengan kode yang pasti tidak ada. Fungsinya melempar "Kode undangan
// tidak berlaku" sebelum menyentuh tabel mana pun, jadi ini membuktikan ia
// terpasang tanpa meninggalkan jejak.
await check('join_group: terpasang dan menolak kode palsu', async () => {
  const res = await fetch(`${url}/rest/v1/rpc/join_group`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      invite_code: '__TIDAK_ADA__',
      claim_member_id: '00000000-0000-0000-0000-000000000000',
    }),
  });
  const body = (await res.text()).slice(0, 200);

  if (res.status === 404) return `TIDAK ADA - ${body}`;
  if (body.includes('Kode undangan tidak berlaku')) return 'ok - ada, dan menolak persis seperti seharusnya';
  return `PERIKSA - status ${res.status}, isi ${body}`;
});

console.log('');
if (gagal === 0) {
  console.log('SEMUA LOLOS - backend siap dipakai.');
} else {
  console.log(`${gagal} pemeriksaan perlu dilihat.`);
  process.exit(1);
}
