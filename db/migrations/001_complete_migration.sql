-- Complete Migration for Token Balance Tracking
-- This consolidated migration includes all schema changes in the correct order
-- Revision ID: complete_migration
-- Create Date: 2025-06-26

-- =====================================================
-- PART 1: Core Tables (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS blocks (
    number UInt64 CODEC(Delta(8), LZ4),
    hash String CODEC(ZSTD(1)),
    parent_hash String CODEC(ZSTD(1)),
    nonce Nullable(String) CODEC(ZSTD(1)),
    sha3_uncles String CODEC(ZSTD(1)),
    logs_bloom String CODEC(ZSTD(1)),
    transactions_root String CODEC(ZSTD(1)),
    state_root String CODEC(ZSTD(1)),
    receipts_root String CODEC(ZSTD(1)),
    miner String CODEC(ZSTD(1)),
    difficulty UInt256,
    total_difficulty UInt256,
    size UInt64,
    extra_data String CODEC(ZSTD(1)),
    gas_limit UInt64,
    gas_used UInt64,
    timestamp UInt32,
    transaction_count UInt64,
    base_fee_per_gas Nullable(Int64),
    l1_block_number UInt64 DEFAULT 0,
    is_reorged Bool DEFAULT 0,
    INDEX blocks_timestamp timestamp TYPE minmax GRANULARITY 1
)
ENGINE = ReplacingMergeTree
ORDER BY (number, hash)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS chain_counts (
    active_addresses AggregateFunction(uniq, Nullable(String)),
    uniq_contracts AggregateFunction(uniq, Nullable(String))
)
ENGINE = AggregatingMergeTree
ORDER BY tuple()
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS contracts (
    address String CODEC(ZSTD(1)),
    bytecode String CODEC(ZSTD(1)),
    function_sighashes Array(String) CODEC(ZSTD(1)),
    is_erc20 UInt8,
    is_erc721 UInt8,
    block_number UInt64
)
ENGINE = EmbeddedRocksDB
PRIMARY KEY address;

CREATE TABLE IF NOT EXISTS transactions (
    hash String CODEC(ZSTD(1)),
    nonce UInt64,
    block_hash String CODEC(ZSTD(1)),
    block_number UInt64,
    transaction_index UInt32,
    from_address String CODEC(ZSTD(1)),
    to_address Nullable(String) CODEC(ZSTD(1)),
    value UInt256,
    gas UInt64,
    gas_price Nullable(UInt256),
    input String CODEC(ZSTD(1)),
    block_timestamp UInt32,
    max_fee_per_gas Nullable(Int64),
    max_priority_fee_per_gas Nullable(Int64),
    transaction_type Nullable(UInt32),
    receipt_cumulative_gas_used Nullable(UInt64),
    receipt_gas_used Nullable(UInt64),
    receipt_contract_address Nullable(String) CODEC(ZSTD(1)),
    receipt_root Nullable(String) CODEC(ZSTD(1)),
    receipt_status Nullable(UInt32),
    receipt_effective_gas_price Nullable(UInt256),
    receipt_logs_count Nullable(UInt32),
    is_reorged Bool DEFAULT 0,
    INDEX blocks_timestamp block_timestamp TYPE minmax GRANULARITY 1
)
ENGINE = ReplacingMergeTree
ORDER BY (block_number, hash, block_hash)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS logs (
    log_index UInt32,
    transaction_hash String CODEC(ZSTD(1)),
    transaction_index UInt32,
    block_hash String CODEC(ZSTD(1)),
    block_number UInt64,
    address String CODEC(ZSTD(1)),
    data String CODEC(ZSTD(1)),
    topics Array(String) CODEC(ZSTD(1)),
    is_reorged Bool DEFAULT 0
)
ENGINE = ReplacingMergeTree
ORDER BY (block_number, transaction_hash, log_index, block_hash)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS token_transfers (
    token_address String CODEC(ZSTD(1)),
    token_standard LowCardinality(String) DEFAULT '',
    from_address String CODEC(ZSTD(1)),
    to_address String CODEC(ZSTD(1)),
    value UInt256,
    transaction_hash String CODEC(ZSTD(1)),
    log_index UInt32,
    block_timestamp UInt32,
    block_number UInt64,
    block_hash String CODEC(ZSTD(1)),
    operator_address Nullable(String) CODEC(ZSTD(1)),
    token_id Nullable(UInt256),
    is_reorged Bool DEFAULT 0
)
ENGINE = ReplacingMergeTree
ORDER BY (block_number, token_address, from_address, to_address, log_index, block_hash)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS native_balances (
    address String CODEC(ZSTD(1)),
    block_number UInt64,
    block_hash String CODEC(ZSTD(1)),
    block_timestamp UInt32,
    value UInt256,
    is_reorged Bool DEFAULT 0
)
ENGINE = ReplacingMergeTree
ORDER BY (block_number, address, block_hash)
SETTINGS index_granularity = 8192;

-- =====================================================
-- PART 2: Balance Tracking Tables with TTL
-- These must be created before the materialized view
-- =====================================================

-- Create token_balance_increases table if it doesn't exist
-- This table tracks all balance increases (incoming transfers, mints)
CREATE TABLE IF NOT EXISTS token_balance_increases (
    token_address String,
    holder_address String,
    token_id Nullable(UInt256),
    amount UInt256,
    block_number UInt64,
    block_timestamp UInt32,
    token_standard LowCardinality(String),
    transaction_hash String,
    log_index UInt32
)
ENGINE = MergeTree()
ORDER BY (token_address, holder_address, coalesce(token_id, 0), block_number)
TTL toDateTime(block_timestamp) + INTERVAL 90 DAY;

-- Create token_balance_decreases table if it doesn't exist
-- This table tracks all balance decreases (outgoing transfers, burns)
CREATE TABLE IF NOT EXISTS token_balance_decreases (
    token_address String,
    holder_address String,
    token_id Nullable(UInt256),
    amount UInt256,
    block_number UInt64,
    block_timestamp UInt32,
    token_standard LowCardinality(String),
    transaction_hash String,
    log_index UInt32
)
ENGINE = MergeTree()
ORDER BY (token_address, holder_address, coalesce(token_id, 0), block_number)
TTL toDateTime(block_timestamp) + INTERVAL 90 DAY;

-- =====================================================
-- PART 3: Materialized View for Balance Aggregation
-- Must be created after the source tables exist
-- =====================================================

-- Drop existing materialized view if it exists and recreate
DROP VIEW IF EXISTS current_token_balances_mv;

-- Create materialized view for automatic current balance tracking
-- This view aggregates increases and decreases into current balances
CREATE MATERIALIZED VIEW current_token_balances_mv
ENGINE = SummingMergeTree()
ORDER BY (token_address, holder_address, coalesce(token_id, 0))
AS SELECT
    token_address,
    holder_address,
    token_id,
    token_standard,
    toInt256(amount) as current_balance,
    block_number as last_updated_block,
    block_timestamp as last_updated_timestamp
FROM token_balance_increases
WHERE holder_address != '0x0000000000000000000000000000000000000000'

UNION ALL

SELECT
    token_address,
    holder_address,
    token_id,
    token_standard,
    -toInt256(amount) as current_balance,
    block_number as last_updated_block,
    block_timestamp as last_updated_timestamp
FROM token_balance_decreases
WHERE holder_address != '0x0000000000000000000000000000000000000000';

-- =====================================================
-- PART 4: Hybrid Balance Tracking Tables
-- From: 002_hybrid_balance_tracking.sql
-- =====================================================

-- Current balances table for fast queries (always up-to-date)
CREATE TABLE IF NOT EXISTS current_token_balances (
    token_address String,
    holder_address String,
    token_id Nullable(UInt256),
    current_balance UInt256,
    last_updated_block UInt64,
    last_updated_timestamp UInt32,
    token_standard LowCardinality(String)
)
ENGINE = ReplacingMergeTree(last_updated_block)
ORDER BY (token_address, holder_address, coalesce(token_id, 0))
SETTINGS index_granularity = 8192;



-- Legacy token_balances table (may exist from previous versions)
-- Note: This will be replaced by the view below
CREATE TABLE IF NOT EXISTS token_balances_legacy (
    token_address String CODEC(ZSTD(1)),
    token_standard LowCardinality(String) DEFAULT '',
    holder_address String CODEC(ZSTD(1)),
    block_number UInt64,
    block_timestamp UInt32,
    value UInt256,
    token_id UInt256,
    block_hash String CODEC(ZSTD(1)),
    is_reorged Bool DEFAULT 0
)
ENGINE = ReplacingMergeTree
ORDER BY (block_number, token_address, holder_address, token_id, block_hash)
SETTINGS index_granularity = 8192;

-- =====================================================
-- PART 5: Views for Querying Balances
-- Create view directly from source tables instead of materialized view
-- =====================================================

-- Rename existing token_balances table if it exists, then create view
RENAME TABLE IF EXISTS token_balances TO token_balances_old;
DROP VIEW IF EXISTS token_balances;
CREATE VIEW token_balances AS
WITH balance_deltas AS (
    SELECT
        token_address,
        holder_address,
        token_id,
        token_standard,
        toInt256(amount) as balance_delta,
        block_number,
        block_timestamp
    FROM token_balance_increases
    WHERE holder_address != '0x0000000000000000000000000000000000000000'
    
    UNION ALL
    
    SELECT
        token_address,
        holder_address,
        token_id,
        token_standard,
        -toInt256(amount) as balance_delta,
        block_number,
        block_timestamp
    FROM token_balance_decreases
    WHERE holder_address != '0x0000000000000000000000000000000000000000'
)
SELECT
    token_address,
    token_standard,
    holder_address,
    max(block_number) as block_number,
    max(block_timestamp) as block_timestamp,
    greatest(0, sum(balance_delta)) as value,
    coalesce(token_id, 0) as token_id,
    '' as block_hash,
    0 as is_reorged
FROM balance_deltas
GROUP BY token_address, holder_address, token_id, token_standard
HAVING greatest(0, sum(balance_delta)) > 0
ORDER BY token_address, holder_address, token_id;

-- View for current ERC-20 token balances (fungible tokens)
CREATE VIEW IF NOT EXISTS current_erc20_balances AS
SELECT
    token_address,
    holder_address,
    value as current_balance,
    block_number as last_updated_block,
    block_timestamp as last_updated_timestamp
FROM token_balances
WHERE token_standard = 'ERC-20'
  AND value > 0
ORDER BY token_address, current_balance DESC;

-- View for current NFT ownership (ERC-721 and ERC-1155)
CREATE VIEW IF NOT EXISTS current_nft_ownership AS
SELECT
    token_address,
    holder_address,
    token_id,
    value as current_balance,
    block_number as last_updated_block,
    block_timestamp as last_updated_timestamp,
    token_standard
FROM token_balances
WHERE token_standard IN ('ERC-721', 'ERC-1155')
  AND token_id > 0
  AND value > 0
ORDER BY token_address, token_id, current_balance DESC;

-- View for token supply tracking (including zero address for mints/burns)
CREATE VIEW IF NOT EXISTS token_supply_tracking AS
SELECT
    token_address,
    holder_address,
    token_id,
    token_standard,
    value as balance,
    block_number as last_updated_block,
    block_timestamp as last_updated_timestamp
FROM token_balances
ORDER BY token_address, coalesce(token_id, 0), balance DESC;

-- View for NFT collection statistics
CREATE VIEW IF NOT EXISTS nft_collection_stats AS
SELECT
    token_address,
    token_standard,
    count(DISTINCT token_id) as unique_tokens,
    count(DISTINCT holder_address) as unique_holders,
    sum(current_balance) as total_supply
FROM current_nft_ownership
GROUP BY token_address, token_standard
ORDER BY unique_holders DESC 