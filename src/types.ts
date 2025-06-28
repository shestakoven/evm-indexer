// Type definitions for the indexer

export interface BlockRow {
    number: number;
    hash: string;
    parent_hash: string;
    nonce: string | null;
    sha3_uncles: string;
    logs_bloom: string;
    transactions_root: string;
    state_root: string;
    receipts_root: string;
    miner: string;
    difficulty: string;
    total_difficulty: string;
    size: number;
    extra_data: string;
    gas_limit: number;
    gas_used: number;
    l1_block_number: number;
    base_fee_per_gas: string | null;
}

export interface TransactionRow {
    block_hash: string;
    block_number: number;
    transaction_index: number;
    [key: string]: any; // Additional transaction fields
}

export interface LogRow {
    log_index: number;
    transaction_hash: string;
    transaction_index: number;
    block_hash: string;
    block_number: number;
    address: string;
}

export interface Transfer {
    token_address: string;
    token_standard: 'ERC-20' | 'ERC-721' | 'ERC-1155';
    from_address: string;
    to_address: string;
    value: string;
    transaction_hash: string;
    log_index: number;
    block_timestamp: number;
    block_number: number;
    block_hash: string;
    operator_address: string | null;
    token_id: string | null;
}

export interface BalanceChange {
    token_address: string;
    holder_address: string;
    token_id: string | null;
    amount: string;
    block_number: number;
    block_timestamp: number;
    token_standard: string;
    transaction_hash: string;
    log_index: number;
}

export interface NativeBalance {
    address: string;
    block_number: number;
    block_hash: string;
    block_timestamp: number;
    value: string;
    is_reorged: number;
}

export interface BatchManager {
    blocks: BlockRow[];
    transactions: TransactionRow[];
    logs: LogRow[];
    transfers: Transfer[];
    nativeBalances: NativeBalance[];
    balanceIncreases: BalanceChange[];
    balanceDecreases: BalanceChange[];
    snapshots: any[];
} 