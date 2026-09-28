import { vi } from "vitest";

// Node's native Web Storage is not the jsdom document's browser storage.
const documentWindow = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
vi.stubGlobal("localStorage", documentWindow.localStorage);
vi.stubGlobal("sessionStorage", documentWindow.sessionStorage);
