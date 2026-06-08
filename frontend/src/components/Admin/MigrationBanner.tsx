import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Spinner from '../common/Spinner';
import { useAdminStore } from '../../store/admin';
import { useToastStore } from '../../store/toast';
import type { Account } from '../../types';

async function getIndexedDBAccounts(): Promise<Account[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open('asspp-accounts', 1);
    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('accounts')) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction('accounts', 'readonly');
      const store = tx.objectStore('accounts');
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        db.close();
        resolve(getAll.result || []);
      };
      getAll.onerror = () => {
        db.close();
        resolve([]);
      };
    };
    request.onupgradeneeded = () => {
      request.result.close();
      resolve([]);
    };
  });
}

export default function MigrationBanner() {
  const { t } = useTranslation();
  const { saveAccount } = useAdminStore();
  const addToast = useToastStore((s) => s.addToast);
  const [localAccounts, setLocalAccounts] = useState<Account[]>([]);
  const [migrating, setMigrating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    getIndexedDBAccounts().then(setLocalAccounts);
  }, []);

  if (dismissed || localAccounts.length === 0) return null;

  async function handleMigrate() {
    setMigrating(true);
    try {
      for (const account of localAccounts) {
        await saveAccount(account);
      }
      indexedDB.deleteDatabase('asspp-accounts');
      addToast(t('admin.migration.success', { count: localAccounts.length }), 'success');
      setLocalAccounts([]);
    } catch {
      addToast(t('admin.migration.failed'), 'error');
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
            {t('admin.migration.title')}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            {t('admin.migration.description', { count: localAccounts.length })}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleMigrate}
              disabled={migrating}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {migrating && <Spinner />}
              {t('admin.migration.migrate')}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors"
            >
              {t('admin.migration.dismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
