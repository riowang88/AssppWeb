import { useAccountsStore } from '../store/accounts';

export function useAccounts() {
  const { accounts, loading, loadAccounts, getDownloadContext, updateCookies } =
    useAccountsStore();

  function getAccount(email: string) {
    return accounts.find((a) => a.email === email);
  }

  return {
    accounts,
    loading,
    loadAccounts,
    getAccount,
    getDownloadContext,
    updateCookies,
  };
}
