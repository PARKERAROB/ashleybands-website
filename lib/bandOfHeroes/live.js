"use client";

// Band of Heroes — live voting transport.
// Uses Supabase Realtime *broadcast* (no DB tables): the presenter is the tally
// authority, phones broadcast votes, presenter broadcasts state. Ephemeral by
// design — votes never need to persist, and nothing here touches the database.

import { createClient } from "@supabase/supabase-js";

export const BOH_CHANNEL = "boh-live";

// Broadcast event names + payload shapes
//  presenter -> phones:  "state"  { sessionId, round, status, optionA, optionB, winner }
//      status: "standby" | "open" | "closed";  round: 0..3;  winner: "a" | "b" | null
//  phone -> presenter:   "vote"   { sessionId, round, deviceId, choice }   choice: "a" | "b"
//  phone -> presenter:   "hello"  { deviceId }   (asks presenter to re-broadcast state)

let _client = null;

export function getLiveClient() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars missing for Band of Heroes live voting.");
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 30 } }
  });
  return _client;
}

// Stable per-device id so one phone counts as one vote (soft, no login).
export function getDeviceId() {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem("boh_device_id");
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("boh_device_id", id);
    }
    return id;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2);
  }
}
