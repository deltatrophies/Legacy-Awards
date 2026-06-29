import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CustomPreview from "../components/custom/CustomPreview.jsx";
import PriceBreakdown from "../components/custom/PriceBreakdown.jsx";
import { blankDesign, customOptions, designPresets } from "../data/customOptions.js";
import { readStorage, writeStorage } from "../utils/storage.js";
import { uploadArtwork } from "../services/apiClient.js";
import "../styles/pages/custom-react.css";

const steps = ["Choose Parts", "Size & Finish", "Text & Logo", "Quantity & Packaging", "Review"];
const extras = { branding: { laser: 120, uv: 180, plate: 220, crystal: 350 }, packaging: { standard: 0, gift: 180, velvet: 320 } };

export default function CustomPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editId = params.get("design");
  const stored = readStorage("savedDesigns", []).find((item) => item.id === editId) || readStorage("cart", []).find((item) => item.designId === editId)?.design;
  const [design, setDesign] = useState(stored ? { ...blankDesign, ...stored } : blankDesign);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(() => readStorage("savedDesigns", []));
  const [notice, setNotice] = useState("");
  const uploadLogo = async (file) => {
    if (!file) return;
    setNotice("Uploading logo securely...");
    try {
      const uploaded = await uploadArtwork(file);
      set("logo", uploaded.url);
      setNotice("Logo uploaded.");
    } catch (error) {
      setNotice(error.message || "Logo upload failed.");
    }
  };
  const set = (key, value) => setDesign((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    if (!editId) return;
    const item = readStorage("savedDesigns", []).find((entry) => entry.id === editId) || readStorage("cart", []).find((entry) => entry.designId === editId)?.design;
    if (item) setDesign({ ...blankDesign, ...item });
  }, [editId]);
  const selected = useMemo(() => ({
    tip: customOptions.tips.find((item) => item.id === design.tip), body: customOptions.bodies.find((item) => item.id === design.body), base: customOptions.bases.find((item) => item.id === design.base), size: customOptions.sizes.find((item) => item.id === design.size), finish: customOptions.finishes.find((item) => item.id === design.finish),
  }), [design]);
  const pricing = useMemo(() => {
    const lines = [{ label: "Tip", value: selected.tip.price }, { label: "Body", value: selected.body.price }, { label: "Base", value: selected.base.price }, { label: "Finish", value: selected.finish.price }, { label: "Engraving", value: extras.branding[design.branding] }, { label: "Packaging", value: extras.packaging[design.packaging] }];
    const unit = Math.round(lines.reduce((sum, line) => sum + line.value, 0) * selected.size.multiplier);
    const discountRate = design.quantity >= 500 ? 20 : design.quantity >= 200 ? 15 : design.quantity >= 100 ? 10 : design.quantity >= 50 ? 8 : 0;
    const subtotal = unit * design.quantity; const discount = Math.round(subtotal * discountRate / 100);
    return { lines, quantity: design.quantity, discountRate, discount, total: subtotal - discount, perPiece: Math.round((subtotal - discount) / design.quantity) };
  }, [design, selected]);
  const persistDesign = (forceNew = false) => { const id = forceNew || !editId ? `DES-${Date.now()}` : editId; const entry = { ...design, id, name: design.text.split("\n")[0] || "Custom Trophy", savedAt: new Date().toISOString() }; const next = [...saved.filter((item) => item.id !== id), entry]; setSaved(next); writeStorage("savedDesigns", next); setNotice("Design saved on this device."); return entry; };
  const addToCart = () => { const item = persistDesign(); const cart = readStorage("cart", []); const cartItem = { id: `custom-${item.id}`, designId: item.id, name: "Custom Fusion Trophy", tag: "Custom design", description: `${selected.tip.name}, ${selected.body.name}, ${selected.base.name}`, price: pricing.perPiece, qty: design.quantity, image: selected.tip.image, design: item }; writeStorage("cart", [...cart.filter((old) => old.designId !== item.id), cartItem]); navigate("/cart"); };
  const downloadPreview = async () => {
    const load = (src) => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
    const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 1000; const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f4ee"; ctx.fillRect(0, 0, 900, 1000); ctx.fillStyle = "#28251f"; ctx.textAlign = "center"; ctx.font = "44px Georgia"; ctx.fillText("Legacy Awards Custom Preview", 450, 70);
    try {
      const [tip, body, base] = await Promise.all([load(selected.tip.image), load(selected.body.image), load(selected.base.image)]);
      ctx.drawImage(tip, 300, 110, 300, 250); ctx.drawImage(body, 315, 320, 270, 330); ctx.drawImage(base, 260, 600, 380, 220);
      if (design.logo) { const logo = await load(design.logo); ctx.drawImage(logo, 415, 360, 70, 70); }
    } catch { ctx.fillStyle = "#ded8cc"; ctx.fillRect(280, 130, 340, 650); }
    ctx.fillStyle = design.textColor; ctx.font = "bold 24px Arial"; design.text.split("\n").forEach((line, index) => ctx.fillText(line, 450, 740 + index * 30));
    ctx.fillStyle = "#28251f"; ctx.font = "20px Arial"; ctx.fillText(`${selected.tip.name} / ${selected.body.name} / ${selected.base.name}`, 450, 890); ctx.fillText(`${selected.finish.name} / ${selected.size.name} / Qty ${design.quantity}`, 450, 930);
    const link = document.createElement("a"); link.download = "legacy-awards-preview.png"; link.href = canvas.toDataURL("image/png"); link.click();
  };
  const cards = (key, items) => <div className="visual-options">{items.map((item) => <button key={item.id} type="button" className={design[key] === item.id ? "active" : ""} onClick={() => set(key,item.id)}><img src={item.image} alt="" /><strong>{item.name}</strong><span>Rs. {item.price}</span></button>)}</div>;

  return (
    <main className="customizer-page">
      <header className="customizer-head"><span>Build it your way</span><h1>Custom Trophy Studio</h1><p>Configure every component, place your artwork and save a production-ready design brief.</p></header>
      <nav className="wizard-steps">{steps.map((label,index) => <button type="button" key={label} className={index === step ? "active" : index < step ? "done" : ""} onClick={() => setStep(index)}><span>{index + 1}</span>{label}</button>)}</nav>
      <div className="customizer-layout"><section className="wizard-panel">
        {step === 0 && <><h2>Choose trophy parts</h2><h3>Tip style</h3>{cards("tip",customOptions.tips)}<h3>Body style</h3>{cards("body",customOptions.bodies)}<h3>Base style</h3>{cards("base",customOptions.bases)}<h3>Start from a template</h3><div className="preset-list">{designPresets.map((preset) => <button type="button" key={preset.name} onClick={() => setDesign((current) => ({ ...current, ...preset }))}>{preset.name}</button>)}</div></>}
        {step === 1 && <><h2>Choose size and finish</h2><div className="choice-grid"><div><h3>Size</h3>{customOptions.sizes.map((item) => <button type="button" className={`choice-row ${design.size === item.id ? "active" : ""}`} onClick={() => set("size",item.id)} key={item.id}><span>{item.name}</span><strong>{item.multiplier}x</strong></button>)}</div><div><h3>Finish</h3>{customOptions.finishes.map((item) => <button type="button" className={`choice-row ${design.finish === item.id ? "active" : ""}`} onClick={() => set("finish",item.id)} key={item.id}><span className="finish-dot" style={{background:item.color}} />{item.name}<strong>+ Rs. {item.price}</strong></button>)}</div></div><label className="form-field">Branding method<select value={design.branding} onChange={(e)=>set("branding",e.target.value)}><option value="laser">Laser engraving</option><option value="uv">UV colour print</option><option value="plate">Metal name plate</option><option value="crystal">3D crystal etch</option></select></label></>}
        {step === 2 && <><h2>Add text and logo</h2><label className="form-field">Award text<textarea value={design.text} onChange={(e)=>set("text",e.target.value)} rows="4" /></label><div className="form-grid"><label className="form-field">Font<select value={design.font} onChange={(e)=>set("font",e.target.value)}><option value="classic">Classic</option><option value="modern">Modern</option><option value="bold">Bold</option><option value="script">Script</option></select></label><label className="form-field">Alignment<select value={design.align} onChange={(e)=>set("align",e.target.value)}><option>left</option><option>center</option><option>right</option></select></label><label className="form-field">Text position<select value={design.textPosition} onChange={(e)=>set("textPosition",e.target.value)}><option value="top">Top plate</option><option value="center">Center plate</option><option value="base">Base plate</option></select></label><label className="form-field">Text colour<input type="color" value={design.textColor} onChange={(e)=>set("textColor",e.target.value)} /></label></div><label className="range-field">Text size <input type="range" min="11" max="26" value={design.textSize} onChange={(e)=>set("textSize",Number(e.target.value))} /><output>{design.textSize}px</output></label><label className="form-field">Upload logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e)=>uploadLogo(e.target.files[0])} /></label><label className="range-field">Logo size <input type="range" min="36" max="130" value={design.logoSize} onChange={(e)=>set("logoSize",Number(e.target.value))} /><output>{design.logoSize}px</output></label>{notice && <p className="success-message">{notice}</p>}</>}
        {step === 3 && <><h2>Quantity and packaging</h2><p style={{ margin: "-10px 0 18px", color: "#716b61", lineHeight: 1.65 }}>Final contact, notes and delivery preferences are collected once in your cart.</p><div className="form-grid"><label className="form-field">Quantity<input type="number" min="1" value={design.quantity} onChange={(e)=>set("quantity",Math.max(1,Number(e.target.value)||1))} /></label><label className="form-field">Packaging<select value={design.packaging} onChange={(e)=>set("packaging",e.target.value)}><option value="standard">Standard safe pack</option><option value="gift">Premium gift box</option><option value="velvet">Velvet presentation case</option></select></label></div></>}
        {step === 4 && <><h2>Review your design</h2><div className="review-list"><div><span>Parts</span><strong>{selected.tip.name}, {selected.body.name}, {selected.base.name}</strong></div><div><span>Finish and size</span><strong>{selected.finish.name}, {selected.size.name}</strong></div><div><span>Branding</span><strong>{design.branding}</strong></div><div><span>Quantity & packaging</span><strong>{design.quantity} pcs, {design.packaging}</strong></div></div><PriceBreakdown pricing={pricing} /><div className="review-actions"><button type="button" onClick={() => persistDesign()}>Save Design</button><button type="button" onClick={downloadPreview}>Download Preview</button><button type="button" className="primary" onClick={addToCart}>Add to Quote Cart</button></div>{notice && <p className="success-message">{notice}</p>}</>}
        <div className="wizard-nav"><button type="button" disabled={step===0} onClick={()=>setStep(step-1)}>Previous</button>{step<4 && <button type="button" className="primary" onClick={()=>setStep(step+1)}>Continue</button>}</div>
      </section><aside><CustomPreview design={design} options={selected} onLogoMove={(x,y)=>setDesign((current)=>({...current,logoX:x,logoY:y}))} />{step!==4 && <PriceBreakdown pricing={pricing} />}</aside></div>
      {saved.length>0 && <section className="saved-designs"><div><span>Your workspace</span><h2>Saved Designs</h2></div><div className="saved-grid">{saved.map((item)=><article key={item.id}><strong>{item.name}</strong><small>{new Date(item.savedAt).toLocaleDateString("en-IN")}</small><div><button onClick={()=>navigate(`/custom?design=${item.id}`)}>Edit</button><button onClick={()=>{const copy={...item,id:`DES-${Date.now()}`,name:`${item.name} Copy`,savedAt:new Date().toISOString()};const next=[...saved,copy];setSaved(next);writeStorage("savedDesigns",next);}}>Duplicate</button><button onClick={()=>{const next=saved.filter((d)=>d.id!==item.id);setSaved(next);writeStorage("savedDesigns",next);}}>Delete</button></div></article>)}</div></section>}
    </main>
  );
}
