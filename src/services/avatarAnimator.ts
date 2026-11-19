/**
 * Motor de avatar 2D sin IA generativa: a partir de una imagen estática (PNG/WebP recortado)
 * dibuja boca procedural, parpadeo, respiración y gestos de cabeza guiados por la envolvente
 * del audio. Todo es una función determinista del tiempo, así que sirve igual para la vista
 * previa, para saltar en la línea de tiempo y para la grabación.
 */

export type AvatarId = 'alice' | 'bob';
export type AvatarSide = 'left' | 'right';

/** Coordenadas en píxeles de la imagen del avatar (la ya recortada). */
export interface AvatarRig {
  id: AvatarId;
  name: string;
  src: string;
  width: number;
  height: number;
  mouth: { x: number; y: number; w: number };
  eyes: { lx: number; rx: number; y: number; rw: number; rh: number };
  /** Punto de giro de la cabeza (base del cuello). */
  pivot: { x: number; y: number };
  /** Color de la voz por defecto de Gemini TTS. */
  defaultVoice: string;
  gender: 'male' | 'female';
}

const BASE = import.meta.env.BASE_URL;

export const AVATAR_RIGS: Record<AvatarId, AvatarRig> = {
  alice: {
    id: 'alice',
    name: 'Alice',
    src: `${BASE}avatars/alice-cut.webp`,
    width: 1131,
    height: 1100,
    mouth: { x: 568, y: 530, w: 110 },
    eyes: { lx: 449, rx: 653, y: 358, rw: 70, rh: 40 },
    pivot: { x: 565, y: 640 },
    defaultVoice: 'Kore',
    gender: 'female',
  },
  bob: {
    id: 'bob',
    name: 'Bob',
    src: `${BASE}avatars/bob-cut.webp`,
    width: 1124,
    height: 1100,
    mouth: { x: 563, y: 531, w: 92 },
    eyes: { lx: 445, rx: 650, y: 372, rw: 70, rh: 40 },
    pivot: { x: 562, y: 650 },
    defaultVoice: 'Puck',
    gender: 'male',
  },
};

/* ------------------------------------------------------------------ */
/* Envolvente del audio                                                */
/* ------------------------------------------------------------------ */

export interface SpeechEnvelope {
  rate: number; // muestras por segundo
  open: Float32Array; // 0-1 apertura de la boca
  wide: Float32Array; // 0-1 forma: 0 = redonda (o/u), 1 = ancha (e/i)
}

export interface SpeechFrame {
  open: number;
  wide: number;
}

/** Calcula la envolvente de un AudioBuffer ya decodificado (RMS + cruces por cero). */
export function computeEnvelope(buffer: AudioBuffer, rate = 60): SpeechEnvelope {
  const ch = buffer.getChannelData(0);
  const hop = Math.max(1, Math.floor(buffer.sampleRate / rate));
  const n = Math.max(1, Math.floor(ch.length / hop));
  const rms = new Float32Array(n);
  const zcr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let zc = 0;
    let prev = ch[i * hop];
    for (let j = 0; j < hop; j++) {
      const v = ch[i * hop + j];
      sum += v * v;
      if ((v >= 0) !== (prev >= 0)) zc++;
      prev = v;
    }
    rms[i] = Math.sqrt(sum / hop);
    zcr[i] = zc / hop;
  }
  // Normalizar por el percentil 95 para que la boca use todo su rango en cualquier volumen
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const ref = Math.max(1e-4, sorted[Math.floor(sorted.length * 0.95)] || 1e-4);
  const gate = ref * 0.08;

  const open = new Float32Array(n);
  const wide = new Float32Array(n);
  let o = 0;
  let w = 0.5;
  for (let i = 0; i < n; i++) {
    const target = rms[i] < gate ? 0 : Math.min(1, Math.pow(rms[i] / ref, 0.75));
    // Ataque rápido, caída más lenta: evita el aleteo de la boca
    o += (target - o) * (target > o ? 0.65 : 0.3);
    const zt = Math.min(1, Math.max(0, (zcr[i] - 0.03) / 0.17));
    w += (zt - w) * 0.25;
    open[i] = o;
    wide[i] = w;
  }
  return { rate, open, wide };
}

