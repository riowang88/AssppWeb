import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPlist } from "../../src/apple/plist";
import { authenticate } from "../../src/apple/authenticate";
import { appleRequest } from "../../src/apple/request";
import { fetchBag } from "../../src/apple/bag";

vi.mock("../../src/apple/request", () => ({
  appleRequest: vi.fn(),
}));

vi.mock("../../src/apple/bag", () => ({
  fetchBag: vi.fn(),
  defaultAuthURL:
    "https://buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/authenticate",
}));

describe("apple/authenticate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("sets guid query exactly once from bag endpoint", async () => {
    vi.mocked(fetchBag).mockResolvedValue({
      authURL:
        "https://buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/authenticate?foo=1&guid=old-value",
    });
    vi.mocked(appleRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      rawHeaders: [],
      body: buildPlist({
        accountInfo: {
          appleId: "test@example.com",
          address: {
            firstName: "Test",
            lastName: "User",
          },
        },
        passwordToken: "token",
        dsPersonId: "123",
      }),
    });

    await authenticate(
      "test@example.com",
      "password",
      undefined,
      undefined,
      "aabbccddeeff",
    );

    const requestCall = vi.mocked(appleRequest).mock.calls[0][0];
    const endpoint = new URL(`https://${requestCall.host}${requestCall.path}`);

    expect(endpoint.searchParams.get("guid")).toBe("aabbccddeeff");
    expect(endpoint.searchParams.getAll("guid")).toHaveLength(1);
    expect(endpoint.searchParams.get("foo")).toBe("1");
  });

  it("retries the observed Apple HTML 503 response and then succeeds", async () => {
    vi.spyOn(window, "setTimeout").mockImplementation((handler: TimerHandler) => {
      if (typeof handler === "function") handler();
      return 0;
    });
    vi.mocked(fetchBag).mockResolvedValue({
      authURL:
        "https://buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/authenticate",
    });
    vi.mocked(appleRequest)
      .mockResolvedValueOnce({
        status: 503,
        statusText: "Service Temporarily Unavailable",
        headers: {},
        rawHeaders: [],
        body: `<html>
<head><title>503 Service Temporarily Unavailable`,
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        rawHeaders: [],
        body: buildPlist({
          accountInfo: {
            appleId: "test@example.com",
            address: {
              firstName: "Test",
              lastName: "User",
            },
          },
          passwordToken: "token",
          dsPersonId: "123",
        }),
      });

    const account = await authenticate(
      "test@example.com",
      "password",
      undefined,
      undefined,
      "aabbccddeeff",
    );

    expect(account.passwordToken).toBe("token");
    expect(appleRequest).toHaveBeenCalledTimes(2);
  });

  it("returns a friendly error after repeated Apple HTML responses", async () => {
    vi.spyOn(window, "setTimeout").mockImplementation((handler: TimerHandler) => {
      if (typeof handler === "function") handler();
      return 0;
    });
    vi.mocked(fetchBag).mockResolvedValue({
      authURL:
        "https://buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/authenticate",
    });
    vi.mocked(appleRequest).mockResolvedValue({
      status: 404,
      statusText: "Not Found",
      headers: {},
      rawHeaders: [],
      body: `<html>
<head><title>404 Not Found`,
    });

    await expect(
      authenticate(
        "test@example.com",
        "password",
        undefined,
        undefined,
        "aabbccddeeff",
      ),
    ).rejects.toThrow(
      "Apple authentication service returned an unexpected response.",
    );
    expect(appleRequest).toHaveBeenCalledTimes(3);
  });

  it("returns an interactive verification error after repeated Apple 403 empty responses", async () => {
    vi.spyOn(window, "setTimeout").mockImplementation((handler: TimerHandler) => {
      if (typeof handler === "function") handler();
      return 0;
    });
    vi.mocked(fetchBag).mockResolvedValue({
      authURL:
        "https://buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/authenticate",
    });
    vi.mocked(appleRequest).mockResolvedValue({
      status: 403,
      statusText: "Forbidden",
      headers: {},
      rawHeaders: [],
      body: "",
    });

    await expect(
      authenticate(
        "test@example.com",
        "password",
        undefined,
        undefined,
        "aabbccddeeff",
      ),
    ).rejects.toThrow("Apple rejected the authentication request");
    expect(appleRequest).toHaveBeenCalledTimes(3);
  });

  it("falls back to the legacy MZFinance endpoint when bag auth returns repeated HTML", async () => {
    vi.spyOn(window, "setTimeout").mockImplementation((handler: TimerHandler) => {
      if (typeof handler === "function") handler();
      return 0;
    });
    vi.mocked(fetchBag).mockResolvedValue({
      authURL: "https://auth.itunes.apple.com/auth/v1/native/fast",
    });
    vi.mocked(appleRequest)
      .mockResolvedValueOnce({
        status: 503,
        statusText: "Service Temporarily Unavailable",
        headers: {},
        rawHeaders: [],
        body: "<html><head><title>503 Service Temporarily Unavailable",
      })
      .mockResolvedValueOnce({
        status: 503,
        statusText: "Service Temporarily Unavailable",
        headers: {},
        rawHeaders: [],
        body: "<html><head><title>503 Service Temporarily Unavailable",
      })
      .mockResolvedValueOnce({
        status: 503,
        statusText: "Service Temporarily Unavailable",
        headers: {},
        rawHeaders: [],
        body: "<html><head><title>503 Service Temporarily Unavailable",
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        rawHeaders: [],
        body: buildPlist({
          accountInfo: {
            appleId: "test@example.com",
            address: {
              firstName: "Test",
              lastName: "User",
            },
          },
          passwordToken: "token",
          dsPersonId: "123",
        }),
      });

    await authenticate(
      "test@example.com",
      "password",
      undefined,
      undefined,
      "aabbccddeeff",
    );

    expect(appleRequest).toHaveBeenCalledTimes(4);
    expect(vi.mocked(appleRequest).mock.calls[0][0].host).toBe(
      "auth.itunes.apple.com",
    );
    expect(vi.mocked(appleRequest).mock.calls[3][0].host).toBe(
      "buy.itunes.apple.com",
    );
    expect(vi.mocked(appleRequest).mock.calls[3][0].path).toContain(
      "/WebObjects/MZFinance.woa/wa/authenticate",
    );
  });

  it("retries an Apple redirect response without location and then succeeds", async () => {
    vi.spyOn(window, "setTimeout").mockImplementation((handler: TimerHandler) => {
      if (typeof handler === "function") handler();
      return 0;
    });
    vi.mocked(fetchBag).mockResolvedValue({
      authURL:
        "https://buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/authenticate",
    });
    vi.mocked(appleRequest)
      .mockResolvedValueOnce({
        status: 302,
        statusText: "Found",
        headers: {},
        rawHeaders: [],
        body: "",
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        rawHeaders: [],
        body: buildPlist({
          accountInfo: {
            appleId: "test@example.com",
            address: {
              firstName: "Test",
              lastName: "User",
            },
          },
          passwordToken: "token",
          dsPersonId: "123",
        }),
      });

    const account = await authenticate(
      "test@example.com",
      "password",
      undefined,
      undefined,
      "aabbccddeeff",
    );

    expect(account.passwordToken).toBe("token");
    expect(appleRequest).toHaveBeenCalledTimes(2);
  });

  it("follows non-302 Apple redirects before parsing the response body", async () => {
    vi.mocked(fetchBag).mockResolvedValue({
      authURL: "https://auth.itunes.apple.com/auth/v1/native/fast",
    });
    vi.mocked(appleRequest)
      .mockResolvedValueOnce({
        status: 301,
        statusText: "Moved Permanently",
        headers: { location: "/auth/v1/native/fast/" },
        rawHeaders: [],
        body: "<html><head><title>Moved Permanently</title></head>",
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        rawHeaders: [],
        body: buildPlist({
          accountInfo: {
            appleId: "test@example.com",
            address: {
              firstName: "Test",
              lastName: "User",
            },
          },
          passwordToken: "token",
          dsPersonId: "123",
        }),
      });

    await authenticate(
      "test@example.com",
      "password",
      undefined,
      undefined,
      "aabbccddeeff",
    );

    expect(appleRequest).toHaveBeenCalledTimes(2);
    expect(vi.mocked(appleRequest).mock.calls[1][0].path).toContain(
      "/auth/v1/native/fast/",
    );
  });
});
