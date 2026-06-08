import fs from "fs";
import path from "path";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { config, getEncryptionKey } from "../config.js";
import type { Account, AccountSummary } from "../types/index.js";

const ACCOUNTS_FILE = path.join(config.dataDir, "accounts.json");

let accounts: Account[] = [];

export function loadAccounts(): void {
  if (fs.existsSync(ACCOUNTS_FILE)) {
    try {
      const raw = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
      accounts = JSON.parse(raw);
    } catch {
      accounts = [];
    }
  }
}

function persist(): void {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
}

export function getAllAccounts(): Account[] {
  return accounts;
}

export function getAccountsSummary(): AccountSummary[] {
  return accounts.map((a) => ({
    email: a.email,
    appleId: a.appleId,
    store: a.store,
    firstName: a.firstName,
    lastName: a.lastName,
    directoryServicesIdentifier: a.directoryServicesIdentifier,
    deviceIdentifier: a.deviceIdentifier,
    pod: a.pod,
  }));
}

export function getAccount(email: string): Account | undefined {
  return accounts.find((a) => a.email === email);
}

export function upsertAccount(account: Account): void {
  const idx = accounts.findIndex((a) => a.email === account.email);
  if (idx >= 0) {
    accounts[idx] = account;
  } else {
    accounts.push(account);
  }
  persist();
}

export function deleteAccount(email: string): boolean {
  const idx = accounts.findIndex((a) => a.email === email);
  if (idx < 0) return false;
  accounts.splice(idx, 1);
  persist();
  return true;
}

export function updateAccountCookies(email: string, cookies: Account["cookies"]): boolean {
  const account = accounts.find((a) => a.email === email);
  if (!account) return false;
  account.cookies = cookies;
  persist();
  return true;
}

export function encryptPassword(password: string): { iv: string; ciphertext: string } {
  const key = Buffer.from(getEncryptionKey(), "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
  };
}

export function getAccountWithEncryptedPassword(email: string): (Omit<Account, "password"> & { password: { iv: string; ciphertext: string } }) | undefined {
  const account = accounts.find((a) => a.email === email);
  if (!account) return undefined;
  return {
    ...account,
    password: encryptPassword(account.password),
  };
}

loadAccounts();
