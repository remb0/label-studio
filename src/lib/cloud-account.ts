import { useEditorV2Store } from "../store/editor-store.ts";
import { usePrinterStore } from "../store/printer-store.ts";
import { useFavorites, FAVORITES_KEY, parseFavorites } from "./favorites.ts";
import { useLanguage, LANGUAGES, type Language } from "./i18n.ts";
import { validateSavedLabel, persistLibrary, type Library } from "./library.ts";

const endpoint = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SESSION_KEY = "label-studio:cloud-session:v1";
export const cloudConfigured = Boolean(endpoint && anonKey && /^https:\/\//.test(endpoint));
type Session = { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email?: string } };
export type CloudSession = Session;
function sessionFromResponse(value: Record<string, unknown>): Session {
 const user = value.user as { id?: unknown; email?: unknown } | undefined;
 if (typeof value.access_token !== "string" || typeof value.refresh_token !== "string" || typeof user?.id !== "string") throw new Error("Ongeldige accountsessie.");
 return { access_token:value.access_token, refresh_token:value.refresh_token, expires_at:Math.floor(Date.now()/1000)+Number(value.expires_in||3600), user:{id:user.id,email:typeof user.email==="string"?user.email:undefined} };
}
function saveSession(value: Session | null) {
 try { if (value) localStorage.setItem(SESSION_KEY,JSON.stringify(value)); else localStorage.removeItem(SESSION_KEY); } catch { /* private browsing */ }
}
let current:Session|null=null;
export function clearCloudSession() { current=null; saveSession(null); }
export function getCloudSession() { return current; }
async function call(path:string, init:RequestInit={}, authToken?:string) {
 if (!cloudConfigured) throw new Error("Cloudaccounts zijn niet geconfigureerd.");
 const response=await fetch(endpoint+path,{...init,headers:{"apikey":anonKey!, "Content-Type":"application/json",...(authToken?{Authorization:`Bearer ${authToken}`}:{}),...init.headers}});
 const data:unknown=await response.json().catch(()=>null);
 if (!response.ok) throw new Error((data as {msg?:string;message?:string;error_description?:string}|null)?.msg || (data as {message?:string}|null)?.message || (data as {error_description?:string}|null)?.error_description || `Cloudfout ${response.status}`);
 return data;
}
export async function restoreCloudSession():Promise<Session|null> {
 if (!cloudConfigured) return null;
 try { const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||"null") as Session|null;
  if(!saved?.refresh_token) return null;
  current=saved;
  return await ensureSession();
 } catch {clearCloudSession();return null;}
}
export async function ensureSession():Promise<Session|null> {
 if(!current) return null;
 if(current.expires_at>Math.floor(Date.now()/1000)+60) return current;
 try {
  const data=await call("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:current.refresh_token})}) as Record<string,unknown>;
  current=sessionFromResponse(data);saveSession(current);return current;
 }catch{clearCloudSession();return null;}
}
export async function requestMagicLink(email:string) {
 if(!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Vul een geldig e-mailadres in.");
 await call("/auth/v1/otp",{method:"POST",body:JSON.stringify({email,create_user:true,gotrue:true})});
}
export async function completeMagicLinkFromUrl():Promise<Session|null> {
 if(!cloudConfigured) return null;
 const url=new URL(window.location.href);
 const hash=new URLSearchParams(url.hash.slice(1));
 let data:Record<string,unknown>|null=null;
 const access=hash.get("access_token"),refresh=hash.get("refresh_token");
 if(access&&refresh) {
  data=await call("/auth/v1/user",{},access) as Record<string,unknown>;
  const user=data;
  current={access_token:access,refresh_token:refresh,expires_at:Math.floor(Date.now()/1000)+Number(hash.get("expires_in")||3600),user:{id:String(user.id),email:typeof user.email==="string"?user.email:undefined}};
 } else if(url.searchParams.get("token_hash") && url.searchParams.get("type")) {
  data=await call("/auth/v1/verify",{method:"POST",body:JSON.stringify({token_hash:url.searchParams.get("token_hash"),type:url.searchParams.get("type")})}) as Record<string,unknown>;
  current=sessionFromResponse(data);
 }
 if(current) {
  saveSession(current);
  url.hash=""; url.searchParams.delete("token_hash");url.searchParams.delete("type");
  window.history.replaceState(null,"",url.pathname+url.search);
 }
 return current;
}
export async function logoutCloud() {
 const token=current?.access_token;
 clearCloudSession();
 if(token) await call("/auth/v1/logout",{method:"POST"},token).catch(()=>{});
}
function snapshot() {
 const editor=useEditorV2Store.getState();
 const printer=usePrinterStore.getState();
 return { version:1, library:editor.library, preferences:{
  theme:editor.theme, mode:editor.mode, uiScale:editor.uiScale, gridVisible:editor.gridVisible,
  rulersVisible:editor.rulersVisible, language:useLanguage.getState().language,
  preferredPrinterModel:printer.preferredModelId, favorites:useFavorites.getState().ids,
 } };
}
export async function uploadCloudData() {
 const session=await ensureSession();if(!session)throw new Error("Log eerst in.");
 const body=JSON.stringify({user_id:session.user.id,payload:snapshot()});
 if(body.length>5_000_000)throw new Error("Te veel gegevens voor cloudopslag (maximaal 5 MB).");
 await call("/rest/v1/user_studio_data?on_conflict=user_id",{
  method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,Prefer:"resolution=merge-duplicates"},body
 },session.access_token);
}
export async function downloadCloudData():Promise<boolean> {
 const session=await ensureSession();if(!session)throw new Error("Log eerst in.");
 const result=await call("/rest/v1/user_studio_data?select=payload&user_id=eq."+encodeURIComponent(session.user.id),{},session.access_token);
 const row=(result as {payload?:unknown}[])[0];if(!row)return false;
 const data=row.payload as {version?:number;library?:Library;preferences?:Record<string,unknown>};
 if(data?.version!==1 || !Array.isArray(data.library?.labels)) throw new Error("Ongeldige cloudgegevens.");
 const labels=data.library.labels.slice(0,1000).map(item=>({...validateSavedLabel(item),id:item.id}));
 if(labels.some(item=>typeof item.id!=="string"||item.id.length>200)) throw new Error("Ongeldige label-ID.");
 const lib:Library={labels,recent:[],currentLabelId:null};
 const editor=useEditorV2Store.getState();
 if(editor.currentLabelDirty) throw new Error("Sla je huidige ontwerp eerst op voordat je cloudgegevens ophaalt.");
 editor.newLabel();
 useEditorV2Store.setState({library:lib});
 persistLibrary(lib);
 const p=data.preferences||{};
 const themes=["cyan","amber","graphite","violet","forest","paper"];
 if(typeof p.theme==="string" && themes.includes(p.theme)) editor.setTheme(p.theme);
 if(p.mode==="dark"||p.mode==="light")editor.setMode(p.mode);
 if(typeof p.uiScale==="number"&&Number.isFinite(p.uiScale))editor.setUiScale(Math.max(0.8,Math.min(1.4,p.uiScale)));
 if(typeof p.gridVisible==="boolean")useEditorV2Store.setState({gridVisible:p.gridVisible});
 if(typeof p.rulersVisible==="boolean")useEditorV2Store.setState({rulersVisible:p.rulersVisible});
 if(LANGUAGES.includes(p.language as Language))useLanguage.getState().setLanguage(p.language as Language);
 if(typeof p.preferredPrinterModel==="string" || p.preferredPrinterModel===null)usePrinterStore.getState().selectPreferredModel(p.preferredPrinterModel as string|null);
 const favoriteData=JSON.stringify({version:1,ids:p.favorites});
 const favorites=parseFavorites(favoriteData);
 useFavorites.setState({ids:favorites});
 try{localStorage.setItem(FAVORITES_KEY,JSON.stringify({version:1,ids:favorites}));}catch{/* optional */}
 return true;
}
