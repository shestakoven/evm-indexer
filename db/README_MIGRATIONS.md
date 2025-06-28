# Database Migrations

## Current State

All migrations have been consolidated into a single file: `001_consolidated_final.sql`

This represents the final working state with:
- Core blockchain tables (blocks, transactions, logs, etc.)
- **NEW: Separate increase/decrease tracking** using `UInt256` fields
- Token balances view that shows **only positive balances**
- Support for ERC-20, ERC-721, and ERC-1155 tokens
- **SOLVED: No negative balances** (prevents Int256 overflow from spam tokens)

## Migration History

Previous migrations have been moved to `migrations_old/` directory for reference:
- 001-010: Various attempts at balance tracking with Int256 (had overflow issues)
- Final working solution: Separate UInt256 increase/decrease tables

## Schema Overview

### Core Tables
- `blocks` - Block data
- `transactions` - Transaction data  
- `logs` - Event logs
- `token_transfers` - Parsed transfer events
- `native_balances` - ETH balance tracking

### **NEW Balance Tracking (Overflow-Safe)**
- `token_balance_increases` - All balance increases (UInt256, can handle massive values)
- `token_balance_decreases` - All balance decreases (UInt256, stored as positive amounts)

### Views
- `token_balances` - **Current token balances (POSITIVE ONLY)** - calculates increases - decreases
- `current_erc20_balances` - ERC-20 token balances only
- `current_nft_ownership` - NFT ownership tracking  
- `token_supply_tracking` - Supply tracking including mints/burns
- `nft_collection_stats` - Collection statistics

## Problem Solved

**Root Cause**: Spam tokens with values like `9×10^80` caused `Int256` overflow in ClickHouse (max: `5×10^76`), creating corrupt negative balances.

**Solution**: 
1. **Separate tables** for increases/decreases using `UInt256` (max: `1×10^77`)
2. **Only show positive balances** in the `token_balances` view
3. **No more negative balances** from overflow issues

## Usage

For fresh deployments:
```bash
npx ts-node src/clickhouseClient/runMigrations.ts
```

The processor now inserts to:
- `token_balance_increases` for received tokens
- `token_balance_decreases` for sent tokens

Query positive balances from the `token_balances` view.

For existing deployments, manually reset if needed using `reset_migrations.sql`. 