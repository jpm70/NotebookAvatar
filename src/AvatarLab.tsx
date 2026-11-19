import { useEffect, useRef, useState } from 'react';
import { AVATAR_RIGS, AvatarId, AvatarRig, drawAvatar } from './services/avatarAnimator';

/** Laboratorio de calibración del avatar (abrir con ?avatarlab). */
export default function AvatarLab() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [id, setId] = useState<AvatarId>('alice');
  const [rig, setRig] = useState<AvatarRig>(AVATAR_RIGS.alice);
  const [open, setOpen] = useState(-1); // -1 = demo automática
  const [wide, setWide] = useState(0.5);
  const [zoom, setZoom] = useState(true);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const state = useRef({ rig, open, wide, zoom });
  state.current = { rig, open, wide, zoom };

  useEffect(() => {
    setRig(AVATAR_RIGS[id]);
    const img = new Image();
    img.src = AVATAR_RIGS[id].src;
    img.onload = () => (imgRef.current = img);
    imgRef.current = null;
  }, [id]);

  useEffect(() => {
    let raf = 0;
    const loop = (ms: number) => {
      const c = ref.current;
      const img = imgRef.current;
      if (c && img) {
        const s = state.current;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, c.width, c.height);
        const t = ms / 1000;
        const demoO = Math.max(0, Math.sin(t * 7) * 0.5 + 0.5) * (Math.sin(t * 1.3) > -0.4 ? 1 : 0);
        const o = s.open < 0 ? demoO : s.open;
        const w = s.open < 0 ? (Math.sin(t * 3.1) + 1) / 2 : s.wide;
        ctx.save();
        if (s.zoom) {
          const kk = c.height / s.rig.height;
          const mx = c.width / 2 - (s.rig.width / 2 - s.rig.mouth.x) * kk;
          const my = c.height - (s.rig.height - s.rig.mouth.y) * kk;
          ctx.translate(c.width / 2, c.height * 0.45);
          ctx.scale(3, 3);
          ctx.translate(-mx, -my);
        }
        drawAvatar(ctx, img, s.rig, { cx: c.width / 2, bottom: c.height, height: c.height }, {
          time: t, speech: { open: o, wide: w }, speaking: true, emotion: 'entusiasta',
        });
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const num = (label: string, get: number, set: (v: number) => void, step = 1) => (
    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
      <span style={{ width: 70 }}>{label}</span>
      <input type="number" step={step} value={get} onChange={(e) => set(Number(e.target.value))} style={{ width: 70, color: '#000' }} />
    </label>
  );
  const m = rig.mouth, e = rig.eyes;
  return (
    <div style={{ padding: 12, color: '#e2e8f0', background: '#0f172a', minHeight: '100vh', display: 'flex', gap: 16 }}>
      <canvas ref={ref} width={700} height={700} style={{ background: '#1e293b', maxWidth: '62vw', maxHeight: '95vh' }} />
      <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
        <div>
          <button onClick={() => setId('alice')}>Alice</button> <button onClick={() => setId('bob')}>Bob</button>{' '}
          <button onClick={() => setZoom(!zoom)}>zoom</button>
        </div>
        <label style={{ fontSize: 12 }}>boca (-1 = demo) <input type="range" min={-1} max={1} step={0.05} value={open} onChange={(ev) => setOpen(Number(ev.target.value))} /></label>
        <label style={{ fontSize: 12 }}>ancha <input type="range" min={0} max={1} step={0.05} value={wide} onChange={(ev) => setWide(Number(ev.target.value))} /></label>
        {num('boca x', m.x, (v) => setRig({ ...rig, mouth: { ...m, x: v } }))}
        {num('boca y', m.y, (v) => setRig({ ...rig, mouth: { ...m, y: v } }))}
        {num('boca ancho', m.w, (v) => setRig({ ...rig, mouth: { ...m, w: v } }))}
        {num('ojo izq x', e.lx, (v) => setRig({ ...rig, eyes: { ...e, lx: v } }))}
        {num('ojo der x', e.rx, (v) => setRig({ ...rig, eyes: { ...e, rx: v } }))}
        {num('ojos y', e.y, (v) => setRig({ ...rig, eyes: { ...e, y: v } }))}
        {num('ojo ancho', e.rw, (v) => setRig({ ...rig, eyes: { ...e, rw: v } }))}
        {num('ojo alto', e.rh, (v) => setRig({ ...rig, eyes: { ...e, rh: v } }))}
        <pre style={{ fontSize: 11 }}>{JSON.stringify({ mouth: m, eyes: e }, null, 1)}</pre>
      </div>
    </div>
  );
}
