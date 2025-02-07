import dotenv from 'dotenv';
import WebSocket from 'ws';
import { WhaleTransaction, WhaleFilter, WebSocketCommand } from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';
import whaleData from '../data/whales.json';

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
        console.log(`Initializing WhaleTracker with minimum USD threshold: ${minUsdThreshold}`);
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
            console.log('Received WebSocket message');
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

        console.log('Subscribing to feed with filter:', filter);
        this.ws.send(JSON.stringify(command));
    }

    private async handleTransaction(event: any): Promise<void> {
        // Check if we have a valid data structure
        if (!event.data?.items || !Array.isArray(event.data.items)) {
            console.warn('Received invalid event structure:', event);
            return;
        }

        console.log(`Processing ${event.data.items.length} transactions`);

        // Process each transaction in the items array
        for (const data of event.data.items) {
            if (!this.isValidTransaction(data)) {
                console.log(`Skipping invalid transaction: ${JSON.stringify(data)}`);
                continue;
            }

            const whaleInfo = await this.db.getWhaleInfo(data.wallet);
            if (!whaleInfo) {
                console.log(`No whale info found for wallet: ${data.wallet}`);
                continue;
            }

            const transaction: WhaleTransaction = {
                wallet: data.wallet,
                whale_category: whaleInfo.category,
                new_token: data.token1_symbol || data.symbol || '',
                amount_usd: data.amount_usd || data.token1_amount_usd || 0,
                chain: data.chain,
                trade_type: data.tx_type,
                timestamp: data.timestamp
            };

            console.log(`Processing whale transaction:`, {
                wallet: transaction.wallet,
                category: transaction.whale_category,
                amount_usd: transaction.amount_usd,
                token: transaction.new_token
            });

            await this.db.saveTransaction(transaction);
            await this.notifications.notifyNewTrade(transaction);
        }
    }

    private isValidTransaction(data: any): boolean {
        const isValid = data.tx_type === 'swap' && data.amount_usd >= this.minUsdThreshold;
        if (!isValid) {
            console.log(`Invalid transaction - Type: ${data.tx_type}, Amount: $${data.amount_usd}`);
        }
        return isValid;
    }

    private reconnect(): void {
        if (!this.isConnected) {
            console.log('Attempting to reconnect to WebSocket...');
            this.ws = new WebSocket(this.apiUrl);
            this.setupWebSocket();
        }
    }

    async initialize(): Promise<void> {
        console.log('Initializing whale categories from whale data');
        for (const whale of whaleData.whales) {
            for (const address of whale.addresses) {
                console.log(`Setting category for address ${address} to "${whale.token} Whale"`);
                await this.db.updateWhaleCategory(address, `${whale.token} Whale`);
            }
        }
        console.log('Whale categories initialization complete');
    }
} 