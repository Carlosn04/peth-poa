import path from 'path';
import { config } from '../../config'; // Adjust the import path as necessary
import PortManager from './PortManager'; // Adjust the import path as necessary
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';

interface NetworkNode {
  address: string;
  role: string;
  port: number | undefined;
}

interface NetworkConfig {
  chainId: string;
  subnet: string;
  nodes: NetworkNode[];
}

export default class NetworkManager {
  private storageMiddleware: IStorageMiddleware;
  private portManager: PortManager;

  constructor(storageMiddleware: IStorageMiddleware) {
    this.storageMiddleware = storageMiddleware;
    this.portManager = PortManager.getInstance(storageMiddleware);
  }

  // Ensures a network config file exists for the given chainId, creates if not
  private async ensureNetworkConfigExists(chainId: string): Promise<void> {
    const networkConfigPath = this.getNetworkConfigPath(chainId);
    try {
      let networkConfig = await this.loadNetworkConfig(chainId);
      if (!networkConfig.subnet) {
        networkConfig.subnet = await this.assignSubnet();
        await this.saveNetworkConfig(chainId, networkConfig);
      }
    } catch {
      const initialConfig: NetworkConfig = { chainId, subnet: await this.assignSubnet(), nodes: [] };
      await this.saveNetworkConfig(chainId, initialConfig);
    }
  }  
  // private async ensureNetworkConfigExists(chainId: string): Promise<void> {
  //   const networkConfigPath = this.getNetworkConfigPath(chainId);
  //   try {
  //     await this.storageMiddleware.readFile(networkConfigPath);
  //   } catch {
  //     const initialConfig: NetworkConfig = { chainId, nodes: [] };
  //     await this.saveNetworkConfig(chainId, initialConfig);
  //   }
  // }

  public async assignSubnet(): Promise<string> {    
    const availableIp = await this.portManager.findAvailableIPs(); 
    return `${availableIp}/24`;
  }  

  // Adds a node to the network configuration and allocates a port for it
  public async addNode(chainId: string, role: string, address: string): Promise<number | undefined> {
    await this.ensureNetworkConfigExists(chainId);
    let networkConfig = await this.loadNetworkConfig(chainId);

    // Allocate a port
    const port = await this.portManager.allocatePort(chainId);
    if (port === null) {
      console.error(`Failed to allocate port for node ${address} in network ${chainId}`);
      return undefined;
    }

    networkConfig.nodes.push({ address, role, port });
    await this.saveNetworkConfig(chainId, networkConfig);

    return port; // Return the allocated port
  }

  // Loads the network configuration for a given chainId
  private async loadNetworkConfig(chainId: string): Promise<NetworkConfig> {
    const networkConfigPath = this.getNetworkConfigPath(chainId);
    const content = await this.storageMiddleware.readFile(networkConfigPath);
    return JSON.parse(content);
  }

  // Saves the network configuration for a given chainId
  private async saveNetworkConfig(chainId: string, networkConfig: NetworkConfig): Promise<void> {
    const networkConfigPath = this.getNetworkConfigPath(chainId);
    await this.storageMiddleware.writeFile(networkConfigPath, JSON.stringify(networkConfig, null, 2));
  }

  // Helper method to get the file path for a network configuration based on chainId
  private getNetworkConfigPath(chainId: string): string {
    return path.join(config.networksBasePath, `${chainId}`, 'network-config.json');
  }
}