import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

export const PROVISIONING_API = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
export const DEFAULT_REGION = 'new-york';

export function clientApi(region?: string | null): string {
  const r = (region && region.trim()) || DEFAULT_REGION;
  return `https://mt-client-api-v1.${r}.agiliumtrade.ai`;
}

export const CLIENT_API = clientApi();

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function getMetaApiToken(): string | null {
  const token = Deno.env.get('METAAPI_TOKEN');
  return token && token.trim().length > 0 ? token : null;
}

export const MISSING_TOKEN_MESSAGE =
  'METAAPI_TOKEN is not configured. Add it in Project Settings → Secrets, then try again.';

export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

export async function metaApiFetch(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: any; text: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'auth-token': token,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  return { ok: res.ok, status: res.status, body, text };
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const raw = await req.json();
    return (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
