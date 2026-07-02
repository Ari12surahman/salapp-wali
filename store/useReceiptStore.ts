import { create } from 'zustand';

interface ReceiptData {
  title?: string;
  id?: string;
  tanggal?: string;
  nama?: string;
  nis?: string;
  tagihan?: string;
  periode?: string;
  nominal?: number;
  status?: string;
  items?: any[];
  isNewTransaction?: boolean;
}

interface ReceiptState {
  isOpen: boolean;
  data: ReceiptData | null;
  openReceipt: (data: ReceiptData) => void;
  closeReceipt: () => void;
}

export const useReceiptStore = create<ReceiptState>((set) => ({
  isOpen: false,
  data: null,
  openReceipt: (data) => set({ isOpen: true, data }),
  closeReceipt: () => set({ isOpen: false, data: null }),
}));
