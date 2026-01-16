# Adding New Exchanges to GoldenPocket - Data Structure Guide

## Overview

This document defines the exact data structure and requirements for integrating new exchanges into the GoldenPocket trading journal. The system is designed to be **exchange-agnostic** through a unified output format called `JsonOutput`.

## Core Architecture

```
New Exchange API
    ↓
Custom Fetcher Script
    ↓
JsonOutput (standardized format)
    ↓
/api/trades/sync endpoint
    ↓
Database (trades + executions tables)
```

**Key Principle**: Your fetcher script must output the `JsonOutput` format. Once it does, all database operations, upserts, and analytics work automatically.

---

## Required Output Format

### 1. Top-Level Structure (JsonOutput)

Your fetcher script must return this structure:

```typescript
interface JsonOutput {
  wallet_address: string      // Exchange account identifier (wallet address for DEX, API key hash for CEX)
  sync_timestamp: string      // ISO 8601 timestamp of sync time
  positions: JsonPosition[]   // Array of all trades
}
```

**Example:**
```json
{
  "wallet_address": "5QzoXjc...",
  "sync_timestamp": "2025-05-15T10:30:00.000Z",
  "positions": [...]
}
```

---

### 2. Trade Object Structure (JsonPosition)

Each trade in the `positions` array must follow this format:

```typescript
interface JsonPosition {
  // REQUIRED FIELDS (all exchanges)
  trade_id: string                    // Unique 5-char uppercase alphanumeric ID (e.g., "Q7K9M")
  symbol: string                      // Trading pair (e.g., "SOL-PERP", "BTC/USD")
  direction: 'long' | 'short'         // Trade direction
  status: 'active' | 'closed' | 'liquidated'
  entry_price: number                 // Entry price (2 decimal precision)
  entry_time: string                  // ISO 8601 timestamp
  size_usd: number                    // Position size in USD (2 decimal precision)
  notional_size: number               // Position size in base asset
  total_fees: number                  // Total fees in USD (6 decimal precision)
  events: JsonEvent[]                 // Array of execution events (see below)
  exchange_type: 'jupiter' | 'backpack' | 'binance' | 'bybit' | ...

  // REQUIRED for closed/liquidated trades
  exit_price?: number                 // Exit price (2 decimals)
  exit_time?: string                  // ISO 8601 timestamp
  realized_pnl?: number               // Realized P&L in USD (2 decimals)
  realized_pnl_percent?: number       // P&L percentage (2 decimals)
  has_profit?: boolean                // true if realized_pnl > 0

  // OPTIONAL for DEX (Jupiter-style)
  position_key?: string | null        // On-chain position identifier (null for CEX)
  collateral_usd?: number | null      // Collateral in USD (null for CEX spot)
  leverage?: number | null            // Position leverage (null for CEX spot)

  // OPTIONAL for CEX (Backpack-style)
  order_id?: string | null            // Exchange order ID
  order_type?: string | null          // 'market', 'limit', 'stop_limit'
  fill_count?: number | null          // Number of partial fills
}
```

### 3. Event Object Structure (JsonEvent)

Each trade must include an array of execution events:

```typescript
interface JsonEvent {
  // REQUIRED
  timestamp: string                   // ISO 8601 timestamp
  transaction_signature: string       // Transaction ID or unique event identifier
  event_name: string                  // Event type identifier
  action: 'Buy' | 'Sell'             // Action type
  type: 'Market' | 'Limit' | 'Stop Loss' | 'Take Profit' | 'Liquidation'
  size_usd: number                    // Execution size in USD (2 decimals)
  price: number                       // Execution price (2 decimals)
  fee_usd: number                     // Execution fee in USD (6 decimals)

  // OPTIONAL for closed positions
  pnl_usd?: number                    // P&L for this execution (2 decimals)
  has_profit?: boolean                // true if pnl_usd > 0

  // OPTIONAL for CEX
  original_fill_id?: string           // Exchange fill ID
  maker_taker?: 'maker' | 'taker'     // Fee tier indicator
  commission_asset?: string           // Fee currency (e.g., 'USDC', 'BNB')
}
```

---

## Field-by-Field Requirements

### Trade ID Generation

**CRITICAL**: `trade_id` must be:
- Exactly 5 characters
- Uppercase alphanumeric only (A-Z, 0-9)
- Unique per trade within a wallet
- Deterministic (same trade = same ID on re-sync)

**Generation Strategy:**
1. Combine: position identifier + first event timestamp
2. Hash using SHA-256
3. Take first 5 chars and uppercase
4. Convert non-alphanumeric to alphanumeric

