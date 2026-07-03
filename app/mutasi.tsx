import { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Clock, TrendingUp, TrendingDown, RefreshCcw, ChevronLeft } from 'lucide-react-native';
import * as SecureStore from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import tw from '../tailwind';
import { callGasAPI } from '../utils/api';
import { useReceiptStore } from '../store/useReceiptStore';

export default function MutasiTabungan() {
  const [refreshing, setRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [dataTabungan, setDataTabungan] = useState<any[]>([]);
  const { openReceipt } = useReceiptStore();

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreTabungan, setHasMoreTabungan] = useState(true);
  const [offsetTabungan, setOffsetTabungan] = useState(0);

  const loadData = async (isRefresh = false) => {
    try {
      const session = await SecureStore.getItemAsync('_parent_session');
      if (!session) return;
      const user = JSON.parse(session);
      
      const cacheKey = `@parent_data_${user.nis}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData && !isRefresh && dataTabungan.length === 0) {
        const parsed = JSON.parse(cachedData);
        setDataTabungan(parsed.Tabungan || []);
        setIsFetching(false);
      }

      const res = await callGasAPI('getParentData', { nis: user.nis });
      const newTabungan = res.Tabungan || [];
      setDataTabungan(newTabungan);
      
      setOffsetTabungan(newTabungan.length);
      setHasMoreTabungan(newTabungan.length === 15);
      
      if (res.Tabungan || res.Tagihan || res.Transaksi) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          ...(cachedData ? JSON.parse(cachedData) : {}),
          Tabungan: res.Tabungan || [],
          Tagihan: res.Tagihan || [],
          Transaksi: res.Transaksi || []
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetching(false);
      setRefreshing(false);
    }
  };

  const loadMoreTabungan = async () => {
    if (isLoadingMore || !hasMoreTabungan) return;
    setIsLoadingMore(true);
    try {
      const session = await SecureStore.getItemAsync('_parent_session');
      if (!session) return;
      const user = JSON.parse(session);
      
      const res = await callGasAPI('getRiwayatTabungan', { nis: user.nis, offset: offsetTabungan });
      const moreData = res.data || [];
      
      if (moreData.length > 0) {
        setDataTabungan(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const filtered = moreData.filter((d: any) => !existingIds.has(d.id));
          return [...prev, ...filtered];
        });
        setOffsetTabungan(prev => prev + moreData.length);
      }
      
      if (moreData.length < 15) {
        setHasMoreTabungan(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  if (isFetching && !refreshing) {
    return (
      <View style={tw`flex-1 bg-canvas justify-center items-center`}>
        <ActivityIndicator size="large" color={tw.color('accent')} />
      </View>
    );
  }

  const safeDate = (dStr: any) => {
    if (!dStr) return new Date(0);
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) return d;
    if (typeof dStr === 'string' && dStr.includes('-')) {
      const p = dStr.split('-');
      if (p.length === 3) return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    }
    return new Date(0);
  };

  const historyData = [...dataTabungan].sort((a, b) => {
    const dateA = a.tanggal;
    const dateB = b.tanggal;
    return safeDate(dateB).getTime() - safeDate(dateA).getTime();
  });

  return (
    <View style={tw`flex-1 bg-canvas`}>
      <View style={tw`bg-white px-4 py-4 flex-row items-center border-b border-whisper pt-12 shadow-sm`}>
        <TouchableOpacity onPress={() => router.back()} style={tw`w-10 h-10 items-center justify-center mr-2`}>
          <ChevronLeft color={tw.color('ink')} size={24} />
        </TouchableOpacity>
        <View style={tw`w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center mr-3`}>
          <TrendingUp color={tw.color('accent')} size={20} />
        </View>
        <View>
          <Text style={tw`font-extrabold text-ink text-xl`}>Mutasi Tabungan</Text>
          <Text style={tw`text-[10px] text-steel font-medium`}>Riwayat keluar masuk tabungan</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={tw`p-6 pb-32`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={tw`font-bold text-ink text-base mb-3`}>Buku Mutasi</Text>
        <View style={tw`space-y-3`}>
          {historyData.length === 0 ? (
            <View style={tw`bg-canvas border border-whisper border-dashed rounded-2xl p-6 items-center`}>
              <RefreshCcw color={tw.color('steel')} size={32} style={tw`mb-3`} />
              <Text style={tw`text-xs text-steel`}>Belum ada riwayat mutasi.</Text>
            </View>
          ) : (
            historyData.map((item, idx) => {
              const isIncome = (item.jenis === "Setor" || item.jenis === "Masuk");
              const title = item.keterangan || "Mutasi Tabungan";
              
              const colorClass = isIncome ? 'success' : 'danger';
              const bgColorClass = isIncome ? 'bg-successBg' : 'bg-dangerBg';
              const dateStr = item.tanggal;
              const nominalNum = item.nominal;

              return (
                <TouchableOpacity 
                  key={idx} 
                  onPress={() => {
                     openReceipt({ ...item, title: 'MUTASI TABUNGAN' });
                  }}
                  style={tw`bg-white border border-whisper p-4 rounded-2xl flex-row items-center justify-between mb-3 shadow-sm active:bg-slate-50`}
                >
                  <View style={tw`flex-row items-center flex-1`}>
                    <View style={tw`w-10 h-10 rounded-full flex items-center justify-center ${bgColorClass}`}>
                      {isIncome ? <TrendingUp color={tw.color('success')} size={20} /> : <TrendingDown color={tw.color('danger')} size={20} />}
                    </View>
                    <View style={tw`ml-3 flex-1 pr-2`}>
                      <Text style={tw`font-bold text-ink text-sm`}>{title}</Text>
                      <Text style={tw`text-[11px] text-steel font-medium mt-0.5`}>{safeDate(dateStr).toLocaleDateString('id-ID')}</Text>
                    </View>
                  </View>
                  <View style={tw`items-end ml-2 flex-shrink-0 w-24`}>
                    <Text style={tw`font-bold text-sm mb-1 text-${colorClass}`} numberOfLines={1} adjustsFontSizeToFit>
                      {isIncome ? '+' : '-'} Rp {Math.abs(Number(nominalNum) || 0).toLocaleString('id-ID')}
                    </Text>
                    <Text style={tw`text-[10px] text-steel`}>{item.jenis}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        
        {hasMoreTabungan && historyData.length > 0 && (
          <TouchableOpacity 
            onPress={loadMoreTabungan}
            disabled={isLoadingMore}
            style={tw`bg-white border border-slate-200 rounded-xl py-3 items-center mt-2 shadow-sm`}
          >
            {isLoadingMore ? (
              <ActivityIndicator size="small" color={tw.color('accent')} />
            ) : (
              <Text style={tw`text-accent font-bold text-sm`}>Muat Lebih Banyak Riwayat</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
