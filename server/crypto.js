// Cifrado del contenido de los usuarios (textos, borradores, grupos de hashtags).
// La clave sale del Secreto TEXT_KEY de Cloudflare: una frase larga que solo existe en el
// panel y en el gestor de contraseñas de la dueña. Si se pierde, lo guardado queda ilegible.
//
// Formato guardado: "enc:v1:" + base64(iv de 12 bytes ‖ cifrado AES-GCM).

const PREFIX = 'enc:v1:';
const keys = new Map(); // frase → CryptoKey, por instancia

export class MissingKeyError extends Error {}

async function getKey(env) {
  const secret = env.TEXT_KEY;
  if (!secret) throw new MissingKeyError('TEXT_KEY no configurada');
  if (!keys.has(secret)) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'HKDF', false, ['deriveKey']);
    keys.set(secret, crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('relab'), info: new TextEncoder().encode('relab-text-v1') },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
    ));
  }
  return keys.get(secret);
}

const toB64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

export async function encryptText(env, str) {
  if (!str) return '';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(env), new TextEncoder().encode(str)));
  const out = new Uint8Array(iv.length + data.length);
  out.set(iv); out.set(data, iv.length);
  return PREFIX + toB64(out);
}

// true si hay contenido guardado de antes del cifrado (texto plano).
export const needsEncryption = str => typeof str === 'string' && str !== '' && !str.startsWith(PREFIX);

// Lo que no tiene el prefijo (datos de antes del cifrado) se devuelve tal cual.
export async function decryptText(env, str) {
  if (typeof str !== 'string' || !str.startsWith(PREFIX)) return str ?? '';
  const raw = fromB64(str.slice(PREFIX.length));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await getKey(env), raw.slice(12));
  return new TextDecoder().decode(plain);
}
