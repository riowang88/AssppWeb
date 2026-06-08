import { create } from 'zustand';
import { adminGet, adminPost, adminDelete } from '../api/admin';
import type { Account } from '../types';

interface AdminState {
  accounts: Account[];
  loading: boolean;
  loadAccounts: () => Promise<void>;
  saveAccount: (account: Account) => Promise<void>;
  removeAccount: (email: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  accounts: [],
  loading: false,

  loadAccounts: async () => {
    set({ loading: true });
    try {
      const accounts = await adminGet<Account[]>('/api/admin/accounts');
      set({ accounts });
    } finally {
      set({ loading: false });
    }
  },

  saveAccount: async (account: Account) => {
    await adminPost('/api/admin/accounts', account);
    const accounts = await adminGet<Account[]>('/api/admin/accounts');
    set({ accounts });
  },

  removeAccount: async (email: string) => {
    await adminDelete(`/api/admin/accounts/${encodeURIComponent(email)}`);
    set((state) => ({
      accounts: state.accounts.filter((a) => a.email !== email),
    }));
  },
}));
