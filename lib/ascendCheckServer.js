import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rehearsalDate } from "@/lib/ascendCheck.mjs";

// One rehearsal day of self checks plus the list of dates that have any (#172).
// Returns only drill number, payload and time: never the rehearsal code.
export async function loadAscendDay(asked) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asked || "") ? asked : rehearsalDate();
  const [rows, dates] = await Promise.all([
    supabaseAdmin.from("ascend_self_checks")
      .select("drill_number,payload,updated_at")
      .eq("rehearsal_date", date)
      .order("drill_number"),
    // ponytail: pulls every date's row stub; fine for one season, page it if it grows past a few thousand.
    supabaseAdmin.from("ascend_self_checks").select("rehearsal_date").order("rehearsal_date", { ascending: false }),
  ]);
  const failed = rows.error || dates.error;
  if (failed) throw new Error(failed.message);
  const counts = {};
  for (const { rehearsal_date: d } of dates.data) counts[d] = (counts[d] || 0) + 1;
  return {
    date,
    submissions: rows.data,
    dates: Object.entries(counts).map(([value, count]) => ({ value, count })),
  };
}
