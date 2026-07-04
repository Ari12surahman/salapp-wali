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
      console.log('Browser tidak mendukung Firebase Messaging.');
      return null;
    }
    
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    
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
            console.log(`getToken attempt ${attempt} failed:`, retryError);
            if (attempt === 3) throw retryError;
          }
        }
        return token;
      } catch (tokenError: any) {
        console.error('Gagal getToken setelah retry:', tokenError);
        return null;
      }
    } else {
      console.log('Izin notifikasi ditolak oleh browser (' + permission + ').');
      return null;
    }
  } catch (error: any) {
    console.error('Error Firebase Init:', error);
    return null;
  }
};

