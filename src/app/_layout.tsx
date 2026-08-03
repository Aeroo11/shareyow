import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { migrate } from '../db/migrations';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Loading } from '../ui/components';
import { colors, type } from '../ui/theme';

// Splash ditahan sampai huruf siap. Tanpa ini layar sempat tampil dengan huruf
// bawaan sistem lalu melompat berubah — kedipan kecil yang langsung membuat
// aplikasi terasa murah.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    // Huruf yang gagal dimuat bukan alasan menahan aplikasi selamanya —
    // React Native akan memakai huruf sistem, dan itu jauh lebih baik daripada
    // splash screen yang tidak pernah hilang.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Error boundary berada DI LUAR SQLiteProvider, bukan di dalamnya.
            Yang paling mungkin gagal justru pembukaan basis datanya sendiri —
            terutama di browser, tempat SQLite berjalan sebagai WebAssembly dan
            dukungannya masih alpha. Kalau boundary-nya ada di dalam, kegagalan
            itu lolos dan menyisakan halaman putih tanpa pesan apa pun. */}
        <ErrorBoundary
          title="Gagal membuka data"
          hint={
            'Basis data lokal tidak bisa dibuka. Di browser ini biasanya karena SQLite ' +
            'versi WebAssembly diblokir; di HP, coba tutup lalu buka lagi aplikasinya.'
          }
        >
          <Suspense fallback={<Loading />}>
            {/* useSuspense menahan seluruh pohon sampai migrasi selesai, sehingga
                tidak ada layar yang sempat menjalankan kueri ke tabel yang belum ada. */}
            <SQLiteProvider databaseName="patungan.db" onInit={migrate} useSuspense>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.bg },
                  headerShadowVisible: false,
                  headerTitleStyle: { ...type.heading, color: colors.text },
                  headerTintColor: colors.accent,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              >
                <Stack.Screen name="index" options={{ title: 'share.yow' }} />
                <Stack.Screen name="account" options={{ title: 'Akun' }} />
                <Stack.Screen
                  name="join"
                  options={{ title: 'Gabung grup', presentation: 'modal' }}
                />
                <Stack.Screen
                  name="group/new"
                  options={{ title: 'Grup baru', presentation: 'modal' }}
                />
                <Stack.Screen name="group/[id]/index" options={{ title: '' }} />
                <Stack.Screen name="group/[id]/settle" options={{ title: 'Selesaikan' }} />
                <Stack.Screen name="group/[id]/activity" options={{ title: 'Riwayat' }} />
                <Stack.Screen
                  name="group/[id]/members"
                  options={{ title: 'Anggota', presentation: 'modal' }}
                />
                <Stack.Screen
                  name="group/[id]/expense/new"
                  options={{ title: 'Pengeluaran baru', presentation: 'modal' }}
                />
                <Stack.Screen
                  name="group/[id]/expense/[expenseId]"
                  options={{ title: 'Ubah pengeluaran', presentation: 'modal' }}
                />
              </Stack>
            </SQLiteProvider>
          </Suspense>
        </ErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}
