import * as fs from 'fs';
import * as path from 'path';
import { OutputData, PositionHistoryItem, FundingHistoryItem, PortfolioDataPoint } from './types.js';

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

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${endpoint}-${walletAddress.substring(0, 8)}-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);

    const outputData: OutputData<T> = {
      wallet_address: walletAddress,
      fetch_timestamp: new Date().toISOString(),
      endpoint,
      total_records: data.length,
      data,
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
