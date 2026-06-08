import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import PageContainer from "../Layout/PageContainer";
import { useToastStore } from "../../store/toast";
import { apiGet } from "../../api/client";
import { countryCodeMap } from "../../apple/config";

interface ServerInfo {
  uptime?: number;
  buildCommit?: string;
  buildDate?: string;
  port?: number;
  dataDir?: string;
  publicBaseUrl?: string;
  disableHttpsRedirect?: boolean;
  autoCleanupDays?: number;
  autoCleanupMaxMB?: number;
  maxDownloadMB?: number;
  downloadThreads?: number;
}

const entityTypes = [
  { value: "software", label: "iPhone" },
  { value: "iPadSoftware", label: "iPad" },
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const [country, setCountry] = useState(
    () => localStorage.getItem("asspp-default-country") || "US",
  );
  const [entity, setEntity] = useState(
    () => localStorage.getItem("asspp-default-entity") || "software",
  );
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    localStorage.setItem("asspp-default-country", country);
  }, [country]);

  useEffect(() => {
    localStorage.setItem("asspp-default-entity", entity);
  }, [entity]);

  useEffect(() => {
    apiGet<ServerInfo>("/api/settings")
      .then(setServerInfo)
      .catch(() => setServerInfo(null));
  }, []);

  const sortedCountries = Object.keys(countryCodeMap).sort((a, b) =>
    t(`countries.${a}`, a).localeCompare(t(`countries.${b}`, b)),
  );

  return (
    <PageContainer title={t("settings.title")}>
      <div className="space-y-6">
        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("settings.language.title")}
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("settings.language.label")}
              </label>
              <select
                id="language"
                value={i18n.resolvedLanguage || "en-US"}
                onChange={async (e) => {
                  const newLang = e.target.value;
                  await i18n.changeLanguage(newLang);
                  addToast(t("settings.language.changed"), "success");
                }}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-base text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                <option value="en-US">English (US)</option>
                <option value="zh-CN">简体中文</option>
                <option value="zh-TW">繁體中文</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
                <option value="ru">Русский</option>
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("settings.defaults.title")}
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="country"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("settings.defaults.country")}
              </label>
              <select
                id="country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  addToast(t("settings.defaults.countryChanged"), "success");
                }}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-base text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                {sortedCountries.map((code) => (
                  <option key={code} value={code}>
                    {t(`countries.${code}`, code)} ({code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="entity"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("settings.defaults.entity")}
              </label>
              <select
                id="entity"
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value);
                  addToast(t("settings.defaults.entityChanged"), "success");
                }}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-base text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                {entityTypes.map((et) => (
                  <option key={et.value} value={et.value}>
                    {et.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("settings.server.title")}
          </h2>
          {serverInfo ? (
            <div className="space-y-6">
              <dl className="space-y-3">
                {serverInfo.uptime != null && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("settings.server.uptime")}
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-200">
                      {formatUptime(serverInfo.uptime)}
                    </dd>
                  </div>
                )}
              </dl>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  {t("settings.server.configuration")}
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      PORT
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-200 font-mono">
                      {serverInfo.port}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      DATA_DIR
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-200 font-mono">
                      {serverInfo.dataDir}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      PUBLIC_BASE_URL
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-200 font-mono">
                      {serverInfo.publicBaseUrl || (
                        <span className="text-gray-400 dark:text-gray-500 italic">
                          {t("settings.server.notSet")}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      UNSAFE_DANGEROUSLY_DISABLE_HTTPS_REDIRECT
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-200 font-mono">
                      {serverInfo.disableHttpsRedirect
                        ? t("settings.server.enabled")
                        : t("settings.server.disabled")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      AUTO_CLEANUP_DAYS
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-200 font-mono">
                      {serverInfo.autoCleanupDays ||
                        t("settings.server.disabled")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      AUTO_CLEANUP_MAX_MB
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-200 font-mono">
                      {serverInfo.autoCleanupMaxMB ||
                        t("settings.server.disabled")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      MAX_DOWNLOAD_MB
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-200 font-mono">
                      {serverInfo.maxDownloadMB ||
                        t("settings.server.disabled")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      DOWNLOAD_THREADS
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-200 font-mono">
                      {serverInfo.downloadThreads ?? 8}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("settings.server.offline")}
            </p>
          )}
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("settings.about.title")}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("settings.about.description")}
          </p>
          {serverInfo && (
            <dl className="mt-3 space-y-2">
              {serverInfo.buildCommit &&
                serverInfo.buildCommit !== "unknown" && (
                  <div>
                    <dt className="text-xs font-medium text-gray-400 dark:text-gray-500">
                      {t("settings.about.buildCommit")}
                    </dt>
                    <dd className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {serverInfo.buildCommit.slice(0, 7)}
                    </dd>
                  </div>
                )}
              {serverInfo.buildDate && serverInfo.buildDate !== "unknown" && (
                <div>
                  <dt className="text-xs font-medium text-gray-400 dark:text-gray-500">
                    {t("settings.about.buildDate")}
                  </dt>
                  <dd className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(serverInfo.buildDate).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>
      </div>

    </PageContainer>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}
