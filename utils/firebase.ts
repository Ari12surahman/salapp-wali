import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyBrUfh63HTT3F7XvUmRnWd9KreV8FUmQFI',
  authDomain: 'salapp-ac39a.firebaseapp.com',
  projectId: 'salapp-ac39a',
  storageBucket: 'salapp-ac39a.firebasestorage.app',
  messagingSenderId: '34361910372',
  appId: '1:34361910372:web:20bc79723bb358f4cf6b71',
  measurementId: 'G-VLWX18R8E3'
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const requestFirebaseWebPushPermission = async (vapidKey: string) => {
  try {
    const supported = await isSupported();
    if (!supported) {
      alert('DEBUG 1: Browser tidak support FCM');
      return null;
    }
    
    // Cek status izin saat ini SEBELUM meminta
    const currentPermission = Notification.permission;
    alert('DEBUG 2: Status izin saat ini = "' + currentPermission + '"');
    
    if (currentPermission === 'denied') {
      alert('DEBUG 3: Izin DIBLOKIR. Bapak perlu membuka Pengaturan HP > Aplikasi > SalApp Wali (atau Chrome) > Notifikasi > Izinkan');
      return null;
    }
    
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    alert('DEBUG 4: Hasil requestPermission = "' + permission + '"');
    
    if (permission === 'granted') {
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        let activeRegistration = await navigator.serviceWorker.ready;
        
        let token = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
            activeRegistration = await navigator.serviceWorker.ready;
            token = await getToken(messaging, { 
              vapidKey,
              serviceWorkerRegistration: activeRegistration 
            });
            if (token) break;
          } catch (retryError: any) {
            alert('DEBUG 5: Retry ' + attempt + ' gagal: ' + retryError.message);
            if (attempt === 3) throw retryError;
          }
        }
        return token;
      } catch (tokenError: any) {
        alert('DEBUG 6: getToken gagal total: ' + tokenError.message);
        return null;
      }
    } else {
      alert('DEBUG 7: Permission bukan granted, hasilnya: ' + permission);
      return null;
    }
  } catch (error: any) {
    alert('DEBUG 8: Error fatal: ' + error.message);
    return null;
  }
};

