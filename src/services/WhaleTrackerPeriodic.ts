import { WhaleTransaction, ContractMention } from '../types';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';
import dotenv from 'dotenv';

dotenv.config();


export class WhaleTrackerPeriodic {
    private db: DatabaseService | null = null;
    private notifications: NotificationService | null = null;
    private intervalId: NodeJS.Timeout | null = null;
    private readonly INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
    private contractMentions: Map<string, ContractMention> = new Map();
    private readonly MENTION_THRESHOLD = 3;
    private readonly TIME_WINDOW_MS = 60 * 60 * 1000; // 1 hour
    private processedTransactionIds: Map<string, Date> = new Map();

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
        this.scanTrendingAcrossDb();
        
        // Then set up interval
        this.intervalId = setInterval(() => {
            console.log('WhaleTrackerPeriodical: Running scheduled transaction check...');
            this.checkAndPostLatestTransaction();
            this.scanTrendingAcrossDb();
        }, this.INTERVAL_MS);
    }

    private async checkAndPostLatestTransaction() {
        try {
            console.log('WhaleTrackerPeriodic: Checking for new transactions...');
            const latestTransaction = await this.getLatestTransaction();
            
            if (latestTransaction) {                
                await this.notifications?.notifyNewTrade(latestTransaction);
                console.log('WhaleTrackerPeriodic: Successfully posted transaction:', latestTransaction);
                
                // Still track this specific transaction
                await this.trackContractMentions(latestTransaction);
            } else {
                console.log('WhaleTrackerPeriodic: No new transactions found at:', new Date().toISOString());
            }
        } catch (error) {
            console.error('WhaleTrackerPeriodic: Error processing latest transaction:', {
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
            console.error('WhaleTrackerPeriodial: Database operation failed:', {
                error: error instanceof Error ? error.message : error,
                timestamp: new Date().toISOString(),
                stack: error instanceof Error ? error.stack : undefined
            });
            return null;
        }
    }

    /**
     * Scan all recent records (last hour) and update trending counts.
     */
    private async scanTrendingAcrossDb(): Promise<void> {
        try {
            const collection = this.db?.getCollection('twitter_whale_posts');
            if (!collection) return;

            // Fetch a reasonable batch and filter by timestamp in app (timestamps are strings)
            const docs = await collection
                .find({}, { sort: { timestamp: -1 } })
                .limit(10000)
                .toArray();

            const cutoff = new Date(Date.now() - this.TIME_WINDOW_MS);

            for (const doc of docs) {
                const ts = new Date(doc.timestamp);
                if (isNaN(ts.getTime())) continue;
                if (ts < cutoff) break; // since sorted desc by timestamp
                await this.trackContractMentions(doc);
            }

            // Cleanup processedTransactionIds older than 2 hours
            const twoHoursAgo = new Date(Date.now() - 2 * this.TIME_WINDOW_MS);
            for (const [txId, seenAt] of this.processedTransactionIds.entries()) {
                if (seenAt < twoHoursAgo) this.processedTransactionIds.delete(txId);
            }
        } catch (error) {
            console.error('WhaleTrackerPeriodic: Error scanning trending across DB:', error);
        }
    }

    /**
     * Tracks contract address mentions and sends alerts when threshold is reached
     */
    private async trackContractMentions(transaction: any): Promise<void> {
        try {
            const contractAddress = transaction.token_address;
            if (!contractAddress) {
                console.log('WhaleTrackerPeriodic: No contract address found in transaction');
                return;
            }

            // Deduplicate by transaction id across intervals
            const txId = transaction._id?.$oid || transaction._id || `${contractAddress}:${transaction.timestamp}`;
            if (this.processedTransactionIds.has(txId)) {
                return;
            }
            this.processedTransactionIds.set(txId, new Date());

            // Parse the timestamp from the record
            const transactionTimestamp = new Date(transaction.timestamp);
            const oneHourAgo = new Date(transactionTimestamp.getTime() - this.TIME_WINDOW_MS);

            // Get or create contract mention tracking
            let contractMention = this.contractMentions.get(contractAddress);
            if (!contractMention) {
                contractMention = {
                    contractAddress,
                    mentions: []
                };
                this.contractMentions.set(contractAddress, contractMention);
            }

            // Add new mention using the record's timestamp
            contractMention.mentions.push({
                timestamp: transactionTimestamp,
                transactionId: txId
            });

            // Remove mentions older than 1 hour
            contractMention.mentions = contractMention.mentions.filter(
                mention => mention.timestamp > oneHourAgo
            );

            // Check if we should send an alert
            if (contractMention.mentions.length >= this.MENTION_THRESHOLD) {
                await this.notifications?.sendTrendingContractAlert(contractMention, transaction);
            }

            // Clean up old contract mentions (older than 2 hours)
            const twoHoursAgo = new Date(transactionTimestamp.getTime() - 2 * this.TIME_WINDOW_MS);
            for (const [address, mention] of this.contractMentions.entries()) {
                if (mention.mentions.every(m => m.timestamp < twoHoursAgo)) {
                    this.contractMentions.delete(address);
                }
            }

        } catch (error) {
            console.error('WhaleTrackerPeriodic: Error tracking contract mentions:', error);
        }
    }

    /**
     * Sends a Telegram alert for trending contract addresses
     */
   

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