import { nanoid } from 'nanoid';
import { getDb } from '../db/index.js';

export function createInviteCode(
  serverId: string,
  createdBy: string,
  usesRemaining: number | null = null,
  expiresInHours: number | null = null
): string {
  const db = getDb();
  const code = nanoid(12);
  const expiresAt = expiresInHours
    ? Math.floor(Date.now() / 1000) + expiresInHours * 3600
    : null;

  db.prepare(
    'INSERT INTO invite_codes (code, server_id, created_by, uses_remaining, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(code, serverId, createdBy, usesRemaining, expiresAt);

  return code;
}

export function consumeInviteCode(code: string): { serverId: string } | null {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const invite = db.prepare(`
    SELECT server_id, uses_remaining, expires_at
    FROM invite_codes
    WHERE code = ?
  `).get(code) as { server_id: string; uses_remaining: number | null; expires_at: number | null } | undefined;

  if (!invite) return null;
  if (invite.expires_at && invite.expires_at < now) return null;
  if (invite.uses_remaining !== null && invite.uses_remaining <= 0) return null;

  if (invite.uses_remaining !== null) {
    db.prepare('UPDATE invite_codes SET uses_remaining = uses_remaining - 1 WHERE code = ?').run(code);
  }

  return { serverId: invite.server_id };
}
