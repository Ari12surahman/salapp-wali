import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, Text, TextInput, View } from 'react-native';

interface TextWithDefaultProps extends Text {
    defaultProps?: { allowFontScaling?: boolean };
}
interface TextInputWithDefaultProps extends TextInput {
    defaultProps?: { allowFontScaling?: boolean };
}

if (((Text as unknown) as TextWithDefaultProps).defaultProps == null) {
    ((Text as unknown) as TextWithDefaultProps).defaultProps = {};
}
((Text as unknown) as TextWithDefaultProps).defaultProps!.allowFontScaling = false;

if (((TextInput as unknown) as TextInputWithDefaultProps).defaultProps == null) {
    ((TextInput as unknown) as TextInputWithDefaultProps).defaultProps = {};
}
((TextInput as unknown) as TextInputWithDefaultProps).defaultProps!.allowFontScaling = false;
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    try {
      const { requestFirebaseWebPushPermission } = require('../utils/firebase');
      const vapidKey = 'BHXv73pKzsflxNWQxYOQlYfntVGdQQp67JyuBVZ_JnHiuccXcrcWzGoFu50QPe4VbIqY3CDdXtjq8kNsTqjh0xc';
      const token = await requestFirebaseWebPushPermission(vapidKey);
      if (token) {
        await AsyncStorage.setItem('_push_token', token);
      }
    } catch (e) {
      console.log('Firebase Web Push error:', e);
    }
    return;
  }
  
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  
  if (isExpoGo) {
    console.log('Push notifications are not supported in Expo Go. Please use a development build.');
    return;
  }

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    } catch (e) {
      console.log('Error setting notification channel', e);
    }
  }

  if (Device.isDevice) {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      // Expo Go >= 53 no longer supports remote push notifications
      // We wrap getExpoPushTokenAsync in try-catch so it doesn't crash Expo Go
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || '7537bbec-8d68-4f88-bb50-c98c249264f5';
      const pushTokenString = (await Notifications.getExpoPushTokenAsync({
        projectId: projectId
      })).data;
      
      console.log("EXPO PUSH TOKEN:", pushTokenString);
      
      // Save token to AsyncStorage to be sent later by Dashboard
      if (pushTokenString) {
        await AsyncStorage.setItem('_push_token', pushTokenString);
      }
    } catch (e) {
      console.log('Push notifications not available in Expo Go or simulator', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }
}

import AutoUpdater from '../components/AutoUpdater';
import InstallPWA from '../components/InstallPWA';

import { getApps, getApp } from 'firebase/app';
import { getMessaging, onMessage } from 'firebase/messaging';

function setupForegroundFCM() {
  if (Platform.OS === 'web') {
    try {
      if (getApps().length > 0) {
        const messaging = getMessaging(getApp());
        onMessage(messaging, (payload) => {
          console.log('Foreground FCM:', payload);
          const title = payload.notification?.title || payload.data?.title || 'SalApp';
          const body = payload.notification?.body || payload.data?.body || '';
          if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, { body, icon: '/icon.png' });
              }).catch(err => {
                console.log('SW notification failed:', err);
                new Notification(title, { body, icon: '/icon.png' });
              });
            }
          }
        });
      }
    } catch (e) {
      console.log('Error setup onMessage', e);
    }
  }
}

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotificationsAsync();
    setTimeout(setupForegroundFCM, 3000); // Give it time to initialize
  }, []);

  const isWeb = Platform.OS === 'web';

  return (
    <View style={{ flex: 1, backgroundColor: isWeb ? '#f4f4f5' : '#fff' }}>
      <InstallPWA />
      <AutoUpdater />
      <View
        style={
          isWeb
            ? {
                flex: 1,
                maxWidth: 480,
                marginHorizontal: 'auto',
                width: '100%',
                backgroundColor: '#fff',
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 15,
                elevation: 5,
                overflow: 'hidden',
              }
            : { flex: 1 }
        }
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
        </Stack>
        <StatusBar style="auto" />
      </View>
    </View>
  );
}