export function sampleEnvelope(env: SpeechEnvelope | null | undefined, t: number): SpeechFrame {
  if (!env || t < 0) return { open: 0, wide: 0.5 };
  const f = t * env.rate;
  const i = Math.floor(f);
  if (i >= env.open.length - 1) return { open: 0, wide: 0.5 };
  const k = f - i;
  return {
    open: env.open[i] * (1 - k) + env.open[i + 1] * k,
    wide: env.wide[i] * (1 - k) + env.wide[i + 1] * k,
  };
}

/** Habla simulada (vista previa sin audio): sílabas ~5 Hz con pausas de frase. */
export function simulatedSpeech(t: number): SpeechFrame {
  const phrase = Math.sin(t * 0.9) > -0.55 ? 1 : 0;
  const syl = Math.pow(Math.max(0, Math.sin(t * 9.5) * 0.6 + Math.sin(t * 5.3 + 1) * 0.4), 0.8);
  return { open: Math.min(1, syl * phrase), wide: (Math.sin(t * 3.1) + 1) / 2 };
}

/* ------------------------------------------------------------------ */
/* Dibujo                                                              */
/* ------------------------------------------------------------------ */

export interface AvatarPose {
  /** Tiempo continuo en segundos (para respiración, balanceo y parpadeo). */
  time: number;
  speech: SpeechFrame;
  /** Si habla (gestos amplios) o escucha (solo respira y parpadea). */
  speaking: boolean;
  /** Emoción del turno: modula la amplitud de los gestos. */
  emotion?: string;
}

function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Cierre de párpados 0-1 en el instante t (parpadeo cada ~3-5 s, de 0,17 s). */
function blinkAmount(t: number): number {
  const period = 3.6;
  const idx = Math.floor(t / period);
  const start = idx * period + 0.4 + hash01(idx) * (period - 0.9);
  const d = t - start;
  const dur = 0.17;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
}

const EMOTION_GAIN: Record<string, number> = {
  entusiasta: 1.5,
  sorprendido: 1.4,
  divertido: 1.3,
  curioso: 1.1,
  analítico: 0.8,
  reflexivo: 0.7,
};

const skinCache = new WeakMap<CanvasImageSource, string>();

