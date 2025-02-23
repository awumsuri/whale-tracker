import dotenv from 'dotenv';
import { WhaleTransaction } from '../types';
import {  Scraper } from 'agent-twitter-client';
import TelegramBot from 'node-telegram-bot-api';

// Load environment variables from .env file
dotenv.config();

export class NotificationService {
    private twitterClient!: Scraper;
    private telegramBot!: TelegramBot;

    async init() {
        this.twitterClient = new Scraper();
        await this.initializeTwitterClient();
        await this.initializeTelegramBot();
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
                process.env.TWITTER_EMAIL,                
            );
            console.log('Successfully logged into Twitter');
            

        } catch (error) {
            console.error('Failed to initialize Twitter client:', error);
            throw new Error('Twitter authentication failed. Please verify your credentials.');
        }
    }

    private initializeTelegramBot() {
        if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
            throw new Error('Missing Telegram credentials in environment variables');
        }

        this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
        console.log('Successfully initialized Telegram bot');
    }

    async notifyNewTrade(transaction: WhaleTransaction): Promise<void> {
        // TODO: Implement notification logic
        await this.postToTwitter(transaction);
        console.log('Successfully posted to Twitter inside notifyNewTrade');
        await this.sendTelegramAlert(transaction);
        console.log('Successfully sent Telegram alert inside notifyNewTrade');
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
        console.log(`transaction: ${transaction.amount} action: ${transaction.action}`);
        const message = this.formatTelegramMessage(transaction);
        try {
            if (parseFloat(transaction?.amount ?? '0') > 1000 && transaction.action?.toLowerCase() === 'bought') {
                await this.telegramBot.sendMessage(process.env.TELEGRAM_CHAT_ID!, message, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                });
                console.log('Successfully sent Telegram alert:', message);
            }
        } catch (error) {
            console.error('Failed to send Telegram alert:', error);
            throw error;
        }
    }

    private formatTwitterMessage(transaction: WhaleTransaction): string {
        
        return transaction.message === '' ? `🐋 A ${transaction.category} just bought $${transaction.amount_usd.toLocaleString()} of ${transaction.new_token} on ${transaction.chain}` : transaction.message;
    }

    private formatTelegramMessage(transaction: WhaleTransaction): string {
     
        return  transaction.message === '' ? `🚨 Whale Alert 🐋\n\nCategory: ${transaction.category}\nAmount: $${transaction.amount_usd.toLocaleString()}\nToken: ${transaction.new_token}\nChain: ${transaction.chain}` : transaction.message;
    }
} 