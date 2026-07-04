import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Download } from 'lucide-react-native';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Cek apakah aplikasi sudah diinstal (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      // Mencegah munculnya pop-up default bawaan Chrome bawah layar
      e.preventDefault();
      // Simpan event untuk dipanggil secara manual nanti lewat tombol kita
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      // Sembunyikan tombol secara permanen ketika berhasil terinstal
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('Untuk menginstal secara manual: Klik ikon Titik Tiga (⋮) di pojok kanan atas Chrome, lalu pilih "Tambahkan ke Layar Utama".\n\nBagi pengguna iPhone (Safari): Klik tombol Bagikan (Share) di bawah, lalu pilih "Tambah ke Layar Utama".');
      return;
    }
    
    // Tampilkan pop-up instalasi asli bawaan browser
    deferredPrompt.prompt();
    
    // Tunggu respon pengguna (apakah Install atau Cancel)
    const { outcome } = await deferredPrompt.userChoice;
    
    // Hapus prompt agar tidak dipanggil lagi sampai browser di-refresh
    setDeferredPrompt(null);
  };

  // Jangan tampilkan apapun jika aplikasi sudah terinstal (terbuka di layar utama)
  if (isInstalled) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleInstallClick} activeOpacity={0.8}>
        <Download size={20} color="#fff" style={styles.icon} />
        <Text style={styles.text}>Instal SalApp Wali ke Layar Utama</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6', // Biru
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  }
});
