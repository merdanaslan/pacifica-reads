import { FetchConfig, PositionHistoryItem, FundingHistoryItem, PortfolioDataPoint } from './types.js';
import { PacificaFetcher } from './fetcher.js';
import { OutputFormatter } from './formatters.js';
import { TradeGrouper } from './grouper.js';

function parseCliArgs(): FetchConfig {
  const args = process.argv.slice(2);
  const config: Partial<FetchConfig> = {
    output: 'json',
    outputDir: './output',
    endpoints: ['positions', 'funding', 'portfolio'],
    limit: 100,
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
  --output <json|console>   Output format (default: json)
  --output-dir <path>       Output directory for JSON files (default: ./output)
  --endpoints <csv>         Comma-separated endpoints: positions,funding,portfolio (default: all)
  --start-time <ms>         Start time in milliseconds (positions only)
  --end-time <ms>           End time in milliseconds (positions only)
  --time-range <range>      Portfolio time range: 1d|7d|14d|30d|all (default: all)
  --symbol <symbol>         Filter by symbol (positions only)
  --limit <number>          Records per page (default: 100)
  --group <mode>            Group positions: none|trades|positions|both (default: none)
  --help                    Show this help message

Examples:
  npm start -- --wallet BrZp5bidJ3WUvceSq7X78bhjTfZXeezzGvGEV4hAYKTa
  npm start -- --wallet <address> --output console
  npm start -- --wallet <address> --endpoints positions --symbol BTC
  npm start -- --wallet <address> --endpoints positions --group trades
  npm start -- --wallet <address> --endpoints positions --group both
`);
}

async function fetchPositionsHistory(
  fetcher: PacificaFetcher,
  config: FetchConfig
): Promise<PositionHistoryItem[]> {
  console.log('[1/3] Fetching Position History...');

  const params: Record<string, string> = {
    account: config.wallet,
    limit: config.limit.toString(),
  };

  if (config.startTime) params.start_time = config.startTime.toString();
  if (config.endTime) params.end_time = config.endTime.toString();
  if (config.symbol) params.symbol = config.symbol;

  const data = await fetcher.fetchAllPages<PositionHistoryItem>('/positions/history', params);
  console.log(`  ✓ Completed: ${data.length} total records\n`);

  return data;
}

async function fetchFundingHistory(
  fetcher: PacificaFetcher,
  config: FetchConfig
): Promise<FundingHistoryItem[]> {
  console.log('[2/3] Fetching Funding History...');

  const params: Record<string, string> = {
    account: config.wallet,
    limit: config.limit.toString(),
  };

  const data = await fetcher.fetchAllPages<FundingHistoryItem>('/funding/history', params);
  console.log(`  ✓ Completed: ${data.length} total records\n`);

  return data;
}

async function fetchPortfolioHistory(
  fetcher: PacificaFetcher,
  config: FetchConfig
): Promise<PortfolioDataPoint[]> {
  console.log('[3/3] Fetching Portfolio/Equity History...');

  const params: Record<string, string> = {
    account: config.wallet,
    time_range: config.timeRange || 'all',
    limit: config.limit.toString(),
  };

  const data = await fetcher.fetchAllPages<PortfolioDataPoint>('/portfolio', params);
  console.log(`  ✓ Completed: ${data.length} total records\n`);

  return data;
}

async function main(): Promise<void> {
  try {
    const config = parseCliArgs();
    const fetcher = new PacificaFetcher();
    const formatter = new OutputFormatter(config.outputDir);
    const startTime = Date.now();

    OutputFormatter.printHeader(
      config.wallet,
      config.endpoints
    );

    let totalRecords = 0;

    if (config.endpoints.includes('positions')) {
      const data = await fetchPositionsHistory(fetcher, config);
      totalRecords += data.length;

      // Always save raw data
      if (config.output === 'json') {
        const filepath = await formatter.writeJsonFile(config.wallet, 'positions_history', data);
        console.log(`Raw positions saved: ${filepath}\n`);
      } else {
        formatter.printConsoleOutput('Position History', data, config.wallet);
      }

      // Apply grouping if requested
      const grouper = new TradeGrouper();

      if (config.groupingMode === 'trades' || config.groupingMode === 'both') {
        console.log('Grouping trades by order...');
        const groupedTrades = grouper.groupByOrder(data);

        if (config.output === 'json') {
          const tradesFile = await formatter.writeGroupedTradesFile(
            config.wallet,
            groupedTrades
          );
          console.log(`Grouped trades saved: ${tradesFile}\n`);
        } else {
          formatter.printGroupedTradesSummary(groupedTrades);
        }

        // Position grouping requires trades as input
        if (config.groupingMode === 'both') {
          console.log('Grouping positions...');
          const groupedPositions = grouper.groupByPosition(groupedTrades);

          if (config.output === 'json') {
            const positionsFile = await formatter.writeGroupedPositionsFile(
              config.wallet,
              groupedPositions
            );
            console.log(`Grouped positions saved: ${positionsFile}\n`);
          } else {
            formatter.printGroupedPositionsSummary(groupedPositions);
          }
        }
      }
    }

    if (config.endpoints.includes('funding')) {
      const data = await fetchFundingHistory(fetcher, config);
      totalRecords += data.length;

      if (config.output === 'json') {
        const filepath = await formatter.writeJsonFile(config.wallet, 'funding_history', data);
        console.log(`Saved to: ${filepath}\n`);
      } else {
        formatter.printConsoleOutput('Funding History', data, config.wallet);
      }
    }

    if (config.endpoints.includes('portfolio')) {
      const data = await fetchPortfolioHistory(fetcher, config);
      totalRecords += data.length;

      if (config.output === 'json') {
        const filepath = await formatter.writeJsonFile(config.wallet, 'portfolio_history', data);
        console.log(`Saved to: ${filepath}\n`);
      } else {
        formatter.printConsoleOutput('Portfolio History', data, config.wallet);
      }
    }

    OutputFormatter.printFooter(totalRecords, startTime);
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
