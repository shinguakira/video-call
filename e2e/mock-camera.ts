/**
 * Replaces getUserMedia in a BrowserContext with a realistic-looking
 * canvas avatar stream. Includes animated background, bokeh, breathing
 * avatar, camera grain, vignette, and an occasional "speaking" pulse —
 * so screenshots are indistinguishable from a real video call at a glance.
 */
import { BrowserContext } from "@playwright/test";

function avatarColors(name: string): {
  bg: string;
  bgLight: string;
  ring: string;
  ringLight: string;
} {
  const palettes = [
    { bg: "#0a0f1e", bgLight: "#151f3a", ring: "#3b82f6", ringLight: "#93c5fd" }, // blue
    { bg: "#071a10", bgLight: "#0f2e1c", ring: "#22c55e", ringLight: "#86efac" }, // green
    { bg: "#130720", bgLight: "#22093a", ring: "#a855f7", ringLight: "#d8b4fe" }, // purple
    { bg: "#1a0e00", bgLight: "#2e1a00", ring: "#f59e0b", ringLight: "#fcd34d" }, // amber
    { bg: "#061820", bgLight: "#0c2d3a", ring: "#06b6d4", ringLight: "#67e8f9" }, // cyan
    { bg: "#1a0608", bgLight: "#2e0c10", ring: "#f43f5e", ringLight: "#fda4af" }, // rose
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return palettes[hash % palettes.length];
}

export async function mockCamera(ctx: BrowserContext, userName: string): Promise<void> {
  const colors = avatarColors(userName);
  const initial = userName.charAt(0).toUpperCase();

  await ctx.addInitScript(
    ({
      bg,
      bgLight,
      ring,
      ringLight,
      initial,
    }: {
      bg: string;
      bgLight: string;
      ring: string;
      ringLight: string;
      initial: string;
    }) => {
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const W = 640,
          H = 480;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const c = canvas.getContext("2d")!;

        // Pre-parse hex colors for performance
        const hexToRgb = (hex: string) => ({
          r: parseInt(hex.slice(1, 3), 16),
          g: parseInt(hex.slice(3, 5), 16),
          b: parseInt(hex.slice(5, 7), 16),
        });
        const ringRgb = hexToRgb(ring);

        // Bokeh particle positions (stable across frames, drift slowly)
        const bokeh = Array.from({ length: 10 }, (_, i) => ({
          ox: Math.sin(i * 2.399) * 0.4 + 0.5,
          oy: Math.cos(i * 1.618) * 0.4 + 0.5,
          r: 18 + (i % 4) * 8,
          speed: 0.08 + (i % 3) * 0.04,
          phase: i * 0.9,
        }));

        let speaking = 0; // countdown for speaking pulse

        const draw = () => {
          const t = performance.now() / 1000;

          // ── Background: radial gradient (room-like lighting) ──────
          const bg2 = c.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H / 2, W * 0.75);
          bg2.addColorStop(0, bgLight);
          bg2.addColorStop(1, bg);
          c.fillStyle = bg2;
          c.fillRect(0, 0, W, H);

          // ── Bokeh / ambient light particles ───────────────────────
          for (const b of bokeh) {
            const bx = (b.ox + Math.sin(t * b.speed + b.phase) * 0.12) * W;
            const by = (b.oy + Math.cos(t * b.speed * 0.7 + b.phase) * 0.08) * H;
            const alpha = 0.04 + Math.sin(t * 0.4 + b.phase) * 0.025;
            const grad = c.createRadialGradient(bx, by, 0, bx, by, b.r);
            grad.addColorStop(0, `rgba(${ringRgb.r},${ringRgb.g},${ringRgb.b},${alpha})`);
            grad.addColorStop(1, "rgba(0,0,0,0)");
            c.fillStyle = grad;
            c.fillRect(bx - b.r, by - b.r, b.r * 2, b.r * 2);
          }

          // ── Avatar: breathing scale ────────────────────────────────
          const breath = 1 + Math.sin(t * 1.1) * 0.014;
          const cx = W / 2,
            cy = H / 2 + 4;
          const R = 96 * breath;

          // Occasional speaking pulse (random trigger every ~4s)
          if (Math.random() < 0.004) speaking = 18;
          if (speaking > 0) {
            const pulse = (18 - speaking) / 18;
            c.beginPath();
            c.arc(cx, cy, R + 24 + pulse * 20, 0, Math.PI * 2);
            c.strokeStyle = `rgba(${ringRgb.r},${ringRgb.g},${ringRgb.b},${0.6 * (1 - pulse)})`;
            c.lineWidth = 3;
            c.stroke();
            speaking--;
          }

          // Glow halo
          const halo = c.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.4);
          halo.addColorStop(0, `rgba(${ringRgb.r},${ringRgb.g},${ringRgb.b},0.18)`);
          halo.addColorStop(1, "rgba(0,0,0,0)");
          c.fillStyle = halo;
          c.beginPath();
          c.arc(cx, cy, R * 1.4, 0, Math.PI * 2);
          c.fill();

          // Circle with top-left highlight (gives 3-D depth)
          const circGrad = c.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
          circGrad.addColorStop(0, ringLight);
          circGrad.addColorStop(1, ring);
          c.beginPath();
          c.arc(cx, cy, R, 0, Math.PI * 2);
          c.fillStyle = circGrad;
          c.fill();

          // Subtle inner shadow at bottom edge
          const inner = c.createRadialGradient(cx, cy + R * 0.5, R * 0.3, cx, cy, R);
          inner.addColorStop(0, "rgba(0,0,0,0)");
          inner.addColorStop(1, "rgba(0,0,0,0.22)");
          c.beginPath();
          c.arc(cx, cy, R, 0, Math.PI * 2);
          c.fillStyle = inner;
          c.fill();

          // Initial letter with subtle shadow
          c.shadowColor = "rgba(0,0,0,0.5)";
          c.shadowBlur = 8;
          c.fillStyle = "#ffffff";
          c.font = `bold ${Math.round(108 * breath)}px system-ui, Arial, sans-serif`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(initial, cx, cy + 4);
          c.shadowBlur = 0;

          // ── Camera grain ──────────────────────────────────────────
          for (let g = 0; g < 300; g++) {
            const gx = Math.random() * W;
            const gy = Math.random() * H;
            const ga = Math.random() * 0.07;
            c.fillStyle = `rgba(255,255,255,${ga})`;
            c.fillRect(gx, gy, 1, 1);
          }

          // ── Vignette ──────────────────────────────────────────────
          const vig = c.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.78);
          vig.addColorStop(0, "rgba(0,0,0,0)");
          vig.addColorStop(1, "rgba(0,0,0,0.55)");
          c.fillStyle = vig;
          c.fillRect(0, 0, W, H);

          requestAnimationFrame(draw);
        };
        draw();

        const videoStream = canvas.captureStream(30);

        // Silent audio track
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        const gain = audioCtx.createGain();
        gain.gain.value = 0;
        gain.connect(dest);

        return new MediaStream([
          ...videoStream.getVideoTracks(),
          ...(constraints?.audio ? dest.stream.getAudioTracks() : []),
        ]);
      };
    },
    { ...colors, initial },
  );
}
