import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Image, Alert, Platform, DeviceEventEmitter } from 'react-native';
import { X, QrCode, CreditCard, ArrowLeft, Zap, Receipt, CheckCircle2, Download, Copy } from 'lucide-react-native';
import tw from '../tailwind';
import { usePakasirStore } from '../store/usePakasirStore';
import { callGasAPI } from '../utils/api';
import { useReceiptStore } from '../store/useReceiptStore';
import * as SecureStore from '../utils/storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

const fetchPakasirProxy = async (action: string, data: any) => {
  const PROXY_URL = "https://script.google.com/macros/s/AKfycbySCGbNxmkRdsyI2RSbszpwC8mxwhfbQulQsiG_DfUU1tdje_BCn9Tz9tdk_ERFLLOA/exec";
  const url = `${PROXY_URL}?action=${action}&data=${encodeURIComponent(JSON.stringify(data))}`;
  const response = await fetch(url);
  return await response.json();
};

export default function PakasirModal() {
  const { isOpen, type, data, closePakasir } = usePakasirStore();
  const { openReceipt } = useReceiptStore();
  const [user, setUser] = useState<any>(null);

  const [bulkData, setBulkData] = useState<{ unpaidBills: any[], masterBills: any[], allTagihan?: any[] } | null>(null);
  const [selectedBulkItems, setSelectedBulkItems] = useState<any[]>([]);
  const [customItem, setCustomItem] = useState({ tagihan: "", bulan: "", tahun: new Date().getFullYear().toString(), nominal: "", masterNominal: 0 });
  const [formError, setFormError] = useState("");

  const [topUpAmount, setTopUpAmount] = useState("");
  const [bayarAmount, setBayarAmount] = useState(0);
  const [pollingInterval, setPollingInterval] = useState<any>(null);
  const [qrisState, setQrisState] = useState<{
    step: "CHOOSE_METHOD" | "LOADING" | "SHOW_QR" | "SHOW_VA" | "SUCCESS" | null;
    method: string | null;
    code: string | null;
    txId: string | null;
  }>({ step: null, method: null, code: null, txId: null });

  useEffect(() => {
    if (isOpen) {
      loadUser();
    } else {
      if (pollingInterval) clearInterval(pollingInterval);
    }
  }, [isOpen]);

  const loadUser = async () => {
    const session = await SecureStore.getItemAsync("_parent_session");
    if (session) {
      const parsedUser = JSON.parse(session);
      setUser(parsedUser);

      // Selalu fetch parent data untuk mendapatkan masterBills (slug & apiKey Pakasir)
      let currentBulkData = null;
      try {
        const res = await callGasAPI("getParentData", { nis: parsedUser.nis });
        const unpaid = (res.Tagihan || []).filter((t: any) => Number(t.terbayar || 0) < Number(t.nominal || 0));
        currentBulkData = { unpaidBills: unpaid, masterBills: res.MasterTagihan || [], allTagihan: res.Tagihan || [] };
        setBulkData(currentBulkData);
      } catch (e) {
        console.error("Gagal mengambil data parent untuk Pakasir:", e);
      }

      if (type === "BAYAR_TAGIHAN") {
        const sisa = data?.nominal - (data?.terbayar || 0);
        setBayarAmount(sisa);
        setTopUpAmount(sisa.toString());
        setQrisState({ step: null, method: null, code: null, txId: null });
      } else if (type === "TOPUP_TABUNGAN") {
        setTopUpAmount("");
        setQrisState({ step: null, method: null, code: null, txId: null });
      } else if (type === "TITIP_JAJAN") {
        setBayarAmount(data?.total || 0);
        setQrisState({ step: "CHOOSE_METHOD", method: null, code: null, txId: null });
      } else if (type === "BAYAR_BEBAS") {
        setSelectedBulkItems([]);
        setCustomItem({ tagihan: "", bulan: "", tahun: new Date().getFullYear().toString(), nominal: "", masterNominal: 0 });
        setQrisState({ step: null, method: null, code: null, txId: null });
      }
    }
  };

  const close = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    closePakasir();
    setTimeout(() => {
      setTopUpAmount("");
      setQrisState({ step: null, method: null, code: null, txId: null });
    }, 300);
  };

  const processPayment = async (method: string) => {
    setQrisState({ step: "LOADING", method, code: null, txId: null });
    
    // Simulate API call to Pakasir
    setTimeout(() => {
      const orderId = `PKS-${Date.now()}`;
      if (method === "qris") {
        setQrisState({
          step: "SHOW_QR",
          method,
          txId: orderId,
          code: "00020101021226610016ID.CO.SHOPEE.WWW01189360091800216005230208216005230303UME51440014ID.CO.QRIS.WWW0215ID10243228429300303UME5204792953033605409100003.005802ID5907Pakasir6012KAB.KEBUMEN61055439262230519SP25RZRATEQI2HQ65Q46304A079",
        });
      } else {
        setQrisState({
          step: "SHOW_VA",
          method,
          txId: orderId,
          code: `8888${user?.nis || "123456"}`,
        });
      }
    }, 1500);
  };

  const simulateSuccess = () => {
    setQrisState({ ...qrisState, step: "SUCCESS" });
    setTimeout(async () => {
      try {
        if (type === "BAYAR_TAGIHAN") {
          await callGasAPI("submitPembayaranQRIS", {
            nis: user?.nis,
            nama: user?.nama,
            tagihanId: data?.id,
            tagName: data?.tagihan,
            nominalBayar: bayarAmount,
            transactionId: qrisState.txId,
          });
        } else if (type === "TOPUP_TABUNGAN") {
          await callGasAPI("submitTopUpTabungan", {
            nis: user?.nis,
            nama: user?.nama,
            nominalSetor: bayarAmount,
            transactionId: qrisState.txId,
          });
        } else if (type === "BAYAR_BEBAS") {
          await callGasAPI("submitPembayaranQRIS", {
            nis: user?.nis,
            nama: user?.nama,
            tagihanId: "BULK",
            nominalBayar: bayarAmount,
            transactionId: qrisState.txId,
            items: selectedBulkItems
          });
        } else if (type === "TITIP_JAJAN") {
          // REVERT TO ORIGINAL APPSCRIPT CALL
          await callGasAPI("submitTitipJajan", {
            nis: user?.nis,
            nama: user?.nama,
            warungId: data?.warungId,
            items: data?.items,
            totalHarga: data?.total,
            transactionId: qrisState.txId,
            catatan: data?.catatan
          });
          
          Alert.alert("Sukses!", "Pesanan Titip Jajan berhasil dikirim.");
        }
      } catch (error) {
        console.error("Gagal simpan pembayaran ke server", error);
        Alert.alert("Error", "Gagal mengirim pesanan. Periksa koneksi internet Anda.");
      }
      
      DeviceEventEmitter.emit('refresh_dashboard');
      close();
      
      setTimeout(() => {
        let tagihanLabel = data?.tagihan;
        let periodeLabel = data?.periode;
        
        if (type === "TOPUP_TABUNGAN") {
           tagihanLabel = "Top Up Saldo Tabungan";
           periodeLabel = "";
        } else if (type === "BAYAR_BEBAS") {
           tagihanLabel = "Pembayaran Multi-Tagihan";
           periodeLabel = "";
        } else if (type === "TITIP_JAJAN") {
           tagihanLabel = "Titip Jajan Anak";
           periodeLabel = "";
        }

        openReceipt({
          title: type === "TOPUP_TABUNGAN" ? "BUKTI TOP-UP" : type === "TITIP_JAJAN" ? "BUKTI TITIP JAJAN" : "BUKTI PEMBAYARAN",
          id: qrisState.txId || `TX-${Date.now()}`,
          tanggal: new Date().toLocaleDateString('id-ID'),
          nama: user?.nama,
          nis: user?.nis,
          tagihan: tagihanLabel,
          periode: periodeLabel,
          nominal: bayarAmount,
          status: "BERHASIL",
          items: type === "BAYAR_BEBAS" ? selectedBulkItems : type === "TITIP_JAJAN" ? data?.items?.map((i:any) => ({ tagihan: i.nama, nominal: i.harga * i.qty, periode: `${i.qty}x` })) : undefined,
        });
      }, 500);
    }, 2000);
  };

  const isWeb = Platform.OS === 'web';

  return (
    <Modal visible={isOpen} animationType="slide" transparent>
      <View style={tw`flex-1 bg-ink/40 justify-end ${isWeb ? 'items-center' : ''}`}>
        <View style={[tw`bg-surface w-full rounded-t-[32px] max-h-[90%] flex-col overflow-hidden`, isWeb && { maxWidth: 480 }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={tw`p-6 pb-20 relative`}>
            <TouchableOpacity onPress={close} style={tw`absolute top-6 right-6 z-50 w-8 h-8 bg-slate-100 rounded-full items-center justify-center`}>
              <X color={tw.color('steel')} size={16} />
            </TouchableOpacity>

            {(type === "TOPUP_TABUNGAN" || type === "BAYAR_TAGIHAN") && !qrisState.step && (
              <View style={tw`pt-2`}>
                <View style={tw`w-14 h-14 bg-accent/10 rounded-full items-center justify-center mb-5`}>
                  {type === "BAYAR_TAGIHAN" ? <Receipt color={tw.color('accent')} size={28} /> : <Zap color={tw.color('accent')} size={28} />}
                </View>
                <Text style={tw`text-2xl font-extrabold text-ink mb-2`}>
                  {type === "BAYAR_TAGIHAN" ? `Bayar ${data?.tagihan}` : "Top Up Tabungan"}
                </Text>
                <Text style={tw`text-sm text-steel mb-8`}>
                  {type === "BAYAR_TAGIHAN" 
                    ? "Ubah nominal di bawah ini jika Anda ingin mencicil tagihan." 
                    : "Masukkan nominal yang ingin disetor."}
                </Text>

                <View style={tw`mb-8 relative justify-center`}>
                  <Text style={tw`absolute left-5 font-bold text-ink text-lg z-10 top-4`}>Rp</Text>
                  <TextInput
                    style={tw`w-full rounded-[20px] bg-canvas border border-whisper px-5 py-4 pl-14 text-xl font-bold text-ink`}
                    value={topUpAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                    onChangeText={(val) => setTopUpAmount(val.replace(/\D/g, ""))}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                  {type === "BAYAR_TAGIHAN" && (
                     <Text style={tw`mt-2 ml-1 text-[11px] font-bold text-steel`}>
                       Total Sisa Tagihan: Rp {(data?.nominal - (data?.terbayar || 0)).toLocaleString("id-ID")}
                     </Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    const amt = parseInt(topUpAmount || "0", 10);
                    if (type === "BAYAR_TAGIHAN") {
                       const sisa = data?.nominal - (data?.terbayar || 0);
                       if (amt > sisa) {
                          Alert.alert("Error", "Nominal bayar tidak boleh melebihi sisa tagihan!");
                          return;
                       }
                       if (amt < 10000) {
                          Alert.alert("Error", "Minimal pembayaran Rp 10.000");
                          return;
                       }
                    } else {
                       if (amt < 10000) {
                          Alert.alert("Error", "Minimal top-up Rp 10.000");
                          return;
                       }
                    }
                    setBayarAmount(amt);
                    setQrisState({ ...qrisState, step: "CHOOSE_METHOD" });
                  }}
                  style={tw`w-full bg-accent rounded-[20px] py-4 items-center`}
                >
                  <Text style={tw`text-white font-bold text-base`}>Lanjut Pilih Pembayaran</Text>
                </TouchableOpacity>
              </View>
            )}

            {type === "BAYAR_BEBAS" && !qrisState.step && bulkData && (
              <View style={tw`pt-2`}>
                <Text style={tw`text-2xl font-extrabold text-ink mb-2`}>Pembayaran Massal</Text>
                <Text style={tw`text-sm text-steel mb-6`}>Pilih tagihan yang ingin dibayar sekaligus.</Text>
                
                {bulkData.unpaidBills.length > 0 && (
                  <View style={tw`mb-6`}>
                    <Text style={tw`font-bold text-xs text-steel mb-2`}>TAGIHAN AKTIF</Text>
                    {bulkData.unpaidBills
                      .filter((bill: any) => {
                        const masterConfig = bulkData.masterBills?.find((m: any) => bill.tagihan.startsWith(m.tagihan));
                        if (!masterConfig) return true;
                        const pm = masterConfig.portalMenu || [];
                        if (pm.includes('Aplikasi POS') || pm.includes('Sembunyikan')) return false;
                        return true;
                      })
                      .map((bill: any) => {
                      const sisa = bill.nominal - (bill.terbayar || 0);
                      const isSelected = selectedBulkItems.find(i => i.tagihanId === bill.id);
                      return (
                        <TouchableOpacity 
                          key={bill.id} 
                          onPress={() => {
                            if (isSelected) {
                              setSelectedBulkItems(prev => prev.filter(i => i.tagihanId !== bill.id));
                            } else {
                              setSelectedBulkItems(prev => [...prev, { tagihanId: bill.id, tagihan: bill.tagihan, periode: bill.periode, nominal: sisa }]);
                            }
                          }}
                          style={tw`flex-row items-center p-3 border border-whisper rounded-[16px] mb-2 ${isSelected ? 'bg-accent/5 border-accent/20' : 'bg-white'}`}
                        >
                          <View style={tw`w-5 h-5 rounded border items-center justify-center mr-3 ${isSelected ? 'border-accent bg-accent' : 'border-slate-300'}`}>
                            {isSelected && <CheckCircle2 color="white" size={14} />}
                          </View>
                          <View style={tw`flex-1`}>
                            <Text style={tw`font-bold text-sm text-ink`}>{bill.tagihan}</Text>
                            <Text style={tw`text-[10px] text-steel`}>{bill.periode || '-'}</Text>
                          </View>
                          <Text style={tw`font-bold text-sm text-ink`}>Rp {sisa.toLocaleString('id-ID')}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}

                {/* Custom Advance Payment */}
                <View style={tw`mb-6 border-t border-whisper pt-4`}>
                  <Text style={tw`font-bold text-xs text-steel uppercase mb-3`}>Tambah Pembayaran Khusus</Text>
                  <View style={tw`bg-slate-50 p-4 rounded-[16px] border border-whisper`}>
                    
                    <Text style={tw`text-[10px] font-bold text-steel mb-2`}>Pilih Jenis Tagihan</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-3`}>
                      {bulkData.masterBills
                        .filter((m: any) => {
                          const pm = m.portalMenu || [];
                          return pm.includes('Menu Plus Portal') || pm.includes('Bayar Tagihan Lain');
                        })
                        .map((m: any, i: number) => {
                        const isSel = customItem.tagihan === (m.tagihan || m.nama);
                        return (
                          <TouchableOpacity 
                            key={i} 
                            onPress={() => {
                              let autoNominal = customItem.nominal;
                              const val = m.nominal || m.nominalAwal || m.biaya || m.harga || m.jumlah || m.total;
                              let masterNum = 0;
                              if (val) {
                                const num = parseInt(String(val).replace(/\D/g, ""), 10);
                                if (!isNaN(num) && num > 0) {
                                  autoNominal = num.toLocaleString("id-ID");
                                  masterNum = num;
                                }
                              }
                              setCustomItem({...customItem, tagihan: m.tagihan || m.nama, nominal: autoNominal, masterNominal: masterNum});
                            }}
                            style={tw`px-3 py-1.5 rounded-full border mr-2 ${isSel ? 'bg-accent border-accent' : 'bg-white border-slate-300'}`}
                          >
                            <Text style={tw`text-xs ${isSel ? 'text-white font-bold' : 'text-steel'}`}>{m.tagihan || m.nama}</Text>
                          </TouchableOpacity>
                        )
                      })}
                    </ScrollView>

                    <View style={tw`flex-row gap-2 mb-3`}>
                      <View style={tw`flex-1`}>
                        <Text style={tw`text-[10px] font-bold text-steel mb-1`}>Bulan (Opsional)</Text>
                        <TouchableOpacity 
                          onPress={() => setQrisState({...qrisState, step: "SELECT_BULAN" as any})}
                          style={tw`w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex-row justify-between items-center`}
                        >
                          <Text style={tw`text-sm ${customItem.bulan ? 'text-ink font-bold' : 'text-slate-400'}`}>
                            {customItem.bulan || '- Bulan -'}
                          </Text>
                          <Text style={tw`text-xs text-slate-400`}>▼</Text>
                        </TouchableOpacity>
                      </View>
                      
                      <View style={tw`flex-1`}>
                        <Text style={tw`text-[10px] font-bold text-steel mb-1`}>Tahun</Text>
                        <TouchableOpacity 
                          onPress={() => setQrisState({...qrisState, step: "SELECT_TAHUN" as any})}
                          style={tw`w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex-row justify-between items-center`}
                        >
                          <Text style={tw`text-sm font-bold text-ink`}>{customItem.tahun}</Text>
                          <Text style={tw`text-xs text-slate-400`}>▼</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={tw`text-[10px] font-bold text-steel mb-1`}>Nominal (Rp)</Text>
                    <TextInput 
                      style={tw`w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 text-ink font-bold`}
                      placeholder="0"
                      keyboardType="number-pad"
                      value={customItem.nominal}
                      onChangeText={(val) => {
                        const numStr = val.replace(/\D/g, "");
                        setCustomItem({...customItem, nominal: numStr ? parseInt(numStr).toLocaleString("id-ID") : ""});
                      }}
                    />

                    {formError ? <Text style={tw`text-danger text-xs font-medium mb-3 text-center`}>{formError}</Text> : null}
                    
                    <TouchableOpacity 
                      onPress={() => {
                        setFormError("");
                        if (!customItem.tagihan || !customItem.nominal) return setFormError("Pilih tagihan dan masukkan nominal!");
                        
                        const fullPeriode = customItem.bulan ? `${customItem.bulan} ${customItem.tahun}`.trim() : '';
                        
                        // Cek apakah tagihan ini sudah ada di database orang tua
                        const existingBill = bulkData?.allTagihan?.find(t => 
                           String(t.tagihan).toLowerCase().trim() === String(customItem.tagihan).toLowerCase().trim() && 
                           String(t.periode || '').toLowerCase().trim() === String(fullPeriode).toLowerCase().trim()
                        );

                        let amt = parseInt(String(customItem.nominal).replace(/\D/g, ""), 10);
                        
                        if (existingBill) {
                           const sisa = Number(existingBill.nominal) - Number(existingBill.terbayar || 0);
                           if (sisa <= 0) {
                              return setFormError("Tagihan ini sudah lunas!");
                           }
                           if (amt > sisa) {
                              amt = sisa;
                              // Auto-adjust, tapi jangan block process
                           }
                        }

                        if (isNaN(amt) || amt < 1000) return setFormError("Nominal tidak valid (Minimal Rp 1.000)!");
                        
                        const alreadyInList = selectedBulkItems.find(i => i.tagihan === customItem.tagihan && i.periode === fullPeriode);
                        if (alreadyInList) return setFormError("Item ini sudah ada di daftar!");

                        const masterAmt = customItem.masterNominal > 0 ? customItem.masterNominal : amt;
                        setSelectedBulkItems(prev => [...prev, { tagihan: customItem.tagihan, periode: fullPeriode, nominal: amt, masterNominal: masterAmt }]);
                        setCustomItem({ tagihan: "", bulan: "", tahun: new Date().getFullYear().toString(), nominal: "", masterNominal: 0 });
                      }}
                      style={tw`w-full bg-slate-200 py-2.5 rounded-xl items-center`}
                    >
                      <Text style={tw`text-ink font-bold text-xs`}>+ Tambahkan ke Daftar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Selected Custom Items */}
                {selectedBulkItems.filter(i => !i.tagihanId).length > 0 && (
                  <View style={tw`mb-6`}>
                    <Text style={tw`font-bold text-xs text-steel uppercase mb-2`}>Item Khusus Ditambahkan</Text>
                    {selectedBulkItems.filter(i => !i.tagihanId).map((item, idx) => (
                      <View key={idx} style={tw`flex-row justify-between items-center bg-accent/5 p-3 rounded-xl border border-accent/10 mb-2`}>
                        <View style={tw`flex-1`}>
                          <Text style={tw`text-xs font-bold text-accent`}>{item.tagihan}</Text>
                          <Text style={tw`text-[10px] text-steel`}>{item.periode || '-'}</Text>
                        </View>
                        <View style={tw`flex-row items-center`}>
                          <Text style={tw`text-sm font-bold text-ink mr-3`}>Rp {item.nominal.toLocaleString('id-ID')}</Text>
                          <TouchableOpacity onPress={() => {
                            setSelectedBulkItems(prev => prev.filter(i => i !== item));
                          }}>
                            <X color={tw.color('danger')} size={16} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={tw`mb-6 flex-row justify-between items-center bg-slate-50 p-4 rounded-[20px] border border-whisper`}>
                   <Text style={tw`text-sm font-bold text-steel`}>Total Pembayaran:</Text>
                   <Text style={tw`text-xl font-extrabold text-accent`}>
                     Rp {selectedBulkItems.reduce((acc, curr) => acc + curr.nominal, 0).toLocaleString('id-ID')}
                   </Text>
                </View>
                
                <TouchableOpacity
                  onPress={() => {
                    const total = selectedBulkItems.reduce((acc, curr) => acc + curr.nominal, 0);
                    if (total < 10000) {
                       Alert.alert("Error", "Total pembayaran minimal Rp 10.000");
                       return;
                    }
                    setBayarAmount(total);
                    setQrisState({ ...qrisState, step: "CHOOSE_METHOD" });
                  }}
                  disabled={selectedBulkItems.length === 0}
                  style={tw`w-full bg-accent rounded-[20px] py-4 items-center ${selectedBulkItems.length === 0 ? 'opacity-50' : ''}`}
                >
                  <Text style={tw`text-white font-bold text-base`}>Lanjut Pilih Pembayaran</Text>
                </TouchableOpacity>
              </View>
            )}

            {qrisState.step === ("SELECT_BULAN" as any) && (
              <View style={tw`pt-2`}>
                <View style={tw`flex-row justify-between items-center mb-6`}>
                  <Text style={tw`text-xl font-bold text-ink`}>Pilih Bulan</Text>
                  <TouchableOpacity onPress={() => setQrisState({...qrisState, step: null})}>
                    <X color={tw.color('steel')} size={20} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={tw`max-h-64 mb-4`}>
                  {["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map(m => (
                    <TouchableOpacity 
                      key={m} 
                      onPress={() => {
                        setCustomItem({...customItem, bulan: m});
                        setQrisState({...qrisState, step: null});
                      }}
                      style={tw`py-4 border-b border-whisper flex-row justify-between items-center`}
                    >
                      <Text style={tw`text-base text-ink ${customItem.bulan === m ? 'font-bold text-accent' : ''}`}>{m || "Kosongkan (Hanya Tahun)"}</Text>
                      {customItem.bulan === m && <CheckCircle2 color={tw.color('accent')} size={18} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {qrisState.step === ("SELECT_TAHUN" as any) && (
              <View style={tw`pt-2`}>
                <View style={tw`flex-row justify-between items-center mb-6`}>
                  <Text style={tw`text-xl font-bold text-ink`}>Pilih Tahun</Text>
                  <TouchableOpacity onPress={() => setQrisState({...qrisState, step: null})}>
                    <X color={tw.color('steel')} size={20} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={tw`max-h-64 mb-4`}>
                  {[2024, 2025, 2026, 2027, 2028].map(y => (
                    <TouchableOpacity 
                      key={y} 
                      onPress={() => {
                        setCustomItem({...customItem, tahun: y.toString()});
                        setQrisState({...qrisState, step: null});
                      }}
                      style={tw`py-4 border-b border-whisper flex-row justify-between items-center`}
                    >
                      <Text style={tw`text-base text-ink ${customItem.tahun === y.toString() ? 'font-bold text-accent' : ''}`}>{y}</Text>
                      {customItem.tahun === y.toString() && <CheckCircle2 color={tw.color('accent')} size={18} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {qrisState.step === "CHOOSE_METHOD" && (
              <View style={tw`pt-2`}>
                <Text style={tw`text-xl font-bold text-ink mb-6`}>Pilih Metode Pembayaran</Text>
                
                <View style={tw`mb-6 bg-slate-50 border border-whisper p-5 rounded-[20px] items-center`}>
                  <Text style={tw`text-sm text-steel mb-1`}>{type === "TOPUP_TABUNGAN" ? "Top Up Tabungan" : type === "TITIP_JAJAN" ? "Titip Jajan" : data?.tagihan}</Text>
                  <Text style={tw`text-3xl font-extrabold text-ink`}>
                    Rp {bayarAmount.toLocaleString("id-ID")}
                  </Text>
                </View>

                <TouchableOpacity onPress={() => processPayment("qris")} style={tw`w-full flex-row items-center p-5 border border-whisper rounded-[20px] mb-3`}>
                  <View style={tw`w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-4`}>
                    <QrCode color={tw.color('accent')} size={20} />
                  </View>
                  <Text style={tw`font-bold text-ink text-sm`}>QRIS (Gopay, OVO, Dana)</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => processPayment("bni_va")} style={tw`w-full flex-row items-center p-5 border border-whisper rounded-[20px] mb-3`}>
                  <View style={tw`w-10 h-10 rounded-full bg-orange-50 items-center justify-center mr-4`}>
                    <CreditCard color="#ea580c" size={20} />
                  </View>
                  <Text style={tw`font-bold text-ink text-sm`}>BNI Virtual Account</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => processPayment("bri_va")} style={tw`w-full flex-row items-center p-5 border border-whisper rounded-[20px] mb-3`}>
                  <View style={tw`w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-4`}>
                    <CreditCard color="#1d4ed8" size={20} />
                  </View>
                  <Text style={tw`font-bold text-ink text-sm`}>BRI Virtual Account</Text>
                </TouchableOpacity>
              </View>
            )}

            {qrisState.step === "LOADING" && (
              <View style={tw`items-center py-20`}>
                <ActivityIndicator size="large" color={tw.color('accent')} />
                <Text style={tw`text-steel font-medium mt-6`}>Sedang menyiapkan pembayaran...</Text>
              </View>
            )}

            {(qrisState.step === "SHOW_QR" || qrisState.step === "SHOW_VA") && (
              <View style={tw`items-center pt-2`}>
                <Text style={tw`text-xl font-bold text-ink mb-2`}>
                  {qrisState.method === "qris" ? "Scan QRIS" : "Transfer VA"}
                </Text>
                <Text style={tw`text-sm text-steel mb-6`}>Selesaikan pembayaran sebelum batas waktu habis.</Text>

                {qrisState.step === "SHOW_QR" ? (
                  <View style={tw`items-center w-full`}>
                    <View style={tw`bg-canvas border border-whisper rounded-[24px] p-4 w-64 h-64 mb-4`}>
                      <Image 
                        source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrisState.code!)}` }} 
                        style={tw`w-full h-full`}
                        resizeMode="contain"
                      />
                    </View>
                    <TouchableOpacity 
                      onPress={async () => {
                        try {
                          const fileUri = FileSystem.documentDirectory + 'qris.png';
                          const { uri } = await FileSystem.downloadAsync(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrisState.code!)}`, fileUri);
                          if (await Sharing.isAvailableAsync()) {
                            await Sharing.shareAsync(uri, { 
                              dialogTitle: 'Simpan atau Bagikan QRIS',
                              mimeType: 'image/png',
                              UTI: 'public.png'
                            });
                          } else {
                            Alert.alert('Info', 'Sharing tidak tersedia di perangkat ini');
                          }
                        } catch (e: any) {
                          Alert.alert('Error', e?.message || String(e) || 'Gagal mengunduh QRIS');
                        }
                      }}
                      style={tw`bg-slate-200 px-6 py-3 rounded-full mb-6 flex-row items-center justify-center`}
                    >
                      <Download color={tw.color('ink')} size={16} />
                      <Text style={tw`text-ink font-bold text-xs ml-2`}>Download QRIS</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={tw`bg-canvas border border-whisper rounded-[24px] p-6 mb-6 items-center w-full`}>
                    <Text style={tw`text-xs font-bold text-steel uppercase mb-2`}>Bank {qrisState.method?.split("_")[0]}</Text>
                    <Text style={tw`text-3xl font-bold text-ink tracking-widest mb-4`}>{qrisState.code}</Text>
                    <TouchableOpacity 
                      onPress={async () => {
                        await Clipboard.setStringAsync(qrisState.code!);
                        Alert.alert("Sukses", "Nomor VA disalin ke clipboard!");
                      }}
                      style={tw`bg-slate-200 px-6 py-3 rounded-full flex-row items-center justify-center`}
                    >
                      <Copy color={tw.color('ink')} size={16} />
                      <Text style={tw`text-ink font-bold text-xs ml-2`}>Copy VA</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={tw`p-4 bg-accent/5 rounded-2xl mb-6 flex-row justify-between items-center w-full border border-accent/10`}>
                  <View>
                    <Text style={tw`text-xs text-accent font-medium mb-1`}>Total Bayar</Text>
                    <Text style={tw`text-xl font-bold text-ink`}>Rp {bayarAmount.toLocaleString("id-ID")}</Text>
                  </View>
                  <TouchableOpacity onPress={simulateSuccess} style={tw`bg-accent px-4 py-2 rounded-xl`}>
                    <Text style={tw`text-white text-xs font-bold`}>Simulasi Sukses</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setQrisState({ ...qrisState, step: "CHOOSE_METHOD" })} style={tw`flex-row items-center mb-8`}>
                  <ArrowLeft color={tw.color('steel')} size={16} />
                  <Text style={tw`text-steel font-medium text-sm ml-2`}>Batal & Pilih Metode Lain</Text>
                </TouchableOpacity>
              </View>
            )}

            {qrisState.step === "SUCCESS" && (
              <View style={tw`items-center justify-center py-10`}>
                <View style={tw`w-24 h-24 bg-successBg rounded-full items-center justify-center mb-6`}>
                  <CheckCircle2 color={tw.color('success')} size={48} />
                </View>
                <Text style={tw`text-success font-extrabold text-2xl mb-2`}>Pembayaran Berhasil!</Text>
                <Text style={tw`text-steel text-center text-sm`}>Transaksi Anda telah tercatat di sistem.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
