/**
 * supabaseApi.ts
 * Menggantikan semua callGasAPI() di Portal Wali dengan query langsung ke Supabase.
 * Semua data sudah ada di Supabase — tidak perlu GAS/Google Sheets lagi.
 */

import { supabase } from './supabase';

// Helper: buat array NIS unik (raw + tanpa leading zeros)
const nisVariants = (nis: string | number): string[] => {
  const raw = String(nis).trim();
  const clean = raw.replace(/^0+/, '');
  return Array.from(new Set([raw, clean])).filter(Boolean);
};

// ─────────────────────────────────────────────────────────────────
// 1. LOGIN ORANG TUA
// ─────────────────────────────────────────────────────────────────
export const loginOrangTua = async (nis: string, password: string) => {
  try {
    const { data, error } = await supabase
      .from('Data Santri')
      .select('nis, nama, kelas, periode, password')
      .in('nis', nisVariants(nis));

    if (error || !data || data.length === 0) {
      return { success: false, message: 'NIS tidak ditemukan.' };
    }

    const santri = data[0];
    // Default password adalah NIS jika belum diset
    const savedPassword = santri.password || nis;
    if (String(savedPassword).trim() !== String(password).trim()) {
      return { success: false, message: 'NIS atau Password salah' };
    }

    return {
      success: true,
      user: {
        nis: santri.nis,
        nama: santri.nama,
        kelas: santri.kelas || '',
        periode: santri.periode || ''
      }
    };
  } catch (e: any) {
    return { success: false, message: 'Terjadi kesalahan: ' + e.message };
  }
};

// ─────────────────────────────────────────────────────────────────
// 2. SAVE PUSH TOKEN FCM
// ─────────────────────────────────────────────────────────────────
export const savePushToken = async (nis: string, token: string) => {
  const variants = nisVariants(nis);
  for (const v of variants) {
    const { error } = await supabase
      .from('Data Santri')
      .update({ FCM_Token: token })
      .eq('nis', v);
    if (!error) break;
  }
  return { success: true };
};

// ─────────────────────────────────────────────────────────────────
// 3. GET ALL PARENT DATA (one-shot fetch)
// ─────────────────────────────────────────────────────────────────
export const getParentData = async (nis: string) => {
  try {
    const variants = nisVariants(nis);

    const [
      tagihanRes,
      pembayaranRes,
      tabunganRes,
      transaksiRes,
      masterRes,
      warungRes,
      produkRes,
      pengaturanRes,
    ] = await Promise.all([
      supabase.from('Tagihan').select('*').in('nis', variants).order('tanggal', { ascending: false }),
      supabase.from('Pembayaran').select('*').in('nis', variants).order('tanggal', { ascending: false }),
      supabase.from('Tabungan').select('*').in('nis', variants).order('tanggal', { ascending: false }),
      supabase.from('Transaksi').select('*').in('SantriID', variants).order('Waktu', { ascending: false }).limit(20),
      supabase.from('MasterTagihan').select('*').order('tagihan'),
      supabase.from('Warung').select('*'),
      supabase.from('Produk').select('*'),
      supabase.from('Pengaturan').select('Kunci, Nilai'),
    ]);

    // Lakukan mapping manual untuk DetailTransaksi karena ketiadaan Foreign Key
    const transaksiData = transaksiRes.data || [];
    if (transaksiData.length > 0) {
      const trxIds = transaksiData.map((t: any) => t.TrxID);
      const { data: detailData } = await supabase.from('DetailTransaksi').select('*').in('TrxID', trxIds);
      const details = detailData || [];
      transaksiData.forEach((t: any) => {
        t.DetailTransaksi = details.filter((d: any) => d.TrxID === t.TrxID);
      });
    }

    // Filter produk aktif di sisi klien (menghindari case-sensitivity issue)
    const rawProduk = produkRes.data || [];
    const produkAktif = rawProduk.filter((p: any) => {
      const s = String(p.status || '').toLowerCase();
      return s !== 'habis' && s !== 'tidak aktif';
    });

    return {
      success: true,
      Tagihan: tagihanRes.data || [],
      Pembayaran: pembayaranRes.data || [],
      Tabungan: tabunganRes.data || [],
      Transaksi: transaksiRes.data || [],
      MasterTagihan: masterRes.data || [],
      POS_Warung: warungRes.data || [],
      POS_Produk: produkAktif,
      Pengaturan: pengaturanRes.data || [],
    };
  } catch (e: any) {
    console.error('getParentData error:', e);
    return {
      success: false,
      Tagihan: [], Pembayaran: [], Tabungan: [], Transaksi: [],
      MasterTagihan: [], POS_Warung: [], POS_Produk: [], Pengaturan: [],
    };
  }
};

