import { create } from 'zustand';
import { apiGet, apiPatch } from '../api/client';
import { decryptPassword } from '../utils/decrypt';
import type { Account, AccountSummary } from '../types';

interface AccountsState {
  accounts: AccountSummary[];
  loading: boolean;
  loadAccounts: () => Promise<void>;
  getDownloadContext: (email: string) => Promise<Account>;
  updateCookies: (email: string, cookies: Account['cookies']) => Promise<void>;
}

export const useAccountsStore = create<AccountsState>((set) => ({
  accounts: [],
  loading: true,

  loadAccounts: async () => {
    set({ loading: true });
    try {
      const accounts = await apiGet<AccountSummary[]>('/api/accounts');
      set({ accounts, loading: false });
    } catch {
      set({ accounts: [], loading: false });
    }
  },

  getDownloadContext: async (email: string) => {
    const data = await apiGet<any>(`/api/accounts/${encodeURIComponent(email)}/ctx`);
    const password = typeof data.password === 'object'
      ? await decryptPassword(data.password)
      : data.password;
    return { ...data, password } as Account;
  },

  updateCookies: async (email: string, cookies: Account['cookies']) => {
    await apiPatch(`/api/accounts/${encodeURIComponent(email)}/cookies`, { cookies });
  },
}));
