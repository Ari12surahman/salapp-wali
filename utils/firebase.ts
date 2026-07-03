import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyBEA5DDdo4BIjpwjzciu1nFpmN_7sqPLRw',
  authDomain: 'salapp-ac39a.firebaseapp.com',
  projectId: 'salapp-ac39a',
  storageBucket: 'salapp-ac39a.firebasestorage.app',
  messagingSenderId: '34361910372',
  appId: '1:34361910372:web:95d8ff8fce6d1d78cf6b71'
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
        const activeRegistration = await navigator.serviceWorker.ready;
        
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
      alert('Izin notifikasi ditolak oleh browser (' + permission + ').');
      return null;
    }
  } catch (error: any) {
    alert('Error Firebase Init: ' + error.message);
    return null;
  }
};

