import { insert as clickhouseInsert } from '../clickhouseClient/clickhouseClient';
import { CONFIG } from '../config';
import { 
    BlockRow, 
    TransactionRow, 
    LogRow, 
    Transfer, 
    NativeBalance, 
    BalanceChange,
    BatchManager 
} from '../types';

// Convert BigInt to string recursively
export function convertBigInt(obj: any): any {
    if (typeof obj === 'bigint') {
        return obj.toString();
    } else if (Array.isArray(obj)) {
        return obj.map(convertBigInt);
    } else if (obj && typeof obj === 'object') {
        const res: any = {};
        for (const key in obj) {
            res[key] = convertBigInt(obj[key]);
        }
        return res;
    }
    return obj;
}

// Generic batch insert function
async function insertBatch(tableName: string, batch: any[], batchType: string): Promise<void> {
    if (batch.length === 0) return;
    try {
        await clickhouseInsert(tableName, batch.map(convertBigInt));
    } catch (error) {
        console.error(`Error inserting ${batchType} batch:`, error);
        throw error;
    }
}

// Specific insert functions
export const insertBlocksBatch = (batch: BlockRow[]) => 
    insertBatch('blocks', batch, 'blocks');

export const insertTransactionsBatch = (batch: TransactionRow[]) => 
    insertBatch('transactions', batch, 'transactions');

export const insertLogsBatch = (batch: LogRow[]) => 
    insertBatch('logs', batch, 'logs');

export const insertTransfersBatch = (batch: Transfer[]) => 
    insertBatch('token_transfers', batch, 'transfers');

export const insertNativeBalancesBatch = (batch: NativeBalance[]) => 
    insertBatch('native_balances', batch, 'native balances');

export const insertBalanceIncreasesBatch = (batch: BalanceChange[]) => 
    insertBatch('token_balance_increases', batch, 'balance increases');

export const insertBalanceDecreasesBatch = (batch: BalanceChange[]) => 
    insertBatch('token_balance_decreases', batch, 'balance decreases');

export const insertSnapshotsBatch = (batch: any[]) => 
    insertBatch('token_balance_snapshots', batch, 'snapshots');

// Batch manager class
export class BatchManagerImpl implements BatchManager {
    blocks: BlockRow[] = [];
    transactions: TransactionRow[] = [];
    logs: LogRow[] = [];
    transfers: Transfer[] = [];
    nativeBalances: NativeBalance[] = [];
    balanceIncreases: BalanceChange[] = [];
    balanceDecreases: BalanceChange[] = [];
    snapshots: any[] = [];

    async flushIfNeeded(): Promise<void> {
        if (CONFIG.STORE_BLOCKS && this.blocks.length >= CONFIG.BATCH_SIZE) {
            await insertBlocksBatch(this.blocks);
            this.blocks = [];
        }
        if (CONFIG.STORE_TRANSACTIONS && this.transactions.length >= CONFIG.BATCH_SIZE) {
            await insertTransactionsBatch(this.transactions);
            this.transactions = [];
        }
        if (CONFIG.STORE_LOGS && this.logs.length >= CONFIG.BATCH_SIZE) {
            await insertLogsBatch(this.logs);
            this.logs = [];
        }
        if (CONFIG.STORE_TRANSFERS && this.transfers.length >= CONFIG.BATCH_SIZE) {
            await insertTransfersBatch(this.transfers);
            this.transfers = [];
        }
        if (CONFIG.STORE_NATIVE_BALANCES && this.nativeBalances.length >= CONFIG.BATCH_SIZE) {
            await insertNativeBalancesBatch(this.nativeBalances);
            this.nativeBalances = [];
        }
        if (CONFIG.STORE_BALANCE_INCREASES && this.balanceIncreases.length >= CONFIG.BATCH_SIZE) {
            await insertBalanceIncreasesBatch(this.balanceIncreases);
            this.balanceIncreases = [];
        }
        if (CONFIG.STORE_BALANCE_DECREASES && this.balanceDecreases.length >= CONFIG.BATCH_SIZE) {
            await insertBalanceDecreasesBatch(this.balanceDecreases);
            this.balanceDecreases = [];
        }
        if (this.snapshots.length >= CONFIG.BATCH_SIZE) {
            await insertSnapshotsBatch(this.snapshots);
            this.snapshots = [];
        }
    }

    async flushAll(): Promise<void> {
        if (CONFIG.STORE_BLOCKS && this.blocks.length > 0) {
            await insertBlocksBatch(this.blocks);
            this.blocks = [];
        }
        if (CONFIG.STORE_TRANSACTIONS && this.transactions.length > 0) {
            await insertTransactionsBatch(this.transactions);
            this.transactions = [];
        }
        if (CONFIG.STORE_LOGS && this.logs.length > 0) {
            await insertLogsBatch(this.logs);
            this.logs = [];
        }
        if (CONFIG.STORE_TRANSFERS && this.transfers.length > 0) {
            await insertTransfersBatch(this.transfers);
            this.transfers = [];
        }
        if (CONFIG.STORE_NATIVE_BALANCES && this.nativeBalances.length > 0) {
            await insertNativeBalancesBatch(this.nativeBalances);
            this.nativeBalances = [];
        }
        if (CONFIG.STORE_BALANCE_INCREASES && this.balanceIncreases.length > 0) {
            await insertBalanceIncreasesBatch(this.balanceIncreases);
            this.balanceIncreases = [];
        }
        if (CONFIG.STORE_BALANCE_DECREASES && this.balanceDecreases.length > 0) {
            await insertBalanceDecreasesBatch(this.balanceDecreases);
            this.balanceDecreases = [];
        }
        if (this.snapshots.length > 0) {
            await insertSnapshotsBatch(this.snapshots);
            this.snapshots = [];
        }
    }
} 