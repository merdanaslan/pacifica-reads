# Pacifica Perps Trade History Fetcher

A TypeScript CLI tool to fetch all historical perps trading data from the Pacifica mainnet API for a given wallet address.

## Features

- Fetches all historical data with automatic pagination
- Supports multiple data types:
  - **Position History**: Trade executions and position data
  - **Funding History**: Funding rate payments
  - **Portfolio History**: Account equity and PnL over time
  - **Order History**: Complete order lifecycle (placements, cancellations, modifications)
  - **Balance History**: Account balance changes over time
- Rate limiting with automatic retry on errors
- Two output modes: JSON files or console output
- Filtering by symbol, time range, and date
- Progress tracking with page counts

## Installation

```bash
npm install
npm run build
```

## Usage

### Basic Usage

Fetch all data for a wallet address:

```bash
npm start -- --wallet <YOUR_WALLET_ADDRESS>
```

### Output to Console

```bash
npm start -- --wallet <YOUR_WALLET_ADDRESS> --output console
```

### Fetch Specific Endpoints

```bash
# Only positions
npm start -- --wallet <YOUR_WALLET_ADDRESS> --endpoints positions

# Positions and funding
npm start -- --wallet <YOUR_WALLET_ADDRESS> --endpoints positions,funding
```

### Filter by Symbol

```bash
npm start -- --wallet <YOUR_WALLET_ADDRESS> --endpoints positions --symbol BTC
```

### Filter by Date Range

```bash
# Start and end time in milliseconds
npm start -- --wallet <YOUR_WALLET_ADDRESS> --start-time 1704067200000 --end-time 1735689600000
```

### Portfolio Time Range

```bash
# Options: 1d, 7d, 14d, 30d, all
npm start -- --wallet <YOUR_WALLET_ADDRESS> --endpoints portfolio --time-range 7d
```

### Custom Output Directory

```bash
npm start -- --wallet <YOUR_WALLET_ADDRESS> --output-dir ./my-data
```

### Grouping Modes

By default, position data is automatically grouped into trades and complete positions:

```bash
# Default: auto-group into trades and positions
npm start -- --wallet <YOUR_WALLET_ADDRESS> --endpoints positions
```

To get raw position history only (no grouping):

```bash
npm start -- --wallet <YOUR_WALLET_ADDRESS> --endpoints positions --group none
```

To group into trades only (not positions):

```bash
npm start -- --wallet <YOUR_WALLET_ADDRESS> --endpoints positions --group trades
```

## Available Endpoints

The tool can fetch 5 types of historical data:

### positions
Trade executions and fills with PnL, fees, and entry/exit details.

### funding
Funding rate payments for open positions over time.

### portfolio
Account equity snapshots (balance + unrealized PnL) over time.

### orders
Complete order lifecycle including placements, cancellations, modifications, stop losses, and take profits. Shows orders that were placed but cancelled before filling, partial fills vs full fills, order adjustments, and rejected orders.

### balance
Raw USD balance changes tracking deposits, withdrawals, and settled PnL. Separate from portfolio equity which includes unrealized PnL.

Examples:

```bash
# Fetch all data types (default)
npm start -- --wallet <address>

# Fetch only trades and orders
npm start -- --wallet <address> --endpoints positions,orders

# Fetch only balance history
npm start -- --wallet <address> --endpoints balance
```

## Command-Line Arguments

### Required
- `--wallet <address>` - Wallet address to fetch data for

### Optional
- `--output <json|console>` - Output format (default: json)
- `--output-dir <path>` - Output directory for JSON files (default: ./output)
- `--endpoints <csv>` - Comma-separated endpoints: positions,funding,portfolio,orders,balance (default: all)
- `--start-time <ms>` - Start time in milliseconds (positions, orders only)
- `--end-time <ms>` - End time in milliseconds (positions, orders only)
- `--time-range <range>` - Portfolio time range: 1d|7d|14d|30d|all (default: all)
- `--symbol <symbol>` - Filter by symbol (positions, orders only)
- `--limit <number>` - Records per page (default: 100)
- `--group <mode>` - Grouping mode for positions: none|trades|both (default: both)
  - `none`: Raw position history only
  - `trades`: Group fills by order_id into complete trades
  - `both`: Group fills into trades, then trades into complete positions
- `--help` - Show help message

## Output

### JSON Mode (Default)

Files are saved to the `output/` directory (or custom directory) with the format:

```
output/
├── positions_history-{wallet}-{timestamp}.json
├── funding_history-{wallet}-{timestamp}.json
└── portfolio_history-{wallet}-{timestamp}.json
```

Each JSON file contains:

```json
{
  "wallet_address": "BrZp5bidJ3WUvceSq7X78bhjTfZXeezzGvGEV4hAYKTa",
  "fetch_timestamp": "2026-01-16T18:45:23.000Z",
  "endpoint": "positions_history",
  "total_records": 245,
  "data": [
    {
      "history_id": 19329801,
      "symbol": "BTC",
      "amount": "0.1",
      "price": "89471.00",
      "pnl": "-0.022965",
      "side": "close_long",
      "created_at": 1765018588190
    }
  ]
}
```

### Console Mode

Displays summary statistics and first 10 records for each endpoint:

```
==================================================
Fetching Pacifica Historical Data
==================================================
Wallet: BrZp5bidJ3WUvceSq7X78bhjTfZXeezzGvGEV4hAYKTa
Endpoints: positions, funding, portfolio
Rate Limit: 120 requests/min
==================================================

[1/3] Fetching Position History...
  Page 1: 100 records
  Page 2: 100 records
  Page 3: 45 records
  ✓ Completed: 245 total records

==================================================
Position History Summary
==================================================
Total Records: 245
Symbols: BTC, ETH, SOL
Total PnL: +$1234.56
Date Range: 2025-06-15 to 2026-01-16
```

## API Endpoints Used

- `GET /api/v1/positions/history` - Position/trade history
- `GET /api/v1/funding/history` - Funding payments
- `GET /api/v1/portfolio` - Account equity history
- `GET /api/v1/orders/history` - Order lifecycle data
- `GET /api/v1/account/balance/history` - Account balance changes

Base URL: `https://api.pacifica.fi/api/v1`

## Features

### Automatic Pagination

The script automatically fetches all pages using cursor-based pagination until all historical data is retrieved.

### Rate Limiting

Respects Pacifica API rate limits with automatic throttling (120 requests/min)

### Error Handling

Automatic retry with exponential backoff for:
- 429 (Rate Limit Exceeded)
- 500/503 (Server Errors)
- Network errors

## Development

### Build

```bash
npm run build
```

### Run Development Mode

```bash
npm run dev -- --wallet <address>
```

## Project Structure

```
pacifica-reads/
├── src/
│   ├── index.ts          # Main CLI entry point
│   ├── types.ts          # TypeScript interfaces
│   ├── fetcher.ts        # Pagination engine
│   ├── rate-limiter.ts   # Rate limiting logic
│   └── formatters.ts     # Output formatting
├── dist/                 # Compiled JavaScript
├── output/               # Generated JSON files
├── package.json
├── tsconfig.json
└── README.md
```

## Requirements

- Node.js v20+ (for native fetch API)
- TypeScript 5.3+

## License

MIT