// ─────────────────────────────────────────────────────────────────
// 4. RIWAYAT TAGIHAN PAGINATED
// ─────────────────────────────────────────────────────────────────
export const getRiwayatTagihan = async (nis: string, offset: number = 0) => {
  const { data } = await supabase
    .from('Tagihan')
    .select('*')
    .in('nis', nisVariants(nis))
    .order('tanggal', { ascending: false })
    .range(offset, offset + 14);
  return { success: true, data: data || [] };
};

// ─────────────────────────────────────────────────────────────────
// 5. RIWAYAT PESANAN PAGINATED
// ─────────────────────────────────────────────────────────────────
export const getRiwayatPesanan = async (nis: string, offset: number = 0) => {
  const { data } = await supabase
    .from('Transaksi')
    .select('*')
    .in('SantriID', nisVariants(nis))
    .order('Waktu', { ascending: false })
    .range(offset, offset + 14);
    
  const transaksiData = data || [];
  if (transaksiData.length > 0) {
    const trxIds = transaksiData.map((t: any) => t.TrxID);
    const { data: detailData } = await supabase.from('DetailTransaksi').select('*').in('TrxID', trxIds);
    const details = detailData || [];
    transaksiData.forEach((t: any) => {
      t.DetailTransaksi = details.filter((d: any) => d.TrxID === t.TrxID);
    });
  }
  
  return { success: true, data: transaksiData };
};

// ─────────────────────────────────────────────────────────────────
// 6. RIWAYAT TABUNGAN PAGINATED
// ─────────────────────────────────────────────────────────────────
export const getRiwayatTabungan = async (nis: string, offset: number = 0) => {
  const { data } = await supabase
    .from('Tabungan')
    .select('*')
    .in('nis', nisVariants(nis))
    .order('tanggal', { ascending: false })
    .range(offset, offset + 14);
  return { success: true, data: data || [] };
};

