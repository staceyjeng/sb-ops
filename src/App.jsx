import { useState, useRef, useCallback, useEffect } from "react";

const RETAILERS = {
  "BJ's Wholesale Club": { nsCustomer: "BJs Wholesale Corporate : BJs Wholesale", shipMethod: "Route", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No" },
  "Global New Beginnings": { nsCustomer: "Global New Beginnings", shipMethod: "Freight", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No" },
  "Hy-Vee": { nsCustomer: "Hy-Vee", shipMethod: "Freight", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No" },
  "TJ Maxx Canada": { nsCustomer: "TJ Maxx Canada", shipMethod: "Freight", status: "Pending Fulfillment", priceLevel: "Custom", isEdiSent: "No", isSample: "No" },
};
const SHIP_METHODS = ["Route","Freight","UPS Ground","UPS 2nd Day Air","FedEx Ground","FedEx Express","Will Call","Other"];
const STATUSES = ["Pending Fulfillment","Pending Approval","Pending Billing","Billed","Closed"];
const CSV_HEADERS = ["Order #","NS SKU","Date","Quantity","Rate","Amount","Is EDI Sent","PO Number","NS CUSTOMER","Price Level","Status","Ship Date","Cancel Date","Must Arrive By Date","Name","Attention","Address 1","Address 2","City","State","Zip","Country","Ship Method","Memo"];
const IM_KEY = "item-master-data";
const IM_SHARED = true;
const TABS_PREVIEW = [
  { label: "Order", cols: ["Order #","Date","PO Number","Status","Price Level","Is EDI Sent"] },
  { label: "Items", cols: ["NS SKU","Quantity","Rate","Amount"] },
  { label: "Dates", cols: ["Ship Date","Cancel Date","Must Arrive By Date"] },
  { label: "Ship to", cols: ["Name","Address 1","Address 2","City","State","Zip","Country"] },
  { label: "Settings", cols: ["NS CUSTOMER","Ship Method","Memo"] },
];

function parseCsvRow(line){const vals=[];let cur="",inQ=false;for(let i=0;i<line.length;i++){const ch=line[i];if(inQ){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"'){inQ=false;}else{cur+=ch;}}else{if(ch==='"'){inQ=true;}else if(ch===','){vals.push(cur);cur="";}else{cur+=ch;}}}vals.push(cur);return vals;}
function parseImCsv(text){const lines=text.replace(/\r/g,"").trim().split("\n");if(!lines.length)return[];const hdrs=parseCsvRow(lines[0]).map(h=>h.trim());return lines.slice(1).filter(l=>l.trim()).map(line=>{const vals=parseCsvRow(line);const obj={};hdrs.forEach((h,i)=>{obj[h]=(vals[i]||"").trim();});return obj;});}
function esc(v){if(v===null||v===undefined)return "";const s=String(v);return(s.includes(",")||s.includes('"')||s.includes("\n"))?'"'+s.replace(/"/g,'""')+'"':s;}
function buildCSV(rows){return[CSV_HEADERS.join(","),...rows.map(r=>CSV_HEADERS.map(h=>esc(r[h])).join(","))].join("\n");}
function dlCSV(content,name){const b=new Blob([content],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
function addDays(ds,n){if(!ds)return "";const[m,d,y]=ds.split("/").map(Number);const dt=new Date(y,m-1,d);dt.setDate(dt.getDate()+n);return `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}/${dt.getFullYear()}`;}

const PROMPT=`Extract data from this purchase order PDF. Return ONLY valid JSON, no markdown, no explanation.\n\n{"poNumber":"","orderDate":"MM/DD/YYYY","deliveryDate":"MM/DD/YYYY","shipDate":"MM/DD/YYYY or empty","cancelDate":"MM/DD/YYYY or empty","mustArriveByDate":"MM/DD/YYYY or empty","shipToName":"","shipToAttention":"","shipToAddress1":"","shipToAddress2":"","shipToCity":"","shipToState":"2-letter","shipToZip":"","shipToCountry":"2-letter","memo":"","lineItems":[{"upc":"","vendorItemNum":"","quantity":0,"unitPrice":0,"description":""}]}\n\nRules: mustArriveByDate=deliveryDate if only one date. shipDate/cancelDate=empty if not stated. memo=any delivery appointment or scheduling note on the PO (e.g. "Vendor to call Shipping Location for appointment"); leave empty if none. Extract ALL lines. ONLY JSON.`;

const S = {
  card:{background:"var(--color-background-primary)",border:"1px solid var(--color-border-secondary)",borderRadius:12,padding:"1.4rem 1.5rem",marginBottom:"1.1rem"},
  sectionLabel:{fontSize:12,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--color-text-secondary)",display:"block",marginBottom:12},
  fieldLabel:{fontSize:14,fontWeight:500,color:"var(--color-text-primary)",display:"block",marginBottom:6},
  select:{width:"100%",boxSizing:"border-box",padding:"10px 12px",fontSize:14,fontFamily:"var(--font-sans)",borderRadius:8,border:"1px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",cursor:"pointer"},
  input:{width:"100%",boxSizing:"border-box",padding:"10px 12px",fontSize:14,fontFamily:"var(--font-sans)",borderRadius:8,border:"1px solid var(--color-border-secondary)",background:"var(--color-background-primary)",color:"var(--color-text-primary)"},
  dzBase:{border:"2px dashed var(--color-border-secondary)",borderRadius:10,padding:"2.5rem 1.5rem",textAlign:"center",cursor:"pointer",background:"var(--color-background-secondary)",transition:"border-color 0.15s,background 0.15s"},
  dzHover:{border:"2px dashed var(--color-border-info)",background:"var(--color-background-info)"},
  fileRow:{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",background:"var(--color-background-secondary)",borderRadius:8,border:"1px solid var(--color-border-secondary)"},
  imStored:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--color-background-success)",border:"1px solid var(--color-border-success)",borderRadius:8,padding:"12px 16px"},
  btnPrimary:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"13px 20px",fontSize:15,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderRadius:8,background:"var(--color-text-primary)",color:"var(--color-background-primary)",cursor:"pointer"},
  btnPrimaryDis:{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"13px 20px",fontSize:15,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderRadius:8,background:"var(--color-text-primary)",color:"var(--color-background-primary)",cursor:"not-allowed",opacity:0.4},
  btnOutline:{display:"flex",alignItems:"center",gap:6,padding:"10px 18px",fontSize:14,fontWeight:500,fontFamily:"var(--font-sans)",border:"1px solid var(--color-border-secondary)",borderRadius:8,background:"var(--color-background-primary)",color:"var(--color-text-primary)",cursor:"pointer"},
  btnSuccess:{display:"flex",alignItems:"center",gap:6,padding:"10px 22px",fontSize:14,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderRadius:8,background:"#166534",color:"#fff",cursor:"pointer"},
  btnReplace:{fontSize:13,color:"var(--color-text-secondary)",background:"var(--color-background-primary)",border:"1px solid var(--color-border-secondary)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"var(--font-sans)"},
  mainTabBtn:(active)=>({padding:"10px 18px",fontSize:14,fontWeight:500,fontFamily:"var(--font-sans)",border:"none",borderBottom:active?"2px solid var(--color-text-primary)":"2px solid transparent",background:"transparent",color:active?"var(--color-text-primary)":"var(--color-text-secondary)",cursor:"pointer"}),
  previewTabBtn:(active)=>({padding:"6px 14px",fontSize:13,fontFamily:"var(--font-sans)",borderRadius:8,border:"1px solid var(--color-border-secondary)",background:active?"var(--color-text-primary)":"var(--color-background-secondary)",color:active?"var(--color-background-primary)":"var(--color-text-secondary)",cursor:"pointer"}),
  stat:{background:"var(--color-background-secondary)",borderRadius:8,padding:"1rem 1.1rem",border:"1px solid var(--color-border-tertiary)"},
  statLabel:{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--color-text-tertiary)",marginBottom:4},
  statVal:{fontSize:19,fontWeight:600,color:"var(--color-text-primary)"},
  msgErr:{fontSize:14,color:"var(--color-text-danger)",background:"var(--color-background-danger)",borderRadius:8,padding:"11px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:9},
  msgWarn:{fontSize:14,color:"var(--color-text-warning)",background:"var(--color-background-warning)",borderRadius:8,padding:"11px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:9},
  msgOk:{fontSize:14,color:"var(--color-text-success)",background:"var(--color-background-success)",borderRadius:8,padding:"11px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:9},
  th:{textAlign:"left",padding:"9px 12px",borderBottom:"1px solid var(--color-border-tertiary)",fontWeight:600,fontSize:13,color:"var(--color-text-secondary)",whiteSpace:"nowrap"},
  td:{padding:"9px 12px",fontSize:13,color:"var(--color-text-primary)",whiteSpace:"nowrap"},
  removeLink:{fontSize:13,color:"var(--color-text-tertiary)",textDecoration:"underline",cursor:"pointer",marginTop:5,display:"inline-block"},
};

export default function App() {
  const [retailer, setRetailer] = useState("BJ's Wholesale Club");
  const [shipMethod, setShipMethod] = useState("Route");
  const [orderStatus, setOrderStatus] = useState("Pending Fulfillment");
  const [memo, setMemo] = useState("");
  const [im, setIm] = useState(null);
  const [imSource, setImSource] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [pdfDrag, setPdfDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [result, setResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [previewTab, setPreviewTab] = useState("Order");
  const [err, setErr] = useState("");
  const pdfRef = useRef();
  const imRef = useRef();

  useEffect(()=>{
    (async()=>{
      try{
        const nsRes=await fetch('/api/netsuite/itemmaster');
        if(nsRes.ok){
          const data=await nsRes.json();
          if(!data.error&&data.items?.length){
            setIm(data.items);
            setImSource(`NetSuite (${data.items.length} items)`);
            localStorage.setItem(IM_KEY,JSON.stringify({items:data.items,savedAt:new Date().toLocaleDateString()}));
            return;
          }
        }
      }catch(_){}
      try{
        const s=localStorage.getItem(IM_KEY);
        if(s){const p=JSON.parse(s);if(p.items?.length){setIm(p.items);setImSource(`Cached (${p.items.length} items, ${p.savedAt||""})`);}}
      }catch(_){}
    })();
  },[]);

  const loadIMCSV=useCallback((file)=>{
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(e)=>{
      const rows=parseImCsv(e.target.result);
      const items=rows.map(r=>({'Name':r['Name']||'','External ID':r['External ID']||'','UPC Code':r['UPC Code']||''})).filter(r=>r['Name']);
      setIm(items);
      setImSource(`CSV (${items.length} items)`);
      localStorage.setItem(IM_KEY,JSON.stringify({items,savedAt:new Date().toLocaleDateString()}));
    };
    reader.readAsText(file);
  },[]);

  const lookup = useCallback((items,upc,vin)=>{
    if(!items?.length) return null;
    const normVIN = String(vin||"").trim().toUpperCase();
    const normUPC = String(upc||"").replace(/\D/g,"");
    if(normVIN){
      const m=items.find(it=>String(it["External ID"]||"").trim().toUpperCase()===normVIN);
      if(m) return m;
    }
    if(normUPC){
      const m=items.find(it=>String(it["UPC Code"]||"").replace(/\D/g,"")===normUPC);
      if(m) return m;
    }
    return null;
  },[]);

  const handleRetailer=(r)=>{setRetailer(r);setShipMethod(RETAILERS[r].shipMethod);setOrderStatus(RETAILERS[r].status);};

  const loadPDF=(file)=>{
    if(!file) return;
    setPdfName(file.name);
    const r=new FileReader();
    r.onload=ev=>setPdf(ev.target.result.split(",")[1]);
    r.readAsDataURL(file);
  };

  const resetPDF=()=>{setPdf(null);setPdfName("");setResult(null);setRows([]);setErr("");setBusy(false);if(pdfRef.current)pdfRef.current.value="";};

  const process=async()=>{
    if(!pdf){setErr("Please upload a PO PDF first.");return;}
    setErr("");setResult(null);setRows([]);setBusy(true);setBusyMsg("Reading PO...");
    try{
      const resp=await fetch("/api/anthropic/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4096,system:PROMPT,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:pdf}},{type:"text",text:"Extract the purchase order data."}]}]})});
      const data=await resp.json();
      if(!resp.ok||data.error){throw new Error(data.error?.message||`API error ${resp.status}`);}
      const raw=data.content?.find(b=>b.type==="text")?.text||"";
      if(!raw) throw new Error("No text in API response. Check your API key.");
      const po=JSON.parse(raw.replace(/```json|```/g,"").trim());
      if(po.memo&&!memo) setMemo(po.memo);
      setBusyMsg("Matching items...");
      const rc=RETAILERS[retailer];
      const mabd=po.mustArriveByDate||po.deliveryDate||"";
      const shipDate=po.shipDate||addDays(mabd,-14);
      const cancelDate=po.cancelDate||mabd;
      const newRows=[],unmatched=[];
      for(const line of po.lineItems){
        let sku="",nsSku="";
        if(im?.length){
          const m=lookup(im,line.upc,line.vendorItemNum);
          if(m){
            nsSku=String(m["Name"]||"").trim();
            sku=line.vendorItemNum||"";
          }else{
            unmatched.push(line.vendorItemNum||line.upc||line.description);
            sku=line.vendorItemNum||"";nsSku=sku;
          }
        }else{sku=line.vendorItemNum||"";nsSku=sku;}
        const qty=Number(line.quantity)||0,rate=Number(line.unitPrice)||0;
        newRows.push({"Order #":po.poNumber,"SKU":sku,"NS SKU":nsSku,"Date":po.orderDate,"Quantity":qty,"Rate":rate,"Amount":parseFloat((qty*rate).toFixed(2)),"Is EDI Sent":rc.isEdiSent,"PO Number":po.poNumber,"NS CUSTOMER":rc.nsCustomer,"Is Sample":rc.isSample,"Price Level":rc.priceLevel,"Status":orderStatus,"Ship Date":shipDate,"Cancel Date":cancelDate,"Must Arrive By Date":mabd,"Name":po.shipToName,"Attention":po.shipToAttention||"","Address 1":po.shipToAddress1,"Address 2":po.shipToAddress2||"","City":po.shipToCity,"State":po.shipToState,"Zip":po.shipToZip,"Country":po.shipToCountry,"Ship Method":shipMethod,"Memo":memo||po.memo||""});
      }
      setRows(newRows);setResult({po,unmatched,shipDate,cancelDate,mabd});setBusy(false);
    }catch(e){setErr("Error: "+e.message);setBusy(false);}
  };

  const total=rows.reduce((s,r)=>s+Number(r["Amount"]),0);
  const firstRow=rows[0]||{};

  return (
    <div style={{fontFamily:"var(--font-sans)",padding:"1.75rem 0",maxWidth:680}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{marginBottom:"1.5rem"}}>
        <h2 style={{fontSize:24,fontWeight:600,margin:"0 0 6px",color:"var(--color-text-primary)"}}>NetSuite PO Converter</h2>
        <p style={{fontSize:15,color:"var(--color-text-secondary)",margin:0}}>Upload a retailer purchase order and download a NetSuite-ready CSV</p>
      </div>


        <div style={{...S.card,padding:"0.75rem 1rem",marginBottom:"0.75rem"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Retailer</label>
              <select style={{...S.select,padding:"7px 10px",fontSize:13}} value={retailer} onChange={e=>handleRetailer(e.target.value)} disabled={busy}>
                {Object.keys(RETAILERS).map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Ship method</label>
              <select style={{...S.select,padding:"7px 10px",fontSize:13}} value={shipMethod} onChange={e=>setShipMethod(e.target.value)} disabled={busy}>
                {SHIP_METHODS.map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Status</label>
              <select style={{...S.select,padding:"7px 10px",fontSize:13}} value={orderStatus} onChange={e=>setOrderStatus(e.target.value)} disabled={busy}>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{...S.fieldLabel,fontSize:11,marginBottom:4}}>Memo <span style={{fontWeight:400,color:"var(--color-text-tertiary)"}}>— optional</span></label>
            <input style={{...S.input,padding:"7px 10px",fontSize:13}} type="text" placeholder="e.g. Spring 2026 Drop" value={memo} onChange={e=>setMemo(e.target.value)} disabled={busy}/>
          </div>
        </div>

        <div style={{...S.card,padding:"0.75rem 1rem",marginBottom:"0.75rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <span style={{fontSize:12,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--color-text-secondary)"}}>Item master</span>
            {imSource?(
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:13,color:"var(--color-text-success)",fontWeight:500}}>{imSource}</span>
                <button style={S.btnReplace} onClick={()=>imRef.current?.click()}>Replace</button>
              </div>
            ):(
              <span style={{fontSize:13,color:"var(--color-text-secondary)"}}>
                <a href="https://4848284.app.netsuite.com/app/common/search/searchresults.nl?searchid=166419&whence=" target="_blank" rel="noreferrer" style={{color:"var(--color-text-primary)",fontWeight:500}}>Export from NS</a>
                {" then "}
                <span style={{cursor:"pointer",color:"var(--color-text-primary)",fontWeight:500,textDecoration:"underline"}} onClick={()=>imRef.current?.click()}>upload CSV</span>
              </span>
            )}
          </div>
          <input ref={imRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>loadIMCSV(e.target.files[0])}/>
        </div>

        <div style={pdf?{...S.card,padding:"0.75rem 1rem",marginBottom:"0.75rem"}:S.card}>
          {pdf?(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <span style={{fontSize:12,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--color-text-secondary)"}}>Purchase order PDF</span>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:13,fontWeight:500,color:"var(--color-text-primary)"}}>{pdfName}</span>
                <button style={S.btnReplace} onClick={resetPDF}>Remove</button>
              </div>
            </div>
          ):(
            <>
            <span style={S.sectionLabel}><i className="ti ti-file-type-pdf" aria-hidden="true" style={{marginRight:6,fontSize:12,verticalAlign:"-1px"}}/>Purchase order PDF</span>
            <div
              style={{...S.dzBase,...(pdfDrag?S.dzHover:{})}}
              onClick={()=>pdfRef.current?.click()}
              onDragOver={e=>{e.preventDefault();setPdfDrag(true);}}
              onDragLeave={()=>setPdfDrag(false)}
              onDrop={e=>{e.preventDefault();setPdfDrag(false);loadPDF(e.dataTransfer.files[0]);}}>
              <i className="ti ti-file-type-pdf" aria-hidden="true" style={{fontSize:36,color:"var(--color-text-secondary)",display:"block",marginBottom:10}}/>
              <p style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)",margin:0}}>Click or drag to upload PO PDF</p>
              <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"6px 0 0"}}>Supports any retailer PDF format</p>
            </div>
            </>
          )}
          <input ref={pdfRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>loadPDF(e.target.files[0])}/>
        </div>

        {err&&<div style={S.msgErr}><i className="ti ti-alert-circle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/>{err}</div>}

        {!result&&(
          <button style={busy||!pdf?S.btnPrimaryDis:S.btnPrimary} onClick={process} disabled={busy||!pdf}>
            {busy
              ?<><span style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/>{busyMsg}</>
              :<><i className="ti ti-wand" aria-hidden="true" style={{fontSize:16}}/>Extract &amp; generate CSV</>}
          </button>
        )}

        {result&&(<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:"1rem"}}>
            <div style={S.stat}><div style={S.statLabel}>PO number</div><div style={{...S.statVal,fontSize:15}}>{result.po.poNumber}</div></div>
            <div style={S.stat}><div style={S.statLabel}>Lines</div><div style={S.statVal}>{rows.length}</div></div>
            <div style={S.stat}><div style={S.statLabel}>MABD</div><div style={{...S.statVal,fontSize:14}}>{result.mabd||"—"}</div></div>
            <div style={S.stat}><div style={S.statLabel}>Total</div><div style={{...S.statVal,fontSize:14}}>${total.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
          </div>

          {result.unmatched?.length>0&&<div style={S.msgWarn}><i className="ti ti-alert-triangle" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/><span><strong>Unmatched:</strong> {result.unmatched.join(", ")} — vendor item # used as fallback</span></div>}
          {!result.unmatched?.length&&im&&<div style={S.msgOk}><i className="ti ti-circle-check" aria-hidden="true" style={{fontSize:16,flexShrink:0}}/>All items matched to item master</div>}

          <div style={{...S.card,marginTop:0}}>
            <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
              {TABS_PREVIEW.map(t=>(
                <button key={t.label} style={S.previewTabBtn(previewTab===t.label)} onClick={()=>setPreviewTab(t.label)}>{t.label}</button>
              ))}
            </div>
            <div style={{overflowX:"auto",border:"0.5px solid var(--color-border-tertiary)",borderRadius:8}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"var(--color-background-secondary)"}}>
                    {TABS_PREVIEW.find(t=>t.label===previewTab)?.cols.map(h=><th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row,i)=>(
                    <tr key={i}>
                      {TABS_PREVIEW.find(t=>t.label===previewTab)?.cols.map(h=>(
                        <td key={h} style={{...S.td,borderBottom:i<rows.length-1?"0.5px solid var(--color-border-tertiary)":"none"}}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>



          <div style={{display:"flex",gap:10,justifyContent:"space-between"}}>
            <button style={S.btnOutline} onClick={resetPDF}><i className="ti ti-refresh" aria-hidden="true" style={{fontSize:15}}/>New PO</button>
            <button style={S.btnSuccess} onClick={()=>dlCSV(buildCSV(rows),`NS_${retailer.replace(/\s+/g,"_")}_PO${rows[0]?.["PO Number"]||""}.csv`)}><i className="ti ti-download" aria-hidden="true" style={{fontSize:15}}/>Download CSV</button>
            <a href="https://4848284.app.netsuite.com/app/setup/assistants/nsimport/importassistant.nl?recid=111&new=T" target="_blank" rel="noreferrer" style={{...S.btnOutline,textDecoration:"none"}}><i className="ti ti-upload" aria-hidden="true" style={{fontSize:15}}/>Import CSV into NS</a>
          </div>
        </>)}
    </div>
  );
}
