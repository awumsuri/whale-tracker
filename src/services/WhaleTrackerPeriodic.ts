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
        console.log('WhaleTracker2: Initializing services...');
        this.db = new DatabaseService();
        this.notifications = new NotificationService();
        await this.notifications.init();
        console.log('WhaleTracker2: Services initialized successfully');
        await this.initialize();
    }

    private async initialize() {
        try {
            console.log('WhaleTracker2: Attempting database connection...');
            await this.db?.connect();
            console.log('WhaleTracker2: Successfully connected to database');
            this.startTracking();
        } catch (error) {
            console.error('WhaleTracker2: Critical failure during initialization:', error);
            throw error;
        }
    }

    private startTracking() {
        console.log(`WhaleTracker2: Starting periodic tracking (Interval: ${this.INTERVAL_MS}ms)`);
        
        // Run immediately on start
        console.log('WhaleTracker2: Performing initial transaction check...');
        this.checkAndPostLatestTransaction();
        
        // Then set up interval
        this.intervalId = setInterval(() => {
            console.log('WhaleTracker2: Running scheduled transaction check...');
            this.checkAndPostLatestTransaction();
        }, this.INTERVAL_MS);
    }

    private async checkAndPostLatestTransaction() {
        try {
            console.log('WhaleTracker2: Checking for new transactions...');
            const latestTransaction = await this.getLatestTransaction();
            
            if (latestTransaction) {
                const transactionDetails = {
                    wallet: latestTransaction.wallet,
                    token: latestTransaction.new_token,
                    amount: latestTransaction.amount_usd,
                    timestamp: new Date().toISOString()
                };
                console.log('WhaleTracker2: Processing new transaction:', transactionDetails);
                
                await this.notifications?.notifyNewTrade(latestTransaction);
                console.log('WhaleTracker2: Successfully posted transaction to Twitter:', transactionDetails);
            } else {
                console.log('WhaleTracker2: No new transactions found at:', new Date().toISOString());
            }
        } catch (error) {
            console.error('WhaleTracker2: Error processing latest transaction:', {
                error: error instanceof Error ? error.message : error,
                timestamp: new Date().toISOString(),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }

    private async getLatestTransaction(): Promise<WhaleTransaction | null> {
        try {
            console.log('WhaleTracker2: Querying database for latest unposted transaction...');
            const collection = this.db?.getCollection('twitter-whale-posts');
            const transaction = await collection?.findOne(
                { posted: { $ne: true } },
                { sort: { timestamp: -1 } }
            );

            if (!transaction) {
                console.log('WhaleTracker2: No unposted transactions found in database');
                return null;
            }

            console.log('WhaleTracker2: Found transaction, proceeding to delete:', transaction._id);
            await collection?.deleteOne({ _id: transaction._id });
            console.log('WhaleTracker2: Successfully deleted transaction from database');

            return transaction as unknown as WhaleTransaction;
        } catch (error) {
            console.error('WhaleTracker2: Database operation failed:', {
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
            console.log('WhaleTracker2: Tracking stopped at:', new Date().toISOString());
        } else {
            console.log('WhaleTracker2: Tracking was not running');
        }
    }
} 