/** Color de piel muestreado de la propia imagen (mejilla bajo el ojo izquierdo). */
function sampleSkin(img: HTMLImageElement, rig: AvatarRig): string {
  const cached = skinCache.get(img);
  if (cached) return cached;
  let color = '#e9c5b0';
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const cx = c.getContext('2d', { willReadFrequently: true })!;
    const sx = (rig.mouth.x - rig.mouth.w * 1.15) * (img.naturalWidth / rig.width);
    const sy = (rig.eyes.y + rig.eyes.rh * 2.1) * (img.naturalHeight / rig.height);
    cx.drawImage(img, sx - 4, sy - 4, 8, 8, 0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    if (d[3] > 200) color = `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch {
    // lienzo contaminado: se queda el color por defecto
  }
  skinCache.set(img, color);
  return color;
}

export interface AvatarBox {
  /** Centro horizontal y base del avatar en el lienzo. */
  cx: number;
  bottom: number;
  /** Altura en píxeles del lienzo. */
  height: number;
}

/** Dibuja el avatar animado. `img` debe ser la imagen de `rig`. */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rig: AvatarRig,
  box: AvatarBox,
  pose: AvatarPose
) {
  const k = box.height / rig.height; // escala imagen -> lienzo
  const imgW = rig.width * k;
  const gain = (pose.emotion && EMOTION_GAIN[pose.emotion]) || 1;
  const talk = pose.speaking ? 1 : 0;
  const t = pose.time;
  const { open, wide } = pose.speech;
  const o = pose.speaking ? open : 0;

  // Gestos: balanceo lento + cabeceo y ladeo proporcionales a la energía de la voz
  const sway = Math.sin(t * 0.8) * 0.012 + Math.sin(t * 1.9 + 1.3) * 0.005 * talk;
  const tilt = (Math.sin(t * 1.35 + 0.6) * 0.016 + (wide - 0.5) * 0.02 * o) * gain * (0.35 + 0.65 * talk);
  const nod = o * 0.012 * gain;
  const breath = 1 + Math.sin(t * 1.6) * 0.004;
  const bob = Math.sin(t * 1.6) * 2 * k + o * 5 * k * gain;

  ctx.save();
  // Origen en el pivote del cuello, apoyado en la base del avatar
  ctx.translate(box.cx - (rig.width / 2 - rig.pivot.x) * k, box.bottom - (rig.height - rig.pivot.y) * k);
  ctx.translate(0, -bob);
  ctx.scale(breath, breath);
  ctx.rotate(sway + tilt);
  ctx.translate(0, nod * box.height);
  ctx.scale(k, k);
  ctx.translate(-rig.pivot.x, -rig.pivot.y);

  ctx.drawImage(img, 0, 0, rig.width, rig.height);

  const skin = sampleSkin(img, rig);

  // Parpadeo
  const blink = blinkAmount(t);
  if (blink > 0.05) {
    const { lx, rx, y, rw, rh } = rig.eyes;
    for (const ex of [lx, rx]) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, y, rw / 2, (rh / 2) * 0.95, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = skin;
      ctx.fillRect(ex - rw, y - rh, rw * 2, rh * (0.5 + 1.0 * blink) );
      ctx.restore();
      ctx.strokeStyle = 'rgba(30,20,35,0.9)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const ly = y - rh / 2 + rh * blink * 0.95;
      ctx.moveTo(ex - rw / 2, ly);
      ctx.quadraticCurveTo(ex, ly + 6 * blink, ex + rw / 2, ly);
      ctx.stroke();
    }
  }

  // Boca procedural sobre la boca cerrada
  if (o > 0.04) drawMouth(ctx, rig, o, wide, skin);

  ctx.restore();
  void imgW;
}

function drawMouth(ctx: CanvasRenderingContext2D, rig: AvatarRig, o: number, wide: number, skin: string) {
  const { x, y, w } = rig.mouth;
  const halfW = (w / 2) * (0.82 + 0.3 * wide - 0.22 * o * (1 - wide));
  const depth = w * 0.42 * Math.pow(o, 0.9);

  // Zona de la boca cerrada: se tapa con piel para que no asome la línea original
  ctx.save();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(x, y + 1, halfW * 1.12, Math.max(4, depth * 0.45), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const top = y - depth * 0.12;
  const bottom = y + depth;

  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x - halfW, top + depth * 0.1);
    ctx.quadraticCurveTo(x, top - depth * 0.08, x + halfW, top + depth * 0.1);
    ctx.bezierCurveTo(x + halfW * 0.85, bottom, x - halfW * 0.85, bottom, x - halfW, top + depth * 0.1);
    ctx.closePath();
  };

  ctx.save();
  path();
  ctx.fillStyle = '#3d1620';
  ctx.fill();
  ctx.clip();
  // dientes superiores
  if (o > 0.22) {
    ctx.fillStyle = '#f3eee8';
    ctx.fillRect(x - halfW, top, halfW * 2, depth * 0.3);
  }
  // lengua
  ctx.fillStyle = '#c4616f';
  ctx.beginPath();
  ctx.ellipse(x, bottom - depth * 0.05, halfW * 0.6, depth * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // contorno de los labios
  path();
  ctx.strokeStyle = 'rgba(95,45,50,0.9)';
  ctx.lineWidth = Math.max(2.5, w * 0.03);
  ctx.lineJoin = 'round';
  ctx.stroke();
}
