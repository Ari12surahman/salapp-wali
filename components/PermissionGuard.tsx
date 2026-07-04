import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';

export default function PermissionGuard({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<string>('granted');
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Check in-app browser (WhatsApp, FB, IG)
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
      if (ua.indexOf('FBAN') > -1 || ua.indexOf('FBAV') > -1 || ua.indexOf('Instagram') > -1 || ua.indexOf('WhatsApp') > -1 || ua.indexOf('Line') > -1) {
        setIsInAppBrowser(true);
      }

      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
        
        // Listen for permission changes (some browsers support this)
        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'notifications' }).then(status => {
            status.onchange = () => {
              setPermission(status.state);
            };
          });
        }
      }
    }
  }, []);

  if (isInAppBrowser) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Buka di Chrome 🌐</Text>
          <Text style={styles.desc}>
            Aplikasi ini membutuhkan fitur Notifikasi. Harap buka tautan ini melalui browser Google Chrome (bukan dari dalam WhatsApp/Instagram).
          </Text>
          <Text style={styles.instruction}>
            Caranya: Klik ikon Titik Tiga (⋮) di pojok kanan atas layar Anda, lalu pilih "Buka di Chrome" (Open in Chrome).
          </Text>
        </View>
      </View>
    );
  }

  if (permission === 'denied') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Notifikasi Diblokir 🔕</Text>
          <Text style={styles.desc}>
            Bapak/Ibu tidak akan bisa menerima laporan SPP & Tabungan karena notifikasi diblokir oleh browser.
          </Text>
          <Text style={styles.instruction}>
            Cara membuka blokir:
            {'\n'}1. Klik ikon Gembok (🔒) atau Pengaturan di samping alamat situs (atas layar).
            {'\n'}2. Pilih "Izin Situs" (Site Settings).
            {'\n'}3. Cari "Notifikasi" dan ubah menjadi "Izinkan" (Allow).
            {'\n'}4. Muat ulang (Refresh) halaman ini.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => window.location.reload()}>
            <Text style={styles.btnText}>Saya Sudah Mengizinkan, Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99999
  },
  card: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 12,
    textAlign: 'center'
  },
  desc: {
    fontSize: 15,
    color: '#444',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    lineHeight: 24,
    marginBottom: 20
  },
  btn: {
    backgroundColor: '#3498db',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15
  }
});
