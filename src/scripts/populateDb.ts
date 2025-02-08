import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import whaleData from '../data/whales.json';

dotenv.config();

async function populateDatabase() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:7777';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db(process.env.MONGODB_DB_NAME || 'whale-tracker');
        const collection = db.collection('whales');

        // Create a unique index on the address field
        await collection.createIndex({ address: 1 }, { unique: true });

        // Flatten the whale data into individual wallet entries
        const walletEntries = whaleData.flatMap(whale => 
            whale.addresses.map(address => ({
                address,
                token: whale.token,
                network: whale.network,
                category: `$${whale.token} Whale`
            }))
        );

        // Insert documents using upsert to avoid duplicates
        const operations = walletEntries.map(entry => ({
            updateOne: {
                filter: { address: entry.address },
                update: { $set: entry },
                upsert: true
            }
        }));

        const result = await collection.bulkWrite(operations);
        
        console.log('Database population completed:');
        console.log(`Matched: ${result.matchedCount}`);
        console.log(`Modified: ${result.modifiedCount}`);
        console.log(`Upserted: ${result.upsertedCount}`);

    } catch (error) {
        console.error('Error populating database:', error);
    } finally {
        await client.close();
    }
}

// Run the population script
populateDatabase().catch(console.error); 