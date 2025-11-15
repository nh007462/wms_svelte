import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
interface UpgradeableServer {
    on(event: 'upgrade', listener: (request: IncomingMessage, socket: Duplex, head: Buffer) => void): this;
}
export declare function setupWebSocket(server: UpgradeableServer): void;
export {};
