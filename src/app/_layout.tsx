import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { migrate } from '../db/migrations';
import { Loading } from '../ui/components';
import { colors, type } from '../ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
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
            <Stack.Screen name="index" options={{ title: 'Patungan' }} />
            <Stack.Screen name="group/new" options={{ title: 'Grup baru', presentation: 'modal' }} />
            <Stack.Screen name="group/[id]/index" options={{ title: '' }} />
            <Stack.Screen name="group/[id]/settle" options={{ title: 'Selesaikan' }} />
            <Stack.Screen
              name="group/[id]/expense/new"
              options={{ title: 'Pengeluaran baru', presentation: 'modal' }}
            />
          </Stack>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}
