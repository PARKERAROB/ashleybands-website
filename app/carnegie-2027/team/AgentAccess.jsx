"use client";
import { useEffect, useState } from "react";
import styles from "./workspace.module.css";
const API = "/api/carnegie-2027/team/agent-access";
export default function AgentAccess() {
  const [keys, setKeys] = useState([]), [token, setToken] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function request(body) {
    const response = await fetch(API, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Agent access unavailable.");
    return data;
  }
  useEffect(() => { let active = true; request().then(d => { if (active) setKeys(d.keys); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function change(command) {
    setBusy(true); setError(""); setToken("");
    try { const data = await request(command); if (data.workspace_key) setToken(data.workspace_key); setKeys((await request()).keys); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function downloadConfig() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ url: `${window.location.origin}/api/carnegie-2027/team/agent`, token })], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "carnegie-agent-config.json"; link.click(); URL.revokeObjectURL(url);
  }
  return <section className={styles.card}><h2>Connect your agent</h2>
    <p>One setup connects your local agent to these shared records. Updates then go directly to the workspace. Your key works only here and expires after 90 days. Revoking it or removing your writer access stops future requests.</p>
    <p><a href="/tools/carnegie-agent.mjs" download>Download the agent client</a> · <a href="/tools/carnegie-agent-guide.txt" download>Setup instructions for your agent</a></p>
    <form onSubmit={e => { e.preventDefault(); change({ action: "create", label: new FormData(e.currentTarget).get("label") }); }}>
      <label className={styles.field}>Agent name<input name="label" maxLength={80} required placeholder="My local agent" /></label><button disabled={busy}>Create my connection</button>
    </form>
    {token && <div role="status"><p>Your connection is ready to save. Keep the configuration private and outside synced project folders. It will not be shown again after leaving this page.</p><button onClick={downloadConfig}>Save private connection file</button></div>}
    {error && <p role="alert">{error}</p>}
    {keys.map(k => <p key={k.id}>{k.label} · {k.revoked_at ? "Revoked" : `Expires ${new Date(k.expires_at).toLocaleDateString()}`} {!k.revoked_at && <button disabled={busy} onClick={() => change({ action: "revoke", id: k.id })}>Revoke</button>}</p>)}
  </section>;
}
