// Cliente mínimo de OAuth de Google y de la YouTube Data API v3, con fetch y sin
// librerías no oficiales. Cada llamada suma sus unidades de cuota (10 000/día por proyecto).

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API_URL = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube';
const TIMEOUT_MS = 15_000;

/** Coste en unidades de cada operación (las lecturas, 1 por página; insertar, 50). */
export const QUOTA_COST = { read: 1, insert: 50 } as const;

/** Google rechazó el refresh token (caducado a los 7 días en modo de pruebas, o revocado). */
export class ReconnectRequiredError extends Error {}
/** Se acabó la cuota diaria del proyecto en la YouTube Data API. */
export class QuotaExceededError extends Error {}
/** Error de la API con su código HTTP y su motivo (`playlistNotFound`, `forbidden`…). */
export class YouTubeApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    message: string,
  ) {
    super(message);
  }
}

export interface GoogleTokens {
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
}

export class GoogleOAuth {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  get configured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** `prompt=consent` + `access_type=offline` para recibir siempre un refresh token. */
  authUrl(redirectUri: string, state: string): string {
    const qs = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: YOUTUBE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${AUTH_URL}?${qs}`;
  }

  exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
    return this.token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  }

  refresh(refreshToken: string): Promise<GoogleTokens> {
    return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  /** Revoca el permiso en la cuenta de Google. Si falla (ya revocado), no pasa nada. */
  async revoke(token: string) {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => undefined);
  }

  private async token(params: Record<string, string>): Promise<GoogleTokens> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, ...params }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, string | number | undefined>;
    if (!res.ok) {
      if (body.error === 'invalid_grant') throw new ReconnectRequiredError('Google ha caducado o revocado el permiso');
      throw new Error(`OAuth de Google: ${body.error ?? res.status} ${body.error_description ?? ''}`.trim());
    }
    return {
      accessToken: String(body.access_token),
      // Un minuto de margen para no usar un token a punto de caducar.
      expiresAt: new Date(Date.now() + (Number(body.expires_in ?? 3600) - 60) * 1000),
      refreshToken: body.refresh_token ? String(body.refresh_token) : undefined,
    };
  }
}

/** Llamadas a la Data API con el token de una persona. Cuenta la cuota gastada. */
export class YouTubeApi {
  quotaUnits = 0;

  constructor(private readonly accessToken: () => Promise<string>) {}

  get<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.call<T>('GET', path, params, undefined, QUOTA_COST.read);
  }

  insert<T>(path: string, params: Record<string, string>, body: unknown): Promise<T> {
    return this.call<T>('POST', path, params, body, QUOTA_COST.insert);
  }

  private async call<T>(method: string, path: string, params: Record<string, string | number | boolean | undefined>, body: unknown, cost: number): Promise<T> {
    const qs = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
    );
    this.quotaUnits += cost;
    const res = await fetch(`${API_URL}/${path}?${qs}`, {
      method,
      headers: { authorization: `Bearer ${await this.accessToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return (await res.json()) as T;
    const error = ((await res.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[] } }).error;
    const reason = error?.errors?.[0]?.reason ?? '';
    if (/quotaExceeded|dailyLimitExceeded/.test(reason)) {
      throw new QuotaExceededError('Se ha agotado la cuota diaria de la YouTube Data API; vuelve a intentarlo mañana');
    }
    if (res.status === 401) throw new ReconnectRequiredError('Google ha rechazado el token de acceso');
    throw new YouTubeApiError(res.status, reason, `YouTube ${res.status} ${reason}: ${error?.message ?? ''}`.trim());
  }
}
