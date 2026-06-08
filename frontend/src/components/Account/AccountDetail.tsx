import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import { useAccounts } from '../../hooks/useAccounts';
import { storeIdToCountry } from '../../apple/config';

export default function AccountDetail() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { accounts, loading: storeLoading, loadAccounts } = useAccounts();

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const decodedEmail = email ? decodeURIComponent(email) : '';
  const account = accounts.find((a) => a.email === decodedEmail);

  if (storeLoading) {
    return (
      <PageContainer title={t('accounts.title')}>
        <div className="text-center text-gray-500 py-12">{t('loading')}</div>
      </PageContainer>
    );
  }

  if (!account) {
    return (
      <PageContainer title={t('accounts.title')}>
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">{t('accounts.detail.notFound')}</p>
          <button
            onClick={() => navigate('/accounts')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {t('accounts.detail.back')}
          </button>
        </div>
      </PageContainer>
    );
  }

  const countryCode = storeIdToCountry(account.store);
  const displayRegion = countryCode
    ? `${t(`countries.${countryCode}`, countryCode)} (${account.store})`
    : account.store;

  return (
    <PageContainer title={t('accounts.detail.title')}>
      <div className="max-w-lg space-y-6">
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <dl className="space-y-4">
            <DetailRow
              label={t('accounts.detail.name')}
              value={`${account.firstName} ${account.lastName}`}
            />
            <DetailRow
              label={t('accounts.detail.email')}
              value={account.email}
            />
            <DetailRow
              label={t('accounts.detail.appleId')}
              value={account.appleId || account.email}
            />
            <DetailRow
              label={t('accounts.detail.storeRegion')}
              value={displayRegion}
            />
            <DetailRow
              label={t('accounts.detail.dsid')}
              value={account.directoryServicesIdentifier}
            />
            <DetailRow
              label={t('accounts.detail.deviceId')}
              value={account.deviceIdentifier}
            />
            {account.pod && (
              <DetailRow label={t('accounts.detail.pod')} value={account.pod} />
            )}
          </dl>
        </section>

        <button
          onClick={() => navigate('/accounts')}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors inline-block"
        >
          {t('accounts.detail.back')}
        </button>
      </div>
    </PageContainer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-white break-all">
        {value || '--'}
      </dd>
    </div>
  );
}
