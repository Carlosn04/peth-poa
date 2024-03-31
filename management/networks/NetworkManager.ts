import path from 'path';
import { config } from '../../config';
import PortManager from './PortManager';
import IPManager from './IpManager';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';

interface NetworkNode {
  address: string;
  role: string;
  port: number | undefined;
  ip: string | undefined
}

interface NetworkConfig {
  chainId: string;
  subnet: string;
  nodes: NetworkNode[];
}

interface NodeAllocationResult {
  ip: string | undefined;
  port: number | undefined;
}

export default class NetworkManager {
  private storageMiddleware: IStorageMiddleware;
  private portManager: PortManager;
  private ipManager: IPManager;

  constructor(storageMiddleware: IStorageMiddleware) {
    this.storageMiddleware = storageMiddleware;
    this.portManager = PortManager.getInstance(storageMiddleware);
    this.ipManager = IPManager.getInstance(storageMiddleware)
  }

  // Ensures a network config file exists for the given chainId, creates if not
  private async ensureNetworkConfigExists(chainId: string): Promise<void> {
    const networkConfigPath = this.getNetworkConfigPath(chainId);
    try {
      let networkConfig = await this.loadNetworkConfig(chainId);
      if (!networkConfig.subnet) {
        networkConfig.subnet = await this.assignSubnet(Number(chainId));
        await this.saveNetworkConfig(chainId, networkConfig);
      }
    } catch {
      const initialConfig: NetworkConfig = { chainId, subnet: await this.assignSubnet(Number(chainId)), nodes: [] };
      await this.saveNetworkConfig(chainId, initialConfig);
    }
  }  

  public async assignSubnet(chainId: number): Promise<string> {    
    const availableIp = await this.ipManager.getSubnetForChainId(chainId.toString()); 
    if (!availableIp) return ''
    return availableIp;
  }  

  // Adds a node to the network configuration and allocates a port for it
  public async addNode(chainId: string, role: string, address: string): Promise<NodeAllocationResult> {
    await this.ensureNetworkConfigExists(chainId);
    let networkConfig = await this.loadNetworkConfig(chainId);

    // Allocate a port and ip
    const port = await this.portManager.allocatePort(chainId);
    const ip = await this.ipManager.allocateIP(chainId)
    if (port === null || ip === null) {
      console.error(`Failed to allocate port/ip for node ${address} in network ${chainId}`);
      return { ip: undefined, port: undefined };
    }

    networkConfig.nodes.push({ address, role, port, ip });
    await this.saveNetworkConfig(chainId, networkConfig);

    return { ip, port }
  }

  // Loads the network configuration for a given chainId
  public async loadNetworkConfig(chainId: string): Promise<NetworkConfig> {
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