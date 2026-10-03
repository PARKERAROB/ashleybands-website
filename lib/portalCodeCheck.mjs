// One-time code check shared by the sign-in and access-confirm routes. A request may
// compare a code only after it wins a conditional increment of code_attempts, so the
// attempt limit holds when many guesses arrive together. The winning request consumes
// the row conditionally, so a code can be used once.
export async function checkPortalCode(client, link, { matches, maxAttempts, consumePatch = {} }) {
  const used = Number(link.code_attempts) || 0;
  if (used >= maxAttempts) return false;

  const { data: reserved, error } = await client
    .from("portal_magic_links")
    .update({ code_attempts: used + 1 })
    .eq("id", link.id)
    .eq("code_attempts", used)
    .is("consumed_at", null)
    .select("id");
  if (error) throw error;
  if (reserved?.length !== 1) return false;

  const nowIso = new Date().toISOString();
  if (!matches()) {
    if (used + 1 >= maxAttempts) {
      const { error: lockError } = await client
        .from("portal_magic_links")
        .update({ consumed_at: nowIso })
        .eq("id", link.id)
        .is("consumed_at", null);
      if (lockError) throw lockError;
    }
    return false;
  }

  const { data: consumed, error: consumeError } = await client
    .from("portal_magic_links")
    .update({ ...consumePatch, consumed_at: nowIso })
    .eq("id", link.id)
    .is("consumed_at", null)
    .select("id");
  if (consumeError) throw consumeError;
  return consumed?.length === 1;
}
