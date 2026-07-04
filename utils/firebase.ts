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
      alert('Browser tidak mendukung notifikasi Firebase (isSupported=false).');
      return null;
    }
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        // Tunggu sampai service worker benar-benar 'active' (ready)
        let activeRegistration = await navigator.serviceWorker.ready;
        
        // Tambahkan delay 2 detik untuk memastikan SW benar-benar sudah 'activated' di background
        await new Promise(resolve => setTimeout(resolve, 2000));
        activeRegistration = await navigator.serviceWorker.ready;
        
        const token = await getToken(messaging, { 
          vapidKey,
          serviceWorkerRegistration: activeRegistration 
        });
        return token;
      } catch (tokenError: any) {
        alert('Gagal getToken: ' + tokenError.message);
        console.error(tokenError);
        return null;
      }
    } else {
      console.log('Izin notifikasi ditolak oleh browser (' + permission + ').');
      return null;
    }
  } catch (error: any) {
    alert('Error Firebase Init: ' + error.message);
    return null;
  }
};

