import { Stack } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, Text, TextInput, View, DeviceEventEmitter, Animated, TouchableOpacity } from 'react-native';

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
          DeviceEventEmitter.emit('refresh_dashboard');
          
          const title = payload.notification?.title || payload.data?.title || 'SalApp';
          const body = payload.notification?.body || payload.data?.body || '';
          
          // Emit custom event to show in-app toast
          DeviceEventEmitter.emit('pwa_toast', { title, body });
          
          if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              navigator.serviceWorker.ready.then(registration => {
                const iconPath = window.location.origin + '/icon.png';
                const badgePath = window.location.origin + '/notif.png';
                registration.showNotification(title, { 
                  body, 
                  icon: iconPath,
                  badge: badgePath,
                  requireInteraction: false,
                  // @ts-ignore
                  vibrate: [200, 100, 200]
                });
              }).catch(err => {
                console.log('SW notification failed:', err);
                const iconPath = window.location.origin + '/icon.png';
                new Notification(title, { body, icon: iconPath });
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
  const [toastData, setToastData] = useState<{title: string, body: string} | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    registerForPushNotificationsAsync();
    setTimeout(setupForegroundFCM, 3000); // Give it time to initialize

    // Listen for Expo native push notifications in foreground
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Native Foreground Push Received:', notification);
      DeviceEventEmitter.emit('refresh_dashboard');
    });

    // Listen for custom PWA foreground toast
    const toastListener = DeviceEventEmitter.addListener('pwa_toast', (data) => {
      setToastData(data);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToastData(null));
      }, 5000);
    });
    
    // Inject PWA manifest link for web
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.querySelector('link[rel="manifest"]')) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = '/manifest.json';
        document.head.appendChild(link);
      }
    }

    return () => {
      notificationListener.remove();
      toastListener.remove();
    };
  }, []);

  const isWeb = Platform.OS === 'web';

  return (
    <View style={{ flex: 1, backgroundColor: isWeb ? '#f4f4f5' : '#fff' }}>
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

        {/* Custom In-App Toast Notification */}
        {toastData && (
          <Animated.View style={{
            position: 'absolute',
            top: 40,
            left: 20,
            right: 20,
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0]
              })
            }],
            backgroundColor: '#fff',
            padding: 16,
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 6,
            borderLeftWidth: 4,
            borderLeftColor: '#0083B8',
            zIndex: 9999
          }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => {
              Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToastData(null));
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, backgroundColor: '#E1F5FE', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 20 }}>🔔</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', color: '#1E293B', fontSize: 15, marginBottom: 2 }}>{toastData.title}</Text>
                  <Text style={{ color: '#64748B', fontSize: 13, lineHeight: 18 }}>{toastData.body}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
        <StatusBar style="auto" />
      </View>
    </View>
  );
}
