// Acceso PRO: permisos, códigos de campaña y administradores.
// El permiso se decide siempre acá, en el servidor, con el usuario de la sesión.
import { json, requireUser, sha256Hex } from './lib.js';

export const PRODUCT = 'kit-feriante-pro';
const DAY = 86_400_000;

// Sin 0/O ni 1/I: se dictan y se copian sin confusiones. 32 símbolos (256 es múltiplo de 32,
// así que b % 32 no tiene sesgo) → 5 bits cada uno.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
if (ALPHABET.length !== 32) throw new Error('ALPHABET debe tener 32 símbolos');
const PREFIX = 'FERIA';

// Código nuevo: FERIA-XXXX-XXXX (8 símbolos al azar, ~40 bits).
export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const s = [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join('');
  return `${PREFIX}-${s.slice(0, 4)}-${s.slice(4)}`;
}

// Lo que escribe la persona → forma canónica (o null si no puede ser un código).
// Acepta minúsculas, espacios, guiones y que falte el prefijo.
export function normalizeCode(input) {
  if (typeof input !== 'string') return null;
  let s = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.length === 8) s = PREFIX + s;
  if (s.length !== PREFIX.length + 8 || !s.startsWith(PREFIX)) return null;
  const body = s.slice(PREFIX.length);
  if ([...body].some(c => !ALPHABET.includes(c))) return null;
  return `${PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`;
}

export const codeHash = code => sha256Hex(code);
export const daysToMs = days => days * DAY;

// Permiso vigente o null. Si la migración 0004 todavía no se aplicó, nadie tiene PRO.
export async function getEntitlement(env, userId, product = PRODUCT, now = Date.now()) {
  return env.DB.prepare(
    `SELECT e.id, e.source, e.starts_at, e.ends_at, c.label FROM entitlements e
     LEFT JOIN access_codes c ON e.source = 'code' AND c.id = e.ref
     WHERE e.user_id = ? AND e.product = ? AND e.status = 'active' AND e.starts_at <= ? AND e.ends_at > ?
     ORDER BY e.ends_at DESC LIMIT 1`
  ).bind(userId, product, now, now).first().catch(() => null);
}

// Para los endpoints que guardan datos PRO (Paso 3): usuario con PRO vigente, o una Response.
export async function requirePro(context, product = PRODUCT) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const ent = await getEntitlement(context.env, user.id, product);
  return ent ? { user, entitlement: ent } : json({ error: 'pro_required' }, 403);
}

// Administradores: emails en la variable ADMIN_EMAILS (panel de Cloudflare), separados por coma.
export function isAdmin(user, env) {
  if (!user?.email || !env.ADMIN_EMAILS) return false;
  const list = String(env.ADMIN_EMAILS).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(String(user.email).toLowerCase());
}

export async function requireAdmin(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  return isAdmin(user, context.env) ? user : json({ error: 'forbidden' }, 403);
}

export const audit = (env, user, action, target) =>
  env.DB.prepare('INSERT INTO admin_audit (admin_user_id, action, target, at) VALUES (?, ?, ?, ?)')
    .bind(user.id, action, target ?? null, Date.now());
