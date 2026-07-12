import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, Download, Share2, ReceiptText, CheckCircle } from 'lucide-react-native';
import tw from '../tailwind';
import { useReceiptStore } from '../store/useReceiptStore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function ReceiptModal() {
  const { isOpen, data, closeReceipt } = useReceiptStore();

  if (!isOpen || !data) return null;

  let parsedItems: any[] = [];
  try {
    parsedItems = typeof data.items === 'string' ? JSON.parse(data.items) : (data.items || data.DetailTransaksi || []);
  } catch(e) {
    parsedItems = [];
  }

  const generateHtml = () => {
    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #0F172A; }
            .container { max-width: 400px; margin: 0 auto; border: 1px dashed #E2E8F0; padding: 20px; border-radius: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #E2E8F0; padding-bottom: 20px; }
            .title { font-size: 20px; font-weight: bold; margin: 10px 0 5px 0; }
            .subtitle { font-size: 12px; color: #64748B; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
            .label { color: #64748B; }
            .val { font-weight: bold; text-align: right; }
            .divider { border-top: 1px dashed #E2E8F0; margin: 15px 0; }
            .total-row { font-size: 18px; font-weight: bold; }
            .footer { text-align: center; font-size: 12px; color: #64748B; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div style="font-size: 32px; color: #10B981;">✓</div>
              <div class="title">${data.title || 'BUKTI PEMBAYARAN'}</div>
              <div class="subtitle">Sistem Keuangan Pesantren</div>
            </div>
            
            <div class="row">
              <div class="label">ID Transaksi</div>
              <div class="val">${data.id || '-'}</div>
            </div>
            <div class="row">
              <div class="label">Tanggal</div>
              <div class="val">${data.tanggal || '-'}</div>
            </div>
            <div class="row">
              <div class="label">Nama Santri</div>
              <div class="val">${data.nama || '-'}</div>
            </div>
            <div class="row">
              <div class="label">NIS</div>
              <div class="val">${data.nis || '-'}</div>
            </div>
            
            <div class="divider"></div>
            
            <div class="row">
              <div class="label">Pembayaran</div>
              <div class="val">${data.tagihan || '-'}</div>
            </div>
            ${data.periode ? `
            <div class="row">
              <div class="label">Periode/Keterangan</div>
              <div class="val">${data.periode}</div>
            </div>
            ` : ''}

            ${parsedItems && parsedItems.length > 0 ? `
              <div class="divider"></div>
              <div style="font-size: 12px; color: #64748B; margin-bottom: 10px; font-weight: bold;">Rincian Item:</div>
              ${parsedItems.map(i => `
                <div class="row" style="font-size: 13px;">
                  <div class="label">${i.tagihan || i.nama} ${i.periode ? `(${i.periode})` : ''}</div>
                  <div class="val">Rp ${(i.nominal || i.harga).toLocaleString('id-ID')}</div>
                </div>
              `).join('')}
            ` : ''}
            
            <div class="divider"></div>
            
            <div class="row total-row">
              <div class="label" style="color: #0F172A;">Total Bayar</div>
              <div class="val text-accent">Rp ${(data.nominal || 0).toLocaleString('id-ID')}</div>
            </div>
            
            <div class="footer">
              Terima kasih atas pembayaran Anda.<br/>Simpan struk ini sebagai bukti pembayaran yang sah.
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const downloadPdf = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ 
        html: generateHtml(),
        width: 300, // Ukuran kertas thermal POS (mini)
        height: 450
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert("Sukses", `File PDF disimpan di: ${uri}`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Gagal mengunduh atau membagikan struk.");
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent>
      <View style={tw`flex-1 bg-ink/50 justify-center items-center p-4`}>
        <View style={tw`bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-xl`}>
          <ScrollView contentContainerStyle={tw`p-6 relative pb-10`}>
            <TouchableOpacity onPress={closeReceipt} style={tw`absolute top-6 right-6 z-50 w-8 h-8 bg-slate-100 rounded-full items-center justify-center`}>
              <X color={tw.color('steel')} size={16} />
            </TouchableOpacity>

            <View style={tw`items-center mb-6 pt-2`}>
              <View style={tw`w-16 h-16 bg-successBg rounded-full items-center justify-center mb-3`}>
                <CheckCircle color={tw.color('success')} size={32} />
              </View>
              <Text style={tw`text-xl font-extrabold text-ink text-center`}>{data.title || "BUKTI TRANSAKSI"}</Text>
              <Text style={tw`text-xs text-steel mt-1`}>Transaksi berhasil dicatat sistem</Text>
            </View>

            <View style={tw`bg-canvas border border-whisper rounded-2xl p-4 border-dashed mb-6`}>
              <View style={tw`flex-row justify-between mb-3`}>
                <Text style={tw`text-xs text-steel`}>ID Transaksi</Text>
                <Text style={tw`text-xs font-bold text-ink`}>{data.id || "-"}</Text>
              </View>
              <View style={tw`flex-row justify-between mb-3`}>
                <Text style={tw`text-xs text-steel`}>Tanggal</Text>
                <Text style={tw`text-xs font-bold text-ink`}>{data.tanggal || "-"}</Text>
              </View>
              <View style={tw`flex-row justify-between mb-3`}>
                <Text style={tw`text-xs text-steel`}>Santri</Text>
                <Text style={tw`text-xs font-bold text-ink`}>{data.nama || "-"}</Text>
              </View>
              <View style={tw`h-[1px] bg-whisper my-2 border border-dashed border-whisper`} />
              {parsedItems && parsedItems.length > 0 ? (
                parsedItems.map((item: any, idx: number) => {
                  const itemName = item.tagihan || item.nama || item.NamaProduk || item.Produk?.NamaProduk || "Item";
                  const itemPrice = Number(item.nominal) || Number(item.harga) * Number(item.qty) || Number(item.Subtotal) || 0;
                  return (
                    <View key={idx} style={tw`flex-row justify-between mb-3`}>
                      <Text style={tw`text-xs text-steel flex-1`}>{itemName} {item.periode ? `(${item.periode})` : ''} {item.Kuantitas ? `x${item.Kuantitas}` : ''}</Text>
                      <Text style={tw`text-xs font-bold text-ink ml-2`}>Rp {itemPrice.toLocaleString("id-ID")}</Text>
                    </View>
                  );
                })
              ) : (
                <View style={tw`flex-row justify-between mb-3`}>
                  <Text style={tw`text-xs text-steel flex-1`}>{data.tagihan || "Pembayaran"} {data.periode ? `(${data.periode})` : ''}</Text>
                  <Text style={tw`text-xs font-bold text-ink ml-2`}>Rp {(Number(data.nominal) || 0).toLocaleString("id-ID")}</Text>
                </View>
              )}
              
              {parsedItems && parsedItems.length > 0 && (
                <View style={tw`mt-2`}>
                  <Text style={tw`text-[10px] font-bold text-steel mb-2`}>Rincian Item:</Text>
                  {parsedItems.map((i: any, idx: number) => {
                    const itemName = i.tagihan || i.nama || i.NamaProduk || i.Produk?.NamaProduk || "Item";
                    const itemPrice = Number(i.nominal) || i.harga || i.HargaSatuan || 0;
                    return (
                      <View key={idx} style={tw`flex-row justify-between mb-1 pl-2`}>
                        <Text style={tw`text-[11px] text-steel flex-1`}>• {itemName} {i.periode ? `(${i.periode})` : ''} {i.Kuantitas ? `(x${i.Kuantitas})` : ''}</Text>
                        <Text style={tw`text-[11px] font-bold text-ink ml-2`}>Rp {itemPrice.toLocaleString("id-ID")}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={tw`h-[1px] bg-whisper my-2 border border-dashed border-whisper`} />
              <View style={tw`flex-row justify-between items-center`}>
                <Text style={tw`text-sm font-bold text-ink`}>Total Bayar</Text>
                <Text style={tw`text-lg font-black text-accent`}>Rp {(data.nominal || 0).toLocaleString("id-ID")}</Text>
              </View>
            </View>

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity onPress={downloadPdf} style={tw`flex-1 bg-accent/10 border border-accent/20 rounded-xl py-3 flex-row items-center justify-center px-1`}>
                <Share2 color={tw.color('accent')} size={16} />
                <Text style={tw`text-accent font-bold text-xs ml-1.5`}>Bagikan</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={downloadPdf} style={tw`flex-1 bg-accent rounded-xl py-3 flex-row items-center justify-center px-1`}>
                <Download color="white" size={16} />
                <Text style={tw`text-white font-bold text-xs ml-1.5`}>Unduh PDF</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
