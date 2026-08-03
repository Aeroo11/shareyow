import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, layout, radius, spacing } from './theme';

interface Props {
  children: ReactNode;
  /** Ditampilkan di atas pesan teknis — menjelaskan apa yang gagal dalam bahasa manusia. */
  title?: string;
  hint?: string;
}

interface State {
  error: Error | null;
}

/**
 * Menangkap kegagalan yang lolos dari seluruh pohon komponen.
 *
 * Tanpa ini, sebuah error saat membuka basis data membuat React membongkar
 * seluruh pohon dan menyisakan **halaman putih kosong tanpa pesan apa pun** —
 * persis yang terjadi di browser, karena dukungan SQLite web masih alpha dan
 * bisa gagal terbuka.
 *
 * Halaman kosong adalah kegagalan paling buruk yang bisa dialami sebuah
 * aplikasi: pengguna tidak tahu apa yang salah, dan pengembangnya tidak dapat
 * petunjuk apa pun. Lebih baik menampilkan kesalahannya apa adanya.
 *
 * Harus berupa kelas: React belum menyediakan versi hook untuk ini.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Sengaja tetap dicatat ke konsol: saat menggarap di browser, jejak
    // komponen inilah yang paling cepat menunjukkan sumber masalahnya.
    console.error('Aplikasi berhenti karena kesalahan tak tertangani:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>{this.props.title ?? 'Aplikasi berhenti'}</Text>
            <Text style={styles.hint}>
              {this.props.hint ??
                'Terjadi kesalahan yang tidak tertangani. Datanya aman — yang gagal hanya tampilannya.'}
            </Text>

            <View style={styles.detail}>
              <Text style={styles.detailLabel}>Pesan aslinya</Text>
              <Text style={styles.detailText}>{error.message || String(error)}</Text>
            </View>

            <Pressable
              onPress={() => this.setState({ error: null })}
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.buttonLabel}>Coba lagi</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }
}

// Sengaja TIDAK memakai token `type`. Token itu menunjuk ke Plus Jakarta Sans,
// dan salah satu hal yang mungkin gagal adalah pemuatan huruf itu sendiri.
// Layar yang tugasnya muncul ketika segalanya rusak harus memakai huruf bawaan
// sistem, supaya tidak ikut rusak bersama yang lain.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  hint: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
  detail: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailLabel: { fontSize: 12, fontWeight: '600', color: colors.textFaint },
  detailText: { fontSize: 13, lineHeight: 19, color: colors.negative },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonLabel: { fontSize: 16, fontWeight: '700', color: colors.textOnAccent },
});
