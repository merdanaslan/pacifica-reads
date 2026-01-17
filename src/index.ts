import { FetchConfig, PositionHistoryItem, FundingHistoryItem, PortfolioDataPoint, OrderHistoryItem, BalanceHistoryItem } from './types.js';
import { PacificaFetcher } from './fetcher.js';
import { OutputFormatter } from './formatters.js';
import { TradeGrouper } from './grouper.js';

function parseCliArgs(): FetchConfig {
  const args = process.argv.slice(2);
  const config: Partial<FetchConfig> = {
    output: 'json',
    outputDir: './output',
    endpoints: ['positions', 'funding', 'portfolio', 'orders', 'balance'],
    limit: 100,
    groupingMode: 'both', // Auto-generate grouped trades and positions
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--wallet':
        config.wallet = nextArg;
        i++;
        break;
      case '--output':
        config.output = nextArg as 'json' | 'console';
        i++;
        break;
      case '--output-dir':
        config.outputDir = nextArg;
        i++;
        break;
      case '--endpoints':
        config.endpoints = nextArg.split(',').map((e) => e.trim());
        i++;
        break;
      case '--start-time':
        config.startTime = parseInt(nextArg);
        i++;
        break;
      case '--end-time':
        config.endTime = parseInt(nextArg);
        i++;
        break;
      case '--time-range':
        config.timeRange = nextArg;
        i++;
        break;
      case '--symbol':
        config.symbol = nextArg;
        i++;
        break;
      case '--limit':
        config.limit = parseInt(nextArg);
        i++;
        break;
      case '--group':
        config.groupingMode = nextArg as 'none' | 'trades' | 'positions' | 'both';
        i++;
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown argument: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  if (!config.wallet) {
    console.error('Error: --wallet argument is required\n');
    printHelp();
    process.exit(1);
  }

  return config as FetchConfig;
}

function printHelp(): void {
  console.log(`
Pacifica Perps Trade History Fetcher

Usage:
  npm start -- --wallet <address> [options]

Required Arguments:
  --wallet <address>        Wallet address to fetch data for

Optional Arguments:
  --endpoints <csv>         Comma-separated endpoints: positions,funding,portfolio,orders,balance (default: all)
  --start-time <ms>         Start time in milliseconds (positions, orders only)
  --end-time <ms>           End time in milliseconds (positions, orders only)
  --time-range <range>      Portfolio time range: 1d|7d|14d|30d|all (default: all)
  --symbol <symbol>         Filter by symbol (positions, orders only)
  --limit <number>          Records per page (default: 100)
  --group <mode>            Group positions: none|trades|both (default: both)
  --help                    Show this help message

Examples:
  npm start -- --wallet BrZp5bidJ3WUvceSq7X78bhjTfZXeezzGvGEV4hAYKTa
  npm start -- --wallet <address> --endpoints positions --symbol BTC
  npm start -- --wallet <address> --endpoints positions --group trades
  npm start -- --wallet <address> --endpoints positions --group both
  npm start -- --wallet <address> | jq '.grouped_positions'
`);
}

async function fetchPositionsHistory(
  fetcher: PacificaFetcher,
  config: FetchConfig
): Promise<PositionHistoryItem[]> {
  const params: Record<string, string> = {
    account: config.wallet,
    limit: config.limit.toString(),
  };

  if (config.startTime) params.start_time = config.startTime.toString();
  if (config.endTime) params.end_time = config.endTime.toString();
  if (config.symbol) params.symbol = config.symbol;

  return await fetcher.fetchAllPages<PositionHistoryItem>('/positions/history', params);
}

async function fetchFundingHistory(
  fetcher: PacificaFetcher,
  config: FetchConfig
): Promise<FundingHistoryItem[]> {
  const params: Record<string, string> = {
    account: config.wallet,
    limit: config.limit.toString(),
  };

  return await fetcher.fetchAllPages<FundingHistoryItem>('/funding/history', params);
}

async function fetchPortfolioHistory(
  fetcher: PacificaFetcher,
  config: FetchConfig
): Promise<PortfolioDataPoint[]> {
  const params: Record<string, string> = {
    account: config.wallet,
    time_range: config.timeRange || 'all',
    limit: config.limit.toString(),
  };

  return await fetcher.fetchAllPages<PortfolioDataPoint>('/portfolio', params);
}

async function fetchOrderHistory(
  fetcher: PacificaFetcher,
  config: FetchConfig
): Promise<OrderHistoryItem[]> {
  const params: Record<string, string> = {
    account: config.wallet,
    limit: config.limit.toString(),
  };

  if (config.startTime) params.start_time = config.startTime.toString();
  if (config.endTime) params.end_time = config.endTime.toString();
  if (config.symbol) params.symbol = config.symbol;

  return await fetcher.fetchAllPages<OrderHistoryItem>('/orders/history', params);
}

async function fetchBalanceHistory(
  fetcher: PacificaFetcher,
  config: FetchConfig
): Promise<BalanceHistoryItem[]> {
  const params: Record<string, string> = {
    account: config.wallet,
    limit: config.limit.toString(),
  };

  return await fetcher.fetchAllPages<BalanceHistoryItem>('/account/balance/history', params);
}

async function main(): Promise<void> {
  try {
    const config = parseCliArgs();
    const fetcher = new PacificaFetcher(true); // Silent mode
    const output: any = {};

    if (config.endpoints.includes('positions')) {
      const data = await fetchPositionsHistory(fetcher, config);
      output.positions = data;

      // Apply grouping if requested
      if (config.groupingMode === 'trades' || config.groupingMode === 'both') {
        const grouper = new TradeGrouper();
        const groupedTrades = grouper.groupByOrder(data);
        output.grouped_trades = groupedTrades;

        if (config.groupingMode === 'both') {
          const groupedPositions = grouper.groupByPosition(groupedTrades);
          output.grouped_positions = groupedPositions;
        }
      }
    }

    if (config.endpoints.includes('funding')) {
      const data = await fetchFundingHistory(fetcher, config);
      output.funding = data;
    }

    if (config.endpoints.includes('portfolio')) {
      const data = await fetchPortfolioHistory(fetcher, config);
      output.portfolio = data;
    }

    if (config.endpoints.includes('orders')) {
      const data = await fetchOrderHistory(fetcher, config);
      output.orders = data;
    }

    if (config.endpoints.includes('balance')) {
      const data = await fetchBalanceHistory(fetcher, config);
      output.balance = data;
    }

    // Output raw JSON to stdout
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
