import { Router } from "express";
import {
  getAccountsSummary,
  getAccountWithEncryptedPassword,
  updateAccountCookies,
} from "../services/accountStore.js";

const router = Router();

router.get("/accounts", (_req, res) => {
  res.json(getAccountsSummary());
});

router.get("/accounts/:email/ctx", (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const account = getAccountWithEncryptedPassword(email);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json(account);
});

router.patch("/accounts/:email/cookies", (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const { cookies } = req.body;
  if (!Array.isArray(cookies)) {
    res.status(400).json({ error: "cookies must be an array" });
    return;
  }
  const updated = updateAccountCookies(email, cookies);
  if (!updated) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
