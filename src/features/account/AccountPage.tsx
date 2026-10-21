import { useEffect, useState } from "react";
import { cloudConfigured, restoreCloudSession, completeMagicLinkFromUrl, requestMagicLink, uploadCloudData, downloadCloudData, logoutCloud, type CloudSession } from "../../lib/cloud-account.ts";
import { useLanguage, t } from "../../lib/i18n.ts";
export function AccountPage() {
 const lang=useLanguage(s=>s.language);
 const [session,setSession]=useState<CloudSession|null>(null);
 const [email,setEmail]=useState("");
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true; void (async()=>{try{const s=await completeMagicLinkFromUrl()||await restoreCloudSession();if(alive)setSession(s);}catch(e){if(alive)setStatus(String(e));}})();return()=>{alive=false};},[]);
 async function work(fn:()=>Promise<void>){setBusy(true);setStatus("");try{await fn();}catch(e){setStatus(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <section className="studio-page"><div className="studio-page-title"><span className="studio-eyebrow">OPTIONAL CLOUD</span><h1>{t(lang,"accountTitle")}</h1><p>{t(lang,"cloudPrefs")}</p></div>
 <div className="studio-cards"><article className="studio-card"><h2>{session?t(lang,"signedIn")+" "+session.user.email:t(lang,"guest")}</h2>
 {!cloudConfigured?<p>{t(lang,"cloudNotConfigured")}</p>:session?<button className="studio-secondary" disabled={busy} onClick={()=>void work(async()=>{await logoutCloud();setSession(null);})}>{t(lang,"signOut")}</button>:<form onSubmit={e=>{e.preventDefault();void work(async()=>{await requestMagicLink(email);setStatus(t(lang,"linkSent"));});}}>
 <label htmlFor="account-email" className="block my-3 text-sm">{t(lang,"email")}</label><input id="account-email" className="studio-field" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/>
 <button disabled={busy} className="studio-primary" type="submit">{t(lang,"sendLink")}</button></form>}
 {status&&<p role="status" className="mt-3">{status}</p>}
 </article>
 {session&&<article className="studio-card"><h2>Cloud sync</h2><p>{t(lang,"syncWarning")}</p><div className="flex flex-wrap gap-3">
 <button className="studio-primary" disabled={busy} onClick={()=>void work(async()=>{await uploadCloudData();setStatus(t(lang,"savedCloud"));})}>{t(lang,"syncUpload")}</button>
 <button className="studio-secondary" disabled={busy} onClick={()=>{if(window.confirm(t(lang,"syncConfirm")))void work(async()=>{const found=await downloadCloudData();setStatus(t(lang,found?"loadedCloud":"cloudEmpty"));});}}>{t(lang,"syncDownload")}</button></div></article>}
 <article className="studio-card"><h2>{t(lang,"guest")}</h2><p>{t(lang,"cloudPrefs")}</p><p>{t(lang,"guest")}: labels remain in this browser until you export or clear them.</p></article></div>
 </section>;
}
