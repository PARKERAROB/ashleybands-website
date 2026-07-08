-- Family portal: make auto-approve a CATEGORY-level default, not a per-lane literal.
--
-- Rob's ruling (3rd recurrence, 2026-07-05): NOTHING in the family portal is gated.
-- The "review queue" is an audit log; parent/family changes apply immediately and
-- auto-approve. Enforce it against the CATEGORY, not each visible lane.
--
-- Before this migration every parent write-path set `status: 'approved'` inline
-- (update-request, guardian-request, request/confirm on roster match). Correct, but
-- the TABLE defaults were still 'new' -- so any FUTURE change category that forgets
-- the override would silently land as an open/pending queue item. That is exactly
-- the "apply to the category, not the lane" gap Rob's ruling names.
--
-- Fix: flip the defaults so a new lane inherits auto-approve by default. This is a
-- no-op for every current handler (they all set 'approved' explicitly); it only adds
-- a safety net going forward. Reversible.
--
-- portal_access_requests is intentionally LEFT at 'new': its intake row is written
-- before email verification and legitimately starts un-granted (the grant happens on
-- verify in request/confirm). Only the two change-record tables flip.

alter table portal_update_requests alter column status set default 'approved';
alter table portal_review_queue   alter column status set default 'approved';
