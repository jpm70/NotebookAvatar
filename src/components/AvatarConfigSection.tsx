import { useEffect, useRef } from 'react';
import { HostConfig, StudioSettings } from '../types';
import { AVATAR_RIGS, AvatarId, AvatarSide, drawAvatar } from '../services/avatarAnimator';
import { PREMIUM_VOICE_CATALOG, getVoiceProfileById } from '../services/voiceCatalog';

const DEFAULT_PROFILE: Record<AvatarId, string> = { alice: 'regional-elvira-es', bob: 'regional-alvaro-es' };
const ROLE: Record<AvatarId, { role: string; tone: string }> = {
  alice: { role: 'Divulgadora técnica y analítica', tone: 'Estructurada, rigurosa y pedagógica' },
  bob: { role: 'Divulgador cercano y curioso', tone: 'Espontáneo, incisivo y ameno' },
};

interface Props {
  hostA: HostConfig;
  setHostA: React.Dispatch<React.SetStateAction<HostConfig>>;
  settings: StudioSettings;
  setSettings: React.Dispatch<React.SetStateAction<StudioSettings>>;
}

export function hostFromProfile(id: AvatarId, profileId: string, prev?: HostConfig): HostConfig {
  const rig = AVATAR_RIGS[id];
  const v = getVoiceProfileById(profileId) || getVoiceProfileById(DEFAULT_PROFILE[id])!;
  return {
    ...(prev || ({} as HostConfig)),
    name: rig.name,
    role: prev?.name === rig.name ? prev.role : ROLE[id].role,
    tone: prev?.name === rig.name ? prev.tone : ROLE[id].tone,
    voiceGender: rig.gender,
    voiceProfileId: v.id,
    voiceName: v.name,
    neuralVoice: v.geminiVoiceId as HostConfig['neuralVoice'],
    voiceRegister: v.vocalRegister,
    voiceAccent: v.accent,
    voicePitch: v.pitch,
    voiceSpeed: v.speed,
    systemVoiceURI: v.edgeVoiceId,
    color: id === 'alice' ? '#3b82f6' : '#f59e0b',
    avatarIcon: '🎙️',
  };
}

function AvatarPreview({ id, active }: { id: AvatarId; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const rig = AVATAR_RIGS[id];
    const img = new Image();
    img.src = rig.src;
    let raf = 0;
    const loop = (ms: number) => {
      const c = ref.current;
      if (c && img.complete && img.naturalWidth) {
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0, 0, c.width, c.height);
        const t = ms / 1000;
        const talk = active ? Math.max(0, Math.sin(t * 8) * 0.5 + 0.5) * (Math.sin(t * 1.1) > -0.3 ? 1 : 0.1) : 0;
        drawAvatar(ctx, img, rig, { cx: c.width / 2, bottom: c.height, height: c.height }, {
          time: t, speech: { open: talk, wide: (Math.sin(t * 3) + 1) / 2 }, speaking: active,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id, active]);
  return <canvas ref={ref} width={260} height={252} className="w-full max-w-[260px] mx-auto" />;
}

export default function AvatarConfigSection({ hostA, setHostA, settings, setSettings }: Props) {
  const avatarId = settings.avatarId;
  const side = settings.avatarSide;

  const chooseAvatar = (id: AvatarId) => {
    if (id === avatarId) return;
    setSettings((s) => ({ ...s, avatarId: id }));
    setHostA(hostFromProfile(id, DEFAULT_PROFILE[id]));
  };
  const chooseSide = (sd: AvatarSide) => setSettings((s) => ({ ...s, avatarSide: sd }));

  const voices = PREMIUM_VOICE_CATALOG.filter((v) => v.engine === 'gemini' || v.edgeVoiceId);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Locutor y avatar</h2>
        <p className="text-sm text-slate-400">
          Elige quién narra todo el guion y a qué lado de la pantalla aparece. El avatar mueve los labios, parpadea y
          gesticula siguiendo la voz.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(['alice', 'bob'] as AvatarId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => chooseAvatar(id)}
            className={`rounded-xl border p-3 text-center transition ${
              avatarId === id ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 hover:border-slate-500'
            }`}
          >
            <AvatarPreview id={id} active={avatarId === id} />
            <div className="mt-1 font-bold text-white">{AVATAR_RIGS[id].name}</div>
            <div className="text-xs text-slate-400">{avatarId === id ? 'Locutor elegido' : 'Pulsa para elegir'}</div>
          </button>
        ))}
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-300 mb-2">Posición del avatar</div>
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-700">
          {(['left', 'right'] as AvatarSide[]).map((sd) => (
            <button
              key={sd}
              type="button"
              onClick={() => chooseSide(sd)}
              className={`px-4 py-2 text-sm font-semibold ${
                side === sd ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {sd === 'left' ? '◀ Izquierda' : 'Derecha ▶'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-sm text-slate-300 space-y-1">
          <span className="font-semibold">Voz de {hostA.name}</span>
          <select
            value={hostA.voiceProfileId || ''}
            onChange={(e) => setHostA((h) => hostFromProfile(avatarId, e.target.value, h))}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.flag} {v.name} · {v.gender === 'female' ? 'femenina' : 'masculina'} · {v.vocalRegister}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300 space-y-1">
          <span className="font-semibold">Estilo al hablar</span>
          <input
            value={hostA.tone}
            onChange={(e) => setHostA((h) => ({ ...h, tone: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
          />
        </label>
      </div>
    </section>
  );
}
