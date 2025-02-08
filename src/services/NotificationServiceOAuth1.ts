import dotenv from 'dotenv';
import { WhaleTransaction } from '../types';
import {  Scraper } from 'agent-twitter-client';
import { TwitterApi, TwitterApiTokens } from 'twitter-api-v2';
import axios from 'axios';

// Load environment variables from .env file
dotenv.config();

export class NotificationService {
    private twitterClient: Scraper;
    private client: TwitterApi | null = null;
    private authServerUrl = 'http://localhost:3333';

    constructor() {
        this.twitterClient = new Scraper();
        this.initializeTwitterClient();
    }

    private async initializeTwitterClient() {
        try {
            // Use environment variables for Twitter credentials
            const accessToken = process.env.TWITTER_ACCESS_TOKEN;
            const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
            const apiKey = process.env.TWITTER_API_KEY;
            const apiSecret = process.env.TWITTER_API_SECRET;
            
            if (!accessToken || !accessSecret || !apiKey || !apiSecret) {
                throw new Error('Missing Twitter credentials in environment variables');
            }

            // Initialize Twitter client with the credentials
            this.client = new TwitterApi({
                appKey: apiKey,
                appSecret: apiSecret,
                accessToken: accessToken,
                accessSecret: accessSecret,
            });
            
            console.log('Successfully authenticated with Twitter');
        } catch (error) {
            console.error('Failed to initialize Twitter client:', error);
            throw error;
        }
    }

    async notifyNewTrade(transaction: WhaleTransaction): Promise<void> {
        // TODO: Implement notification logic
        await this.postToTwitter(transaction);
        await this.sendTelegramAlert(transaction);
    }

    private async postToTwitter(transaction: WhaleTransaction): Promise<void> {
        const message = this.formatTwitterMessage(transaction);
        try {
            // await this.twitterClient.sendTweet(message);
            const tweet = await this.client?.v1.tweet(message);
            console.log('Successfully posted to Twitter:', tweet);
        } catch (error) {
            console.error('Failed to post to Twitter:', error);
            throw error;
        }
    }

    private async sendTelegramAlert(transaction: WhaleTransaction): Promise<void> {
        const message = this.formatTelegramMessage(transaction);
        // TODO: Implement Telegram API integration
        console.log('Sending Telegram alert:', message);
    }

    private formatTwitterMessage(transaction: WhaleTransaction): string {
        return `🐋 ${transaction.wallet} just bought $${transaction.amount_usd.toLocaleString()} of ${transaction.new_token} on ${transaction.chain} on DEX ${transaction.dex} \n
        hash: ${transaction.tx_hash}`;
    }

    private formatTelegramMessage(transaction: WhaleTransaction): string {
        return `🚨 Whale Alert 🐋\n\nCategory: ${transaction.category}\nAmount: $${transaction.amount_usd.toLocaleString()}\nToken: ${transaction.new_token}\nChain: ${transaction.chain}`;
    }
} 