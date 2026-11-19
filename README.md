# 🎙️ NotebookAvatar
### Un Fantasma en el Sistema ([www.unfantasmaenelsistema.com](https://www.unfantasmaenelsistema.com/))

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-en_vivo-222?logo=github)](https://jpm70.github.io/NotebookAvatar/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Convierte un artículo en un **vídeo narrado por un único avatar** (Alice o Bob) que mueve los labios, parpadea y gesticula al compás de la voz. La IA escribe el guion y genera la voz; **el avatar no usa IA generativa**: es una imagen 2D animada en el navegador.

**👉 [jpm70.github.io/NotebookAvatar](https://jpm70.github.io/NotebookAvatar/)**

No hay servidor: todo se ejecuta en tu navegador con **tu propia clave de Gemini**, que solo se guarda en este navegador.

## Cómo se usa

1. **Configurar API Key** (barra superior) con tu clave de [Google AI Studio](https://aistudio.google.com/apikey).
2. **1. Ingesta** → sube el artículo y elige **locutor** (Alice o Bob), **lado** de la pantalla (izquierda o derecha) y **voz**.
3. **Generar guion** → Gemini escribe un monólogo con una diapositiva por punto (o «Diapositivas 1:1 directas» sin clave).
4. **4. Vídeo Final** → fondos, portada, subtítulos y música; **Compilar Episodio** graba el `.mp4`/`.webm` en tiempo real.

Usa Chrome o Edge recientes y mantén la pestaña visible mientras graba.

## Cómo se anima el avatar (sin IA de vídeo)

| Pieza | Técnica |
|---|---|
| Boca | Se calcula la envolvente del audio (RMS) y los cruces por cero de cada voz ya decodificada; el volumen abre la boca y el contenido de frecuencias elige la forma (ancha «e/i» o redonda «o/u»). Se dibuja una boca procedural sobre la imagen. |
| Ojos | Parpadeo cada 3-5 s con un párpado dibujado sobre el color de piel muestreado de la propia imagen. |
| Gestos | Respiración, balanceo, cabeceo y ladeo proporcionales a la energía de la voz y a la emoción del turno. |
| Calibración | Las coordenadas de boca y ojos de cada avatar están en `src/services/avatarAnimator.ts`. La página `?avatarlab` permite ajustarlas viendo el resultado. |

Como todo es una función determinista del tiempo, la vista previa, la línea de tiempo y la grabación se ven igual.

## Desarrollo

```bash
bun install
bun run dev      # http://localhost:3000
bun run lint     # tsc --noEmit
bun run build
```

Se despliega solo en GitHub Pages con cada `push` a `main` (`.github/workflows/deploy.yml`).

## Créditos y licencia

Basada en [NotebookLM Studio](https://github.com/jpm70/NotebookLM-Studio). Licencia MIT.
