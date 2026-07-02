import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Home, Receipt, Clock, User, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from '../../tailwind';
import { usePakasirStore } from '../../store/usePakasirStore';
import PakasirModal from '../../components/PakasirModal';
import ReceiptModal from '../../components/ReceiptModal';

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { openPakasir } = usePakasirStore();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 24);

  const getIcon = (routeName: string, isFocused: boolean) => {
    const color = isFocused ? tw.color('accent') : tw.color('steel');
    switch (routeName) {
      case 'dashboard': return <Home color={color} size={22} />;
      case 'tagihan': return <Receipt color={color} size={22} />;
      case 'riwayat': return <Clock color={color} size={22} />;
      case 'profil': return <User color={color} size={22} />;
      default: return null;
    }
  };

  const getLabel = (routeName: string) => {
    switch (routeName) {
      case 'dashboard': return 'Beranda';
      case 'tagihan': return 'Tagihan';
      case 'riwayat': return 'Riwayat';
      case 'profil': return 'Profil';
      default: return '';
    }
  };

  // Splitting tabs for center FAB
  const leftTabs = state.routes.slice(0, 2);
  const rightTabs = state.routes.slice(2, 4);

  const renderTab = (route: any, index: number, isLeft: boolean) => {
    const isFocused = state.index === (isLeft ? index : index + 2);
    
    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        style={tw`flex-1 items-center justify-center py-2 h-[56px]`}
      >
        <View style={tw`p-1.5 rounded-xl ${isFocused ? 'bg-accentLight/50' : ''}`}>
          {getIcon(route.name, isFocused)}
        </View>
        <Text style={tw`text-[10px] mt-0.5 ${isFocused ? 'text-accent font-bold' : 'text-steel font-medium'}`}>
          {getLabel(route.name)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[tw`absolute bottom-0 left-0 right-0 z-50 px-4`, { paddingBottom: bottomPadding }]}>
      <View style={tw`bg-white rounded-[24px] shadow-lg flex-row items-center px-2 py-1 border border-slate-200`}>
        {/* Left Tabs */}
        {leftTabs.map((route: any, index: number) => renderTab(route, index, true))}
        
        {/* Center FAB */}
        <View style={tw`relative -mt-10 items-center justify-center px-1 z-10`}>
          <TouchableOpacity
            onPress={() => openPakasir("BAYAR_BEBAS")}
            style={tw`w-[60px] h-[60px] bg-accent rounded-full items-center justify-center shadow-lg border-[4px] border-canvas`}
          >
            <Plus color="white" size={28} />
          </TouchableOpacity>
        </View>

        {/* Right Tabs */}
        {rightTabs.map((route: any, index: number) => renderTab(route, index, false))}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="tagihan" />
        <Tabs.Screen name="riwayat" />
        <Tabs.Screen name="profil" />
      </Tabs>
      <PakasirModal />
      <ReceiptModal />
    </>
  );
}
