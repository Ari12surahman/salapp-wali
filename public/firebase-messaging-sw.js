importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyBEA5DDdo4BIjpwjzciu1nFpmN_7sqPLRw',
  authDomain: 'salapp-ac39a.firebaseapp.com',
  projectId: 'salapp-ac39a',
  storageBucket: 'salapp-ac39a.firebasestorage.app',
  messagingSenderId: '34361910372',
  appId: '1:34361910372:web:95d8ff8fce6d1d78cf6b71'
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'SalApp';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Pemberitahuan baru',
    icon: '/favicon.ico',
    data: payload.data,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
