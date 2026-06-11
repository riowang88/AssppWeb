import { useTranslation } from 'react-i18next';
import { useAccounts } from './useAccounts';
import { useToastStore } from '../store/toast';
import { useDownloadsStore } from '../store/downloads';
import { getDownloadInfo } from '../apple/download';
import {
  isPurchaseReauthenticationRequired,
  purchaseApp,
} from '../apple/purchase';
import { authenticate } from '../apple/authenticate';
import { apiGet, apiPost } from '../api/client';
import { accountHash } from '../utils/account';
import { getErrorMessage } from '../utils/error';
import { getAccountContext } from '../utils/toast';
import type { Account, AccountSummary, Software } from '../types';

export function useDownloadAction() {
  const { getDownloadContext, updateCookies, updateSession } = useAccounts();
  const addToast = useToastStore((s) => s.addToast);
  const fetchTasks = useDownloadsStore((s) => s.fetchTasks);
  const { t } = useTranslation();

  async function startDownload(
    account: Account,
    app: Software,
    versionId?: string,
  ) {
    const ctx = getAccountContext(account, t);
    const appName = app.name;

    try {
      const settings = await apiGet<{ maxDownloadMB: number }>('/api/settings');
      if (settings.maxDownloadMB > 0 && app.fileSizeBytes) {
        const sizeMB = parseInt(app.fileSizeBytes, 10) / (1024 * 1024);
        if (sizeMB > settings.maxDownloadMB) {
          addToast(
            t('toast.downloadLimit.message', {
              appName,
              size: sizeMB.toFixed(2),
              limit: settings.maxDownloadMB,
            }),
            'error',
            t('toast.title.downloadLimit'),
          );
          return;
        }
      }
    } catch {
      // Settings fetch failed — backend will still enforce the limit
    }

    const { output, updatedCookies } = await getDownloadInfo(
      account,
      app,
      versionId,
    );
    await updateCookies(account.email, updatedCookies);
    const hash = await accountHash(account);

    await apiPost('/api/downloads', {
      software: { ...app, version: output.bundleShortVersionString },
      accountHash: hash,
      downloadURL: output.downloadURL,
      sinfs: output.sinfs,
      iTunesMetadata: output.iTunesMetadata,
    });

    fetchTasks();

    addToast(
      t('toast.msg', { appName, ...ctx }),
      'info',
      t('toast.title.downloadStarted'),
    );
  }

  async function acquireLicense(
    account: Account,
    app: Software,
    reauthenticationCode?: string,
  ) {
    const ctx = getAccountContext(account, t);
    const appName = app.name;
    const result = await purchaseWithReauthentication(
      account,
      app,
      reauthenticationCode,
    );
    await updateCookies(result.account.email, result.updatedCookies);

    addToast(
      t('toast.msg', { appName, ...ctx }),
      'success',
      t('toast.title.licenseSuccess'),
    );
  }

  async function purchaseWithReauthentication(
    account: Account,
    app: Software,
    reauthenticationCode?: string,
  ) {
    try {
      const result = await purchaseApp(account, app);
      return { account, updatedCookies: result.updatedCookies };
    } catch (error) {
      if (!isPurchaseReauthenticationRequired(error)) {
        throw error;
      }

      const renewed = await authenticate(
        account.email,
        account.password,
        reauthenticationCode,
        undefined,
        account.deviceIdentifier,
      );
      await updateSession(renewed);

      const result = await purchaseApp(renewed, app);
      return { account: renewed, updatedCookies: result.updatedCookies };
    }
  }

  function toastDownloadError(account: Account | AccountSummary, app: Software, error: unknown) {
    const ctx = getAccountContext(account, t);
    addToast(
      t('toast.msgFailed', {
        appName: app.name,
        ...ctx,
        error: getErrorMessage(error, t('toast.title.downloadFailed')),
      }),
      'error',
      t('toast.title.downloadFailed'),
    );
  }

  function toastLicenseError(account: Account | AccountSummary, app: Software, error: unknown) {
    const ctx = getAccountContext(account, t);
    addToast(
      t('toast.msgFailed', {
        appName: app.name,
        ...ctx,
        error: getErrorMessage(error, t('toast.title.licenseFailed')),
      }),
      'error',
      t('toast.title.licenseFailed'),
    );
  }

  return {
    startDownload,
    acquireLicense,
    getDownloadContext,
    toastDownloadError,
    toastLicenseError,
  };
}
