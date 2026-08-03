/**
 * Gerak, memakai `Animated` bawaan React Native.
 *
 * Reanimated sempat dipasang lalu dicopot lagi. Yang dibutuhkan aplikasi ini
 * hanya tiga hal — tombol menyusut saat ditekan, baris masuk berurutan, dan
 * angka memantul saat berubah — dan ketiganya murni transform serta opacity,
 * yang sudah dijalankan di thread native lewat `useNativeDriver`. Reanimated
 * unggul untuk animasi yang digerakkan gestur atau berjalan terus-menerus;
 * milik kita pendek dan diskret. Menambahkannya berarti menambah peer
 * dependency, babel plugin, dan satu lagi hal yang bisa patah di Expo Go —
 * tanpa hasil yang berbeda di mata pengguna.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { motion } from './theme';

/** Getaran halus. Diam saja di web, tempat API-nya tidak ada. */
export function tapFeedback(style: 'light' | 'medium' | 'success' = 'light'): void {
  if (Platform.OS === 'web') return;
  if (style === 'success') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return;
  }
  void Haptics.impactAsync(
    style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
  );
}

/**
 * Skala tekan untuk apa pun yang bisa disentuh. Dikembalikan sebagai pasangan
 * gaya + penangan, supaya pemanggil tinggal menyebarkannya ke Animated.View.
 */
export function usePressScale(scaleTo: number = motion.pressScale) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = useCallback(
    (value: number) => {
      Animated.spring(scale, {
        toValue: value,
        useNativeDriver: true,
        ...motion.spring,
      }).start();
    },
    [scale],
  );

  return {
    style: { transform: [{ scale }] },
    onPressIn: () => to(scaleTo),
    onPressOut: () => to(1),
  };
}

/**
 * Masuk dengan pudar dan geser naik. `index` membuat baris berurutan muncul
 * bergiliran — jeda kecil yang membuat daftar terasa disusun, bukan dilempar.
 */
export function useEnter(index = 0, distance = 12) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.normal,
      delay: Math.min(index, 8) * 40,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, index]);

  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
      },
    ],
  };
}

/**
 * Denyut kecil saat sebuah angka berubah. Sengaja hanya menskalakan, tidak
 * menghitung naik dari nilai lama: menghitung naik terlihat mengesankan sekali
 * lalu melelahkan setiap kali sesudahnya, dan pada aplikasi uang ia membuat
 * nominal sempat menampilkan angka yang tidak pernah benar.
 */
export function usePulseOnChange(value: number) {
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;

    scale.setValue(1.06);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring }).start();
  }, [value, scale]);

  return { transform: [{ scale }] };
}
