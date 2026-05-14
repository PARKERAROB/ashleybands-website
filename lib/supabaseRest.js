export function supabaseHeaders(key, extra = {}) {
  const headers = {
    apikey: key,
    ...extra
  };

  if (!key.startsWith("sb_publishable_")) {
    headers.Authorization = `Bearer ${key}`;
  }

  return headers;
}
