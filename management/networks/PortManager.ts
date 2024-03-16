import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config';

interface NetworkPorts {
    [networkId: string]: number[];
}

interface NetworkPortConfig {
    ports: NetworkPorts;
    chainIdMapping: { [networkIdentifier: string]: string };
}

export default class PortManager {
    private storageMiddleware: IStorageMiddleware;
    private networkPortConfig: NetworkPortConfig = { ports: {}, chainIdMapping: {} };
    private filePath: string;
    private initialized: boolean = false;

    constructor(storageMiddleware: IStorageMiddleware) {
        this.storageMiddleware = storageMiddleware;
        this.filePath = `${config.portsBasePath}/network_ports.json`;
        this.init();
    }

    public async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.init();
            this.initialized = true; // Ensure init only runs once
        }
    }

    private async init(): Promise<void> {
        try {
            const configData = await this.storageMiddleware.readFile(this.filePath);
            this.networkPortConfig = JSON.parse(configData);
        } catch (error) {
            console.log('Port assignment file does not exist, creating a new one.');
            await this.initializePorts();
        }
    }

    private async initializePorts(maxNodesPerNetwork: number = 19, startingPort: number = 30303, numberOfNetworks: number = 4): Promise<void> {
        for (let i = 1; i <= numberOfNetworks; i++) {
            const networkId = `network_${i}`;
            this.networkPortConfig.ports[networkId] = Array.from({ length: maxNodesPerNetwork }, (_, j) => startingPort + i * 100 + j);
        }
        // Initialize chainIdMapping or perform necessary setup here
        await this.savePortAssignments();
    }

    public async allocatePort(chainId: string): Promise<number | null | undefined> {
        await this.init();
        // Try to find an existing networkId mapped to the given chainId
        let availableNetworkId: string | undefined = this.networkPortConfig.chainIdMapping[chainId];
    
        // If there's no existing mapping, look for an available network with free ports
        if (!availableNetworkId) {
            availableNetworkId = Object.keys(this.networkPortConfig.ports).find(networkId => this.networkPortConfig.ports[networkId].length > 0);
    
            // If an available network is found, map it to the chainId for future reference
            if (availableNetworkId) {
                this.networkPortConfig.chainIdMapping[chainId] = availableNetworkId;
            } else {
                console.error('No available networks with free ports.');
                return null;
            }
        }
    
        // Allocate the first available port from the selected network
        const ports = this.networkPortConfig.ports[availableNetworkId];
        if (!ports || ports.length === 0) {
            console.error(`No available ports for network ${availableNetworkId}.`);
            return null;
        }
    
        const port = ports.shift(); // Remove the first available port
        await this.savePortAssignments(); // Save the updated port allocations and mapping
        return port;
    }    

    private async savePortAssignments(): Promise<void> {
        try {
            await this.storageMiddleware.writeFile(this.filePath, JSON.stringify(this.networkPortConfig, null, 4));
        } catch (error) {
            console.error(`Failed to save port assignments: ${error}`);
        }
    }
}