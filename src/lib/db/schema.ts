import { pgTable, uuid, text, timestamp, integer, boolean, numeric, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull().default(''),
  phoneNumber: text('phone_number').unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'provider', 'user'] }).default('user').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  refreshToken: text('refresh_token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const mt5Accounts = pgTable('mt5_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  metaApiAccountId: text('meta_api_account_id').notNull().unique(),
  accountName: text('account_name').notNull(),
  login: text('login').notNull(),
  encryptedPassword: text('encrypted_password').notNull(),
  server: text('server').notNull(),
  platform: text('platform').default('mt5').notNull(),
  connectionStatus: text('connection_status').default('DISCONNECTED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const providers = pgTable('providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mt5AccountId: uuid('mt5_account_id').references(() => mt5Accounts.id, { onDelete: 'cascade' }).notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const followerAccounts = pgTable('follower_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mt5AccountId: uuid('mt5_account_id').references(() => mt5Accounts.id, { onDelete: 'cascade' }).notNull(),
  providerId: uuid('provider_id').references(() => providers.id, { onDelete: 'cascade' }).notNull(),
  lotMultiplier: numeric('lot_multiplier', { precision: 5, scale: 2 }).default('1.00').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqFollower: unique().on(t.mt5AccountId, t.providerId)
}));

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  priceKn: numeric('price', { precision: 10, scale: 2 }).notNull(),
  durationDays: integer('duration_days').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  planId: uuid('plan_id').references(() => subscriptionPlans.id),
  tradingDays: integer('trading_days').default(0).notNull(),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  startsAt: timestamp('starts_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  status: text('status', { enum: ['active', 'expired', 'cancelled'] }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  planId: uuid('plan_id').references(() => subscriptionPlans.id).notNull(),
  merchantRequestId: text('merchant_request_id').notNull().unique(),
  checkoutRequestId: text('checkout_request_id').notNull().unique(),
  mpesaReceiptNumber: text('mpesa_receipt_number'),
  phoneNumber: text('phone_number').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: text('status', { enum: ['pending', 'completed', 'failed'] }).default('pending').notNull(),
  rawCallbackData: text('raw_callback_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const trades = pgTable('trades', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: uuid('provider_id').references(() => providers.id).notNull(),
  masterPositionId: text('master_position_id').notNull(),
  symbol: text('symbol').notNull(),
  type: text('type').notNull(),
  volume: numeric('volume', { precision: 10, scale: 2 }).notNull(),
  openPrice: numeric('open_price', { precision: 15, scale: 5 }).notNull(),
  closePrice: numeric('close_price', { precision: 15, scale: 5 }),
  status: text('status', { enum: ['open', 'closed'] }).default('open').notNull(),
  openedAt: timestamp('opened_at').notNull(),
  closedAt: timestamp('closed_at')
});

export const tradeLogs = pgTable('trade_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tradeId: uuid('trade_id').references(() => trades.id, { onDelete: 'cascade' }).notNull(),
  followerAccountId: uuid('follower_account_id').references(() => followerAccounts.id, { onDelete: 'cascade' }).notNull(),
  followerPositionId: text('follower_position_id'),
  action: text('action').notNull(),
  volume: numeric('volume', { precision: 10, scale: 2 }).notNull(),
  executionLatencyMs: integer('execution_latency_ms'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const mediaFiles = pgTable('media_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  url: text('url').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  whatsapp: text('whatsapp'),
  label: text('label').default('Support').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptionSettings = pgTable('subscription_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  feePerDay: numeric('fee_per_day', { precision: 10, scale: 2 }).default('500.00').notNull(),
  minDays: integer('min_days').default(5).notNull(),
  maxDays: integer('max_days').default(60).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const masterAccounts = pgTable('master_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerName: text('provider_name').notNull(),
  mt5Login: text('mt5_login').notNull(),
  brokerName: text('broker_name').notNull(),
  serverName: text('server_name').notNull(),
  strategyDescription: text('strategy_description'),
  riskLevel: text('risk_level').default('medium').notNull(),
  winRate: numeric('win_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  totalTrades: integer('total_trades').default(0).notNull(),
  monthlyReturn: numeric('monthly_return', { precision: 8, scale: 2 }).default('0.00').notNull(),
  maxDrawdown: numeric('max_drawdown', { precision: 5, scale: 2 }).default('0.00').notNull(),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userProviderSubscriptions = pgTable('user_provider_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  masterAccountId: uuid('master_account_id').references(() => masterAccounts.id, { onDelete: 'cascade' }).notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userRelations = relations(users, ({ many }) => ({
  accounts: many(mt5Accounts),
  subscriptions: many(subscriptions)
}));

export const providerRelations = relations(providers, ({ one, many }) => ({
  account: one(mt5Accounts, { fields: [providers.mt5AccountId], references: [mt5Accounts.id] }),
  followers: many(followerAccounts)
}));

export const followerRelations = relations(followerAccounts, ({ one }) => ({
  provider: one(providers, { fields: [followerAccounts.providerId], references: [providers.id] }),
  account: one(mt5Accounts, { fields: [followerAccounts.mt5AccountId], references: [mt5Accounts.id] })
}));
