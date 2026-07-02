import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, Text, TextInput } from 'react-native';

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

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
