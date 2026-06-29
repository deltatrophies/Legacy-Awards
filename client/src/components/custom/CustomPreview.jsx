import { forwardRef, useRef } from "react";

const fontMap = { classic: "Georgia, serif", modern: "Arial, sans-serif", bold: "Arial Black, sans-serif", script: "cursive" };

const CustomPreview = forwardRef(function CustomPreview({ design, options, onLogoMove }, ref) {
  const stageRef = useRef(null);
  const startDrag = (event) => {
    if (!design.logo) return;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveLogo = (event) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = stageRef.current.getBoundingClientRect();
    onLogoMove(Math.max(8, Math.min(92, ((event.clientX - rect.left) / rect.width) * 100)), Math.max(8, Math.min(88, ((event.clientY - rect.top) / rect.height) * 100)));
  };
  return (
    <div className="preview-shell" ref={ref}>
      <div className="preview-title"><span>Live preview</span><strong>{options.size.name}</strong></div>
      <div className={`custom-stage text-${design.textPosition}`} ref={stageRef} style={{ "--finish": options.finish.color }}>
        <img className="layer tip-layer" src={options.tip.image} alt="Selected trophy tip" />
        <img className="layer body-layer" src={options.body.image} alt="Selected trophy body" />
        <img className="layer base-layer" src={options.base.image} alt="Selected trophy base" />
        {design.logo && <img className="custom-logo" src={design.logo} alt="Uploaded logo" style={{ left: `${design.logoX}%`, top: `${design.logoY}%`, width: design.logoSize }} onPointerDown={startDrag} onPointerMove={moveLogo} />}
        <div className="custom-text" style={{ fontFamily: fontMap[design.font], textAlign: design.align, fontSize: design.textSize, color: design.textColor }}>{design.text.split("\n").map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div>
      </div>
      <p className="preview-help">Drag the uploaded logo directly on the preview to position it.</p>
    </div>
  );
});
export default CustomPreview;
