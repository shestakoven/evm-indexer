import { config } from 'dotenv';

config();

// Storage configuration flags
export const CONFIG = {
    // Storage flags
    STORE_BLOCKS: process.env.STORE_BLOCKS === 'true',
    STORE_TRANSACTIONS: process.env.STORE_TRANSACTIONS === 'true',
    STORE_LOGS: process.env.STORE_LOGS === 'true',
    STORE_TRANSFERS: process.env.STORE_TRANSFERS !== 'false',
    STORE_NATIVE_BALANCES: process.env.STORE_NATIVE_BALANCES === 'true',
    STORE_BALANCE_INCREASES: process.env.STORE_BALANCE_INCREASES !== 'false',
    STORE_BALANCE_DECREASES: process.env.STORE_BALANCE_DECREASES !== 'false',
    
    // Processing configuration
    BATCH_SIZE: process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE) : 100,
    
    // TTL configuration (in days)
    BALANCE_CHANGES_TTL_DAYS: process.env.BALANCE_CHANGES_TTL_DAYS ? parseInt(process.env.BALANCE_CHANGES_TTL_DAYS) : 90,
    
    // Network configuration
    GATEWAY_URL: process.env.GATEWAY_URL,
    RPC_ETH_HTTP: process.env.RPC_ETH_HTTP,
    RPC_ETH_RATE_LIMIT: process.env.RPC_ETH_RATE_LIMIT ? parseInt(process.env.RPC_ETH_RATE_LIMIT) : 0,
    
    // RabbitMQ configuration
    RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    RABBITMQ_QUEUE: process.env.RABBITMQ_QUEUE || 'block_batches',
    RABBITMQ_EXCHANGE: process.env.RABBITMQ_EXCHANGE || '',
    RABBITMQ_ROUTING_KEY: process.env.RABBITMQ_ROUTING_KEY || 'blocks.batch',
    RABBITMQ_ENABLED: process.env.RABBITMQ_ENABLED !== 'false',
    
    // Constants
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    TRANSFER_TOPIC: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    ERC1155_TRANSFER_SINGLE_TOPIC: '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62',
} as const;

// Log configuration on startup
export function logConfiguration(): void {
    console.log('Storage configuration:');
    console.log(`  STORE_BLOCKS: ${CONFIG.STORE_BLOCKS}`);
    console.log(`  STORE_TRANSACTIONS: ${CONFIG.STORE_TRANSACTIONS}`);
    console.log(`  STORE_LOGS: ${CONFIG.STORE_LOGS}`);
    console.log(`  STORE_TRANSFERS: ${CONFIG.STORE_TRANSFERS}`);
    console.log(`  STORE_NATIVE_BALANCES: ${CONFIG.STORE_NATIVE_BALANCES}`);
    console.log(`  STORE_BALANCE_INCREASES: ${CONFIG.STORE_BALANCE_INCREASES}`);
    console.log(`  STORE_BALANCE_DECREASES: ${CONFIG.STORE_BALANCE_DECREASES}`);

    console.log(`  BATCH_SIZE: ${CONFIG.BATCH_SIZE}`);
    console.log(`  BALANCE_CHANGES_TTL_DAYS: ${CONFIG.BALANCE_CHANGES_TTL_DAYS}`);
    
    console.log('RabbitMQ configuration:');
    console.log(`  RABBITMQ_ENABLED: ${CONFIG.RABBITMQ_ENABLED}`);
    console.log(`  RABBITMQ_URL: ${CONFIG.RABBITMQ_URL}`);
    console.log(`  RABBITMQ_QUEUE: ${CONFIG.RABBITMQ_QUEUE}`);
    console.log(`  RABBITMQ_EXCHANGE: ${CONFIG.RABBITMQ_EXCHANGE}`);
    console.log(`  RABBITMQ_ROUTING_KEY: ${CONFIG.RABBITMQ_ROUTING_KEY}`);
} 