// section 39 — Session Management. Thin wrapper around window.captureStudio (exposed by
// electron/preload.cjs), plus the defaults/merging logic for creating new sessions.

import { nextId } from "@/engine/xpath/util";
import type { CaptureSession } from "@/types";

export function createEmptySession(name: string, baseUrl: string): CaptureSession {
  const now = new Date().toISOString();
  return {
    id: nextId("session"),
    name,
    createdAt: now,
    updatedAt: now,
    baseUrl,
    currentUrl: baseUrl,
    elements: [],
  };
}

export async function listSessions(): Promise<SessionSummary[]> {
  return window.captureStudio.sessions.list();
}

export async function loadSession(id: string): Promise<CaptureSession> {
  return window.captureStudio.sessions.load(id) as Promise<CaptureSession>;
}

export async function saveSession(session: CaptureSession): Promise<void> {
  const toSave: CaptureSession = { ...session, updatedAt: new Date().toISOString() };
  await window.captureStudio.sessions.save(toSave);
}

export async function deleteSession(id: string): Promise<void> {
  await window.captureStudio.sessions.delete(id);
}
