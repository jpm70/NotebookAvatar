import { PodcastScript } from '../types';

/** NotebookAvatar tiene un único locutor: todos los turnos los dice Host_A. */
export function monologize<T extends PodcastScript | null>(script: T): T {
  if (!script) return script;
  if (script.turns.every((t) => t.speaker === 'Host_A')) return script;
  return { ...script, turns: script.turns.map((t) => ({ ...t, speaker: 'Host_A' as const })) };
}
