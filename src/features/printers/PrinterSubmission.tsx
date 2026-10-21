import { useState } from "react";
import { useLanguage, t } from "../../lib/i18n.ts";
const repo="https://github.com/remb0/label-studio";
type PrinterSubmissionData={brand:string;model:string;connection:string;width:string;formats:string;bluetooth:string;url:string;notes:string};
const initial:PrinterSubmissionData={brand:"",model:"",connection:"Bluetooth",width:"",formats:"",bluetooth:"",url:"",notes:""};
export function PrinterSubmission(){
 const lang=useLanguage(s=>s.language);
 const [data,setData]=useState(initial);
 const rows:[keyof PrinterSubmissionData,string][]=[["brand","brand"],["model","model"],["connection","connection"],["width","labelWidth"],["formats","labelFormats"],["bluetooth","deviceName"],["url","link"],["notes","notes"]];
 const update=(key:keyof PrinterSubmissionData,value:string)=>setData(p=>({...p,[key]:value.slice(0,1000)}));
 const openIssue=()=>{
  const clean=(value:string)=>value.replace(/[<>]/g,"").trim()||"Unknown";
  const body=[ "## New printer profile request",...rows.map(([key,label])=>`**${label}:** ${clean(data[key])}`),"","## Tests / evidence","- [ ] Paired / connected","- [ ] Printed a test label","- [ ] Width and alignment checked","","Please do not include serial numbers, MAC addresses or personal details."].join("\n");
  const params=new URLSearchParams({title:`Printer profile: ${clean(data.brand)} ${clean(data.model)}`,body});
  window.open(repo+"/issues/new?"+params.toString(),"_blank","noopener,noreferrer");
 };
 return <div className="studio-card mt-5"><h2>{t(lang,"printerHelpTitle")}</h2><p>{t(lang,"printerHelpIntro")}</p>
 <div className="studio-form-grid">{rows.map(([key,label])=><label key={key}>{t(lang,label)}<input className="studio-field" type="text" value={data[key]} onChange={e=>update(key,e.target.value)}/></label>)}</div>
 <p>{t(lang,"privacy")}</p><button className="studio-primary" disabled={!data.brand.trim()||!data.model.trim()} onClick={openIssue}>{t(lang,"generate")}</button></div>;
}
