import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageContainer from '../Layout/PageContainer';
import Spinner from '../common/Spinner';
import { useAdminStore } from '../../store/admin';
import { useToastStore } from '../../store/toast';
import { authenticate, AuthenticationError } from '../../apple/authenticate';
import { storeIdToCountry } from '../../apple/config';
import { getErrorMessage } from '../../utils/error';
import type { Account } from '../../types';

export default function AdminAccountDetail() {
  const { email: rawEmail } = useParams<{ email: string }>();
  const email = rawEmail ? decodeURIComponent(rawEmail) : '';
  const navigate = useNavigate();
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { accounts, loadAccounts, saveAccount, removeAccount } = useAdminStore();
  const [account, setAccount] = useState<Account | null>(null);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);

  useEffect(() => {
    if (accounts.length === 0) {
      loadAccounts();
    }
  }, [accounts.length, loadAccounts]);

  useEffect(() => {
    const found = accounts.find((a) => a.email === email);
    if (found) setAccount(found);
  }, [accounts, email]);

  async function handleReauth() {
    if (!account) return;
    setReauthLoading(true);

    try {
      const renewed = await authenticate(
        account.email,
        account.password,
        needsCode && code ? code : undefined,
        account.cookies,
        account.deviceIdentifier,
        undefined,
        account.pod,
      );
      await saveAccount(renewed);
      setAccount(renewed);
      setNeedsCode(false);
      setCode('');
      addToast(t('admin.accounts.reauthSuccess'), 'success');
    } catch (err) {
      if (err instanceof AuthenticationError && err.codeRequired) {
        setNeedsCode(true);
        addToast(err.message, 'error');
      } else {
        addToast(getErrorMessage(err, t('admin.accounts.reauthFailed')), 'error');
      }
    } finally {
      setReauthLoading(false);
    }
  }

  async function handleDelete() {
    if (!account) return;
    if (!confirm(t('admin.accounts.deleteConfirm'))) return;
    setDeleteLoading(true);
    try {
      await removeAccount(account.email);
      addToast(t('admin.accounts.deleteSuccess'), 'success');
      navigate('/admin');
    } catch (err) {
      addToast(getErrorMessage(err, t('admin.accounts.deleteFailed')), 'error');
    } finally {
      setDeleteLoading(false);
    }
  }

  if (!account) {
    return (
      <PageContainer title={t('admin.accounts.detail')}>
        <p className="text-gray-500 dark:text-gray-400">{t('loading')}</p>
      </PageContainer>
    );
  }

  const fields = [
    { label: t('admin.accounts.fields.email'), value: account.email },
    { label: t('admin.accounts.fields.appleId'), value: account.appleId },
    { label: t('admin.accounts.fields.name'), value: `${account.firstName} ${account.lastName}` },
    { label: t('admin.accounts.fields.store'), value: storeIdToCountry(account.store) || account.store },
    { label: t('admin.accounts.fields.dsid'), value: account.directoryServicesIdentifier },
    { label: t('admin.accounts.fields.deviceId'), value: account.deviceIdentifier },
    { label: t('admin.accounts.fields.pod'), value: account.pod || '-' },
  ];

  return (
    <PageContainer title={t('admin.accounts.detail')}>
      <div className="space-y-6">
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <dl className="space-y-4">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {f.label}
                </dt>
                <dd className="mt-0.5 text-sm text-gray-900 dark:text-white font-mono break-all">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {needsCode && (
          <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('accounts.addForm.code')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('accounts.addForm.codePlaceholder')}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-base text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              autoFocus
            />
          </section>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleReauth}
            disabled={reauthLoading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {reauthLoading && <Spinner />}
            {t('admin.accounts.reauth')}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteLoading}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {deleteLoading && <Spinner />}
            {t('admin.accounts.delete')}
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('admin.accounts.back')}
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
