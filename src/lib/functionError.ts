/**
 * supabase.functions.invoke() collapses any non-2xx response into the generic
 * "Edge Function returned a non-2xx status code" message, discarding the JSON
 * body the function actually returned. This reads that body back out so users
 * see the real reason a call failed.
 */
export async function functionErrorMessage(
  error: unknown,
  data: any,
  fallback: string,
): Promise<string> {
  if (data?.message) return data.message as string;

  if (error && typeof error === "object" && "context" in error) {
    try {
      const ctx = (error as any).context;
      const body = typeof ctx?.json === "function" ? await ctx.json() : null;
      if (body?.message) return body.message as string;
    } catch {
      /* body already consumed or not JSON */
    }
  }

  const msg = (error as any)?.message;
  if (msg && !/non-2xx status code/i.test(msg)) return msg as string;
  return "We got an error on our end — we'll fix it as soon as possible. Please try again shortly.";
}
