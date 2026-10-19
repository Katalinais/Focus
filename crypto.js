// crypto.js — Web Crypto API helpers (Session 22): hashing, a real
// password-derived key (PBKDF2), and AES-GCM encrypt/decrypt.

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Derives a real, reproducible AES-GCM key from a user password and a
// salt: the same password + salt always produce the same key. Unlike
// crypto.subtle.generateKey(), nothing here is lost on reload — as long
// as the salt (not secret, but required) is kept, e.g. in IndexedDB.
export async function deriveKeyFromPassword(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { ciphertext, iv }; // the IV isn't secret, it travels with the ciphertext
}

export async function decryptText(key, { ciphertext, iv }) {
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(data);
}
