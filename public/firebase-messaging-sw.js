importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyBrUfh63HTT3F7XvUmRnWd9KreV8FUmQFI',
  authDomain: 'salapp-ac39a.firebaseapp.com',
  projectId: 'salapp-ac39a',
  storageBucket: 'salapp-ac39a.firebasestorage.app',
  messagingSenderId: '34361910372',
  appId: '1:34361910372:web:20bc79723bb358f4cf6b71',
  measurementId: 'G-VLWX18R8E3'
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.data?.title || 'SalApp Wali';
  const notificationOptions = {
    body: payload.data?.body || 'Pemberitahuan baru',
    icon: payload.data?.icon || 'https://salapp-wali.vercel.app/icon.png',
    badge: 'https://salapp-wali.vercel.app/icon.png',
    data: payload.data,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
