"use client";
import {useEffect,useState,useCallback} from "react";
import {WORKS,validChoices} from "@/lib/percussionPreferences.mjs";
import styles from "./preferences.module.css";
export default function Preferences(){
 const [data,setData]=useState(null),[choices,setChoices]=useState({}),[error,setError]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{
  const response=await fetch("/api/portal/percussion-preferences",{cache:"no-store"});
  if(response.status===401){window.location.replace("/portal?next=/portal/percussion-preferences");return;}
  const body=await response.json();if(!response.ok)throw new Error(body.error);setData(body);setChoices(body.choices||{});
 }catch(e){setError(e.message||"Unable to load preferences.");}finally{setLoading(false);}},[]);
 useEffect(()=>{const timer=setTimeout(load,0);return()=>clearTimeout(timer);},[load]);
 async function save(event){event.preventDefault();setSaving(true);setError("");setMessage("");try{
  const response=await fetch("/api/portal/percussion-preferences",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({choices})});
  const body=await response.json();if(!response.ok)throw new Error(body.error);setData(body);setMessage("Your preferences are saved. You can change them and save again.");
 }catch(e){setError(e.message||"Unable to save. Your selections are still here; please try again.");}finally{setSaving(false);}}
 const dirty=!!data&&WORKS.some(work=>choices[work.id]!==data.choices?.[work.id]);
 return <main className={styles.page}><h1>Percussion part preferences</h1><p>Choose the printed part you would most like to play for each piece. These are preferences, not assignments. More than one student can choose the same part.</p><p>Page numbers refer to the 51-page percussion packet emailed to class. Some printed parts include several instruments and may be shared by multiple players.</p>
 {loading?<p role="status">Loading your preferences…</p>:data?<><p>Signed in as <strong>{data.name}</strong>. {dirty?"Unsaved changes. Save below to update your preferences.":data.updatedAt?"Your current preferences are saved. You can edit them below.":"No preferences saved yet."}</p><form onSubmit={save}>{WORKS.map(work=><fieldset key={work.id} disabled={saving}><legend>{work.title}</legend>{work.parts.map(([id,label,pages])=><label className={styles.option} key={id}><input type="radio" required name={work.id} value={id} checked={choices[work.id]===id} onChange={()=>{setChoices({...choices,[work.id]:id});setMessage("");}}/><span>{label}<small>Packet page{pages.includes("–")?"s":""} {pages}</small></span></label>)}</fieldset>)}<button disabled={saving||!validChoices(choices)}>{saving?"Saving…":"Save preferences"}</button><p>Choose one part for all six pieces before saving.</p></form></>:<button onClick={load}>Try again</button>}
 {error&&<p className={styles.error} role="alert">{error} {error.includes("sign in")&&<a href="/portal?next=/portal/percussion-preferences">Sign in again</a>}</p>}<p role="status" aria-live="polite">{message}</p><p><a href="/portal/review">Back to your portal</a></p></main>;
}
