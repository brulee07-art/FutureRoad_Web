import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const settings = sqliteTable('settings', { id:text('id').primaryKey(), owner:text('owner').notNull(), pinHash:text('pin_hash'), salt:text('salt'), updatedAt:integer('updated_at').notNull() });
export const attempts = sqliteTable('attempts', { id:text('id').primaryKey(), mode:text('mode').notNull(), teamId:integer('team_id').notNull(), round:integer('round').notNull(), status:text('status').notNull(), rawCs:integer('raw_cs'), flags:text('flags').notNull(), revision:integer('revision').notNull(), requestId:text('request_id').notNull(), updatedAt:integer('updated_at').notNull() });
export const history = sqliteTable('attempt_history', { requestId:text('request_id').primaryKey(), attemptId:text('attempt_id').notNull(), snapshot:text('snapshot').notNull(), updatedAt:integer('updated_at').notNull() });
export const sessions = sqliteTable('judge_sessions', { id:text('id').primaryKey(), expires:integer('expires').notNull() });
export const limits = sqliteTable('login_limits', { id:text('id').primaryKey(), failures:integer('failures').notNull(), expires:integer('expires').notNull() });