**Example Implementation:**
```typescript
import crypto from 'crypto';

function generateTradeId(positionIdentifier: string, firstEventTimestamp: string): string {
  const combined = `${positionIdentifier}-${firstEventTimestamp}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  return hash.substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, '0');
}
```

### Symbol Formatting

**DEX Perpetuals (Jupiter-style):**
- Format: `{ASSET}-PERP`
- Examples: `SOL-PERP`, `BTC-PERP`, `ETH-PERP`

**CEX Spot/Futures (Backpack-style):**
- Format: `{BASE}/{QUOTE}`
- Examples: `BTC/USD`, `SOL/USDC`, `ETH/USDT`

### Direction & Status

**Direction:**
- `'long'` - Buying to open (expect price increase)
- `'short'` - Selling to open (expect price decrease)

**Status:**
- `'active'` - Position currently open
- `'closed'` - Position closed normally
- `'liquidated'` - Position force-closed by exchange

### Decimal Precision

**Important**: Round values to specified precision before outputting:
- Prices & sizes: 2 decimals → `Number(value.toFixed(2))`
- Fees: 6 decimals → `Number(value.toFixed(6))`
- Percentages: 2 decimals → `Number(value.toFixed(2))`

### Exchange Type Identification

Add your exchange identifier to the `exchange_type` field:
- `'jupiter'` - Jupiter Perpetuals (DEX)
- `'backpack'` - Backpack Exchange (CEX)
- `'binance'` - Binance (your new integration)
- `'bybit'` - Bybit (your new integration)
- etc.

---

## Exchange-Specific Considerations

### DEX (Jupiter-like) Integrations

**Key Characteristics:**
- Uses wallet addresses (public blockchain data)
- No credentials required
- Must provide `position_key` (on-chain position identifier)
- Must provide `collateral_usd` and `leverage`
- Transaction signatures are blockchain transaction hashes

**Required Fields:**
```typescript
{
  position_key: "abc123...",      // On-chain position identifier
  collateral_usd: 1000.00,        // Collateral amount
  leverage: 10.5,                 // Position leverage

  // Events use blockchain tx signatures
  events: [{
    transaction_signature: "5QzoXjc...",
    ...
  }]
}
```

### CEX (Backpack-like) Integrations

**Key Characteristics:**
- Uses API credentials (private account data)
- Requires credential storage in `exchange_credentials` table
- Can set `position_key` to `null`
- Set `collateral_usd` and `leverage` to `null` for spot trades
- Must provide `order_id`, `order_type`, `fill_count`

**Required Fields:**
```typescript
{
  position_key: null,             // No on-chain identifier
  collateral_usd: null,           // No collateral for spot
  leverage: null,                 // No leverage for spot
  order_id: "12345",              // Exchange order ID
  order_type: "limit",            // Order type
  fill_count: 3,                  // Number of partial fills

  // Events use generated or exchange-provided IDs
  events: [{
    transaction_signature: "fill_67890",
    original_fill_id: "67890",
    maker_taker: "taker",
    commission_asset: "USDC",
    ...
  }]
}
```

---

## Complete Example: CEX Integration

Here's a complete example for a CEX trade (Binance-style):

```json
{
  "wallet_address": "binance_user_12345",
  "sync_timestamp": "2025-05-15T10:30:00.000Z",
  "positions": [
    {
      "trade_id": "A7K9M",
      "position_key": null,
      "symbol": "BTC/USDT",
      "direction": "long",
      "status": "closed",
      "exchange_type": "binance",

      "entry_price": 50000.00,
      "exit_price": 52000.00,
      "size_usd": 5000.00,
      "notional_size": 0.1,

      "collateral_usd": null,
      "leverage": null,

      "realized_pnl": 200.00,
      "realized_pnl_percent": 4.00,
      "total_fees": 15.50,
      "has_profit": true,

      "entry_time": "2025-05-10T08:00:00.000Z",
      "exit_time": "2025-05-12T14:30:00.000Z",

      "order_id": "BIN123456",
      "order_type": "limit",
      "fill_count": 2,

      "events": [
        {
          "timestamp": "2025-05-10T08:00:00.000Z",
          "transaction_signature": "fill_789012",
          "event_name": "OrderFilled",
          "action": "Buy",
          "type": "Limit",
          "size_usd": 5000.00,
          "price": 50000.00,
          "fee_usd": 7.50,
          "original_fill_id": "789012",
          "maker_taker": "maker",
          "commission_asset": "BNB"
        },
        {
          "timestamp": "2025-05-12T14:30:00.000Z",
          "transaction_signature": "fill_789013",
          "event_name": "OrderFilled",
          "action": "Sell",
          "type": "Market",
          "size_usd": 5200.00,
          "price": 52000.00,
          "fee_usd": 8.00,
          "pnl_usd": 200.00,
          "has_profit": true,
          "original_fill_id": "789013",
          "maker_taker": "taker",
          "commission_asset": "USDT"
        }
      ]
    }
  ]
}
```

---

## Complete Example: DEX Integration

Here's a complete example for a DEX perpetual trade (Jupiter-style):

```json
{
  "wallet_address": "5QzoXjcxVzEdKMx519Nx44vzCuTJfW6FQTJGRQfYzPwT",
  "sync_timestamp": "2025-05-15T10:30:00.000Z",
  "positions": [
    {
      "trade_id": "Q7K9M",
      "position_key": "8j4FmPqQaKSVhL2NkTxW9rYzB3D1cE6v",
      "symbol": "SOL-PERP",
      "direction": "long",
      "status": "closed",
      "exchange_type": "jupiter",

      "entry_price": 100.50,
      "exit_price": 105.25,
      "size_usd": 10000.00,
      "notional_size": 99.50,

      "collateral_usd": 1000.00,
      "leverage": 10.0,

      "realized_pnl": 472.64,
      "realized_pnl_percent": 47.26,
      "total_fees": 2.36,
      "has_profit": true,

      "entry_time": "2025-05-10T10:15:00.000Z",
      "exit_time": "2025-05-11T16:45:00.000Z",

      "order_id": null,
      "order_type": null,
      "fill_count": null,

      "events": [
        {
          "timestamp": "2025-05-10T10:15:00.000Z",
          "transaction_signature": "5QzoXjcxVzEdKMx519Nx44vzCuTJfW6FQTJGRQfYzPwT",
          "event_name": "IncreasePositionEvent",
          "action": "Buy",
          "type": "Market",
          "size_usd": 10000.00,
          "price": 100.50,
          "fee_usd": 1.50
        },
        {
          "timestamp": "2025-05-11T16:45:00.000Z",
          "transaction_signature": "3KpRsWyNmXdFvGhJ8LqB1cT9rYzV4nE2",
          "event_name": "DecreasePositionEvent",
          "action": "Sell",
          "type": "Market",
          "size_usd": 10475.00,
          "price": 105.25,
          "fee_usd": 0.86,
          "pnl_usd": 472.64,
          "has_profit": true
        }
      ]
    }
  ]
}
```

---

## Integration Checklist

### 1. Create Fetcher Module

**File**: `src/lib/[exchange]/fetcher.ts`

Your fetcher must:
- [ ] Accept authentication parameters (API keys, wallet address, etc.)
- [ ] Accept optional date range for filtering
- [ ] Fetch all trades from exchange API
- [ ] Parse trade data into `JsonOutput` format
- [ ] Handle pagination if needed
- [ ] Implement retry logic for failed requests
- [ ] Return `JsonOutput` with all trades

**Function Signature Example:**
```typescript
export async function analyzeTradeHistory(
  credentials: { apiKey: string; apiSecret: string },
  fromDate?: string,
  toDate?: string
): Promise<JsonOutput> {
  // Your implementation
}
```

### 2. Create Types Module

**File**: `src/lib/[exchange]/types.ts`

Define exchange-specific types:
- [ ] API request/response types
- [ ] Raw trade data types
- [ ] Authentication types
- [ ] Error types

### 3. Create Authentication Module (CEX only)

**File**: `src/lib/[exchange]/auth.ts`

If your exchange requires credentials:
- [ ] Implement HMAC signature generation
- [ ] Create authenticated request wrapper
- [ ] Handle API key encryption/decryption
- [ ] Implement credential validation

### 4. Update Sync Endpoint

**File**: `src/app/api/trades/sync/route.ts`

Add your exchange to the sync handler:
- [ ] Add case for your exchange type
- [ ] Call your fetcher function
- [ ] Handle exchange-specific errors
- [ ] Return standardized response

**Example:**
```typescript
if (exchange === 'binance') {
  // Fetch credentials from exchange_credentials table
  const { data: credentials } = await supabase
    .from('exchange_credentials')
    .select('encrypted_api_key, encrypted_api_secret')
    .eq('user_id', userId)
    .eq('exchange', 'binance')
    .single();

  // Decrypt credentials
  const { apiKey, apiSecret } = decryptCredentials(
    credentials.encrypted_api_key,
    credentials.encrypted_api_secret
  );

  // Call your fetcher
  tradeData = await analyzeBinanceTradeHistory(
    { apiKey, apiSecret },
    fromDate,
    toDate
  );
}
```

### 5. Update Type Definitions

**File**: `src/lib/exchanges/types.ts`

- [ ] Add exchange name to `ExchangeType` union type
- [ ] Add to `SUPPORTED_EXCHANGES` array
- [ ] Update any exchange-specific type guards

### 6. Database Schema (Already Supports Your Integration)

The existing schema supports your integration automatically:
- ✅ `trades` table has `exchange_type` field
- ✅ `wallets` table has `exchange` field
- ✅ `exchange_credentials` table stores encrypted API keys
- ✅ CEX-specific fields: `order_id`, `order_type`, `fill_count`
- ✅ DEX-specific fields: `position_key`, `collateral_usd`, `leverage`

**No schema changes needed** - just ensure your fetcher outputs the correct format.

### 7. Frontend Integration

**File**: `src/app/exchange-manager/page.tsx`

- [ ] Add UI for connecting your exchange
- [ ] Implement credential input form (CEX) or wallet address input (DEX)
- [ ] Add sync trigger button
- [ ] Display exchange-specific status indicators

### 8. Testing

- [ ] Test fetcher with real exchange API
- [ ] Verify `JsonOutput` format matches exactly
- [ ] Test trade ID uniqueness and determinism
- [ ] Test sync endpoint with your exchange
- [ ] Verify database upserts work correctly
- [ ] Test with active positions
- [ ] Test with closed positions
- [ ] Test with liquidated positions (if applicable)
- [ ] Test multi-symbol scenarios
- [ ] Test pagination handling (if applicable)

---

## Common Pitfalls

### 1. Incorrect Trade ID Format
❌ **Wrong**: `"trade_12345"` (too long, lowercase)
✅ **Correct**: `"A7K9M"` (5 chars, uppercase alphanumeric)

### 2. Missing Decimal Precision
❌ **Wrong**: `entry_price: 100.123456789`
✅ **Correct**: `entry_price: 100.12` (2 decimals)

### 3. Wrong Status for Active Positions
❌ **Wrong**: `{ status: 'closed', exit_price: null }`
✅ **Correct**: `{ status: 'active' }` (no exit_price/exit_time)

### 4. Missing Exchange Type
❌ **Wrong**: `{ exchange_type: undefined }`
✅ **Correct**: `{ exchange_type: 'binance' }`

### 5. Inconsistent Symbol Format
❌ **Wrong**: `symbol: 'BTCUSDT'` (no separator)
✅ **Correct**: `symbol: 'BTC/USDT'` (CEX format with slash)

---

## Verification Steps

Before submitting your integration, verify:

1. **Output Format**: Run your fetcher and save output to JSON file
   ```bash
   npm run test:json -- --exchange=binance
   ```

2. **Validate Schema**: Ensure all required fields present
   ```typescript
   // Check trade_id format
   const tradeIdRegex = /^[A-Z0-9]{5}$/;
   console.assert(tradeIdRegex.test(position.trade_id));

   // Check decimal precision
   console.assert(position.entry_price.toString().split('.')[1]?.length <= 2);
   ```

3. **Test Sync**: Trigger sync and verify database insertion
   ```bash
   # Check trades table
   SELECT trade_id, symbol, status, exchange_type FROM trades WHERE wallet_id = '...';

   # Check executions table
   SELECT * FROM executions WHERE trade_id IN (SELECT id FROM trades WHERE exchange_type = 'binance');
   ```

4. **Visual Verification**: Check dashboard displays trades correctly

---

## Support & Reference

**Existing Implementations:**
- Jupiter (DEX): `src/lib/jupiter/fetcher.ts`
- Backpack (CEX): `src/lib/backpack/fetcher.ts`

**Database Schema**: `src/lib/supabase.ts`

**Sync Endpoint**: `src/app/api/trades/sync/route.ts`

**Project Documentation**: `CLAUDE.md` and `.cursor/rules/`

---

## Summary

To add a new exchange:

1. **Create fetcher script** that outputs `JsonOutput` format
2. **Ensure trade IDs** are 5-char uppercase alphanumeric
3. **Round decimals** correctly (prices: 2, fees: 6)
4. **Include all events** with complete execution details
5. **Set exchange_type** to your exchange identifier
6. **Handle authentication** via `exchange_credentials` table (CEX)
7. **Update sync endpoint** to call your fetcher
8. **Test thoroughly** with real data

The system is designed to accept any exchange's data as long as it follows the `JsonOutput` format. Focus on making your fetcher output match this structure exactly, and the rest will work automatically.
