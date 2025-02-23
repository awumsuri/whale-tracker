import dotenv from 'dotenv';
import { WhaleTrackerRealTime } from './services/WhaleTrackerRealTime';
import {  WhaleTrackerPeriodic } from './services/WhaleTrackerPeriodic';

// Load environment variables
dotenv.config();

const CIELO_WS_URL = process.env.CIELO_WS_URL || 'wss://feed-api.cielo.finance/api/v1/ws';
const MIN_USD_THRESHOLD = 3000;

async function main() {
    try {
        // Start real-time tracker
        const tracker = new WhaleTrackerRealTime(CIELO_WS_URL, MIN_USD_THRESHOLD);       
        console.log('Real-time whale tracker initialized');

        // Start periodic tracker
        const periodicTracker = new WhaleTrackerPeriodic();
        await periodicTracker.init()
        console.log('Periodic whale tracker initialized');

        // Handle shutdown
        process.on('SIGINT', () => {
            console.log('Shutting down trackers...');
            //periodicTracker.stop();
            process.exit(0);
        });
    } catch (error) {
        console.error('Failed to start whale trackers:', error);
        process.exit(1);
    }
}

main(); 