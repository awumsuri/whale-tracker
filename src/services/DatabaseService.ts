import { WhaleInfo, WhaleTransaction } from '../types';
import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

export class DatabaseService {
    private client: MongoClient;
    private db: Db;

    constructor() {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:7777';
        const dbName = process.env.MONGODB_DB_NAME || 'whale-tracker';
        
        this.client = new MongoClient(uri);
        this.db = this.client.db(dbName);
    }

    async connect(): Promise<void> {
        try {
            await this.client.connect();
            console.log('Connected to MongoDB');
        } catch (error) {
            console.error('MongoDB connection error:', error);
            throw error;
        }
    }

    getCollection(name: string): Collection {
        return this.db.collection(name);
    }

    async getWhaleInfo(address: string): Promise<WhaleInfo | null> {
        const whale = await this.db.collection('whales').findOne({ address });
        if (!whale) return null;
        
        return {
            id: whale._id.toString(),
            address: whale.address,
            category: whale.category
        };
    }

    async saveTransaction(transaction: WhaleTransaction): Promise<void> {
        await this.db.collection('transactions').insertOne({
            ...transaction,
            posted: false, // Add posted flag for tracking
            timestamp: transaction.timestamp || Date.now()
        });
    }

    async updateWhaleCategory(address: string, newCategory: string): Promise<void> {
        await this.db.collection('whales').updateOne(
            { address },
            { $set: { category: newCategory } },
            { upsert: true }
        );
    }
} 