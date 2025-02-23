import { WhaleTransaction } from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';
import dotenv from 'dotenv';

dotenv.config();

export class WhaleTrackerPeriodic {
    private db: DatabaseService | null = null;
    private notifications: NotificationService | null = null;
    private intervalId: NodeJS.Timeout | null = null;
    private readonly INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

    async init() {
        this.db = new DatabaseService();
        this.notifications = new NotificationService();
        await this.notifications.init();
        await this.initialize();
    }

    private async initialize() {
        try {
            await this.db?.connect();
            console.log('WhaleTracker2: Connected to database');
            this.startTracking();
        } catch (error) {
            console.error('WhaleTracker2: Failed to initialize:', error);
            throw error;
        }
    }

    private startTracking() {
        console.log('WhaleTracker2: Starting periodic tracking');
        
        // Run immediately on start
        this.checkAndPostLatestTransaction();
        
        // Then set up interval
        this.intervalId = setInterval(() => {
            this.checkAndPostLatestTransaction();
        }, this.INTERVAL_MS);
    }

    private async checkAndPostLatestTransaction() {
        try {
            const latestTransaction = await this.getLatestTransaction();
            
            if (latestTransaction) {
                console.log('WhaleTracker2: Found new transaction to post:', {
                    wallet: latestTransaction.wallet,
                    token: latestTransaction.new_token,
                    amount: latestTransaction.amount_usd
                });
                
                await this.notifications?.notifyNewTrade(latestTransaction);
                console.log('WhaleTracker2: Successfully posted transaction to Twitter');
            } else {
                console.log('WhaleTracker2: No new transactions found');
            }
        } catch (error) {
            console.error('WhaleTracker2: Error processing latest transaction:', error);
        }
    }

    private async getLatestTransaction(): Promise<WhaleTransaction | null> {
        try {
            // Get the latest transaction from MongoDB
            const collection = this.db?.getCollection('twitter-whale-posts');
            const transaction = await collection?.findOne(
                { posted: { $ne: true } }, // Only get transactions that haven't been posted
                { sort: { timestamp: -1 } }
            );

            if (!transaction) {
                return null;
            }

            // Delete the transaction instead of marking it as posted
            await collection?.deleteOne(
                { _id: transaction._id }
            );

            return transaction as unknown as WhaleTransaction;
        } catch (error) {
            console.error('WhaleTracker2: Error fetching latest transaction:', error);
            return null;
        }
    }

    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('WhaleTracker2: Stopped tracking');
        }
    }
} 