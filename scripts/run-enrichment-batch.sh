#!/bin/zsh
# Resume the sponsorship email-enrichment batch. Designed to run unattended via
# launchd after the firecrawl monthly credit resets. Resumable + limit-safe:
# enrich-contacts-firecrawl.mjs skips already-done leads and stops cleanly if the
# credit runs out again, so this can run month after month until all are covered.
#
# launchd gives a minimal environment, so set PATH explicitly (node + firecrawl
# live in the nvm bin). firecrawl reads its login from its own config dir; the
# scripts read .env.local by absolute path.

export PATH="/Users/parkerarob/.nvm/versions/node/v20.19.3/bin:/usr/local/bin:/usr/bin:/bin"
APP="/Users/parkerarob/Atlas/band-website"
LOG="/Users/parkerarob/Atlas/BandsofAHS/data/_work/batch-$(date +%Y%m%d-%H%M).log"
PLIST="$HOME/Library/LaunchAgents/com.ahsband.enrichment-resume.plist"

cd "$APP" || exit 1
{
  echo "=== enrichment batch start $(date) ==="
  echo "--- firecrawl status ---"; firecrawl --status 2>&1 | grep -i credit
  echo "--- 1. enrich (resumable, stops on limit) ---"
  node scripts/enrich-contacts-firecrawl.mjs
  echo "--- 2. merge new emails into Supabase ---"
  node scripts/apply-contact-enrichment.mjs
  echo "--- 3. refresh HTML view ---"
  node scripts/generate-prospect-view.mjs
  echo "=== batch done $(date) ==="
} >> "$LOG" 2>&1

# Self-remove ONLY if the enrichment finished all leads (log says "DONE." and not
# "LIMIT REACHED"). If credits ran out again, leave the job armed so it retries
# next month automatically — but bump its month so it fires on the next reset.
if grep -q "^DONE\." "$LOG" && ! grep -q "LIMIT REACHED" "$LOG"; then
  /bin/launchctl unload "$PLIST" 2>/dev/null
  /bin/rm -f "$PLIST" 2>/dev/null
else
  # advance to the 14th of next month so it re-fires after the next credit reset
  NEXT_MONTH=$(/bin/date -v+1m +%m | /usr/bin/sed 's/^0//')
  /usr/bin/sed -i '' -E "s#(<key>Month</key><integer>)[0-9]+#\1${NEXT_MONTH}#" "$PLIST" 2>/dev/null
  /bin/launchctl unload "$PLIST" 2>/dev/null
  /bin/launchctl load "$PLIST" 2>/dev/null
fi
