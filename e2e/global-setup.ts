import { spawn, ChildProcess } from "child_process";
import { join } from "path";

export default async function globalSetup(): Promise<() => void> {
  const serverPath = join(process.cwd(), "server.js");

  const server: ChildProcess = spawn("node", [serverPath], {
    stdio: "pipe",
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Signaling server did not start within 10s")),
      10_000,
    );

    server.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("Socket.IO server running on port 4001")) {
        clearTimeout(timer);
        resolve();
      }
    });

    server.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  // Return teardown function — Playwright calls this after all tests finish.
  return () => {
    server.kill();
  };
}
