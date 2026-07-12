import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from '../tailwind';
import { ShieldCheck, User, Lock, Eye, EyeOff, AlertCircle, ChevronRight } from 'lucide-react-native';
import { loginOrangTua, savePushToken } from '../utils/supabaseApi';
import InstallPWA from '../components/InstallPWA';

export default function Login() {
  const router = useRouter();
  const [nis, setNis] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!nis || !password) {
      setError('Mohon isi NIS dan Password');
      return;
    }

    setLoading(true);
    setError('');

    let fcmToken = null;
    
    // Request Push Notification permission di awal sebelum await apapun (untuk mematuhi user gesture browser)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const { requestFirebaseWebPushPermission } = require('../utils/firebase');
          const vapidKey = 'BHXv73pKzsflxNWQxYOQlYfntVGdQQp67JyuBVZ_JnHiuccXcrcWzGoFu50QPe4VbIqY3CDdXtjq8kNsTqjh0xc';
          fcmToken = await requestFirebaseWebPushPermission(vapidKey);
          if (fcmToken) {
            await AsyncStorage.setItem('_push_token', fcmToken);
          }
        }
      } catch (e) {
        console.log('Firebase Web Push error on login:', e);
      }
    }

    try {
      const res = await loginOrangTua(nis, password);
      if (res.success && res.user) {
        const sessionData = {
          nis: res.user.nis,
          nama: res.user.nama,
          password: password,
          appName: "Portal Wali Santri"
        };
        
        await SecureStore.setItemAsync('_parent_session', JSON.stringify(sessionData));
        
        try {
          const savedStr = await SecureStore.getItemAsync('_parent_saved_accounts');
          let savedAccounts = savedStr ? JSON.parse(savedStr) : [];
          savedAccounts = savedAccounts.filter((acc: any) => acc.nis !== sessionData.nis);
          savedAccounts.push(sessionData);
          await SecureStore.setItemAsync('_parent_saved_accounts', JSON.stringify(savedAccounts));
        } catch (e) {
          console.error("Gagal menyimpan multi-akun", e);
        }
        
        if (!fcmToken) {
          fcmToken = await AsyncStorage.getItem('_push_token');
        }
        
        if (fcmToken) {
          console.log('Menyimpan FCM/Expo Token baru...', fcmToken);
          await savePushToken(res.user.nis, fcmToken);
        }
        
        router.replace('/(tabs)/dashboard');
      } else {
        setError(res.message || 'Login gagal.');
      }
    } catch (e: any) {
      setError('Koneksi bermasalah. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={tw`flex-1 bg-canvas`}
    >
      <ScrollView contentContainerStyle={tw`flex-grow justify-center px-6 py-12 relative`}>
        {/* Background Decor */}
        <View style={tw`absolute top-0 left-0 right-0 h-96 bg-accentLight/30`} />
        
        <View style={tw`w-full max-w-sm self-center z-10`}>
          <View style={tw`items-center mb-10`}>
            <View style={tw`w-24 h-24 bg-white shadow-md rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-whisper relative`}>
              <View style={tw`absolute inset-0 bg-accent/5 rounded-[2rem]`} />
              <ShieldCheck color={tw.color('accent')} size={48} />
            </View>
            <Text style={tw`text-3xl font-black text-ink mb-2 tracking-tight`}>Portal Wali</Text>
            <Text style={tw`text-steel text-sm text-center`}>Masuk untuk memantau aktivitas keuangan Ananda dengan aman.</Text>
          </View>

          <View style={tw`bg-white rounded-[1.25rem] p-2 shadow-sm border border-whisper/60 mb-4`}>
            <View style={tw`flex-row items-center relative`}>
              <View style={tw`absolute left-4 z-10`}>
                <User color={tw.color('slate-500')} size={20} />
              </View>
              <TextInput
                style={tw`flex-1 bg-transparent px-5 py-4 pl-12 text-sm text-ink font-medium`}
                placeholder="Nomor Induk Santri (NIS)"
                placeholderTextColor={tw.color('slate-400')}
                value={nis}
                onChangeText={setNis}
                keyboardType="number-pad"
                autoCapitalize="none"
              />
            </View>
            
            <View style={tw`h-[1px] w-full bg-slate-100 my-1`} />
            
            <View style={tw`flex-row items-center relative`}>
              <View style={tw`absolute left-4 z-10`}>
                <Lock color={tw.color('slate-500')} size={20} />
              </View>
              <TextInput
                style={tw`flex-1 bg-transparent px-5 py-4 pl-12 pr-12 text-sm text-ink font-medium`}
                placeholder="Kata Sandi"
                placeholderTextColor={tw.color('slate-400')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={tw`absolute right-4 z-10 p-1`}
              >
                {showPassword ? (
                  <EyeOff color={tw.color('slate-500')} size={20} />
                ) : (
                  <Eye color={tw.color('slate-500')} size={20} />
                )}
              </TouchableOpacity>
            </View>
          </View>
          
          {error ? (
            <View style={tw`p-4 rounded-xl bg-dangerBg flex-row items-center mb-4`}>
              <AlertCircle color={tw.color('danger')} size={16} />
              <Text style={tw`text-danger text-sm font-medium ml-2`}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={tw`w-full bg-ink rounded-[1.25rem] px-5 py-4 flex-row items-center justify-between shadow-md mt-2 ${loading ? 'opacity-80' : ''}`}
          >
            <Text style={tw`text-white font-semibold text-base ml-2`}>Masuk Akun</Text>
            <View style={tw`w-8 h-8 rounded-full bg-white/20 flex items-center justify-center`}>
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <ChevronRight color="white" size={16} />
              )}
            </View>
          </TouchableOpacity>
          
          <View style={tw`mt-6 w-full`}>
            <InstallPWA />
          </View>

          <Text style={tw`text-center text-slate-500 text-xs font-medium mt-8`}>
            Password default adalah NIS santri jika belum diubah.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
