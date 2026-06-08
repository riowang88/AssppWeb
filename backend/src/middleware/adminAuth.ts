import { Request, Response, NextFunction } from "express";
import { adminPasswordHash, verifyAdminToken } from "../config.js";

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith("/auth/")) {
    next();
    return;
  }

  if (!adminPasswordHash) {
    res.status(403).json({ error: "Admin panel not configured" });
    return;
  }

  const token = req.headers["x-admin-token"];
  if (typeof token === "string" && verifyAdminToken(token)) {
    next();
  } else {
    res.status(401).json({ error: "Admin unauthorized" });
  }
}
