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
}

// Portfolio/Account Equity Data Point
export interface PortfolioDataPoint {
  account_equity: string;
  pnl: string;
  timestamp: number;
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
}

// Output file structure
export interface OutputData<T> {
  wallet_address: string;
  fetch_timestamp: string;
  endpoint: string;
  total_records: number;
  data: T[];
}
