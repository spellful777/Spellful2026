import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { followsPostAuthor, postAudienceAllows } from './community-post-access';

// Exercise the generated predicates with real rows and bound parameters.
describe('community post audience', () => {
  function posts(viewer?: string) {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(`
        create table community_posts(user_id text, audience text);
        create table community_blocks(blocker_id text, blocked_id text);
        create table community_follows(follower_id text, following_id text);
        create table coven_connections(requester_id text, receiver_id text, status text);
        insert into community_posts values ('reader','coven'),('ally','coven'),('other','public'),
          ('pending','coven'),('stranger','coven'),('blocked','public'),('blocker','public');
        insert into community_blocks values ('reader','blocked'),('blocker','reader');
        insert into coven_connections values ('ally','reader','accepted'),('reader','pending','pending');
        insert into community_follows values ('reader','ally'),('reader','stranger');
      `);
      const order = viewer ? followsPostAuthor(viewer) : sql`0 + 0`;
      const query = new MySqlDialect().sqlToQuery(sql`select user_id from community_posts
        where ${postAudienceAllows(viewer)} order by ${order} desc, user_id`);
      return db.prepare(query.sql).all(...query.params as string[]).map(row => row.user_id);
    } finally {
      db.close();
    }
  }
  it('prioritizes followed authors after enforcing blocks and accepted membership', () => {
    expect(posts('reader')).toEqual(['ally', 'other', 'reader']);
  });
  it('only returns public posts for an anonymous viewer', () => {
    expect(posts()).toEqual(['blocked', 'blocker', 'other']);
  });
});
