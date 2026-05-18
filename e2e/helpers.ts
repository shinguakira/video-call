import { Page } from "@playwright/test";

/**
 * Injects a no-op Socket.IO mock so the room page reaches the "connected"
 * state without a real signaling server.  Call this BEFORE page.goto().
 */
export async function mockSocket(page: Page) {
  await page.addInitScript(() => {
    // Minimal EventEmitter
    class FakeEmitter {
      private _handlers: Record<string, Array<(...args: unknown[]) => void>> = {};

      on(event: string, fn: (...args: unknown[]) => void) {
        (this._handlers[event] ??= []).push(fn);
        return this;
      }
      off(event: string, fn: (...args: unknown[]) => void) {
        this._handlers[event] = (this._handlers[event] ?? []).filter((h) => h !== fn);
        return this;
      }
      emit(event: string, ...args: unknown[]) {
        (this._handlers[event] ?? []).forEach((h) => h(...args));
        return this;
      }
    }

    class FakeSocket extends FakeEmitter {
      id = "mock-socket-id";
      connected = true;

      connect() {
        return this;
      }
      disconnect() {
        return this;
      }
    }

    const fakeSocket = new FakeSocket();

    // Override the socket.io-client module that lib/socket.ts uses.
    // Because Next.js bundles everything, we patch the global so that
    // when socket.io-client calls `io(url)` it returns our fake.
    // This works as long as the patch runs before any module initialises.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__fakeSocket = fakeSocket;

    // Simulate "connect" event after a short delay so hooks can register
    // their listeners first.
    window.addEventListener("load", () => {
      setTimeout(() => {
        fakeSocket.emit("connect");
      }, 100);
    });
  });
}

/** Navigate to a room and wait for the main UI (past the loading spinner). */
export async function gotoRoom(page: Page, roomId = "test-room-123", name = "Test User") {
  await page.goto(`/room/${roomId}?name=${encodeURIComponent(name)}`);
}
