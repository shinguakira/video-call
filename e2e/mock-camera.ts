/**
 * Replaces getUserMedia in a BrowserContext with a canvas-based avatar stream.
 * Each user gets a deterministic dark background + colored circle + initial,
 * making E2E screenshots look like a real video call instead of a green blob.
 *
 * Must be called after `browser.newContext()` and before `page.goto()`.
 */
import { BrowserContext } from "@playwright/test";

/** Pick a visually distinct dark-theme color pair from the user's name. */
function avatarColors(name: string): { bg: string; ring: string } {
  const palettes = [
    { bg: "#0f1729", ring: "#6366f1" }, // indigo
    { bg: "#0d1f12", ring: "#22c55e" }, // emerald
    { bg: "#1a0a2e", ring: "#a855f7" }, // purple
    { bg: "#1c1000", ring: "#f59e0b" }, // amber
    { bg: "#0c1a2e", ring: "#38bdf8" }, // sky
    { bg: "#1a0a0a", ring: "#f43f5e" }, // rose
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return palettes[hash % palettes.length];
}

export async function mockCamera(ctx: BrowserContext, userName: string): Promise<void> {
  const { bg, ring } = avatarColors(userName);
  const initial = userName.charAt(0).toUpperCase();

  await ctx.addInitScript(
    ({
      bg,
      ring,
      initial,
    }: {
      bg: string;
      ring: string;
      initial: string;
    }) => {
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        // ── Video track: canvas avatar ──────────────────────────────
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx2d = canvas.getContext("2d")!;

        const draw = () => {
          // Dark background
          ctx2d.fillStyle = bg;
          ctx2d.fillRect(0, 0, 640, 480);

          // Subtle outer glow ring
          ctx2d.beginPath();
          ctx2d.arc(320, 240, 118, 0, Math.PI * 2);
          ctx2d.fillStyle = ring + "28";
          ctx2d.fill();

          // Solid circle
          ctx2d.beginPath();
          ctx2d.arc(320, 240, 96, 0, Math.PI * 2);
          ctx2d.fillStyle = ring;
          ctx2d.fill();

          // Initial letter
          ctx2d.fillStyle = "#ffffff";
          ctx2d.font = "bold 108px system-ui, Arial, sans-serif";
          ctx2d.textAlign = "center";
          ctx2d.textBaseline = "middle";
          ctx2d.fillText(initial, 320, 248);

          requestAnimationFrame(draw);
        };
        draw();

        const videoStream = canvas.captureStream(30);

        // ── Audio track: silent oscillator ─────────────────────────
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0; // completely silent
        osc.connect(gain);
        gain.connect(dest);
        osc.start();

        return new MediaStream([
          ...videoStream.getVideoTracks(),
          ...(constraints?.audio ? dest.stream.getAudioTracks() : []),
        ]);
      };
    },
    { bg, ring, initial },
  );
}
