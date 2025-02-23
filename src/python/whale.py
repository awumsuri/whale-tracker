import requests
import json
import time
from datetime import datetime, timedelta, timezone
import pymongo
from pymongo import MongoClient
import os

base_url = "https://swap-api.assetdash.com/api/api_v5/whalewatch"

# Headers including the Bearer Token for authentication
headers = {
    "Accept": "application/json, text/plain, */*",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjQ3MTQ5NjAyNzIxLCJzdWIiOiI3ZGNiMTVmMi1iMTM0LTQxNjAtYjI4OC1jYTEwOGE0YzhiNjkifQ.Izz4asUZIIckHrtHmbNzQGlSYqMgQJRhrUOFLQKug7I",  # Replace with your actual Bearer token
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Origin": "https://swap.assetdash.com",
}

# Initialize last seen timestamp (set it to None to fetch latest trades initially)
last_timestamp = None

# MongoDB connection setup
mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:7777/')  # Default fallback if env var not set
client = MongoClient(mongo_uri)
db = client['whale-tracker']  # Database name
trades_collection = db['twitter-whale-posts']  # Collection name

def format_market_cap(market_cap):
    if market_cap >= 1_000_000_000:
        return f"${market_cap / 1_000_000_000:.2f}B"
    elif market_cap >= 1_000_000:
        return f"${market_cap / 1_000_000:.2f}M"
    elif market_cap >= 1_000:
        return f"${market_cap / 1_000:.0f}k"
    else:
        return f"${market_cap:.0f}"

def fetch_live_whale_trades():
    """
    Fetches whale trades since the last recorded timestamp and saves to MongoDB.
    """
    global last_timestamp  # Use global variable to track the last seen timestamp

    # If it's the first run, get the latest trades (set an initial timestamp)
    if last_timestamp is None:
        last_timestamp = datetime.utcnow().isoformat()
        
    # Convert last_timestamp to a datetime object and subtract 20 minutes
    last_timestamp_dt = datetime.fromisoformat(last_timestamp)
    adjusted_timestamp = last_timestamp_dt - timedelta(minutes=20)

    # Convert adjusted timestamp back to ISO format
    adjusted_timestamp_str = adjusted_timestamp.isoformat(timespec='seconds')

    url = f"{base_url}/transactions/list?page=1&limit=100&after_timestamp={adjusted_timestamp_str}"

    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()

            if data.get("transactions"):
                latest_trades = data["transactions"]

                # Extract the most recent timestamp from fetched trades
                new_timestamp = max(tx["timestamp"] for tx in latest_trades)

                # Process transactions
                print("\n🔹 New Whale Transactions Found:")
                for tx in latest_trades:
                    whale_name = tx["swap_whalewatch_list"]["name"].replace(" ", "")
                    trade_type = tx["transaction_type"]
                    token_name = tx["swap_token"]["name"]
                    token_symbol = tx["swap_token"]["symbol"]
                    token_address = tx["swap_token"]["token_address"]
                    amount = tx["trade_amount_rounded"]
                    market_cap = format_market_cap(tx["token_market_cap"])

                    # Choose emoji based on amount
                    emoji = "🐋" if amount >= 1000 else "🐬"

                    # Correct language for trade type
                    action = "bought" if trade_type == "buy" else "sold"

                    # Chart link
                    chart_link = f"https://dexscreener.com/solana/{token_address}"

                    # Multi-line message
                    message = (
                        f"🚨 ${whale_name} whale just {action} ${amount} of ${token_symbol} {emoji} 👇\n\n"
                        f"📊 Coin: ${token_symbol} ({token_name})\n"
                        f"💰 Marketcap: {market_cap}\n"
                        f"💰 Amount: ${amount}\n"
                        f"🚀 CA: {token_address}\n"
                        f"📈 Chart: {chart_link}"                        
                    )

                    # Create trade document for MongoDB
                    trade_doc = {
                        'timestamp': tx['timestamp'],
                        'whale_name': whale_name,
                        'trade_type': trade_type,
                        'token_name': token_name,
                        'token_symbol': token_symbol,
                        'token_address': token_address,
                        'amount': amount,
                        'market_cap': tx['token_market_cap'],
                        'chart_link': chart_link,
                        'message': message
                    }

                    # Insert trade into MongoDB
                    try:
                        trades_collection.insert_one(trade_doc)
                        print(f"✅ Trade saved to MongoDB: {whale_name} {action} {token_symbol}")
                    except Exception as e:
                        print(f"❌ Error saving to MongoDB: {e}")

                # Update last_timestamp to the latest trade's timestamp
                last_timestamp = new_timestamp

            else:
                print("✅ No new trades since last check.")

        else:
            print(f"⚠️ API Error: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"❌ Error fetching whale trades: {e}")

# **🔄 Poll the API every 5 minutes**
if __name__ == "__main__":
    print("🚀 Starting Live Whale Trade Monitor...")
    while True:
        fetch_live_whale_trades()
        time.sleep(1200)  # Run every 20 minutes
