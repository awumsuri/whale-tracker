import dotenv from 'dotenv';
import { WhaleTransaction } from '../types';
import {  Scraper } from 'agent-twitter-client';

// Load environment variables from .env file
dotenv.config();

export class NotificationService {
    private twitterClient: Scraper;

    constructor() {
        this.twitterClient = new Scraper();
        this.initializeTwitterClient();
    }

    private async initializeTwitterClient() {
        try {
            if (!process.env.TWITTER_USERNAME || !process.env.TWITTER_PASSWORD || !process.env.TWITTER_EMAIL) {
                throw new Error('Missing Twitter credentials in environment variables');
            }

            console.log(process.env.TWITTER_USERNAME, process.env.TWITTER_PASSWORD, process.env.TWITTER_EMAIL);
            
            await this.twitterClient.login(
                process.env.TWITTER_USERNAME,
                process.env.TWITTER_PASSWORD,
                process.env.TWITTER_EMAIL
            );
            console.log('Successfully logged into Twitter');
            

        } catch (error) {
            console.error('Failed to initialize Twitter client:', error);
            throw new Error('Twitter authentication failed. Please verify your credentials.');
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
            await this.twitterClient.sendTweet(message);
            console.log('Successfully posted to Twitter:', message);
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
        return `🐋 ${transaction.category} just bought $${transaction.amount_usd.toLocaleString()} of ${transaction.new_token} on ${transaction.chain}`;
    }

    private formatTelegramMessage(transaction: WhaleTransaction): string {
        return `🚨 Whale Alert 🐋\n\nCategory: ${transaction.category}\nAmount: $${transaction.amount_usd.toLocaleString()}\nToken: ${transaction.new_token}\nChain: ${transaction.chain}`;
    }
} 