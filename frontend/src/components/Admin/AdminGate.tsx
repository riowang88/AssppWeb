import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { hashPassword } from '../Auth/PasswordGate';
import { getAdminToken, setAdminToken } from '../../api/admin';

export default function AdminGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'loading' | 'required' | 'verified' | 'disabled'>('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth/status')
      .then((r) => r.json())
      .then(async (data: { required: boolean }) => {
        if (!data.required) {
          setStatus('disabled');
          return;
        }

        const storedToken = getAdminToken();
        if (storedToken) {
          try {
            const res = await fetch('/api/admin/auth/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: storedToken }),
            });
            const result = (await res.json()) as { ok: boolean };
            if (result.ok) {
              setStatus('verified');
              return;
            }
          } catch {}
        }

        setStatus('required');
      })
      .catch(() => setStatus('disabled'));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const hash = await hashPassword(password);
      const res = await fetch('/api/admin/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hash }),
      });
      const data = (await res.json()) as { ok: boolean };

      if (data.ok) {
        setAdminToken(hash);
        setStatus('verified');
      } else {
        setError(t('admin.auth.error'));
      }
    } catch {
      setError(t('admin.auth.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">{t('loading')}</p>
      </div>
    );
  }

  if (status === 'disabled') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-2xl mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('admin.disabled.title')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('admin.disabled.description')}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'verified') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white text-2xl font-semibold mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('admin.auth.title')}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('admin.auth.placeholder')}
              autoFocus
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t('admin.auth.verifying') : t('admin.auth.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
