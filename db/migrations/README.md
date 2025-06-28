# ClickHouse Migrations

This directory contains the database schema migrations for the Squid EVM indexer.

## Current Migration

**001_complete_migration.sql** - A consolidated migration that includes all schema components:
- Core tables (blocks, transactions, logs, etc.)
- Balance tracking tables (current_token_balances, token_balance_snapshots)
- Balance increase/decrease tables with TTL
- Materialized view for automatic balance aggregation
- Views for querying balances

## Reference Files

- **001_complete_schema.sql.reference** - Shows the complete schema structure (documentation only)

## Schema Overview

### Core Tables
- **blocks**: Block data with compression and indexing
- **transactions**: Transaction details with receipts
- **logs**: Event logs from smart contracts
- **token_transfers**: Parsed token transfer events (ERC-20/721/1155)
- **native_balances**: ETH balance snapshots from state diffs
- **contracts**: Contract metadata (uses EmbeddedRocksDB)
- **chain_counts**: Aggregate statistics
- **token_balances**: Legacy balance tracking table

### Balance Tracking System
- **current_token_balances**: Current balances (ReplacingMergeTree)
- **token_balance_snapshots**: Historical snapshots (partitioned by month)
- **token_balance_increases**: Balance increases with 90-day TTL
- **token_balance_decreases**: Balance decreases with 90-day TTL
- **current_token_balances_mv**: Materialized view aggregating increases/decreases

### Views
- **token_balances**: Current positive balances for all tokens
- **current_erc20_balances**: ERC-20 token balances
- **current_nft_ownership**: NFT ownership (ERC-721 and ERC-1155)
- **token_supply_tracking**: Includes zero address for mints/burns
- **nft_collection_stats**: NFT collection statistics

## Running Migrations

Migrations are automatically run when the indexer starts. To run manually:

```bash
npm run migrate
```

## Features

### 1. Automatic Balance Tracking
The materialized view `current_token_balances_mv` automatically aggregates balance changes from the increase/decrease tables into current balances.

### 2. TTL (Time To Live)
Balance increase/decrease records older than 90 days are automatically deleted, while current balances are preserved in the materialized view.

### 3. Historical Snapshots
The `token_balance_snapshots` table stores periodic snapshots of all balances, partitioned by month for efficient querying.

### 4. Compatibility
All tables use `CREATE TABLE IF NOT EXISTS` to ensure compatibility with existing schemas.

## Query Examples

### Get current balance
```sql
SELECT * FROM token_balances 
WHERE holder_address = '0x...' 
AND token_address = '0x...';
```

### Get top ERC-20 holders
```sql
SELECT holder_address, current_balance 
FROM current_erc20_balances 
WHERE token_address = '0x...' 
ORDER BY current_balance DESC 
LIMIT 100;
```

### Get NFT ownership
```sql
SELECT * FROM current_nft_ownership 
WHERE token_address = '0x...' 
AND token_id = 123;
```

### Query historical snapshot
```sql
SELECT * FROM token_balance_snapshots
WHERE snapshot_block = 1000000
AND token_address = '0x...'
ORDER BY balance DESC; 