import * as fs from 'fs';
import * as path from 'path';
import { OutputData, PositionHistoryItem, FundingHistoryItem, PortfolioDataPoint, GroupedTrade, GroupedPosition } from './types.js';

export class OutputFormatter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async writeJsonFile<T>(
    walletAddress: string,
    endpoint: string,
    data: T[]
  ): Promise<string> {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Determine which timestamp field to convert based on endpoint
    let timestampField = 'created_at';
    if (endpoint.includes('portfolio')) {
      timestampField = 'timestamp';
    }

    // Add readable timestamps to all data items
    const dataWithReadableTimestamps = this.addReadableTimestamps(data, timestampField);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${endpoint}-${walletAddress.substring(0, 8)}-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);

    const outputData: OutputData<T> = {
      wallet_address: walletAddress,
      fetch_timestamp: new Date().toISOString(),
      endpoint,
      total_records: dataWithReadableTimestamps.length,
      data: dataWithReadableTimestamps,
    };

    fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2));

    return filepath;
  }

  private addReadableTimestamps<T>(data: T[], timestampField: string): T[] {
    return data.map(item => ({
      ...item,
      [`${timestampField}_readable`]: new Date((item as any)[timestampField]).toISOString()
    }));
  }

  async writeGroupedTradesFile(
    walletAddress: string,
    trades: GroupedTrade[]
  ): Promise<string> {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `grouped_trades-${walletAddress.substring(0, 8)}-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);

    const outputData = {
      wallet_address: walletAddress,
      fetch_timestamp: new Date().toISOString(),
      endpoint: 'grouped_trades',
      total_trades: trades.length,
      total_fills: trades.reduce((sum, t) => sum + t.fill_count, 0),
      data: trades,
    };

    fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2));
    return filepath;
  }

  async writeGroupedPositionsFile(
    walletAddress: string,
    positions: GroupedPosition[]
  ): Promise<string> {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `grouped_positions-${walletAddress.substring(0, 8)}-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);

    const outputData = {
      wallet_address: walletAddress,
      fetch_timestamp: new Date().toISOString(),
      endpoint: 'grouped_positions',
      total_positions: positions.length,
      open_positions: positions.filter(p => p.status === 'open').length,
      closed_positions: positions.filter(p => p.status === 'closed').length,
      data: positions,
    };

    fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2));
    return filepath;
  }

  printConsoleOutput<T>(
    endpointName: string,
    data: T[],
    walletAddress: string
  ): void {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`${endpointName} Summary`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Total Records: ${data.length}`);

    if (data.length === 0) {
      console.log('No data found.');
      return;
    }

    if (endpointName.includes('Position')) {
      this.printPositionSummary(data as unknown as PositionHistoryItem[]);
    } else if (endpointName.includes('Funding')) {
      this.printFundingSummary(data as unknown as FundingHistoryItem[]);
    } else if (endpointName.includes('Portfolio')) {
      this.printPortfolioSummary(data as unknown as PortfolioDataPoint[]);
    }

    console.log(`\nFirst ${Math.min(10, data.length)} records:`);
    console.table(data.slice(0, 10));
  }

  private printPositionSummary(data: PositionHistoryItem[]): void {
    const symbols = new Set(data.map((item) => item.symbol));
    const totalPnl = data.reduce(
      (sum, item) => sum + parseFloat(item.pnl || '0'),
      0
    );

    const timestamps = data.map((item) => item.created_at);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    console.log(`Symbols: ${Array.from(symbols).join(', ')}`);
    console.log(`Total PnL: ${totalPnl > 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
    console.log(
      `Date Range: ${new Date(minTimestamp).toISOString()} to ${new Date(maxTimestamp).toISOString()}`
    );
  }

  private printFundingSummary(data: FundingHistoryItem[]): void {
    const symbols = new Set(data.map((item) => item.symbol));
    const totalPayout = data.reduce(
      (sum, item) => sum + parseFloat(item.payout),
      0
    );

    const timestamps = data.map((item) => item.created_at);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    console.log(`Symbols: ${Array.from(symbols).join(', ')}`);
    console.log(`Total Funding Paid: ${totalPayout > 0 ? '+' : ''}$${totalPayout.toFixed(2)}`);
    console.log(
      `Date Range: ${new Date(minTimestamp).toISOString()} to ${new Date(maxTimestamp).toISOString()}`
    );
  }

  private printPortfolioSummary(data: PortfolioDataPoint[]): void {
    if (data.length === 0) return;

    const firstEquity = parseFloat(data[0].account_equity);
    const lastEquity = parseFloat(data[data.length - 1].account_equity);
    const totalPnl = parseFloat(data[data.length - 1].pnl);

    const timestamps = data.map((item) => item.timestamp);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    console.log(`Initial Equity: $${firstEquity.toFixed(2)}`);
    console.log(`Final Equity: $${lastEquity.toFixed(2)}`);
    console.log(`Total PnL: ${totalPnl > 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
    console.log(
      `Date Range: ${new Date(minTimestamp).toISOString()} to ${new Date(maxTimestamp).toISOString()}`
    );
  }

  printGroupedTradesSummary(trades: GroupedTrade[]): void {
    console.log(`\nGrouped Trades Summary`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Total Trades: ${trades.length}`);
    console.log(`Total Fills: ${trades.reduce((sum, t) => sum + t.fill_count, 0)}`);

    const totalPnl = trades.reduce((sum, t) => sum + parseFloat(t.total_pnl), 0);
    console.log(`Total PnL: ${totalPnl > 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);

    console.log(`\nSample trades (first 10):`);
    console.table(trades.slice(0, 10).map(t => ({
      trade_id: t.trade_id,
      symbol: t.symbol,
      side: t.side,
      amount: t.total_amount,
      avg_price: t.average_price,
      fills: t.fill_count,
      pnl: t.total_pnl,
      time: t.first_fill_time_readable,
    })));
  }

  printGroupedPositionsSummary(positions: GroupedPosition[]): void {
    console.log(`\nGrouped Positions Summary`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Total Positions: ${positions.length}`);
    console.log(`Open: ${positions.filter(p => p.status === 'open').length}`);
    console.log(`Closed: ${positions.filter(p => p.status === 'closed').length}`);

    const totalPnl = positions.reduce((sum, p) => sum + parseFloat(p.total_pnl), 0);
    console.log(`Total PnL: ${totalPnl > 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);

    console.log(`\nSample positions (first 10):`);
    console.table(positions.slice(0, 10).map(p => ({
      symbol: p.symbol,
      direction: p.direction,
      size: p.position_size,
      entry: p.entry_price,
      exit: p.exit_price,
      pnl: p.total_pnl,
      pnl_pct: p.pnl_percentage + '%',
      duration_hrs: p.duration_hours,
      trades: p.trade_count,
    })));
  }

  static printHeader(
    walletAddress: string,
    endpoints: string[]
  ): void {
    console.log('\n' + '='.repeat(50));
    console.log('Fetching Pacifica Historical Data');
    console.log('='.repeat(50));
    console.log(`Wallet: ${walletAddress}`);
    console.log(`Endpoints: ${endpoints.join(', ')}`);
    console.log(`Rate Limit: 120 requests/min`);
    console.log('='.repeat(50) + '\n');
  }

  static printFooter(totalRecords: number, startTime: number): void {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(50));
    console.log('Fetch Complete');
    console.log('='.repeat(50));
    console.log(`Total Records: ${totalRecords}`);
    console.log(`Duration: ${duration}s`);
    console.log('='.repeat(50) + '\n');
  }
}
