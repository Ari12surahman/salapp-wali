import { create } from 'zustand';

export type PakasirType = 'BAYAR_TAGIHAN' | 'TOPUP_TABUNGAN' | 'BAYAR_BEBAS' | 'TITIP_JAJAN' | '';

interface PakasirState {
  isOpen: boolean;
  type: PakasirType;
  data: any;
  openPakasir: (type: PakasirType, data?: any) => void;
  closePakasir: () => void;
}

export const usePakasirStore = create<PakasirState>((set) => ({
  isOpen: false,
  type: '',
  data: null,
  openPakasir: (type, data = null) => set({ isOpen: true, type, data }),
  closePakasir: () => set({ isOpen: false, type: '', data: null }),
}));
