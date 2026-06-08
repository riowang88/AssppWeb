import { getAccessToken } from '../components/Auth/PasswordGate';

const FALLBACK_KEY_SOURCE = 'asspp-default-key';

async function getDecryptionKey(): Promise<CryptoKey> {
  const token = getAccessToken() || await hashString(FALLBACK_KEY_SOURCE);
  const keyData = hexToBytes(token);
  return crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
}

async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function decryptPassword(encrypted: { iv: string; ciphertext: string }): Promise<string> {
  const key = await getDecryptionKey();
  const iv = base64ToBytes(encrypted.iv);
  const ciphertextWithTag = base64ToBytes(encrypted.ciphertext);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertextWithTag.buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(decrypted);
}
