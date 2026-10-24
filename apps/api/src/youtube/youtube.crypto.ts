import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Cifrado de los tokens de Google en la BD (AES-256-GCM) y firma del `state` de OAuth.
 * La clave sale de `TOKEN_ENCRYPTION_KEY` (cualquier texto largo; se normaliza con SHA-256).
 */
export class TokenCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (!secret) throw new Error('Falta TOKEN_ENCRYPTION_KEY (o GOOGLE_CLIENT_SECRET) para cifrar los tokens');
    this.key = createHash('sha256').update(`sintonia:tokens:${secret}`).digest();
  }

  /** `v1.<iv>.<tag>.<cifrado>` en base64url. */
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
  }

  decrypt(value: string): string {
    const [version, iv, tag, data] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Token cifrado con un formato desconocido');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }

  /** Firma corta para el `state` de OAuth (HMAC-SHA256). */
  sign(payload: string): string {
    return createHmac('sha256', this.key).update(`state:${payload}`).digest('base64url');
  }
}

export interface OAuthState {
  /** Persona anónima que inicia la conexión. */
  user: string;
  /** Valor aleatorio que también va en una cookie HttpOnly: liga el `state` a este navegador. */
  nonce: string;
  /** Caducidad (ms desde epoch). */
  exp: number;
}

/** `state` = payload en base64url + "." + firma. No es secreto, pero no se puede falsificar. */
export function createState(cipher: TokenCipher, user: string, ttlMs = 10 * 60_000, now = Date.now()) {
  const state: OAuthState = { user, nonce: randomBytes(16).toString('base64url'), exp: now + ttlMs };
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return { state, value: `${payload}.${cipher.sign(payload)}` };
}

/** Comprueba firma, caducidad y que el nonce coincide con el de la cookie del navegador. */
export function verifyState(cipher: TokenCipher, value: string, cookieNonce: string | undefined, now = Date.now()): OAuthState {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) throw new Error('state mal formado');
  const expected = Buffer.from(cipher.sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new Error('state con firma no válida');
  const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
  if (state.exp < now) throw new Error('state caducado');
  if (!cookieNonce || cookieNonce !== state.nonce) throw new Error('state de otro navegador');
  return state;
}
