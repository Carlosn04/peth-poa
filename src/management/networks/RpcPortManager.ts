import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config';
import path from 'path';

interface RpcPorts {
    [chainId: string]: number;
}

interface RpcPortConfig {
    rpcPorts: RpcPorts;
}

export default class RpcPortManager {
    private static instance: RpcPortManager;
    private storageMiddleware: IStorageMiddleware;
    private rpcPortConfig: RpcPortConfig = { rpcPorts: {} };
    private filePath: string;

    constructor(storageMiddleware: IStorageMiddleware) {
        this.storageMiddleware = storageMiddleware;
        this.filePath = path.join(config.portsBasePath, 'rpcPorts.json');
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            const configData = await this.storageMiddleware.readFile(this.filePath);
            this.rpcPortConfig = JSON.parse(configData);
        } catch (error) {
            console.log('RPC port assignment file does not exist, creating...');
            await this.saveRpcPortAssignments();
        }
    }

    public async allocateRpcPort(chainId: string): Promise<number> {
        await this.initialize();
        if (!this.rpcPortConfig.rpcPorts[chainId]) {
            // Allocate a new port for the chain
            const allocatedPort = this.findAvailableRpcPort();
            this.rpcPortConfig.rpcPorts[chainId] = allocatedPort;
            await this.saveRpcPortAssignments();
        }
        return this.rpcPortConfig.rpcPorts[chainId];
    }

    private findAvailableRpcPort(): number {
        // Implement logic to find and return an available RPC port
        // This can be a simple increment from a base port, ensuring it doesn't conflict with existing allocations
        const baseRpcPort = 8575;
        let potentialPort = baseRpcPort;
        const usedPorts = new Set(Object.values(this.rpcPortConfig.rpcPorts));
        while (usedPorts.has(potentialPort)) {
            potentialPort++;
        }
        return potentialPort;
    }

    private async saveRpcPortAssignments(): Promise<void> {
        try {
            const dirPath = path.dirname(this.filePath);
            await this.storageMiddleware.ensureDir(dirPath);
            await this.storageMiddleware.writeFile(this.filePath, JSON.stringify(this.rpcPortConfig, null, 2));
        } catch (error) {
            console.error(`Failed to save RPC port assignments: ${error}`);
        }
    }

    public static getInstance(storageMiddleware: IStorageMiddleware): RpcPortManager {
        if (!RpcPortManager.instance) {
            RpcPortManager.instance = new RpcPortManager(storageMiddleware);
        }
        return RpcPortManager.instance;
    }
}