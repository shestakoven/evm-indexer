import { EvmBatchProcessor } from '@subsquid/evm-processor';
import { TypeormDatabase } from '@subsquid/typeorm-store';
import { waitForClickHouse, checkClickHouseSchema } from './clickhouseClient/healthCheck';
import { CONFIG, logConfiguration } from './config';
import { BatchManagerImpl } from './utils/batch';
import { 
    parseERC20Transfer, 
    parseERC721Transfer, 
    parseERC1155Transfer 
} from './parsers/transfer';
import { BlockRow, TransactionRow, LogRow, NativeBalance } from './types';


// Perform health checks before starting
async function performHealthChecks() {
    try {
        await waitForClickHouse();
        await checkClickHouseSchema();
    } catch (error) {
        console.error('Health checks failed:', error);
        process.exit(1);
    }
}

// Run health checks immediately
performHealthChecks().then(() => {
    console.log('Starting processor...');
}).catch(error => {
    console.error('Failed to start processor:', error);
    process.exit(1);
});

// Create processor with optimized configuration
const processor = new EvmBatchProcessor()
    .setGateway(CONFIG.GATEWAY_URL)
    .setRpcEndpoint({
        url: CONFIG.RPC_ETH_HTTP,
        rateLimit: CONFIG.RPC_ETH_RATE_LIMIT
    })
    .setFinalityConfirmation(10) // 15 mins to finality
    .addLog({
        topic0: [CONFIG.TRANSFER_TOPIC]
    });

// Only add transaction if we're storing transactions
if (CONFIG.STORE_TRANSACTIONS) {
    processor.addTransaction({});
}

// Only add stateDiff if we're storing native balances
if (CONFIG.STORE_NATIVE_BALANCES) {
    processor.addStateDiff({});
}

// Configure fields based on what we're actually using
const fields: any = {
    block: {
        timestamp: true,
        height: true,
        hash: true,
        parentHash: true,
    },
    log: {
        logIndex: true,
        transactionIndex: true,
        address: true,
        data: true,
        topics: true,
        transactionHash: true,
    }
};

// Add block fields if storing blocks
if (CONFIG.STORE_BLOCKS) {
    Object.assign(fields.block, {
        nonce: true,
        sha3Uncles: true,
        logsBloom: true,
        transactionsRoot: true,
        stateRoot: true,
        receiptsRoot: true,
        miner: true,
        difficulty: true,
        totalDifficulty: true,
        size: true,
        extraData: true,
        baseFeePerGas: true,
        gasUsed: true,
        gasLimit: true,
        l1BlockNumber: true,
    });
}

// Add transaction fields if storing transactions
if (CONFIG.STORE_TRANSACTIONS) {
    fields.transaction = {
        gas: true,
        gasPrice: true,
        maxFeePerGas: true,
        maxPriorityFeePerGas: true,
        input: true,
        nonce: true,
        value: true,
        type: true,
        status: true,
        gasUsed: true,
        cumulativeGasUsed: true,
        effectiveGasPrice: true,
        contractAddress: true,
        sighash: true,
    };
}

// Add stateDiff fields if storing native balances
if (CONFIG.STORE_NATIVE_BALANCES) {
    fields.stateDiff = {
        address: true,
        key: true,
        next: true,
    };
}

processor.setFields(fields);

// Log configuration
logConfiguration();

// Initialize database and batch manager
const db = new TypeormDatabase();
const batchManager = new BatchManagerImpl();

