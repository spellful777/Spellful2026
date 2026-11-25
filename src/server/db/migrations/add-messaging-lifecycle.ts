/**
 * Migration: add messaging lifecycle columns and conversation_user_state table
 *
 * Adds:
 *  - messages.delivered_at  TIMESTAMP NULL  — set when recipient first polls/fetches
 *  - conversation_user_state table          — per-user archive/pin/mute/star/hidden state
 *
 * Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS column checks).
 */
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

export async function runMigration() {
  if (!db) throw new Error('Database unavailable');

  // 1. Add delivered_at column to messages (idempotent)
  await db.execute(sql`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL DEFAULT NULL
  `);

  // 2. Create conversation_user_state table (idempotent)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversation_user_state (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      user_id       VARCHAR(36) NOT NULL,
      conversation_id INT NOT NULL,
      is_archived   TINYINT(1) NOT NULL DEFAULT 0,
      is_pinned     TINYINT(1) NOT NULL DEFAULT 0,
      is_muted      TINYINT(1) NOT NULL DEFAULT 0,
      is_starred    TINYINT(1) NOT NULL DEFAULT 0,
      is_hidden     TINYINT(1) NOT NULL DEFAULT 0,
      updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cus_user_conv (user_id, conversation_id),
      CONSTRAINT fk_cus_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
      CONSTRAINT fk_cus_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[migration] add-messaging-lifecycle: complete');
}
