-- Parent portal: magic-link -> 6-digit email code (OTP).
--
-- Microsoft Defender "Safe Links" detonates link URLs in a JS-executing sandbox
-- before the human ever clicks, which fired the portal pages' on-mount POST and
-- burned the single-use magic token. An emailed code has nothing to detonate.
--
-- token_hash now holds an email-salted hash of the 6-digit code
-- (hashCode(email, code) in lib/portalTokens.js). Codes are NOT globally unique
-- (two families can hold 123456 at once), so:
--   1. drop the UNIQUE on token_hash, and
--   2. add code_attempts to back the 5-try lockout.
-- Verification now looks up the active row by (email, purpose) and compares the
-- salted hash, instead of looking up by the token alone.

alter table portal_magic_links
  drop constraint if exists portal_magic_links_token_hash_key;

alter table portal_magic_links
  add column if not exists code_attempts int not null default 0;
