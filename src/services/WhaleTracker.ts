import dotenv from 'dotenv';
import WebSocket from 'ws';
import { WhaleTransaction, WhaleFilter, WebSocketCommand } from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';

// Load environment variables from .env file
dotenv.config();

export class WhaleTracker {
    private ws: WebSocket;
    private db: DatabaseService;
    private notifications: NotificationService;
    private isConnected: boolean = false;

    constructor(
        private apiUrl: string,
        private minUsdThreshold: number = 3000,
        private apiKey: string = process.env.CEILO_API_KEY || ''
    ) {
        this.db = new DatabaseService();
        this.notifications = new NotificationService();
        this.ws = new WebSocket(apiUrl, {
            headers: {
                'X-API-KEY': this.apiKey
            }
        });
        this.setupWebSocket();
    }

    private setupWebSocket(): void {
        this.ws.addListener('open', () => {
            this.isConnected = true;
            this.subscribeToFeed();
            console.log('Connected to Cielo WebSocket');
        });

        this.ws.addListener('message', async (data: Buffer) => {
            const event = JSON.parse(data.toString());
            await this.handleTransaction(event);
        });

        this.ws.addListener('close', () => {
            this.isConnected = false;
            console.log('WebSocket connection closed. Attempting to reconnect...');
            setTimeout(() => this.reconnect(), 5000);
        });

        this.ws.addListener('error', (error) => {
            console.error('WebSocket error:', error);
        });
    }

    private subscribeToFeed(): void {
        const filter: WhaleFilter = {
            tx_types: ['swap'],
            min_usd_value: this.minUsdThreshold,
            new_trade: true
        };

        const command: WebSocketCommand = {
            type: 'subscribe_feed',
            filter
        };

        this.ws.send(JSON.stringify(command));
    }

    private async handleTransaction(event: any): Promise<void> {
        // Check if we have a valid data structure
        if (!event.data?.items || !Array.isArray(event.data.items)) {
            return;
        }

        // Process each transaction in the items array
        for (const data of event.data.items) {
            if (!this.isValidTransaction(data)) {
                continue;
            }

            const whaleInfo = await this.db.getWhaleInfo(data.wallet);
            if (!whaleInfo) {
                continue;
            }

            const transaction: WhaleTransaction = {
                wallet: data.wallet,
                whale_category: whaleInfo.category,
                new_token: data.token1_symbol || data.symbol || '', // Handle both swap and transfer cases
                amount_usd: data.amount_usd || data.token1_amount_usd || 0,
                chain: data.chain,
                trade_type: data.tx_type,
                timestamp: data.timestamp
            };

            await this.db.saveTransaction(transaction);
            await this.notifications.notifyNewTrade(transaction);
        }
    }

    private isValidTransaction(data: any): boolean {
        return (
            data.tx_type === 'swap' &&
            data.amount_usd >= this.minUsdThreshold
        );
    }

    private reconnect(): void {
        if (!this.isConnected) {
            this.ws = new WebSocket(this.apiUrl);
            this.setupWebSocket();
        }
    }
} 