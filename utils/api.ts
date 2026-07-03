import { supabase } from './supabase';

// Mock function for now if tables don't exist, otherwise query actual tables
export const callGasAPI = async (action: string, data: any = {}) => {
  try {
    switch (action) {
      case 'loginOrangTua': {
        const { nis, password } = data;
        const { data: santriData, error } = await supabase
          .from('Data Santri')
          .select('nis, nama, password')
          .eq('nis', nis)
          .single();
          
        if (error || !santriData) {
          return { success: false, message: 'NIS tidak ditemukan' };
        }
        
        if (santriData.password && santriData.password.toString() !== password.toString()) {
          return { success: false, message: 'Password salah' };
        }
        
        return { 
          success: true, 
          user: { nis: santriData.nis || nis, nama: santriData.nama || 'Santri' } 
        };
      }

      case 'getParentData': {
        const { nis } = data;
        const { data: santriData } = await supabase.from('Data Santri').select('nama').eq('nis', nis).single();
        
        const { data: warung } = await supabase.from('Warung').select('ID, Nama, Status');
        const { data: produk } = await supabase.from('Produk').select('ID, Nama, HargaJual, WarungID, Status, Kategori');
        
        // LIMIT applied to Tagihan & Tabungan (max 15 on initial load)
        const { data: tagihan } = await supabase.from('Tagihan').select('id, tagihan, periode, nominal, terbayar, status').eq('nis', nis).order('tanggal', { ascending: false }).limit(15);
        const { data: tabungan } = await supabase.from('Tabungan').select('id, tanggal, jenis, nominal, keterangan').eq('nis', nis).order('tanggal', { ascending: false }).limit(15);
        
        // Fetch Transaksi for history (only completed/cancelled)
        const { data: transaksi } = await supabase.from('Transaksi')
          .select('TrxID, Waktu, TotalHarga, StatusAmbil, Metode')
          .eq('SantriID', nis)
          .in('StatusAmbil', ['Selesai', 'Dibatalkan'])
          .order('Waktu', { ascending: false })
          .limit(15);
        
        const { data: masterTagihan } = await supabase.from('MasterTagihan').select('tagihan, portalMenu, pakasirSlug, pakasirApiKey, nominal');
        
        return {
          success: true,
          namaSantri: santriData?.nama || 'Santri',
          Tagihan: tagihan || [],
          Tabungan: tabungan || [],
          Transaksi: transaksi || [],
          MasterTagihan: masterTagihan ? masterTagihan.map(m => ({
            ...m,
            portalMenu: typeof m.portalMenu === 'string' ? JSON.parse(m.portalMenu || '[]') : m.portalMenu
          })) : [],
          POS_Warung: warung || [],
          POS_Produk: produk || []
        };
      }
      
      case 'getRiwayatTagihan': {
        const { nis, offset } = data;
        const { data: tagihan } = await supabase.from('Tagihan')
          .select('id, tagihan, periode, nominal, terbayar, status')
          .eq('nis', nis)
          .order('tanggal', { ascending: false })
          .range(offset, offset + 14); // 15 items per page
        return { success: true, data: tagihan || [] };
      }
      
      case 'getRiwayatTabungan': {
        const { nis, offset } = data;
        const { data: tabungan } = await supabase.from('Tabungan')
          .select('id, tanggal, jenis, nominal, keterangan')
          .eq('nis', nis)
          .order('tanggal', { ascending: false })
          .range(offset, offset + 14);
        return { success: true, data: tabungan || [] };
      }
      
      case 'getPesananAktif': {
        const { nis } = data;
        const { data: pesanan } = await supabase
          .from('Transaksi')
          .select('TrxID, StatusAmbil, Waktu, TotalHarga, Catatan')
          .eq('SantriID', nis)
          .order('Waktu', { ascending: false })
          .limit(5);
          
        if (!pesanan || pesanan.length === 0) {
          return { success: true, data: [] };
        }
        
        const trxIds = pesanan.map(p => p.TrxID);
        const { data: details } = await supabase
          .from('DetailTransaksi')
          .select('TrxID, NamaProduk, Kuantitas')
          .in('TrxID', trxIds);
          
        const formattedPesanan = pesanan.map((p: any) => ({
          ...p,
          items: (details || [])
            .filter((d: any) => d.TrxID === p.TrxID)
            .map((d: any) => ({ nama: d.NamaProduk, qty: d.Kuantitas }))
        }));
          
        return { success: true, data: formattedPesanan };
      }

      case 'savePushToken': {
        return { success: true };
      }
      
      case 'submitTitipJajan': {
        const { warungId, items, total, catatan, nis } = data;
        const trxId = `TRX-P-${new Date().getTime()}`;
        const { error } = await supabase.from('Transaksi').insert({
          TrxID: trxId,
          Waktu: new Date().toISOString(),
          SantriID: nis || 'UNKNOWN',
          WarungID: warungId || 'UNKNOWN',
          TotalHarga: total,
          Metode: 'Pesanan Online',
          StatusAmbil: 'Menunggu',
          Catatan: catatan || '',
          StatusPencairan: 'Belum Diajukan'
        });
        
        if (error) throw error;
        
        const details = items.map((item: any) => ({
          TrxID: trxId,
          ProdukID: item.id,
          NamaProduk: item.nama,
          HargaSatuan: item.harga,
          Kuantitas: item.qty,
          Subtotal: item.harga * item.qty
        }));
        
        await supabase.from('DetailTransaksi').insert(details);
        return { success: true };
      }
      
      case 'submitTopUpTabungan': {
        const { nis, nama, nominal, nominalSetor } = data;
        const setor = nominalSetor || nominal;
        const { error } = await supabase.from('Tabungan').insert({
          id: `TB-${new Date().getTime()}`,
          tanggal: new Date().toISOString().split('T')[0],
          nis: nis,
          nama: nama || 'Santri',
          jenis: 'Setor',
          nominal: setor,
          keterangan: 'Topup via Portal'
        });
        if (error) throw error;
        return { success: true };
      }
      
      case 'submitPembayaranQRIS': {
        const { tagihanId, nominalBayar, items } = data;
        
        if (tagihanId === 'BULK' && items) {
          // Bayar massal
          for (const item of items) {
            if (item.tagihanId) {
              const { data: currentBill } = await supabase.from('Tagihan').select('nominal, terbayar').eq('id', item.tagihanId).single();
              if (currentBill) {
                const totalTerbayar = (currentBill.terbayar || 0) + item.nominal;
                const status = totalTerbayar >= currentBill.nominal ? 'Lunas' : 'Cicil';
                await supabase.from('Tagihan').update({
                  terbayar: totalTerbayar,
                  status: status
                }).eq('id', item.tagihanId);
              }
            } else {
              // Custom bill payment (no existing tagihan ID in bulk mode)
              console.log("Pembayaran tagihan kustom:", item.tagihan, item.nominal);
            }
          }
        } else if (tagihanId) {
          // Bayar single tagihan
          const { data: currentBill } = await supabase.from('Tagihan').select('nominal, terbayar').eq('id', tagihanId).single();
          if (currentBill) {
            const totalTerbayar = (currentBill.terbayar || 0) + (nominalBayar || 0);
            const status = totalTerbayar >= currentBill.nominal ? 'Lunas' : 'Cicil';
            
            const { error } = await supabase.from('Tagihan').update({
              terbayar: totalTerbayar,
              status: status
            }).eq('id', tagihanId);
            if (error) throw error;
          }
        }
        return { success: true };
      }
      
      case 'gantiPasswordOrangTua': {
        const { nis, oldPassword, newPassword } = data;
        
        const { data: santriData } = await supabase.from('Data Santri').select('password').eq('nis', nis).single();
        if (!santriData || (santriData.password && santriData.password.toString() !== oldPassword.toString())) {
          return { success: false, message: 'Password lama salah' };
        }
        
        const { error } = await supabase.from('Data Santri').update({ password: newPassword }).eq('nis', nis);
        if (error) throw error;
        
        return { success: true };
      }
      
      default:
        console.warn(`Action ${action} not fully implemented in Supabase yet.`);
        return { success: true };
    }
  } catch (error: any) {
    console.error(`Error calling Supabase ${action}:`, error.message);
    throw new Error('Koneksi bermasalah. Coba lagi.');
  }
};
