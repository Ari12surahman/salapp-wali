import { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { Clock, CheckCircle, CheckCircle2, TrendingUp, TrendingDown, RefreshCcw, FileText } from 'lucide-react-native';
import * as SecureStore from '../../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from '../../tailwind';
import { getParentData, getRiwayatTabungan } from '../../utils/supabaseApi';
import { useReceiptStore } from '../../store/useReceiptStore';
import { supabase } from '../../utils/supabase';

export default function Riwayat() {
  const [refreshing, setRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [dataTabungan, setDataTabungan] = useState<any[]>([]);
  const [dataPembayaran, setDataPembayaran] = useState<any[]>([]);
  const [dataPesanan, setDataPesanan] = useState<any[]>([]);
  const { openReceipt } = useReceiptStore();
  const [historyLimit, setHistoryLimit] = useState(10);

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreTabungan, setHasMoreTabungan] = useState(true);
  const [offsetTabungan, setOffsetTabungan] = useState(0);

  const loadData = async (isRefresh = false) => {
    try {
      const session = await SecureStore.getItemAsync('_parent_session');
      if (!session) return;
      const user = JSON.parse(session);

      const combineHistory = (pems: any[], tags: any[]) => {
        const combined = [...pems];
        const lunasTags = tags ? tags.filter((t: any) => t.status === 'Lunas' || t.status === 'Cicil') : [];
        const cleanTag = (str: string) => (str || '').replace(/ \(Via QRIS\)/i, '').trim();
        
        lunasTags.forEach((tag: any) => {
          const hasPem = pems.some(p => cleanTag(p.tagihan) === cleanTag(tag.tagihan) && p.periode === tag.periode);
          if (!hasPem) combined.push(tag);
        });
        return combined;
      };
      
      const cacheKey = `@parent_data_${user.nis}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData && !isRefresh && dataTabungan.length === 0) {
        const parsed = JSON.parse(cachedData);
        setDataTabungan(parsed.Tabungan || []);
        setDataPembayaran(combineHistory(parsed.Pembayaran || [], parsed.Tagihan || []));
        setDataPesanan(parsed.Transaksi || []);
        setIsFetching(false);
      }

      const res = await getParentData(user.nis);
      const newTabungan = res.Tabungan || [];
      setDataTabungan(newTabungan);
      setDataPembayaran(combineHistory(res.Pembayaran || [], res.Tagihan || []));
      setDataPesanan(res.Transaksi || []);
      
      setOffsetTabungan(newTabungan.length);
      setHasMoreTabungan(newTabungan.length === 15);
      
      if (res.Tabungan || res.Tagihan || res.Transaksi) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          ...(cachedData ? JSON.parse(cachedData) : {}),
          Tabungan: res.Tabungan || [],
          Tagihan: res.Tagihan || [],
          Transaksi: res.Transaksi || [],
          Pembayaran: res.Pembayaran || []
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
      
      const res = await getRiwayatTabungan(user.nis, offsetTabungan);
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

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('refresh_dashboard', () => {
      console.log('Instant refresh received in riwayat');
      loadData(true);
    });

    return () => {
      subscription.remove();
    };
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

  const getSortTime = (item: any) => {
    if (item.Waktu) {
      const d = new Date(item.Waktu);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    
    if (item.id && typeof item.id === 'string') {
      const match = item.id.match(/\d{13}/);
      if (match) {
        const ts = parseInt(match[0], 10);
        if (!isNaN(ts) && ts > 1000000000000) return ts;
      }
    }
    
    if (item.tanggal) {
       const d = new Date(item.tanggal);
       if (!isNaN(d.getTime())) return d.getTime();
       if (typeof item.tanggal === 'string' && item.tanggal.includes('-')) {
         const p = item.tanggal.split('-');
         if (p.length === 3) return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2])).getTime();
       }
    }
    
    return 0;
  };

  const historyData = [
    ...dataTabungan.filter(t => !t.keterangan?.includes('Kantin')), 
    ...dataPembayaran,
    ...dataPesanan.filter(t => t.Metode === 'Pesanan Online')
  ].filter((item) => item.status !== 'Pending')
    .sort((a, b) => {
      return getSortTime(b) - getSortTime(a);
    });

  return (
    <View style={tw`flex-1 bg-canvas`}>
      <View style={tw`bg-white px-6 py-4 flex-row items-center border-b border-whisper pt-6 shadow-sm`}>
        <View style={tw`w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center mr-3`}>
          <Clock color={tw.color('accent')} size={20} />
        </View>
        <View>
          <Text style={tw`font-extrabold text-ink text-xl`}>Riwayat</Text>
          <Text style={tw`text-[10px] text-steel font-medium`}>Riwayat transaksi dan pembayaran</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={tw`p-6 pb-32`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        <Text style={tw`font-bold text-ink text-base mb-3`}>Riwayat Transaksi</Text>
        <View style={tw`space-y-3`}>
          {historyData.length === 0 ? (
            <View style={tw`bg-canvas border border-whisper border-dashed rounded-2xl p-6 items-center`}>
              <RefreshCcw color={tw.color('steel')} size={32} style={tw`mb-3`} />
              <Text style={tw`text-xs text-steel`}>Belum ada riwayat transaksi.</Text>
            </View>
          ) : (
            <>
              {historyData.slice(0, historyLimit).map((item, idx) => {
                const isTabungan = !!item.jenis;
              const isPesanan = !!item.TrxID;
              const isSetor = isTabungan && (item.jenis === "Setor" || item.jenis === "Masuk");
              
              let title = '';
              if (isPesanan) title = 'Pembayaran Titip Jajan';
              else if (isTabungan) title = (item.keterangan || "Mutasi Tabungan");
              else title = (item.tagihan || "Pembayaran");
              
              const isIncome = isSetor;
              const colorClass = isPesanan ? 'ink' : (isIncome ? 'success' : (isTabungan ? 'danger' : 'accent'));
              const bgColorClass = isPesanan ? 'bg-slate-100' : (isIncome ? 'bg-successBg' : (isTabungan ? 'bg-dangerBg' : 'bg-accentLight'));
              const dateStr = item.tanggal || item.Waktu;
              const nominalNum = isPesanan ? (item.TotalHarga || item.totalHarga || item.total || 0) : item.nominal;
              const textJenis = isTabungan ? item.jenis : (isPesanan ? item.Metode : 'Pembayaran');

              return (
                <TouchableOpacity 
                  key={idx} 
                  onPress={() => {
                       if (isPesanan) {
                         openReceipt({ 
                           ...item, 
                           title: 'BUKTI PEMBAYARAN',
                           id: item.TrxID,
                           tanggal: item.Waktu,
                           tagihan: 'Titip Jajan',
                           nominal: nominalNum
                         });
                       } else {
                         openReceipt({ ...item, title: isTabungan ? 'MUTASI TABUNGAN' : 'BUKTI PEMBAYARAN' });
                       }
                  }}
                  style={tw`bg-white border border-whisper p-4 rounded-2xl flex-row items-center justify-between mb-3 shadow-sm active:bg-slate-50`}
                >
                  <View style={tw`flex-row items-center flex-1`}>
                    <View style={tw`w-10 h-10 rounded-full flex items-center justify-center ${bgColorClass}`}>
                      {isPesanan ? (
                        <Clock color={tw.color(colorClass)} size={20} />
                      ) : isTabungan ? (
                        isIncome ? <TrendingUp color={tw.color('success')} size={20} /> : <TrendingDown color={tw.color('danger')} size={20} />
                      ) : (
                        <CheckCircle color={tw.color('accent')} size={20} />
                      )}
                    </View>
                    <View style={tw`ml-3 flex-1`}>
                      <Text style={tw`font-bold text-ink text-sm`} numberOfLines={1}>{title}</Text>
                      <Text style={tw`text-[10px] text-steel mt-0.5`}>
                        {safeDate(dateStr).toLocaleDateString('id-ID')}
                      </Text>
                    </View>
                  </View>
                  <View style={tw`items-end`}>
                    <Text style={tw`font-bold text-${colorClass} text-sm`}>
                      {isIncome ? '+ ' : '- '}Rp {Number(nominalNum || 0).toLocaleString('id-ID')}
                    </Text>
                    <Text style={tw`text-[10px] text-steel mt-0.5 capitalize`}>{textJenis}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            
            {historyLimit < historyData.length && (
              <TouchableOpacity 
                onPress={() => setHistoryLimit(prev => prev + 10)}
                style={tw`w-full bg-white border border-slate-200 py-3 rounded-xl flex-row justify-center items-center mt-2`}
              >
                <Text style={tw`text-sm font-bold text-steel`}>Tampilkan lebih banyak</Text>
              </TouchableOpacity>
            )}
            </>
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
