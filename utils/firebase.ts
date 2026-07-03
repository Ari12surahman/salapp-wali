import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyBrUfh63HTT3F7XvUmRnWd9KreV8FUmQFI',
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
      console.log('Firebase Messaging is not supported in this browser.');
      return null;
    }
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, { vapidKey });
      console.log('Firebase Web Push Token:', token);
      return token;
    } else {
      console.log('Notification permission not granted.');
      return null;
    }
  } catch (error) {
    console.error('Error getting push token', error);
    return null;
  }
};

