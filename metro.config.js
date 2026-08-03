// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// --- Dukungan web untuk expo-sqlite ---------------------------------------
//
// Di HP, expo-sqlite memakai SQLite bawaan sistem. Di browser tidak ada yang
// seperti itu, jadi ia memuat SQLite versi WebAssembly. Dua hal harus disiapkan:

// 1. Metro perlu tahu bahwa .wasm adalah aset yang boleh dimuat.
config.resolver.assetExts.push('wasm');

// 2. SQLite versi WebAssembly memerlukan SharedArrayBuffer, dan browser hanya
//    mengaktifkannya pada halaman yang "terisolasi lintas-asal". Isolasi itu
//    diminta lewat dua header di bawah. Tanpa keduanya basis data di browser
//    gagal terbuka — dan pesan errornya tidak menyebut header sama sekali, jadi
//    ini termasuk hal yang sangat lama dicari kalau sampai terlupa.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
