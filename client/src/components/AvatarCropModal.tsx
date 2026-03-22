import { useEffect, useRef, useState } from 'react';

interface Props {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  shape?: 'circle' | 'rect';
  aspectRatio?: number; // width/height, e.g. 16/9 or 3/4
  outputSize?: number;  // output square/width px
}

export default function AvatarCropModal({
  file,
  onConfirm,
  onCancel,
  shape = 'circle',
  aspectRatio,
  outputSize = 400
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Preview area dimensions
  const PREVIEW_W = 280;
  const PREVIEW_H = aspectRatio ? Math.round(PREVIEW_W / aspectRatio) : 280;

  useEffect(() => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      imgRef.current = img;
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const canvas = previewRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = zoom * Math.min(PREVIEW_W / img.width, PREVIEW_H / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const x = PREVIEW_W / 2 - drawW / 2 + offsetX;
    const y = PREVIEW_H / 2 - drawH / 2 + offsetY;

    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    ctx.save();
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(PREVIEW_W / 2, PREVIEW_H / 2, Math.min(PREVIEW_W, PREVIEW_H) / 2, 0, Math.PI * 2);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.roundRect(0, 0, PREVIEW_W, PREVIEW_H, 8);
      ctx.clip();
    }
    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.restore();

    // Border
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(PREVIEW_W / 2, PREVIEW_H / 2, Math.min(PREVIEW_W, PREVIEW_H) / 2 - 1, 0, Math.PI * 2);
    } else {
      ctx.roundRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2, 8);
    }
    ctx.strokeStyle = 'rgba(130,80,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [zoom, offsetX, offsetY, imgRef.current, shape, PREVIEW_W, PREVIEW_H]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };

  const handlePointerUp = () => setDragging(false);

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = canvasRef.current!;
    const outH = aspectRatio ? Math.round(outputSize / aspectRatio) : outputSize;
    out.width = outputSize;
    out.height = outH;
    const ctx = out.getContext('2d')!;

    const scale = zoom * Math.min(PREVIEW_W / img.width, PREVIEW_H / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const x = PREVIEW_W / 2 - drawW / 2 + offsetX;
    const y = PREVIEW_H / 2 - drawH / 2 + offsetY;

    const ratioX = outputSize / PREVIEW_W;
    const ratioY = outH / PREVIEW_H;

    ctx.save();
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(outputSize / 2, outH / 2, Math.min(outputSize, outH) / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(img, x * ratioX, y * ratioY, drawW * ratioX, drawH * ratioY);
    ctx.restore();

    out.toBlob((blob) => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.92);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'var(--color-surface, #1a1030)', borderRadius: 16,
        padding: '1.5rem', width: '100%', maxWidth: 360,
        display: 'flex', flexDirection: 'column', gap: '1rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fff' }}>Ajustar imagem</h3>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
          Arraste para reposicionar · Use o zoom para ajustar
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <canvas
            ref={previewRef}
            width={PREVIEW_W}
            height={PREVIEW_H}
            style={{
              borderRadius: shape === 'circle' ? '50%' : 8,
              cursor: dragging ? 'grabbing' : 'grab',
              touchAction: 'none', userSelect: 'none',
              maxWidth: '100%'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>Zoom</span>
          <input
            type="range" min={0.5} max={3} step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--color-primary, #8250ff)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '0.625rem', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '0.875rem'
            }}
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1, padding: '0.625rem', borderRadius: 8,
              border: 'none', background: 'var(--color-primary, #8250ff)',
              color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}
            type="button"
          >
            Salvar
          </button>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
