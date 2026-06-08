import { Router } from "express";
import { adminPasswordHash, verifyAdminToken } from "../config.js";
import {
  getAllAccounts,
  upsertAccount,
  deleteAccount,
} from "../services/accountStore.js";
import type { Account } from "../types/index.js";

const router = Router();

router.get("/auth/status", (_req, res) => {
  res.json({ required: !!adminPasswordHash });
});

router.post("/auth/verify", (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token || !verifyAdminToken(token)) {
    res.json({ ok: false });
    return;
  }
  res.json({ ok: true });
});

router.get("/accounts", (_req, res) => {
  res.json(getAllAccounts());
});

router.post("/accounts", (req, res) => {
  const account = req.body as Account;
  if (!account.email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  upsertAccount(account);
  res.status(201).json({ ok: true });
});

router.delete("/accounts/:email", (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const deleted = deleteAccount(email);
  if (!deleted) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
