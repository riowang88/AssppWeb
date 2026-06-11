import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDownloadAction } from "../../src/hooks/useDownloadAction";
import type { Account, Software } from "../../src/types";

class TestPurchaseError extends Error {
  constructor(
    message: string,
    public readonly reauthenticationRequired: boolean,
  ) {
    super(message);
  }
}

const mocks = vi.hoisted(() => ({
  updateCookies: vi.fn(),
  updateSession: vi.fn(),
  addToast: vi.fn(),
  fetchTasks: vi.fn(),
  authenticate: vi.fn(),
  purchaseApp: vi.fn(),
}));

vi.mock("../../src/hooks/useAccounts", () => ({
  useAccounts: () => ({
    getDownloadContext: vi.fn(),
    updateCookies: mocks.updateCookies,
    updateSession: mocks.updateSession,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.appName ? `${key}:${values.appName}` : key,
  }),
}));

vi.mock("../../src/store/toast", () => ({
  useToastStore: (
    selector: (state: { addToast: typeof mocks.addToast }) => unknown,
  ) => selector({ addToast: mocks.addToast }),
}));

vi.mock("../../src/store/downloads", () => ({
  useDownloadsStore: (
    selector: (state: { fetchTasks: typeof mocks.fetchTasks }) => unknown,
  ) => selector({ fetchTasks: mocks.fetchTasks }),
}));

vi.mock("../../src/api/client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("../../src/apple/download", () => ({
  getDownloadInfo: vi.fn(),
}));

vi.mock("../../src/apple/authenticate", () => ({
  authenticate: mocks.authenticate,
}));

vi.mock("../../src/apple/purchase", () => ({
  isPurchaseReauthenticationRequired: (error: unknown) =>
    Boolean((error as { reauthenticationRequired?: boolean }).reauthenticationRequired),
  purchaseApp: mocks.purchaseApp,
}));

describe("useDownloadAction", () => {
  const account: Account = {
    email: "test@example.com",
    password: "password",
    appleId: "test@example.com",
    store: "143441",
    firstName: "Test",
    lastName: "User",
    passwordToken: "old-token",
    directoryServicesIdentifier: "old-dsid",
    cookies: [],
    deviceIdentifier: "aabbccddeeff",
    pod: "33",
  };

  const renewedAccount: Account = {
    ...account,
    passwordToken: "new-token",
    directoryServicesIdentifier: "new-dsid",
    cookies: [{ name: "mz", value: "1", path: "/", httpOnly: true, secure: true }],
    pod: "25",
  };

  const app: Software = {
    id: 123,
    bundleID: "com.example.app",
    name: "Example",
    version: "1.0",
    price: 0,
    artistName: "Example Inc.",
    sellerName: "Example Inc.",
    description: "Example app",
    averageUserRating: 0,
    userRatingCount: 0,
    artworkUrl: "",
    screenshotUrls: [],
    minimumOsVersion: "15.0",
    releaseDate: "2026-01-01",
    primaryGenreName: "Utilities",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reauthenticates and retries license acquisition once when the token expired", async () => {
    mocks.purchaseApp
      .mockRejectedValueOnce(new TestPurchaseError("expired", true))
      .mockResolvedValueOnce({ updatedCookies: renewedAccount.cookies });
    mocks.authenticate.mockResolvedValueOnce(renewedAccount);

    const { result } = renderHook(() => useDownloadAction());

    await result.current.acquireLicense(account, app);

    expect(mocks.authenticate).toHaveBeenCalledTimes(1);
    expect(mocks.authenticate).toHaveBeenCalledWith(
      account.email,
      account.password,
      undefined,
      undefined,
      account.deviceIdentifier,
      expect.objectContaining({ traceId: expect.any(String) }),
      account.pod,
    );
    expect(mocks.updateSession).toHaveBeenCalledWith(renewedAccount);
    expect(mocks.purchaseApp).toHaveBeenCalledTimes(2);
    expect(mocks.purchaseApp).toHaveBeenLastCalledWith(
      renewedAccount,
      app,
      expect.objectContaining({ action: "purchase-retry" }),
    );
    expect(mocks.updateCookies).toHaveBeenCalledWith(
      renewedAccount.email,
      renewedAccount.cookies,
    );
  });

  it("does not loop when reauthentication fails", async () => {
    const authError = new Error("Apple authentication service returned an unexpected response.");
    mocks.purchaseApp.mockRejectedValueOnce(
      new TestPurchaseError("expired", true),
    );
    mocks.authenticate.mockRejectedValueOnce(authError);

    const { result } = renderHook(() => useDownloadAction());

    await expect(result.current.acquireLicense(account, app)).rejects.toThrow(
      authError.message,
    );
    expect(mocks.authenticate).toHaveBeenCalledTimes(1);
    expect(mocks.purchaseApp).toHaveBeenCalledTimes(1);
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("uses the supplied verification code when continuing reauthentication", async () => {
    mocks.purchaseApp
      .mockRejectedValueOnce(new TestPurchaseError("expired", true))
      .mockResolvedValueOnce({ updatedCookies: renewedAccount.cookies });
    mocks.authenticate.mockResolvedValueOnce(renewedAccount);

    const { result } = renderHook(() => useDownloadAction());

    await result.current.acquireLicense(account, app, "123456");

    expect(mocks.authenticate).toHaveBeenCalledWith(
      account.email,
      account.password,
      "123456",
      undefined,
      account.deviceIdentifier,
      expect.objectContaining({ traceId: expect.any(String) }),
      account.pod,
    );
  });
});
