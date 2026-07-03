import { Stack } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, Text, TextInput, View, DeviceEventEmitter, Animated, TouchableOpacity, StyleSheet, Image } from 'react-native';

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
                DeviceEventEmitter.emit('showToast', { title, body });
              }).catch(err => {
                console.log('SW notification failed:', err);
                new Notification(title, { body, icon: '/icon.png' });
                DeviceEventEmitter.emit('showToast', { title, body });
              });
            } else {
              DeviceEventEmitter.emit('showToast', { title, body });
            }
          } else {
            DeviceEventEmitter.emit('showToast', { title, body });
          }
        });
      }
    } catch (e) {
      console.log('Error setup onMessage', e);
    }
  }
}

const CustomToast = () => {
  const [toast, setToast] = useState<{title: string, body: string} | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener('showToast', (data) => {
      setToast(data);
      Animated.spring(translateY, {
        toValue: 20,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 5000);
    });
    return () => listener.remove();
  }, []);

  if (!toast) return null;

  return (
    <Animated.View style={[styles.toastContainer, { transform: [{ translateY }] }]}>
      <TouchableOpacity activeOpacity={0.8} style={styles.toastContent} onPress={() => {
        Animated.timing(translateY, { toValue: -100, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }}>
        <Image source={require('../assets/icon.png')} style={styles.toastIcon} />
        <View style={styles.toastTextContainer}>
          <Text style={styles.toastTitle}>{toast.title}</Text>
          <Text style={styles.toastBody} numberOfLines={2}>{toast.body}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center'
  },
  toastContent: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#3498db'
  },
  toastIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 12
  },
  toastTextContainer: {
    flex: 1
  },
  toastTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
    marginBottom: 4
  },
  toastBody: {
    fontSize: 13,
    color: '#666'
  }
});

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotificationsAsync();
    setTimeout(setupForegroundFCM, 3000); // Give it time to initialize
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
        <StatusBar style="auto" />
        <CustomToast />
      </View>
    </View>
  );
}
