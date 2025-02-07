import { WhaleTransaction } from '../types';

export class NotificationService {
    async notifyNewTrade(transaction: WhaleTransaction): Promise<void> {
        // TODO: Implement notification logic
        await this.postToTwitter(transaction);
        await this.sendTelegramAlert(transaction);
    }

    private async postToTwitter(transaction: WhaleTransaction): Promise<void> {
        const message = this.formatTwitterMessage(transaction);
        // TODO: Implement Twitter API integration
        console.log('Posting to Twitter:', message);
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