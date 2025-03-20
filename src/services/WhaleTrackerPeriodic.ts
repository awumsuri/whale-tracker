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
        console.log('WhaleTrackerPeriodical: Initializing services...');
        this.db = new DatabaseService();
        this.notifications = new NotificationService();
        await this.notifications.init();
        console.log('WhaleTrackerPeriodical: Services initialized successfully');
        await this.initialize();
    }

    private async initialize() {
        try {
            console.log('WhaleTrackerPeriodical: Attempting database connection...');
            await this.db?.connect();
            console.log('WhaleTrackerPeriodical: Successfully connected to database');
            this.startTracking();
        } catch (error) {
            console.error('WhaleTrackerPeriodical: Critical failure during initialization:', error);
            throw error;
        }
    }

    private startTracking() {
        console.log(`WhaleTrackerPeriodical: Starting periodic tracking (Interval: ${this.INTERVAL_MS}ms)`);
        
        // Run immediately on start
        console.log('WhaleTrackerPeriodical: Performing initial transaction check...');
        this.checkAndPostLatestTransaction();
        
        // Then set up interval
        this.intervalId = setInterval(() => {
            console.log('WhaleTrackerPeriodical: Running scheduled transaction check...');
            this.checkAndPostLatestTransaction();
        }, this.INTERVAL_MS);
    }

    private async checkAndPostLatestTransaction() {
        try {
            console.log('WhaleTrackerPeriodical: Checking for new transactions...');
            const latestTransaction = await this.getLatestTransaction();
            
            if (latestTransaction) {                
                await this.notifications?.notifyNewTrade(latestTransaction);
                console.log('WhaleTrackerPeriodical: Successfully posted transaction:', latestTransaction);
            } else {
                console.log('WhaleTrackerPeriodical: No new transactions found at:', new Date().toISOString());
            }
        } catch (error) {
            console.error('WhaleTrackerPeriodical: Error processing latest transaction:', {
                error: error instanceof Error ? error.message : error,
                timestamp: new Date().toISOString(),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }

    private async getLatestTransaction(): Promise<WhaleTransaction | null> {
        try {
            console.log('WhaleTrackerPeriodical: Querying database for latest unposted transaction...');
            const collection = this.db?.getCollection('twitter_whale_posts');
            const transaction = await collection?.findOne(
                { posted: { $ne: true }, amount: { $gte: 10000 } },
                { sort: { timestamp: -1 } }
            );

            if (!transaction) {
                console.log('WhaleTrackerPeriodical: No unposted transactions found in database');
                return null;
            }

            console.log('WhaleTrackerPeriodical: Found transaction, proceeding to delete:', transaction._id);
            await collection?.deleteOne({ _id: transaction._id });
            console.log('WhaleTrackerPeriodical: Successfully deleted transaction from database');

            return transaction as unknown as WhaleTransaction;
        } catch (error) {
            console.error('WhaleTrackerPeriodical: Database operation failed:', {
                error: error instanceof Error ? error.message : error,
                timestamp: new Date().toISOString(),
                stack: error instanceof Error ? error.stack : undefined
            });
            return null;
        }
    }

    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('WhaleTrackerPeriodical: Tracking stopped at:', new Date().toISOString());
        } else {
            console.log('WhaleTrackerPeriodical: Tracking was not running');
        }
    }
} 