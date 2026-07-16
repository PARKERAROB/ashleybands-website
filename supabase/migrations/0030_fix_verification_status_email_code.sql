-- HOTFIX 2026-07-16 (uniform-fitting morning): every FIRST-TIME portal sign-in was
-- failing with a 500 and no session cookie.
--
-- Migration 0025 moved portal login from magic links to 6-digit email codes, and
-- app/api/portal/session/route.js writes verification_status='verified_email_code'
-- on a successful verify. That value was never added to the CHECK constraint, so
-- the write raised 23514 -> contactError -> 500 "Could not verify the code."
--
-- Why it hid until today: the offending UPDATE is scoped
-- .eq("verification_status", "unverified"), so it only fires for a contact that has
-- never signed in. Already-verified contacts match zero rows, raise nothing, and log
-- in fine -- which is why the 15 verified parents worked and all 202 unverified ones
-- could not. The fitting was the first mass first-time-login event, so the whole
-- room hit it at once.
--
-- The failure is also self-obscuring: the route consumes the code (consumed_at +
-- ip_consumed) in the same Promise.all as the failing update, so the code is burned
-- before the 500. The retry then finds no active row and reports "That code is
-- incorrect or expired" -- the reported symptom, one step removed from the cause.
--
-- Fix = allow the value the app has been writing since 0025. Additive to a CHECK
-- constraint: no data rewrite, no deploy, reversible by restoring the prior list.

alter table portal_contact_methods
  drop constraint if exists portal_contact_methods_verification_status_check;

alter table portal_contact_methods
  add constraint portal_contact_methods_verification_status_check
  check (verification_status = any (array[
    'unverified',
    'verified_magic_link',
    'verified_email_code',
    'verified_reply',
    'verified_one_click_response',
    'verified_manual',
    'hard_bounce',
    'replaced',
    'superseded'
  ]));