// ─────────────────────────────────────────────────────────────────
// 6. SUBMIT PEMBAYARAN QRIS / VA (polling path – app open)
// Webhook handles this for the app-closed case automatically.
// ─────────────────────────────────────────────────────────────────
export const submitPembayaranQRIS = async (payload: any) => {
  const { nis, nama, tagihanId, nominalBayar, transactionId, items } = payload;
  try {
    const processTagihan = async (tgId: string, nominal: number) => {
      const { data: tg } = await supabase.from('Tagihan').select('*').eq('id', tgId).single();
      if (!tg) return;
      const newTerbayar = (Number(tg.terbayar) || 0) + Number(nominal);
      const newStatus = newTerbayar >= Number(tg.nominal) ? 'Lunas' : 'Cicil';
      await supabase.from('Tagihan').update({ terbayar: newTerbayar, status: newStatus }).eq('id', tgId);
      const invId = `INV-PKS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await supabase.from('Pembayaran').insert([{
        id: invId,
        tanggal: new Date().toISOString().split('T')[0],
        nis, nama,
        tagihan: `${tg.tagihan} (Via QRIS)`,
        periode: tg.periode,
        nominal,
        status: newStatus === 'Cicil' ? 'Cicilan' : 'Lunas',
        sisa: Math.max(0, Number(tg.nominal) - newTerbayar),
        items: JSON.stringify([{ tagihan: tg.tagihan, periode: tg.periode, nominal }])
      }]);
    };

    const processNewTagihan = async (item: any) => {
      const tgId = `TG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await supabase.from('Tagihan').insert([{
        id: tgId,
        nis, nama,
        tagihan: item.tagihan,
        periode: item.periode,
        nominal: item.nominal,
        terbayar: item.nominal,
        status: 'Lunas',
        tanggal: new Date().toISOString().split('T')[0],
      }]);
      const invId = `INV-PKS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await supabase.from('Pembayaran').insert([{
        id: invId,
        tanggal: new Date().toISOString().split('T')[0],
        nis, nama,
        tagihan: `${item.tagihan} (Via QRIS)`,
        periode: item.periode,
        nominal: item.nominal,
        status: 'Lunas',
        sisa: 0,
        items: JSON.stringify([{ tagihan: item.tagihan, periode: item.periode, nominal: item.nominal }])
      }]);
    };

    if (tagihanId && tagihanId !== 'NEW' && tagihanId !== 'BULK') {
      await processTagihan(tagihanId, nominalBayar);
    } else if (tagihanId === 'BULK' && items) {
      for (const item of items) {
        if (item.tagihanId && item.tagihanId !== 'NEW') {
          await processTagihan(item.tagihanId, item.nominal);
        } else {
          await processNewTagihan(item);
        }
      }
    }
    return { success: true };
  } catch (e: any) {
    console.error('submitPembayaranQRIS error:', e);
    return { success: false, message: e.message };
  }
};

// ─────────────────────────────────────────────────────────────────
// 7. SUBMIT TOP UP TABUNGAN (polling path – app open)
// ─────────────────────────────────────────────────────────────────
export const submitTopUpTabungan = async (payload: any) => {
  const { nis, nama, nominalSetor, transactionId } = payload;
  try {
    await supabase.from('Tabungan').insert([{
      nis, nama,
      jenis: 'Setor',
      nominal: nominalSetor,
      tanggal: new Date().toISOString().split('T')[0],
      keterangan: `Top Up via QRIS (${transactionId || Date.now()})`
    }]);
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
};

// ─────────────────────────────────────────────────────────────────
// 8. SUBMIT TITIP JAJAN (polling path – app open)
// Untuk kasus webhook (app tutup): ditangani oleh POS webhook otomatis.
// ─────────────────────────────────────────────────────────────────
export const submitTitipJajan = async (payload: any) => {
  const { nis, nama, warungId, items, totalHarga, transactionId, catatan } = payload;
  try {
    const trxId = transactionId || `TJ-${Date.now()}`;
    await supabase.from('Transaksi').insert([{
      TrxID: trxId,
      SantriID: nis,
      TotalHarga: totalHarga,
      Waktu: new Date().toISOString(),
      Metode: 'Pesanan Online',
      StatusAmbil: 'Menunggu',
      WarungID: warungId || 'WRG-KANTIN',
      Catatan: catatan || ''
    }]);

    if (items && items.length > 0) {
      await supabase.from('DetailTransaksi').insert(
        items.map((i: any) => ({
          TrxID: trxId,
          KodeProduk: i.id || '',
          NamaProduk: i.nama || i.name || '',
          Kuantitas: i.qty || i.quantity || 1,
          HargaSatuan: i.harga || i.price || 0
        }))
      );
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
};

// ─────────────────────────────────────────────────────────────────
// 9. GANTI PASSWORD ORANG TUA
// ─────────────────────────────────────────────────────────────────
export const gantiPasswordOrangTua = async (nis: string, oldPassword: string, newPassword: string) => {
  try {
    const { data } = await supabase
      .from('Data Santri')
      .select('nis, password')
      .in('nis', nisVariants(nis));

    if (!data || data.length === 0) {
      return { success: false, message: 'Akun tidak ditemukan' };
    }

    const santri = data[0];
    const savedPass = santri.password || nis;
    if (String(savedPass).trim() !== String(oldPassword).trim()) {
      return { success: false, message: 'Password lama salah' };
    }

    await supabase.from('Data Santri').update({ password: newPassword }).eq('nis', santri.nis);
    return { success: true, message: 'Password berhasil diubah' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
};

// ─────────────────────────────────────────────────────────────────
// 10. GET KONTAK ADMIN
// ─────────────────────────────────────────────────────────────────
export const getAdminContact = async () => {
  try {
    const { data } = await supabase
      .from('MasterConfig')
      .select('kunci, nilai')
      .in('kunci', ['adminContacts', 'adminPhone']);
    
    if (data && data.length > 0) {
      const contactsEntry = data.find(d => d.kunci === 'adminContacts');
      if (contactsEntry && contactsEntry.nilai) {
        try {
          return JSON.parse(contactsEntry.nilai);
        } catch (e) {
          return null;
        }
      }
      
      const phoneEntry = data.find(d => d.kunci === 'adminPhone');
      if (phoneEntry && phoneEntry.nilai) {
        return [{ nama: 'Pengurus', phone: phoneEntry.nilai }];
      }
    }
    return null;
  } catch (e) {
    return null;
  }
};

