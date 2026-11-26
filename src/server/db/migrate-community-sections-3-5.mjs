/**
 * migrate-community-sections-3-5.mjs
 * Adds: community_announcements, community_suggestions, community_suggestion_votes, community_appeals
 * Extends: bug_reports with category, steps_to_reproduce, expected_behavior, device_info, ticket_ref
 */
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const configPath = join(process.env.NOMAD_TASK_DIR || '/local', 'config.json');
const cfg = JSON.parse(readFileSync(configPath, 'utf-8')).DATABASE.VALUE;

const conn = await createConnection({
  host: cfg.HOST, user: cfg.USERNAME, password: cfg.PASSWORD,
  database: cfg.NAME, port: parseInt(cfg.PORT),
  ssl: { rejectUnauthorized: false },
});

const run = async (sql, label) => {
  try {
    await conn.execute(sql);
    console.log('OK:', label);
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_TABLE_EXISTS_ERROR' || e.message?.includes('Duplicate column') || e.message?.includes('already exists')) {
      console.log('SKIP (already exists):', label);
    } else {
      console.log('ERR:', label, e.message?.slice(0, 120));
    }
  }
};

// ── Extend bug_reports ────────────────────────────────────────────────────────
await run(`ALTER TABLE bug_reports ADD COLUMN category VARCHAR(50) DEFAULT 'general' AFTER title`, 'bug_reports.category');
await run(`ALTER TABLE bug_reports ADD COLUMN steps_to_reproduce TEXT AFTER description`, 'bug_reports.steps_to_reproduce');
await run(`ALTER TABLE bug_reports ADD COLUMN expected_behavior TEXT AFTER steps_to_reproduce`, 'bug_reports.expected_behavior');
await run(`ALTER TABLE bug_reports ADD COLUMN device_info VARCHAR(500) DEFAULT '' AFTER expected_behavior`, 'bug_reports.device_info');
await run(`ALTER TABLE bug_reports ADD COLUMN ticket_ref VARCHAR(20) DEFAULT '' AFTER device_info`, 'bug_reports.ticket_ref');
await run(`ALTER TABLE bug_reports ADD COLUMN is_known_issue TINYINT(1) DEFAULT 0 AFTER ticket_ref`, 'bug_reports.is_known_issue');
await run(`ALTER TABLE bug_reports ADD COLUMN known_issue_title VARCHAR(255) DEFAULT '' AFTER is_known_issue`, 'bug_reports.known_issue_title');

// ── community_announcements ───────────────────────────────────────────────────
await run(`CREATE TABLE IF NOT EXISTS community_announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(30) NOT NULL DEFAULT 'announcement',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_pinned TINYINT(1) DEFAULT 0,
  is_published TINYINT(1) DEFAULT 0,
  published_at TIMESTAMP NULL,
  scheduled_for TIMESTAMP NULL,
  author_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ann_type (type),
  INDEX idx_ann_published (is_published, published_at)
)`, 'community_announcements');

// ── community_suggestions ─────────────────────────────────────────────────────
await run(`CREATE TABLE IF NOT EXISTS community_suggestions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  vote_count INT NOT NULL DEFAULT 0,
  staff_response TEXT,
  staff_response_by VARCHAR(36),
  staff_response_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sug_status (status),
  INDEX idx_sug_votes (vote_count),
  INDEX idx_sug_user (user_id)
)`, 'community_suggestions');

// ── community_suggestion_votes ────────────────────────────────────────────────
await run(`CREATE TABLE IF NOT EXISTS community_suggestion_votes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  suggestion_id INT NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sug_vote (suggestion_id, user_id),
  INDEX idx_sv_suggestion (suggestion_id)
)`, 'community_suggestion_votes');

// ── community_appeals ─────────────────────────────────────────────────────────
await run(`CREATE TABLE IF NOT EXISTS community_appeals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(36) NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id INT NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by VARCHAR(36),
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_appeal_user (user_id),
  INDEX idx_appeal_status (status)
)`, 'community_appeals');

await conn.end();
console.log('Migration complete.');