// Main processing function
processor.run(db, async (ctx) => {
    for (let block of ctx.blocks) {
        if (!block.logs.length && !block.stateDiffs?.length) {
            continue;
        }
        
        const header = block.header as any;
        const blockNumber = header.height ?? 0;
        const blockHash = header.hash ?? '';
        const blockTimestamp = header.timestamp ?? 0;

        // Process block data
        if (CONFIG.STORE_BLOCKS) {
            const blockRow: BlockRow = {
                number: blockNumber,
                hash: blockHash,
                parent_hash: header.parentHash ?? '',
                nonce: header.nonce ?? null,
                sha3_uncles: header.sha3Uncles ?? '',
                logs_bloom: header.logsBloom ?? '',
                transactions_root: header.transactionsRoot ?? '',
                state_root: header.stateRoot ?? '',
                receipts_root: header.receiptsRoot ?? '',
                miner: header.miner ?? '',
                difficulty: header.difficulty ?? '',
                total_difficulty: header.totalDifficulty ?? '',
                size: header.size ?? 0,
                extra_data: header.extraData ?? '',
                gas_limit: header.gasLimit ?? 0,
                gas_used: header.gasUsed ?? 0,
                l1_block_number: header.l1BlockNumber ?? 0,
                base_fee_per_gas: header.baseFeePerGas ?? null,
            };
            batchManager.blocks.push(blockRow);
        }

        // Process transactions
        if (CONFIG.STORE_TRANSACTIONS) {
            for (let [txIndex, tx] of block.transactions.entries()) {
                const txRow: TransactionRow = {
                    ...tx,
                    block_hash: blockHash,
                    block_number: blockNumber,
                    transaction_index: txIndex,
                };
                batchManager.transactions.push(txRow);
            }
        }

        // Process logs for transfers
        for (let log of block.logs) {
            // Check if it's a Transfer event
            if (log.topics[0] === CONFIG.TRANSFER_TOPIC) {
                let parsedTransfer = null;
                
                // ERC20 Transfer (3 topics)
                if (log.topics.length === 3) {
                    parsedTransfer = parseERC20Transfer(log, blockNumber, blockHash, blockTimestamp);
                }
                // ERC721 Transfer (4 topics)
                else if (log.topics.length === 4) {
                    parsedTransfer = parseERC721Transfer(log, blockNumber, blockHash, blockTimestamp);
                }
                
                // Process parsed transfer
                if (parsedTransfer) {
                    if (CONFIG.STORE_TRANSFERS) {
                        batchManager.transfers.push(parsedTransfer.transfer);
                    }
                    if (parsedTransfer.balanceIncrease) {
                        batchManager.balanceIncreases.push(parsedTransfer.balanceIncrease);
                    }
                    if (parsedTransfer.balanceDecrease) {
                        batchManager.balanceDecreases.push(parsedTransfer.balanceDecrease);
                    }
                }
            }
            // ERC1155 TransferSingle
            else if (log.topics[0] === CONFIG.ERC1155_TRANSFER_SINGLE_TOPIC) {
                const parsedTransfer = parseERC1155Transfer(log, blockNumber, blockHash, blockTimestamp);
                if (parsedTransfer) {
                    if (CONFIG.STORE_TRANSFERS) {
                        batchManager.transfers.push(parsedTransfer.transfer);
                    }
                    if (parsedTransfer.balanceIncrease) {
                        batchManager.balanceIncreases.push(parsedTransfer.balanceIncrease);
                    }
                    if (parsedTransfer.balanceDecrease) {
                        batchManager.balanceDecreases.push(parsedTransfer.balanceDecrease);
                    }
                }
            }
            
            // Store raw log if needed
            if (CONFIG.STORE_LOGS) {
                const logRow: LogRow = {
                    log_index: log.logIndex ?? 0,
                    transaction_hash: (log as any).transactionHash ?? log.transaction?.hash ?? '',
                    transaction_index: log.transactionIndex ?? 0,
                    block_hash: blockHash,
                    block_number: blockNumber,
                    address: log.address ?? '',
                };
                batchManager.logs.push(logRow);
            }
        }

        // Process native balances from stateDiffs
        if (CONFIG.STORE_NATIVE_BALANCES && block.stateDiffs) {
            for (let stateDiff of block.stateDiffs) {
                if (stateDiff.key === 'balance' && stateDiff.next != null) {
                    const nativeBalance: NativeBalance = {
                        address: stateDiff.address,
                        block_number: blockNumber,
                        block_hash: blockHash,
                        block_timestamp: blockTimestamp,
                        value: BigInt(stateDiff.next).toString(),
                        is_reorged: 0
                    };
                    batchManager.nativeBalances.push(nativeBalance);
                }
            }
        }

        // Flush batches if needed
        await batchManager.flushIfNeeded();


    }
    
    // Flush any remaining data
    await batchManager.flushAll();
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
    console.log('Flushing batches before exit (SIGINT)...');
    await batchManager.flushAll();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Flushing batches before exit (SIGTERM)...');
    await batchManager.flushAll();
    process.exit(0);
});

process.on('exit', async () => {
    console.log('Flushing batches before exit...');
    await batchManager.flushAll();
});