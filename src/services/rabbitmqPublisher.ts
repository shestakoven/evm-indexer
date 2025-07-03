import * as amqp from 'amqplib';
import { CONFIG } from '../config';

export interface BatchMessage {
    type: 'block';
    number: number;
}

export class RabbitMQPublisher {
    private connection: any = null;
    private channel: any = null;
    private isConnected: boolean = false;

    async connect(): Promise<void> {
        if (!CONFIG.RABBITMQ_ENABLED) {
            console.log('RabbitMQ publishing is disabled');
            return;
        }

        try {
            console.log(`Connecting to RabbitMQ at ${CONFIG.RABBITMQ_URL}...`);
            this.connection = await amqp.connect(CONFIG.RABBITMQ_URL);
            this.channel = await this.connection.createChannel();
            
            // Ensure the queue exists
            await this.channel.assertQueue(CONFIG.RABBITMQ_QUEUE, {
                durable: true
            });
            
            this.isConnected = true;
            console.log(`Connected to RabbitMQ, queue: ${CONFIG.RABBITMQ_QUEUE}`);
            
            // Handle connection errors
            this.connection.on('error', (err: Error) => {
                console.error('RabbitMQ connection error:', err);
                this.isConnected = false;
            });
            
            this.connection.on('close', () => {
                console.log('RabbitMQ connection closed');
                this.isConnected = false;
            });
            
        } catch (error) {
            console.error('Failed to connect to RabbitMQ:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async publishBatchMessage(firstBlock: number, lastBlock: number, routingKey?: string): Promise<void> {
        if (!CONFIG.RABBITMQ_ENABLED || !this.isConnected || !this.channel) {
            return;
        }

        const message: BatchMessage[] = [
            { type: 'block', number: firstBlock },
            { type: 'block', number: lastBlock }
        ];

        try {
            const messageBuffer = Buffer.from(JSON.stringify(message));
            
            if (CONFIG.RABBITMQ_EXCHANGE && CONFIG.RABBITMQ_EXCHANGE.trim() !== '') {
                // Publish to exchange with routing key
                await this.channel.publish(
                    CONFIG.RABBITMQ_EXCHANGE, 
                    routingKey || '', 
                    messageBuffer, 
                    { persistent: true }
                );
                console.log(`Published batch message to exchange ${CONFIG.RABBITMQ_EXCHANGE} with routing key "${routingKey || 'default'}": [${firstBlock}, ${lastBlock}]`);
            } else {
                // Send directly to queue
                await this.channel.sendToQueue(CONFIG.RABBITMQ_QUEUE, messageBuffer, {
                    persistent: true
                });
                console.log(`Published batch message to queue ${CONFIG.RABBITMQ_QUEUE}: [${firstBlock}, ${lastBlock}]`);
            }
        } catch (error) {
            console.error('Failed to publish batch message:', error);
            // Don't throw the error to avoid breaking the main processing flow
        }
    }

    async close(): Promise<void> {
        if (!CONFIG.RABBITMQ_ENABLED) {
            return;
        }

        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
            this.isConnected = false;
            console.log('RabbitMQ connection closed');
        } catch (error) {
            console.error('Error closing RabbitMQ connection:', error);
        }
    }

    get connected(): boolean {
        return this.isConnected;
    }
}

// Singleton instance
export const rabbitmqPublisher = new RabbitMQPublisher(); 