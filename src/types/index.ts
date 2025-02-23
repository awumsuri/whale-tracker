export interface WhaleFilter {
    type: string;
    wallet: string;
    filter: {
        tx_types: string[];
        min_usd_value: number;
        new_trade: boolean;
        chains?: string[];
        tokens?: string[];
    }
}

export interface WebSocketCommand {
    type: string;
    filter?: WhaleFilter;
    list_id?: number;
    wallet?: string;
}

export interface WhaleTransaction {
    wallet: string;    
    new_token: string;
    amount_usd: number;
    chain: string;
    trade_type?: string;
    timestamp?: number;
    tx_hash?: string;
    dex: string;
    is_sell: boolean;
    category: string;
    message: string;
}

export interface WhaleInfo {
    id: string;
    address: string;
    category: string;
    lastBuyToken?: string;
    buyAmount?: number;
    chain?: string;
    timestamp?: number;
} 

export interface WhaleConfig {
    token: string;
    network: string;
    addresses: string[];
}
