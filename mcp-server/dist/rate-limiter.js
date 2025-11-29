"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    requestCount = 0;
    lastReset = Date.now();
    limit;
    interval;
    constructor(limit = 50, intervalMs = 60000) {
        this.limit = limit;
        this.interval = intervalMs;
    }
    checkLimit() {
        const now = Date.now();
        if (now - this.lastReset > this.interval) {
            this.requestCount = 0;
            this.lastReset = now;
        }
        if (this.requestCount >= this.limit) {
            throw new Error('LIMIT_REACHED: Free tier limit exceeded. Please wait before sending more requests.');
        }
        this.requestCount++;
    }
}
exports.RateLimiter = RateLimiter;
