const redis = require('redis');

class RedisService {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Tạo Redis client với cấu hình mặc định
            this.client = redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        console.log('Redis server không khả dụng, sử dụng fallback');
                        return null; // Không retry
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        console.log('Redis retry timeout, sử dụng fallback');
                        return null;
                    }
                    if (options.attempt > 10) {
                        console.log('Redis max retry attempts, sử dụng fallback');
                        return null;
                    }
                    return Math.min(options.attempt * 100, 3000);
                }
            });

            this.client.on('error', (err) => {
                console.log('Redis Client Error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                console.log('Redis Client Connected');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                console.log('Redis Client Ready');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                console.log('Redis Client Disconnected');
                this.isConnected = false;
            });

            await this.client.connect();
        } catch (error) {
            console.log('Không thể kết nối Redis, sử dụng fallback:', error.message);
            this.isConnected = false;
        }
    }

    async get(key) {
        if (!this.isConnected || !this.client) {
            return null;
        }

        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.log('Redis get error:', error.message);
            return null;
        }
    }

    async set(key, value, ttl = 900) { // 15 phút mặc định
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            await this.client.setEx(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            console.log('Redis set error:', error.message);
            return false;
        }
    }

    async del(key) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.log('Redis del error:', error.message);
            return false;
        }
    }

    async flush() {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            await this.client.flushAll();
            return true;
        } catch (error) {
            console.log('Redis flush error:', error.message);
            return false;
        }
    }

    async disconnect() {
        if (this.client) {
            try {
                await this.client.quit();
                this.isConnected = false;
            } catch (error) {
                console.log('Redis disconnect error:', error.message);
            }
        }
    }

    // Kiểm tra Redis có khả dụng không
    isRedisAvailable() {
        return this.isConnected && this.client;
    }
}

// Tạo instance singleton
const redisService = new RedisService();

module.exports = redisService;
