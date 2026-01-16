export class RateLimiter {
  private requestTimestamps: number[] = [];
  private maxRequestsPerMinute: number = 120;
  private delayBetweenRequests: number;

  constructor(delayMs: number = 500) {
    this.delayBetweenRequests = delayMs;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => timestamp > oneMinuteAgo
    );

    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = oldestRequest + 60000 - now;

      if (waitTime > 0) {
        console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await this.sleep(waitTime);
      }
    }

    await this.sleep(this.delayBetweenRequests);

    this.requestTimestamps.push(Date.now());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getMaxRequestsPerMinute(): number {
    return this.maxRequestsPerMinute;
  }
}
