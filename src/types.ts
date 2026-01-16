// Generic API response wrapper
export interface PacificaResponse<T> {
  success: boolean;
  data: T[];
  next_cursor?: string;
  has_more?: boolean;
  error?: string;
  code?: number;
}

// Position/Trade History Item
export interface PositionHistoryItem {
  history_id: number;
  order_id?: number;
  symbol: string;
  amount: string;
  price: string;
  entry_price?: string;
  fee?: string;
  pnl?: string;
  event_type: string;
  side: string;
  created_at: number;
  created_at_readable?: string;
  cause?: string;
}

// Funding History Item
export interface FundingHistoryItem {
  history_id: number;
  symbol: string;
  side: string;
  amount: string;
  payout: string;
  rate: string;
  created_at: number;
  created_at_readable?: string;
}

// Portfolio/Account Equity Data Point
export interface PortfolioDataPoint {
  account_equity: string;
  pnl: string;
  timestamp: number;
  timestamp_readable?: string;
}

// Individual fill within a trade (same as PositionHistoryItem but used in nested context)
export interface FillEvent {
  history_id: number;
  amount: string;
  price: string;
  fee?: string;
  pnl?: string;
  event_type: string;
  created_at: number;
  created_at_readable?: string;
  cause?: string;
}

// A grouped trade (all fills from one order)
export interface GroupedTrade {
  trade_id: string;                // Generated: order_id or fallback to first history_id
  order_id?: number;               // The order that generated these fills
  symbol: string;
  side: string;                    // "close_short", "open_long", etc.

  // Aggregated metrics
  total_amount: string;            // Sum of all fill amounts
  average_price: string;           // Weighted average price
  total_value: string;             // total_amount * average_price
  total_fee: string;               // Sum of all fees
  total_pnl: string;               // Sum of all PnLs
  entry_price?: string;            // Position entry price (from API)

  // Timing
  first_fill_time: number;         // Timestamp of first fill
  last_fill_time: number;          // Timestamp of last fill
  first_fill_time_readable?: string;
  last_fill_time_readable?: string;

  // Individual fills
  fills: FillEvent[];              // Array of individual fills
  fill_count: number;              // Number of fills
}

// A complete position (multiple trades from entry to exit)
export interface GroupedPosition {
  position_id: string;             // Generated: symbol_direction_timestamp
  symbol: string;
  direction: 'long' | 'short';     // Derived from trades

  // Position lifecycle
  opened_at: number;               // Timestamp of first entry trade
  closed_at: number;               // Timestamp of final exit trade
  opened_at_readable?: string;
  closed_at_readable?: string;
  duration_hours: number;          // Time position was open

  // Position metrics
  entry_price: string;             // Weighted avg entry price
  exit_price: string;              // Weighted avg exit price
  position_size: string;           // Maximum position size reached
  total_pnl: string;               // Sum of all trade PnLs
  total_fees: string;              // Sum of all fees
  pnl_percentage: string;          // (exit - entry) / entry * 100

  // Trades that make up this position
  trades: GroupedTrade[];          // Array of trades (entries + exits)
  trade_count: number;             // Number of trades
  status: 'open' | 'closed';       // Position status
}

// CLI Configuration
export interface FetchConfig {
  wallet: string;
  output: 'json' | 'console';
  outputDir: string;
  endpoints: string[];
  startTime?: number;
  endTime?: number;
  timeRange?: string;
  symbol?: string;
  limit: number;
  groupingMode?: 'none' | 'trades' | 'positions' | 'both';
}

// Output file structure
export interface OutputData<T> {
  wallet_address: string;
  fetch_timestamp: string;
  endpoint: string;
  total_records: number;
  data: T[];
}
