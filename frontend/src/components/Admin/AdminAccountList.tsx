import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import MigrationBanner from './MigrationBanner';
import { useAdminStore } from '../../store/admin';
import { storeIdToCountry } from '../../apple/config';

export default function AdminAccountList() {
  const { t } = useTranslation();
  const { accounts, loading, loadAccounts } = useAdminStore();

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return (
    <PageContainer
      title={t('admin.accounts.title')}
      action={
        <Link
          to="/admin/accounts/add"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('admin.accounts.add')}
        </Link>
      }
    >
      <MigrationBanner />
      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">{t('loading')}</p>
      ) : accounts.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center bg-gray-50 dark:bg-gray-900/30">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {t('admin.accounts.empty')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('admin.accounts.emptyDescription')}
          </p>
          <Link
            to="/admin/accounts/add"
            className="inline-flex px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('admin.accounts.add')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Link
              key={account.email}
              to={`/admin/accounts/${encodeURIComponent(account.email)}`}
              className="block bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {account.firstName} {account.lastName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {account.email}
                  </p>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                  {storeIdToCountry(account.store) || account.store}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
