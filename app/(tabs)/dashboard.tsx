import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, ActivityIndicator, TextInput, DeviceEventEmitter } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from '../../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Receipt, Wallet, TrendingUp, AlertCircle, ArrowRight, ArrowDownRight, 
  ShieldCheck, ShoppingBag, BookOpen, Users, Heart, X, Store, CheckCircle2, Clock, LogOut 
} from 'lucide-react-native';
import tw from '../../tailwind';
import { getParentData, savePushToken } from '../../utils/supabaseApi';
import { supabase } from '../../utils/supabase';
import { usePakasirStore } from '../../store/usePakasirStore';

export default function Dashboard() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  const [userData, setUserData] = useState<{ nis: string, nama: string } | null>(null);
  const [dataTagihan, setDataTagihan] = useState<any[]>([]);
  const [dataMasterTagihan, setDataMasterTagihan] = useState<any[]>([]);
  const [dataTabungan, setDataTabungan] = useState<any[]>([]);
  const [dataPOSWarung, setDataPOSWarung] = useState<any[]>([]);
  const [dataPOSProduk, setDataPOSProduk] = useState<any[]>([]);
  const [dataPesananAktif, setDataPesananAktif] = useState<any[]>([]);
  
  const [jajanCart, setJajanCart] = useState<{ id: string; nama: string; harga: number; qty: number; warungId: string }[]>([]);
  const [activeWarungId, setActiveWarungId] = useState<string>('');
  const [isTitipJajanOpen, setIsTitipJajanOpen] = useState(false);
  const [catatanJajan, setCatatanJajan] = useState('');

  const loadData = useCallback(async (isBackground = false) => {
    try {
      const session = await SecureStore.getItemAsync('_parent_session');
      if (!session) {
        router.replace('/login');
        return;
      }
      const user = JSON.parse(session);
      setUserData(user);

      // 0. Sync Push Token ke Supabase SETIAP kali app dibuka
      const pushToken = await AsyncStorage.getItem('_push_token');
      if (pushToken && !isBackground) {
        savePushToken(user.nis, pushToken)
          .then(() => console.log('✅ Push token synced'))
          .catch(console.error);
      }

      // 1. Coba ambil dari Cache Lokal dulu biar instan
      const cacheKey = `@parent_data_${user.nis}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        // Langsung tampilkan dari cache tanpa muter-muter
        const parsed = JSON.parse(cachedData);
        setDataTagihan(parsed.Tagihan ? parsed.Tagihan.slice().reverse() : []);
        setDataTabungan(parsed.Tabungan ? parsed.Tabungan.slice().reverse() : []);
        setDataPOSWarung(parsed.POS_Warung || []);
        setDataPOSProduk(parsed.POS_Produk || []);
        setDataPesananAktif(parsed.PesananAktif || []);
        
        if (parsed.POS_Warung && parsed.POS_Warung.length > 0 && !activeWarungId) {
          setActiveWarungId(parsed.POS_Warung[0].id || parsed.POS_Warung[0].ID || "");
        }
        
        // Matikan loading karena data sudah tampil
        setIsFetching(false);
      } else {
        // Kalau belum ada cache sama sekali (pertama login), baru tampilkan loading
        if (!isBackground) setIsFetching(true);
      }

      // 2. Fetch data terbaru secara diam-diam (silent update)
      const [res] = await Promise.all([
        getParentData(user.nis),
      ]);

      // 3. Update UI dengan data terbaru
      setDataTagihan(res.Tagihan ? res.Tagihan.slice().reverse() : []);
      setDataTabungan(res.Tabungan ? res.Tabungan.slice().reverse() : []);
      
      const warungs = res.POS_Warung || [];
      setDataPOSWarung(warungs);
      setDataPOSProduk(res.POS_Produk || []);
      if (warungs.length > 0 && !activeWarungId) {
        setActiveWarungId(warungs[0].id || warungs[0].ID || "");
      }
      
      // Query pesanan aktif langsung dari Supabase (mendukung order dari webhook maupun polling)
      const kemarin = new Date();
      kemarin.setDate(kemarin.getDate() - 1);
      const { data: transaksiData } = await supabase
        .from('Transaksi')
        .select('*')
        .eq('SantriID', user.nis)
        .eq('Metode', 'Pesanan Online')
        .gte('Waktu', kemarin.toISOString())
        .order('Waktu', { ascending: false })
        .limit(10);

      let pesananAktif: any[] = [];
      if (transaksiData && transaksiData.length > 0) {
        const trxIds = transaksiData.map((t: any) => t.TrxID);
        const { data: detailData } = await supabase
          .from('DetailTransaksi')
          .select('*')
          .in('TrxID', trxIds);
        
        pesananAktif = transaksiData.map((t: any) => ({
          ...t,
          statusAmbil: t.StatusAmbil,
          items: (detailData || [])
            .filter((d: any) => d.TrxID === t.TrxID)
            .map((d: any) => ({ qty: d.Kuantitas, nama: d.NamaProduk }))
        }));
      }
      setDataPesananAktif(pesananAktif);

      // 4. Simpan ke Cache untuk dipakai waktu buka aplikasi berikutnya
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        ...res,
        PesananAktif: pesananAktif
      }));
      
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetching(false);
      setRefreshing(false);
    }
  }, [activeWarungId, router]);

  const { openPakasir } = usePakasirStore();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (!userData?.nis) return;

    // Listen for instant refresh from PakasirModal (instead of wasteful Supabase Realtime)
    const subscription = DeviceEventEmitter.addListener('refresh_dashboard', () => {
      console.log('Instant refresh received');
      loadData(true); // background refresh
    });

    return () => {
      subscription.remove();
    };
  }, [userData?.nis, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleTopup = () => {
    openPakasir("TOPUP_TABUNGAN");
  };

  const handleTitipJajanBayar = () => {
    if (jajanCart.length === 0) return;
    const total = jajanCart.reduce((a,c) => a + (c.harga * c.qty), 0);
    setIsTitipJajanOpen(false);
    openPakasir("TITIP_JAJAN", { items: jajanCart, warungId: activeWarungId, total, catatan: catatanJajan });
    setJajanCart([]);
    setCatatanJajan('');
  };

  const displayableTagihan = useMemo(() => {
    return dataTagihan.filter(t => {
      const masterConfig = dataMasterTagihan.find((m: any) => t.tagihan.startsWith(m.tagihan));
      if (!masterConfig) return true;
      
      const portalMenu = masterConfig.portalMenu || [];
      if (portalMenu.includes('Aplikasi POS') || portalMenu.includes('Sembunyikan') || portalMenu.includes('Menu Plus Portal')) {
        return false;
      }
      return true;
    });
  }, [dataTagihan, dataMasterTagihan]);

  const totalTagihanBelumDibayar = displayableTagihan
    .filter((t) => t.status !== "Lunas")
    .reduce((acc, curr) => acc + (curr.nominal - (curr.terbayar || 0)), 0);

  const totalTabunganMasuk = dataTabungan
    .filter((t) => t.jenis === "Setor" || t.jenis === "Masuk")
    .reduce((acc, curr) => acc + Math.abs(Number(curr.nominal) || 0), 0);
  const totalTabunganKeluar = dataTabungan
    .filter((t) => t.jenis === "Tarik" || t.jenis === "Keluar")
    .reduce((acc, curr) => acc + Math.abs(Number(curr.nominal) || 0), 0);
  const saldoTabungan = totalTabunganMasuk - totalTabunganKeluar;

  if (isFetching && !refreshing) {
    return (
      <View style={tw`flex-1 bg-canvas justify-center items-center`}>
        <ActivityIndicator size="large" color={tw.color('accent')} />
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-canvas relative`}>
      {/* Background Decor */}
      <View style={tw`absolute top-0 left-0 right-0 h-48 bg-accentLight/30`} />
      
      <ScrollView 
        contentContainerStyle={tw`p-6 pb-32`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        
        <View style={tw`flex-row justify-between items-center mb-6`}>
          <View>
            <Text style={tw`text-steel text-sm font-medium`}>Assalamu'alaikum,</Text>
            <Text style={tw`text-ink text-xl font-bold`}>{userData?.nama || 'Wali Santri'}</Text>
          </View>
          <TouchableOpacity 
            onPress={async () => {
              await SecureStore.deleteItemAsync('_parent_session');
              router.replace('/login');
            }}
            style={tw`w-10 h-10 bg-white rounded-full border border-whisper shadow-sm flex items-center justify-center`}
          >
            <LogOut color={tw.color('danger')} size={18} />
          </TouchableOpacity>
        </View>

        {/* Saldo Tabungan Card */}
        <View style={tw`bg-ink rounded-[24px] p-6 shadow-md relative overflow-hidden mb-6`}>
          <View style={tw`absolute -right-10 -top-10 w-40 h-40 bg-accent/40 rounded-full`} />
          <View style={tw`absolute left-0 bottom-0 w-32 h-32 bg-success/30 rounded-full`} />
          
          <View style={tw`flex-row justify-between items-center mb-6`}>
            <View style={tw`flex-row items-center`}>
              <Wallet color="white" size={20} style={tw`opacity-80`} />
              <Text style={tw`text-white/80 text-sm font-medium ml-2`}>Saldo Tabungan</Text>
            </View>
            <View style={tw`bg-white/10 px-3 py-1 rounded-full flex-row items-center border border-white/10`}>
              <ShieldCheck color={tw.color('success')} size={14} />
              <Text style={tw`text-white text-[10px] font-bold ml-1 tracking-wide`}>AMAN</Text>
            </View>
          </View>
          
          <View style={tw`mb-6`}>
            <Text style={tw`text-4xl font-extrabold tracking-tight text-white mb-1`} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={tw`text-xl font-semibold text-white/70`}>Rp </Text>
              {saldoTabungan.toLocaleString("id-ID")}
            </Text>
            <Text style={tw`text-xs text-white/60`}>Diperbarui beberapa saat lalu</Text>
          </View>

          <View style={tw`flex-row gap-3`}>
            <TouchableOpacity onPress={handleTopup} style={tw`flex-1 bg-accent py-3 rounded-xl flex-row justify-center items-center`}>
              <ArrowDownRight color="white" size={16} />
              <Text style={tw`text-white text-sm font-semibold ml-2`}>Top Up</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/mutasi')} style={tw`flex-1 bg-white/10 border border-white/10 py-3 rounded-xl flex-row justify-center items-center`}>
              <TrendingUp color="white" size={16} />
              <Text style={tw`text-white text-sm font-semibold ml-2`}>Mutasi</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Tagihan Minimalist Card */}
        <View style={tw`bg-surface rounded-2xl p-5 border border-whisper shadow-sm flex-row items-center justify-between mb-6`}>
          <View style={tw`flex-row items-center flex-1`}>
            <View style={tw`w-12 h-12 rounded-full flex items-center justify-center ${totalTagihanBelumDibayar > 0 ? 'bg-dangerBg' : 'bg-successBg'}`}>
              <Receipt color={totalTagihanBelumDibayar > 0 ? tw.color('danger') : tw.color('success')} size={24} />
            </View>
            <View style={tw`ml-4 flex-1 pr-2`}>
              <Text style={tw`text-xs font-semibold text-steel mb-0.5`}>Total Tagihan Aktif</Text>
              <Text style={tw`text-lg font-bold text-ink`} numberOfLines={1} adjustsFontSizeToFit>Rp {totalTagihanBelumDibayar.toLocaleString("id-ID")}</Text>
            </View>
          </View>
          {totalTagihanBelumDibayar > 0 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/tagihan')} style={tw`w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center`}>
              <ArrowRight color={tw.color('steel')} size={20} />
            </TouchableOpacity>
          )}
        </View>

        {/* Layanan Portal */}
        <View style={tw`mb-6`}>
          <Text style={tw`font-bold text-ink text-base mb-3 ml-1`}>Layanan Portal</Text>
          <View style={tw`flex-row justify-between`}>
            <TouchableOpacity onPress={() => setIsTitipJajanOpen(true)} style={tw`items-center flex-1`}>
              <View style={tw`w-14 h-14 bg-accentLight text-accent rounded-2xl flex items-center justify-center mb-2`}>
                <ShoppingBag color={tw.color('accent')} size={24} />
              </View>
              <Text style={tw`text-[10px] font-bold text-ink text-center`}>Titip Jajan</Text>
            </TouchableOpacity>
            
            <View style={tw`items-center flex-1 opacity-50`}>
              <View style={tw`w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-2`}>
                <BookOpen color={tw.color('steel')} size={24} />
              </View>
              <Text style={tw`text-[10px] font-bold text-steel text-center`}>Akademik</Text>
            </View>

            <View style={tw`items-center flex-1 opacity-50`}>
              <View style={tw`w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-2`}>
                <Users color={tw.color('steel')} size={24} />
              </View>
              <Text style={tw`text-[10px] font-bold text-steel text-center`}>Pengasuhan</Text>
            </View>

            <View style={tw`items-center flex-1 opacity-50`}>
              <View style={tw`w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-2`}>
                <Heart color={tw.color('steel')} size={24} />
              </View>
              <Text style={tw`text-[10px] font-bold text-steel text-center`}>Tahfidz</Text>
            </View>
          </View>
        </View>

        {/* Widget Status Pesanan */}
        {dataPesananAktif.length > 0 && (
          <View style={tw`mb-6`}>
            <Text style={tw`font-bold text-ink text-base mb-3 ml-1`}>Status Pesanan</Text>
            {dataPesananAktif.map((order, idx) => {
              const statusRaw = order.StatusAmbil || order.statusAmbil || 'Menunggu';
              const isSelesai = statusRaw === "Selesai";
              const isDibatalkan = statusRaw === "Dibatalkan";
              const isMenunggu = statusRaw === "Menunggu";
              
              let bgColor = 'bg-warningBg border-warning/30';
              let iconBg = 'bg-warning';
              let textColor = 'text-warning';
              let label = 'Sedang Disiapkan';
              
              if (isSelesai) {
                bgColor = 'bg-successBg border-success/30';
                iconBg = 'bg-success';
                textColor = 'text-success';
                label = 'Telah Diambil Ananda';
              } else if (isDibatalkan) {
                bgColor = 'bg-dangerBg border-danger/30';
                iconBg = 'bg-danger';
                textColor = 'text-danger';
                label = 'Pesanan Dibatalkan';
              } else if (isMenunggu) {
                label = 'Menunggu Konfirmasi Kantin';
              } else {
                label = `Pesanan ${statusRaw}`;
              }
              
              return (
                <View key={idx} style={tw`border rounded-2xl p-4 shadow-sm flex-row items-center justify-between mb-3 ${bgColor}`}>
                  <View style={tw`flex-row items-center flex-1`}>
                    <View style={tw`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
                      {isSelesai ? <CheckCircle2 color="white" size={20} /> : <Clock color="white" size={20} />}
                    </View>
                    <View style={tw`ml-3 flex-1`}>
                      <Text style={tw`font-bold text-ink text-sm`}>
                        {label}
                      </Text>
                      <Text style={tw`text-[11px] font-medium mt-0.5 pr-2 ${textColor}`}>
                        {order.items?.map((i:any) => i.qty + 'x ' + i.nama).join(', ')}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Tagihan Mendesak */}
        <View style={tw`mb-6`}>
          <View style={tw`flex-row items-center justify-between mb-3 px-1`}>
            <Text style={tw`font-bold text-ink text-base`}>Tagihan Mendesak</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/tagihan')}>
              <Text style={tw`text-xs font-bold text-accent`}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>
          
          <View style={tw`space-y-3`}>
            {displayableTagihan.filter((t) => t.status !== "Lunas").length === 0 ? (
              <View style={tw`bg-canvas border border-whisper border-dashed rounded-2xl p-8 items-center`}>
                <View style={tw`w-16 h-16 bg-successBg rounded-full flex items-center justify-center mb-3`}>
                  <ShieldCheck color={tw.color('success')} size={32} />
                </View>
                <Text style={tw`font-bold text-ink text-lg mb-1`}>Semua Lunas!</Text>
                <Text style={tw`text-xs text-steel`}>Tidak ada tagihan yang tertunggak.</Text>
              </View>
            ) : (
              displayableTagihan
                .filter((t) => t.status !== "Lunas")
                .slice(0, 3)
                .map((item) => (
                  <View key={item.id} style={tw`bg-surface border border-whisper p-4 rounded-2xl flex-row items-center justify-between mb-3`}>
                    <View style={tw`flex-row items-center flex-1`}>
                      <View style={tw`w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center`}>
                        <AlertCircle color={tw.color('warning')} size={20} />
                      </View>
                      <View style={tw`ml-3 flex-1`}>
                        <Text style={tw`font-bold text-ink text-sm`}>{item.tagihan}</Text>
                        <Text style={tw`text-[11px] text-steel font-medium mt-0.5`}>{item.periode || "-"}</Text>
                      </View>
                    </View>
                    <View style={tw`items-end ml-2`}>
                      <Text style={tw`font-bold text-ink text-sm mb-1`}>
                        Rp {(item.nominal - (item.terbayar || 0)).toLocaleString("id-ID")}
                      </Text>
                      <TouchableOpacity 
                        onPress={() => openPakasir('BAYAR_TAGIHAN', item)} 
                        style={tw`bg-accent px-3 py-1.5 rounded-lg`}
                      >
                        <Text style={tw`text-[10px] font-bold text-white`}>Bayar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Titip Jajan Modal */}
      <Modal visible={isTitipJajanOpen} animationType="slide">
        <View style={tw`flex-1 bg-canvas`}>
          {/* Modal Header */}
          <View style={tw`bg-white px-5 py-4 flex-row items-center justify-between border-b border-whisper shadow-sm pt-12`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-10 h-10 bg-accentLight rounded-xl flex items-center justify-center`}>
                <ShoppingBag color={tw.color('accent')} size={20} />
              </View>
              <View style={tw`ml-3`}>
                <Text style={tw`font-extrabold text-ink text-lg`}>Titip Jajan</Text>
                <Text style={tw`text-[10px] text-steel font-medium`}>Beli produk kantin untuk Ananda</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setIsTitipJajanOpen(false)} style={tw`w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center`}>
              <X color={tw.color('steel')} size={16} />
            </TouchableOpacity>
          </View>

          {/* Modal Body */}
          <ScrollView contentContainerStyle={tw`p-5 pb-40`}>
            {dataPOSWarung.length === 0 ? (
              <View style={tw`items-center py-10`}>
                <Store color={tw.color('slate-300')} size={48} style={tw`mb-3`} />
                <Text style={tw`font-bold text-sm text-steel`}>Tidak ada warung aktif.</Text>
              </View>
            ) : (
              <>
                <Text style={tw`text-sm font-bold text-ink mb-3`}>Pilih Kantin / Warung</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-6`}>
                  <View style={tw`flex-row gap-2`}>
                    {dataPOSWarung.map((w: any, idx: number) => {
                      const wId = w.id || w.ID;
                      const wNama = w.nama || w.Nama;
                      const isActive = activeWarungId === wId;
                      return (
                        <TouchableOpacity 
                          key={idx} 
                          onPress={() => {
                            setActiveWarungId(wId);
                            if (jajanCart.length > 0 && jajanCart[0].warungId !== wId) {
                              setJajanCart([]); 
                            }
                          }}
                          style={tw`px-4 py-2 rounded-xl border ${isActive ? 'bg-ink border-ink' : 'bg-white border-slate-200'}`}
                        >
                          <Text style={tw`text-sm font-bold ${isActive ? 'text-white' : 'text-steel'}`}>{wNama}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </ScrollView>

                <Text style={tw`text-sm font-bold text-ink mb-3 border-t border-whisper pt-5`}>Daftar Produk</Text>
                <View style={tw`flex-row flex-wrap justify-between`}>
                  {dataPOSProduk.filter(p => (p.warungid || p.WarungID) === activeWarungId).map((p: any, idx: number) => {
                    const pId = p.id || p.ID;
                    const pNama = p.nama || p.Nama;
                    const pHarga = Number(p.hargajual || p.HargaJual) || 0;
                    const inCart = jajanCart.find(c => c.id === pId);
                    
                    return (
                      <View key={idx} style={tw`w-[48%] border border-whisper rounded-2xl p-3 bg-white mb-3 shadow-sm`}>
                        <Text style={tw`font-bold text-sm text-ink`}>{pNama}</Text>
                        <Text style={tw`text-xs font-bold text-accent mt-1`} numberOfLines={1} adjustsFontSizeToFit>Rp {pHarga.toLocaleString("id-ID")}</Text>
                        
                        <View style={tw`mt-4`}>
                          {inCart ? (
                            <View style={tw`flex-row items-center justify-between bg-canvas rounded-lg border border-whisper p-1`}>
                              <TouchableOpacity 
                                onPress={() => {
                                  if(inCart.qty <= 1) setJajanCart(prev => prev.filter(c => c.id !== pId));
                                  else setJajanCart(prev => prev.map(c => c.id === pId ? {...c, qty: c.qty - 1} : c));
                                }} 
                                style={tw`w-8 h-8 flex items-center justify-center bg-white shadow-sm rounded-md`}
                              >
                                <Text style={tw`text-ink font-bold`}>-</Text>
                              </TouchableOpacity>
                              <Text style={tw`text-xs font-bold`}>{inCart.qty}</Text>
                              <TouchableOpacity 
                                onPress={() => setJajanCart(prev => prev.map(c => c.id === pId ? {...c, qty: c.qty + 1} : c))} 
                                style={tw`w-8 h-8 flex items-center justify-center bg-accentLight shadow-sm rounded-md`}
                              >
                                <Text style={tw`text-accent font-bold`}>+</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity 
                              onPress={() => setJajanCart(prev => [...prev, { id: pId, nama: pNama, harga: pHarga, qty: 1, warungId: activeWarungId }])} 
                              style={tw`w-full bg-white border border-slate-200 py-2 rounded-lg items-center`}
                            >
                              <Text style={tw`text-xs font-bold text-ink`}>Tambah</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
                {dataPOSProduk.filter(p => (p.warungid || p.WarungID) === activeWarungId).length === 0 && (
                  <View style={tw`items-center py-10 bg-white rounded-2xl border border-whisper border-dashed`}>
                    <Text style={tw`text-xs font-medium text-steel`}>Belum ada produk di warung ini.</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Cart Footer */}
          {jajanCart.length > 0 && (
            <View style={tw`absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-5 shadow-lg pb-8`}>
              <View style={tw`flex-row items-center justify-between mb-4`}>
                <Text style={tw`text-sm font-bold text-steel`}>Total Belanja</Text>
                <Text style={tw`text-2xl font-black text-ink`}>
                  Rp {jajanCart.reduce((a,c) => a + (c.harga * c.qty), 0).toLocaleString("id-ID")}
                </Text>
              </View>
              <TextInput
                style={tw`w-full bg-canvas border border-whisper px-4 py-3 rounded-xl font-medium text-ink text-sm mb-4`}
                placeholder="Catatan Pesanan (Opsional)"
                placeholderTextColor={tw.color('slate-400')}
                value={catatanJajan}
                onChangeText={setCatatanJajan}
              />
              <TouchableOpacity 
                onPress={handleTitipJajanBayar} 
                style={tw`w-full bg-accent py-4 rounded-2xl flex-row justify-center items-center`}
              >
                <Text style={tw`text-white font-bold text-base mr-2`}>Bayar Sekarang</Text>
                <ArrowRight color="white" size={20} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
