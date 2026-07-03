import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Receipt, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import * as SecureStore from '../../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from '../../tailwind';
import { callGasAPI } from '../../utils/api';
import { usePakasirStore } from '../../store/usePakasirStore';
import { supabase } from '../../utils/supabase';

export default function Tagihan() {
  const [refreshing, setRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreTagihan, setHasMoreTagihan] = useState(true);
  const [offsetTagihan, setOffsetTagihan] = useState(0);
  const [dataTagihan, setDataTagihan] = useState<any[]>([]);
  const [dataMasterTagihan, setDataMasterTagihan] = useState<any[]>([]);
  const { openPakasir } = usePakasirStore();

  const loadData = async (isRefresh = false) => {
    try {
      const session = await SecureStore.getItemAsync('_parent_session');
      if (!session) return;
      const user = JSON.parse(session);
      
      const cacheKey = `@parent_data_${user.nis}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData && !isRefresh && dataTagihan.length === 0) {
        const parsed = JSON.parse(cachedData);
        setDataMasterTagihan(parsed.MasterTagihan || []);
        setDataTagihan(parsed.Tagihan || []);
        setIsFetching(false);
      }

      const res = await callGasAPI('getParentData', { nis: user.nis });
      setDataMasterTagihan(res.MasterTagihan || []);
      const newTagihan = res.Tagihan || [];
      setDataTagihan(newTagihan);
      setOffsetTagihan(newTagihan.length);
      setHasMoreTagihan(newTagihan.length === 15);
      
      if (res.Tagihan) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          ...(cachedData ? JSON.parse(cachedData) : {}),
          Tagihan: res.Tagihan,
          MasterTagihan: res.MasterTagihan || []
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetching(false);
      setRefreshing(false);
    }
  };

  const loadMoreTagihan = async () => {
    if (isLoadingMore || !hasMoreTagihan) return;
    setIsLoadingMore(true);
    try {
      const session = await SecureStore.getItemAsync('_parent_session');
      if (!session) return;
      const user = JSON.parse(session);
      
      const res = await callGasAPI('getRiwayatTagihan', { nis: user.nis, offset: offsetTagihan });
      const moreData = res.data || [];
      
      if (moreData.length > 0) {
        setDataTagihan(prev => {
          // avoid duplicates
          const existingIds = new Set(prev.map(p => p.id));
          const filtered = moreData.filter((d: any) => !existingIds.has(d.id));
          return [...prev, ...filtered];
        });
        setOffsetTagihan(prev => prev + moreData.length);
      }
      
      if (moreData.length < 15) {
        setHasMoreTagihan(false);
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
    const setupRealtime = async () => {
      const session = await SecureStore.getItemAsync('_parent_session');
      if (!session) return;
      const user = JSON.parse(session);

      const channel = supabase
        .channel(`tagihan-changes-${user.nis}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'Tagihan',
            filter: `nis=eq.${user.nis}`,
          },
          (payload) => {
            console.log('Realtime Tagihan update:', payload);
            // Refresh data gracefully instead of mutating locally for simplicity
            loadData(true);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };
    setupRealtime();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const displayableTagihan = useMemo(() => {
    return dataTagihan.filter(t => {
      const masterConfig = dataMasterTagihan.find((m: any) => t.tagihan.startsWith(m.tagihan));
      if (!masterConfig) return true;
      
      const portalMenu = masterConfig.portalMenu || [];
      if (portalMenu.includes('Aplikasi POS') || portalMenu.includes('Sembunyikan')) {
        return false;
      }
      return true;
    });
  }, [dataTagihan, dataMasterTagihan]);

  if (isFetching && !refreshing) {
    return (
      <View style={tw`flex-1 bg-canvas justify-center items-center`}>
        <ActivityIndicator size="large" color={tw.color('accent')} />
      </View>
    );
  }

  const unpaid = displayableTagihan.filter(t => t.status !== "Lunas");
  const paid = displayableTagihan.filter(t => t.status === "Lunas");

  return (
    <View style={tw`flex-1 bg-canvas`}>
      <View style={tw`bg-white px-6 py-4 flex-row items-center border-b border-whisper pt-12 shadow-sm`}>
        <View style={tw`w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center mr-3`}>
          <Receipt color={tw.color('accent')} size={20} />
        </View>
        <View>
          <Text style={tw`font-extrabold text-ink text-xl`}>Tagihan</Text>
          <Text style={tw`text-[10px] text-steel font-medium`}>Daftar semua tagihan Ananda</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={tw`p-6 pb-32`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        <Text style={tw`font-bold text-ink text-base mb-3`}>Belum Lunas</Text>
        <View style={tw`space-y-3 mb-8`}>
          {unpaid.length === 0 ? (
            <View style={tw`bg-canvas border border-whisper border-dashed rounded-2xl p-6 items-center`}>
              <Text style={tw`font-bold text-ink mb-1`}>Alhamdulillah!</Text>
              <Text style={tw`text-xs text-steel`}>Tidak ada tagihan yang tertunggak.</Text>
            </View>
          ) : (
            unpaid.map((item) => (
              <View key={item.id} style={tw`bg-white border border-whisper p-4 rounded-2xl flex-row items-center justify-between mb-3 shadow-sm`}>
                <View style={tw`flex-row items-center flex-1`}>
                  <View style={tw`w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center`}>
                    <AlertCircle color={tw.color('warning')} size={20} />
                  </View>
                  <View style={tw`ml-3 flex-1`}>
                    <Text style={tw`font-bold text-ink text-sm`}>{item.tagihan}</Text>
                    <Text style={tw`text-[11px] text-steel font-medium mt-0.5`}>{item.periode || "-"}</Text>
                  </View>
                </View>
                <View style={tw`items-end ml-2 flex-shrink-0 w-24`}>
                  <Text style={tw`font-bold text-ink text-sm mb-1`} numberOfLines={1} adjustsFontSizeToFit>
                    Rp {(item.nominal - (item.terbayar || 0)).toLocaleString("id-ID")}
                  </Text>
                  <TouchableOpacity onPress={() => openPakasir('BAYAR_TAGIHAN', item)} style={tw`bg-accent px-4 py-1.5 rounded-lg`}>
                    <Text style={tw`text-xs font-bold text-white`}>Bayar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={tw`font-bold text-ink text-base mb-3`}>Sudah Lunas</Text>
        <View style={tw`space-y-3`}>
          {paid.length === 0 ? (
            <Text style={tw`text-xs text-steel italic`}>Belum ada riwayat tagihan lunas.</Text>
          ) : (
            paid.map((item) => (
              <View key={item.id} style={tw`bg-white border border-whisper p-4 rounded-2xl flex-row items-center justify-between mb-3 opacity-70`}>
                <View style={tw`flex-row items-center flex-1`}>
                  <View style={tw`w-10 h-10 rounded-full bg-success/10 flex items-center justify-center`}>
                    <CheckCircle2 color={tw.color('success')} size={20} />
                  </View>
                  <View style={tw`ml-3 flex-1`}>
                    <Text style={tw`font-bold text-ink text-sm`}>{item.tagihan}</Text>
                    <Text style={tw`text-[11px] text-steel font-medium mt-0.5`}>{item.periode || "-"}</Text>
                  </View>
                </View>
                <View style={tw`items-end ml-2 flex-shrink-0 w-24`}>
                  <Text style={tw`font-bold text-ink text-sm mb-1`} numberOfLines={1} adjustsFontSizeToFit>
                    Rp {item.nominal.toLocaleString("id-ID")}
                  </Text>
                  <Text style={tw`text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded`}>LUNAS</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {hasMoreTagihan && paid.length > 0 && (
          <TouchableOpacity 
            onPress={loadMoreTagihan}
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
