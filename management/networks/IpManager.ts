import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import path from 'path';
import { config } from '../../config';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

interface NetworkIPs {
    [networkId: string]: string[];
}

interface NetworkSubnets {
    [networkId: string]: string;
}
interface NetworkIPConfig {
    ips: NetworkIPs;
    chainIdMapping: { [networkIdentifier: string]: string };
    subnets: NetworkSubnets;
}

export default class IPManager {
    private static instance: IPManager;
    private storageMiddleware: IStorageMiddleware;
    private networkIPConfig: NetworkIPConfig = { ips: {}, chainIdMapping: {}, subnets: {} };
    private filePath: string;

    constructor(storageMiddleware: IStorageMiddleware) {
        this.storageMiddleware = storageMiddleware;
        this.filePath = `${config.ipsBasePath}/ips.json`;
        this.initialize();
    }

    private async initialize() {
        try {
            const configData = await this.storageMiddleware.readFile(this.filePath);
            this.networkIPConfig = JSON.parse(configData);
        } catch (error) {
            console.log('Network IP assignment file does not exist, creating...');
            await this.initializeIPs();
        }
    }

    private async initializeIPs(numberOfNetworks: number = 4, maxNodesPerNetwork: number = 19): Promise<void> {
        const baseIP = (await this.findAvailableIPs())[0];
        let [baseA, baseB, ,] = baseIP.split('.'); 

        for (let networkIndex = 0; networkIndex < numberOfNetworks; networkIndex++) {
            const networkId = `network_${networkIndex + 1}`;
            const networkSegment = (networkIndex * maxNodesPerNetwork) % 254; // Ensure it stays within .1-.254 range
            const networkIPs = [];
            const subnet = `${baseA}.${baseB}.${networkSegment}.0/24`
    
            for (let nodeIndex = 1; nodeIndex <= maxNodesPerNetwork; nodeIndex++) {
                const nodeIP = `${baseA}.${baseB}.${networkSegment}.${nodeIndex}`;
                networkIPs.push(nodeIP);
            }
    
            // Assign generated IPs to the network
            this.networkIPConfig.ips[networkId] = networkIPs;
            this.networkIPConfig.subnets[networkId] = subnet;
        }
        await this.saveIPAssignments();
    }    

    public async allocateIP(chainId: string): Promise<string | undefined> {
        await this.initialize();
        let availableNetworkId: string | undefined = this.networkIPConfig.chainIdMapping[chainId];
    
        if (!availableNetworkId) {
          availableNetworkId = Object.keys(this.networkIPConfig.ips).find(networkId => this.networkIPConfig.ips[networkId].length > 0);
    
          if (availableNetworkId) {
            this.networkIPConfig.chainIdMapping[chainId] = availableNetworkId;
          } else {
            console.error('No available networks with free IPs.');
            return undefined;
          }
        }
    
        const ips = this.networkIPConfig.ips[availableNetworkId];
        if (!ips || ips.length === 0) {
          console.error(`No available IPs for network ${availableNetworkId}.`);
          return undefined;
        }
    
        const ip = ips.shift(); // Allocate the first available IP
        await this.saveIPAssignments();
        return ip;
      }

    private async saveIPAssignments() {
        try {
            const dirPath = path.dirname(config.ipsBasePath);
            await this.storageMiddleware.ensureDir(dirPath)
            await this.storageMiddleware.writeFile(this.filePath, JSON.stringify(this.networkIPConfig, null, 4));
        } catch (error) {
            console.error(`Failed to save port assignments: ${error}`);
        }
    }

    public async findAvailableIPs(maxIps: number = 1) {
        try {
            const { stdout, stderr } = await execAsync('ifconfig');
            if (stderr) {
                console.error(`Error executing ifconfig: ${stderr}`);
                return [];
            }

            const ipRegex = /inet (\d+\.\d+\.\d+\.\d+)/g;
            let match;
            const ips = [];

            while ((match = ipRegex.exec(stdout)) !== null && ips.length < maxIps) {
                ips.push(match[1]);
            }

            return ips.slice(0, maxIps);
        } catch (error) {
            console.error(`Failed to find available IPs: ${error}`);
            return [];
        }
    }

    public async getSubnetForChainId(chainId: string): Promise<string | undefined> {
        try {
            await this.allocateIP(chainId);
            const configData = await this.storageMiddleware.readFile(this.filePath);
            const config: NetworkIPConfig = JSON.parse(configData);
            
            // Find the network ID associated with the given chainId
            const networkId = config.chainIdMapping[chainId];
            if (!networkId) {
                console.error(`No network ID found for chainId: ${chainId}`);
                return undefined;
            }
    
            // Retrieve and return the subnet for the found network ID
            const subnet = config.subnets[networkId];
            if (!subnet) {
                console.error(`No subnet found for network ID: ${networkId}`);
                return undefined;
            }
    
            return subnet;
        } catch (error) {
            console.error(`Error retrieving subnet for chainId ${chainId}:`, error);
            return undefined;
        }
    }    

    public static getInstance(storageMiddleware: IStorageMiddleware): IPManager {
        if (!IPManager.instance) {
            IPManager.instance = new IPManager(storageMiddleware);
        }
        return IPManager.instance;
    }
}
