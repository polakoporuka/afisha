/* Шифрование ключа GitHub общим паролем. Чистый WebCrypto, без библиотек.
 * PBKDF2-SHA256 (300 000 итераций) → AES-GCM-256. Используется и сайтом, и setup_vault.html. */
(function () {
  'use strict';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const ITER = 300000;

  async function deriveKey(password, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(secret, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(secret));
    return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }
  async function decrypt(vault, password) {
    const key = await deriveKey(password, unb64(vault.salt));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.ct));
    return dec.decode(pt);
  }
  window.AfishaVault = { encrypt, decrypt };
})();
