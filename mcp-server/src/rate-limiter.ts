export class RateLimiter {
	private requestCount: number = 0;
	private lastReset: number = Date.now();
	private readonly limit: number;
	private readonly interval: number;

	constructor(limit: number = 50, intervalMs: number = 60000) {
		this.limit = limit;
		this.interval = intervalMs;
	}

	checkLimit(): void {
		const now = Date.now();
		if (now - this.lastReset > this.interval) {
			this.requestCount = 0;
			this.lastReset = now;
		}

		if (this.requestCount >= this.limit) {
			throw new Error(
				'LIMIT_REACHED: Free tier limit exceeded. Please wait before sending more requests.'
			);
		}

		this.requestCount++;
	}
}
