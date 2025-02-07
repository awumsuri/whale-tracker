import dotenv from 'dotenv';
import { WhaleTracker } from './services/WhaleTracker';

// Load environment variables
dotenv.config();

const CIELO_WS_URL = process.env.CIELO_WS_URL || 'wss://feed-api.cielo.finance/api/v1/ws';
const MIN_USD_THRESHOLD = 3000;

async function main() {
    try {
        const tracker = new WhaleTracker(CIELO_WS_URL, MIN_USD_THRESHOLD);
        console.log('Whale tracker initialized');
    } catch (error) {
        console.error('Failed to start whale tracker:', error);
        process.exit(1);
    }
}

main(); 