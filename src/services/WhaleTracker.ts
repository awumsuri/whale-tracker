import dotenv from 'dotenv';
import WebSocket from 'ws';
import { WhaleTransaction, WhaleFilter, WebSocketCommand, WhaleConfig, WhaleInfo } from '../types';
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
            this.subscribeToAllWhales();
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

    private subscribeToAllWhales(): void {
        console.log(`Subscribing to ${whaleData.length} whale configurations...`);
        whaleData.forEach(whale => {
            try {
                this.subscribeToFeed(whale);
            } catch (error) {
                console.error(`Failed to subscribe to whale ${whale.token || 'unknown'}:`, error);
            }
        });
    }

    private subscribeToFeed(whale: WhaleConfig): void {
        for (const address of whale.addresses) {

            const command: WhaleFilter = {
                type: 'subscribe_wallet',
                wallet: address,
                filter: {
                    tx_types: ['swap'],
                    chains: [whale.network.toLowerCase()],
                    min_usd_value: this.minUsdThreshold,
                    new_trade: true
                }                
            };

            console.log('Subscribing to feed with filter:',  JSON.stringify(command));
            this.ws.send(JSON.stringify(command));
        }
    }

    private async handleTransaction(event: any): Promise<void> {
        if (event.type === 'feed_subscribed' || event.type === 'wallet_subscribed') {
            console.log('Feed subscribed successfully');
            return;
        }

        // Handle single transaction event
        if (event.type === 'tx' && event.data) {
            const data = event.data;
            
            if (!this.isValidTransaction(data)) {
                console.log(`Skipping invalid transaction: ${JSON.stringify(data)}`);
                return;
            }          

            const whaleInfo: WhaleInfo = await this.db.getWhaleInfo(data.wallet)

            const transaction: WhaleTransaction = {
                wallet: data.wallet,
                new_token: data.is_sell ? data.token1_symbol : data.token0_symbol,
                amount_usd: data.token1_amount_usd || data.token0_amount_usd || 0,
                chain: data.chain,
                trade_type: data.tx_type,
                timestamp: data.timestamp,
                tx_hash: data.tx_hash,
                dex: data.dex,
                is_sell: data.is_sell,
                category: whaleInfo.category
            };

            console.log(`Processing whale transaction:`, {
                wallet: transaction.wallet,
                category: transaction.category,
                amount_usd: transaction.amount_usd,
                token: transaction.new_token,
                is_sell: data.is_sell
            });

            // await this.db.saveTransaction(transaction);
            await this.notifications.notifyNewTrade(transaction);
        }
    }

    private isValidTransaction(data: any): boolean {
        const isValid = data.tx_type === 'swap' && 
            (data.token0_amount_usd >= this.minUsdThreshold || 
             data.token1_amount_usd >= this.minUsdThreshold);
        
        if (!isValid) {
            console.log(`Invalid transaction - Type: ${data.tx_type}, Amount: $${data.token0_amount_usd || data.token1_amount_usd}`);
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

    
   
} 