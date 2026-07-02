import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { User, Shield, LogOut, ChevronRight, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import tw from '../../tailwind';
import { callGasAPI } from '../../utils/api';

export default function Profil() {
  const router = useRouter();
  const [userData, setUserData] = useState<{ nis: string, nama: string } | null>(null);
  
  // Ganti Password State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('_parent_session').then(session => {
      if (session) setUserData(JSON.parse(session));
    });
  }, []);



  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('_parent_session');
    router.replace('/login');
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      Alert.alert('Error', 'Mohon isi password lama dan baru');
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await callGasAPI('gantiPasswordOrangTua', { 
        nis: userData?.nis, 
        oldPassword, 
        newPassword 
      });
      if (res.success) {
        Alert.alert('Berhasil', 'Password berhasil diubah!');
        setIsPasswordModalOpen(false);
        setOldPassword('');
        setNewPassword('');
      } else {
        Alert.alert('Gagal', res.message || 'Gagal mengubah password');
      }
    } catch (e) {
      Alert.alert('Error', 'Terjadi kesalahan koneksi');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <View style={tw`flex-1 bg-canvas`}>
      <View style={tw`bg-white px-6 py-4 flex-row items-center border-b border-whisper pt-12 shadow-sm`}>
        <View style={tw`w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center mr-3`}>
          <User color={tw.color('accent')} size={20} />
        </View>
        <View>
          <Text style={tw`font-extrabold text-ink text-xl`}>Profil</Text>
          <Text style={tw`text-[10px] text-steel font-medium`}>Informasi Akun</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={tw`p-6 pb-32`}>
        <View style={tw`bg-white rounded-[24px] p-6 shadow-sm border border-whisper items-center mb-6`}>
          <View style={tw`w-20 h-20 bg-accentLight rounded-full flex items-center justify-center mb-4`}>
            <Text style={tw`text-3xl font-bold text-accent`}>
              {userData?.nama ? userData.nama.charAt(0) : 'S'}
            </Text>
          </View>
          <Text style={tw`text-xl font-bold text-ink`}>{userData?.nama || 'Santri'}</Text>
          <Text style={tw`text-sm font-medium text-steel mt-1`}>NIS: {userData?.nis || '-'}</Text>
        </View>

        <Text style={tw`font-bold text-ink text-base mb-3 ml-1`}>Pengaturan</Text>
        <View style={tw`bg-white rounded-2xl shadow-sm border border-whisper overflow-hidden mb-6`}>
          <TouchableOpacity 
            onPress={() => setIsPasswordModalOpen(true)}
            style={tw`flex-row items-center justify-between p-4 border-b border-whisper`}
          >
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center mr-3`}>
                <Shield color={tw.color('steel')} size={16} />
              </View>
              <Text style={tw`text-sm font-bold text-ink`}>Ganti Password</Text>
            </View>
            <ChevronRight color={tw.color('steel')} size={16} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleLogout} style={tw`w-full bg-dangerBg py-4 rounded-2xl flex-row justify-center items-center`}>
          <LogOut color={tw.color('danger')} size={20} />
          <Text style={tw`text-danger font-bold text-base ml-2`}>Keluar Akun</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Ganti Password Modal */}
      <Modal visible={isPasswordModalOpen} animationType="fade" transparent>
        <View style={tw`flex-1 bg-ink/40 justify-center p-4`}>
          <View style={tw`bg-surface w-full rounded-[24px] p-6 shadow-lg relative`}>
            <TouchableOpacity onPress={() => setIsPasswordModalOpen(false)} style={tw`absolute top-4 right-4 z-50 w-8 h-8 bg-slate-100 rounded-full items-center justify-center`}>
              <X color={tw.color('steel')} size={16} />
            </TouchableOpacity>

            <View style={tw`items-center mb-6`}>
              <View style={tw`w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mb-3`}>
                <Shield color={tw.color('accent')} size={24} />
              </View>
              <Text style={tw`text-xl font-bold text-ink`}>Ganti Password</Text>
              <Text style={tw`text-xs text-steel mt-1 text-center`}>Pastikan password baru mudah Anda ingat.</Text>
            </View>

            <View style={tw`space-y-4 mb-6`}>
              <View>
                <Text style={tw`text-xs font-bold text-steel mb-2 ml-1`}>Password Lama</Text>
                <TextInput
                  style={tw`w-full bg-canvas border border-whisper px-4 py-3 rounded-xl font-medium text-ink text-sm`}
                  placeholder="Masukkan password lama"
                  placeholderTextColor={tw.color('slate-400')}
                  secureTextEntry
                  value={oldPassword}
                  onChangeText={setOldPassword}
                />
              </View>
              <View style={tw`mt-3`}>
                <Text style={tw`text-xs font-bold text-steel mb-2 ml-1`}>Password Baru</Text>
                <TextInput
                  style={tw`w-full bg-canvas border border-whisper px-4 py-3 rounded-xl font-medium text-ink text-sm`}
                  placeholder="Masukkan password baru"
                  placeholderTextColor={tw.color('slate-400')}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleChangePassword}
              disabled={isChangingPassword}
              style={tw`w-full bg-accent rounded-xl py-3.5 items-center flex-row justify-center ${isChangingPassword ? 'opacity-70' : ''}`}
            >
              {isChangingPassword ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={tw`text-white font-bold text-sm`}>Simpan Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
