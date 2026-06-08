import { pgTable, uuid, varchar, numeric, timestamp, integer, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Existing Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('user').notNull(), // admin, provider, user
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// MT5 Accounts Table
export const mt5Accounts = pgTable('mt5_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  metaApiAccountId: varchar('meta_api_account_id', { length: 255 }).notNull().unique(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  login: varchar('login', { length: 50 }).notNull(),
  server: varchar('server', { length: 255 }).notNull(),
  encryptedCredentials: varchar('encrypted_credentials', { length: 1000 }).notNull(),
  accountType: varchar('account_type', { length: 50 }).notNull(), // demo, real
  connectionStatus: varchar('connection_status', { length: 50 }).default('disconnected').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Providers Table (Master Accounts mapping)
export const providers = pgTable('providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mt5AccountId: uuid('mt5_account_id').references(() => mt5Accounts.id, { onDelete: 'cascade' }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Follower Accounts Settings Table
export const followerAccounts = pgTable('follower_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mt5AccountId: uuid('mt5_account_id').references(() => mt5Accounts.id, { onDelete: 'cascade' }).notNull().unique(),
  providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'cascade' }).notNull(),
  riskModel: varchar('risk_model', { length: 50 }).notNull(), // fixed_lot, balance_ratio, multiplier
  riskValue: numeric('risk_value', { precision: 10, scale: 4 }).notNull(), // e.g. 0.10 for fixed, 1.5 for multiplier
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    userProviderIdx: uniqueIndex('user_provider_idx').on(table.mt5AccountId, table.providerId),
  };
});

// Phase 1 Requirement: Permanent Trade Mapping Registry
export const tradeLinks = pgTable('trade_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'cascade' }).notNull(),
  masterAccountId: varchar('master_account_id', { length: 255 }).notNull(),
  masterTradeId: varchar('master_trade_id', { length: 255 }).notNull(),
  followerAccountId: varchar('follower_account_id', { length: 255 }).notNull(),
  followerTradeId: varchar('follower_trade_id', { length: 255 }).notNull(),
  symbol: varchar('symbol', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('open').notNull(), // open, modified, closed
  masterVolume: numeric('master_volume', { precision: 10, scale: 2 }).notNull(),
  followerVolume: numeric('follower_volume', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    masterFollowerIdx: uniqueIndex('master_follower_trade_idx').on(table.masterTradeId, table.followerTradeId),
    masterIdIdx: index('master_trade_id_idx').on(table.masterTradeId),
    followerIdIdx: index('follower_trade_id_idx').on(table.followerTradeId),
  };
});

// Analytics Dashboard Metadata Table
export const providerAnalytics = pgTable('provider_analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'cascade' }).notNull().unique(),
  totalTrades: integer('total_trades').default(0).notNull(),
  winningTrades: integer('winning_trades').default(0).notNull(),
  losingTrades: integer('losing_trades').default(0).notNull(),
  winRate: numeric('win_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  profitFactor: numeric('profit_factor', { precision: 10, scale: 2 }).default('0.00').notNull(),
  averageRR: numeric('average_rr', { precision: 10, scale: 2 }).default('0.00').notNull(),
  monthlyPerformance: numeric('monthly_performance', { precision: 8, scale: 2 }).default('0.00').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// System Level Audit Log Table
export const systemAuditLogs = pgTable('system_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  level: varchar('level', { length: 20 }).notNull(), // info, warning, error, repair
  component: varchar('component', { length: 100 }).notNull(),
  message: varchar('message', { length: 1000 }).notNull(),
  metaData: jsonb('meta_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
