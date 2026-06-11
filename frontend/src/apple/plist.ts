export function buildPlist(obj: Record<string, any>): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    buildNode(obj),
    "</plist>",
  ].join("\n");
}

function buildNode(value: any): string {
  if (value === null || value === undefined) return "<string></string>";
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `<data>${btoa(binary)}</data>`;
  }
  if (value instanceof Date) {
    return `<date>${value.toISOString()}</date>`;
  }
  if (typeof value === "string") return `<string>${escapeXml(value)}</string>`;
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? `<integer>${value}</integer>`
      : `<real>${value}</real>`;
  }
  if (typeof value === "boolean") return value ? "<true/>" : "<false/>";
  if (Array.isArray(value))
    return `<array>${value.map(buildNode).join("")}</array>`;
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([k, v]) => `<key>${escapeXml(k)}</key>${buildNode(v)}`)
      .join("");
    return `<dict>${entries}</dict>`;
  }
  return `<string>${escapeXml(String(value))}</string>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type PlistParseErrorKind = "empty" | "non-plist" | "invalid-xml";

export class PlistParseError extends Error {
  constructor(
    message: string,
    public readonly kind: PlistParseErrorKind,
  ) {
    super(message);
    this.name = "PlistParseError";
  }
}

// Native browser plist parser — avoids @xmldom/xmldom bundling issues
export function parsePlist(xml: string): any {
  const normalized = normalizePlistXML(xml);
  if (!normalized.trim()) {
    throw new PlistParseError("Invalid plist: empty response", "empty");
  }

  const doc = new DOMParser().parseFromString(normalized, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new PlistParseError("Invalid plist: malformed XML", "invalid-xml");
  }

  const root = doc.documentElement;
  if (root.nodeName !== "plist") {
    throw new PlistParseError(
      "Apple returned a non-plist response",
      "non-plist",
    );
  }
  const firstChild = root.firstElementChild;
  if (!firstChild) {
    throw new PlistParseError("Invalid plist: empty <plist> element", "empty");
  }
  return parseNode(firstChild);
}

function normalizePlistXML(xml: string): string {
  let normalized = xml.trim();
  if (!normalized) return normalized;

  const plistMatch = normalized.match(/<plist\b[\s\S]*?<\/plist>/i);
  if (plistMatch) return plistMatch[0].trim();

  const dictMatch = normalized.match(/<dict\b[\s\S]*?<\/dict>/i);
  if (dictMatch) {
    return wrapPlist(dictMatch[0].trim());
  }

  if (/<key\b/i.test(normalized)) {
    const documentMatch = normalized.match(/<Document\b[^>]*>([\s\S]*?)<\/Document>/i);
    if (documentMatch?.[1]) {
      normalized = documentMatch[1].trim();
    }
    return wrapPlist(`<dict>${normalized}</dict>`);
  }

  return normalized;
}

function wrapPlist(body: string): string {
  return `<plist version="1.0">${body}</plist>`;
}

function parseNode(node: Element): any {
  switch (node.nodeName) {
    case "dict": {
      const result: Record<string, any> = {};
      const children = Array.from(node.children);
      for (let i = 0; i < children.length; i += 2) {
        if (children[i].nodeName !== "key") continue;
        const key = children[i].textContent || "";
        const value =
          i + 1 < children.length ? parseNode(children[i + 1]) : null;
        result[key] = value;
      }
      return result;
    }
    case "array":
      return Array.from(node.children).map(parseNode);
    case "string":
      return node.textContent || "";
    case "integer":
      return parseInt(node.textContent || "0", 10);
    case "real":
      return parseFloat(node.textContent || "0");
    case "true":
      return true;
    case "false":
      return false;
    case "date":
      return new Date(node.textContent || "");
    case "data": {
      const b64 = (node.textContent || "").trim();
      const binaryStr = atob(b64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return bytes;
    }
    default:
      return node.textContent || "";
  }
}
