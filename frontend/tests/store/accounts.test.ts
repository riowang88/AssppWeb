import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountsStore } from "../../src/store/accounts";
import type { Account, AccountSummary } from "../../src/types";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  decryptPassword: vi.fn(),
}));

vi.mock("../../src/api/client", () => ({
  apiGet: mocks.apiGet,
  apiPatch: mocks.apiPatch,
}));

vi.mock("../../src/utils/decrypt", () => ({
  decryptPassword: mocks.decryptPassword,
}));

const mockSummary: AccountSummary = {
  email: "test@example.com",
  appleId: "test@example.com",
  store: "143441",
  firstName: "Test",
  lastName: "User",
  directoryServicesIdentifier: "dsid123",
  deviceIdentifier: "aabbccddeeff",
  pod: "25",
};

const mockAccount: Account = {
  ...mockSummary,
  password: "secret",
  passwordToken: "token123",
  cookies: [],
};

describe("store/accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAccountsStore.setState({ accounts: [], loading: true });
  });

  it("loads account summaries from the API", async () => {
    mocks.apiGet.mockResolvedValueOnce([mockSummary]);

    await useAccountsStore.getState().loadAccounts();

    expect(mocks.apiGet).toHaveBeenCalledWith("/api/accounts");
    expect(useAccountsStore.getState().accounts).toEqual([mockSummary]);
    expect(useAccountsStore.getState().loading).toBe(false);
  });

  it("clears summaries when loading fails", async () => {
    mocks.apiGet.mockRejectedValueOnce(new Error("offline"));

    await useAccountsStore.getState().loadAccounts();

    expect(useAccountsStore.getState().accounts).toEqual([]);
    expect(useAccountsStore.getState().loading).toBe(false);
  });

  it("decrypts the password when fetching download context", async () => {
    const encryptedPassword = { iv: "iv", ciphertext: "ciphertext" };
    mocks.apiGet.mockResolvedValueOnce({
      ...mockAccount,
      password: encryptedPassword,
    });
    mocks.decryptPassword.mockResolvedValueOnce("secret");

    const account = await useAccountsStore
      .getState()
      .getDownloadContext(mockAccount.email);

    expect(mocks.apiGet).toHaveBeenCalledWith(
      "/api/accounts/test%40example.com/ctx",
    );
    expect(mocks.decryptPassword).toHaveBeenCalledWith(encryptedPassword);
    expect(account.password).toBe("secret");
  });

  it("updates cookies through the account API", async () => {
    mocks.apiPatch.mockResolvedValueOnce({ ok: true });

    await useAccountsStore
      .getState()
      .updateCookies(mockAccount.email, mockAccount.cookies);

    expect(mocks.apiPatch).toHaveBeenCalledWith(
      "/api/accounts/test%40example.com/cookies",
      { cookies: mockAccount.cookies },
    );
  });

  it("updates the reauthenticated session without sending the password", async () => {
    mocks.apiPatch.mockResolvedValueOnce({ ok: true });

    await useAccountsStore.getState().updateSession(mockAccount);

    expect(mocks.apiPatch).toHaveBeenCalledWith(
      "/api/accounts/test%40example.com/session",
      expect.objectContaining({
        appleId: mockAccount.appleId,
        passwordToken: mockAccount.passwordToken,
        directoryServicesIdentifier: mockAccount.directoryServicesIdentifier,
        cookies: mockAccount.cookies,
        pod: mockAccount.pod,
      }),
    );
    const payload = mocks.apiPatch.mock.calls[0][1];
    expect(payload.password).toBeUndefined();
    expect(payload.deviceIdentifier).toBeUndefined();
  });
});
