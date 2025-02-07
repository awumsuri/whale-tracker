import dotenv from 'dotenv';
import { WhaleTransaction } from '../types';
import {  Scraper } from 'agent-twitter-client';
import { TwitterApi, TwitterApiTokens } from 'twitter-api-v2';

// Load environment variables from .env file
dotenv.config();

export class NotificationService {
    private twitterClient: Scraper;
    private client: TwitterApi | null = null;

    constructor() {
        this.twitterClient = new Scraper();
        this.initializeTwitterClient();
    }

    private async initializeTwitterClient() {
        try {
            if (!process.env.TWITTER_USERNAME || !process.env.TWITTER_PASSWORD || !process.env.TWITTER_EMAIL) {
                throw new Error('Missing Twitter credentials in environment variables');
            }

            // Add more detailed logging
            console.log('Attempting Twitter login...');
            
            try {              

                const tokens: TwitterApiTokens =  {
                    appKey: process.env.TWITTER_API_KEY!,
                    appSecret: process.env.TWITTER_API_SECRET!,
                    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
                    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!
                }

                this.client = new TwitterApi( tokens );
                
                console.log('Successfully logged into Twitter');
            } catch (loginError: any) {
                // More specific error handling for login failures
                const errorMessage = loginError.errors?.[0]?.message || loginError.message || 'Unknown login error';
                console.error('Twitter login failed:', {
                    message: errorMessage,
                    fullError: loginError
                });
                throw new Error(`Twitter login failed: ${errorMessage}`);
            }
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
            const tweet = await this.client?.v2.tweet(message);
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
        return `🐋 ${transaction.whale_category} just bought $${transaction.amount_usd.toLocaleString()} of ${transaction.new_token} on ${transaction.chain}`;
    }

    private formatTelegramMessage(transaction: WhaleTransaction): string {
        return `🚨 Whale Alert 🐋\n\nCategory: ${transaction.whale_category}\nAmount: $${transaction.amount_usd.toLocaleString()}\nToken: ${transaction.new_token}\nChain: ${transaction.chain}`;
    }
} 