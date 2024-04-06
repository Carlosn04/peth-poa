import path from 'path';
import { config } from '../../config';
import PortManager from './PortManager';
import IPManager from './IpManager';
import RpcPortManager from './RpcPortManager';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';

import { exec } from 'child_process'
import util from 'util'
const execAsync = util.promisify(exec);

interface NetworkNode {
  address: string;
  role: string;
  port: number | undefined;
  rpcPort: number | undefined;
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
  rpcPort: number | undefined;
}

interface ActiveGethNode {
  chainId: string;
  dataDir: string;
  port: string;
}

interface DockerContainerDetail {
  Name: string;
  EndpointID: string;
  MacAddress: string;
  IPv4Address: string;
  IPv6Address: string;
}

interface DockerNetworkDetail {
  Name: string;
  Id: string;
  Created?: string;
  Scope?: string;
  Driver?: string;
  EnableIPv6?: boolean;
  IPAM: {
      Config: Array<{
          Subnet: string;
          Gateway?: string;
      }>;
  };
  Internal?: boolean;
  Attachable?: boolean;
  Ingress?: boolean;
  ConfigFrom?: { Network: string };
  ConfigOnly?: boolean;
  Containers: Record<string, DockerContainerDetail>; // Using Record for a map of container ID to details
  Options?: Record<string, any>;
  Labels?: Record<string, string>;
  ChainId?: string; // Optional field to store extracted chain ID
}

// Utility to parse active local Geth nodes
async function getActiveLocalGethNodes(): Promise<ActiveGethNode[]> {
  const { stdout } = await execAsync("ps aux | grep geth");
  const lines = stdout.split('\n');
  const activeNodes: ActiveGethNode[] = [];

  lines.forEach(line => {
    if (line.includes('--networkid') && line.includes('--datadir')) {
      const chainIdMatch = line.match(/--networkid (\d+)/);
      const datadirMatch = line.match(/--datadir ([^ ]+)/);
      const portMatch = line.match(/--port (\d+)/);
      // Customize these regexes based on your setup to extract IP or other info if needed

      if (chainIdMatch && datadirMatch && portMatch) {
        activeNodes.push({
          chainId: chainIdMatch[1],
          dataDir: datadirMatch[1],
          port: portMatch[1],
          // Extract additional info as needed
        });
      }
    }
  });

  return activeNodes;
}

// Utility to get active Docker networks based on chainId
async function getActiveDockerNetworks(): Promise<DockerNetworkDetail[]> {
  const { stdout: networkIdsOut } = await execAsync('docker network ls --quiet');
  const networkIds = networkIdsOut.trim().split('\n').filter(id => id);
  const activeNetworks: DockerNetworkDetail[] = [];

  for (let id of networkIds) {
    const { stdout: inspectOut } = await execAsync(`docker network inspect ${id}`);
    const details: DockerNetworkDetail[] = JSON.parse(inspectOut);

    // Here, you might extract chainId from the network Name or other metadata
    // For example, if your networks are named like "eth<chainId>", you can extract chainId from the name
    details.forEach(detail => {
      const chainIdMatch = detail.Name.match(/^eth(\d+)$/);
      if (chainIdMatch) {
        detail.ChainId = chainIdMatch[1]; // Assign extracted chainId
      }
    });

    activeNetworks.push(...details);
  }

  return activeNetworks;
}

export default class NetworkManager {
  private static instance: NetworkManager;
  private storageMiddleware: IStorageMiddleware;
  private portManager: PortManager;
  private ipManager: IPManager;
  private rpcPortManager: RpcPortManager;

  constructor(storageMiddleware: IStorageMiddleware) {
    this.storageMiddleware = storageMiddleware;
    this.portManager = PortManager.getInstance(storageMiddleware);
    this.ipManager = IPManager.getInstance(storageMiddleware)
    this.rpcPortManager = RpcPortManager.getInstance(storageMiddleware)
  }

  async collectAndCleanupNetworkConfigs(): Promise<{
    availableResourcesByChainId: Record<string, {
      availableIPs: string[];
      availablePorts: string[];
    }>
  }> {
    const availableResourcesByChainId: Record<string, {
      availableIPs: string[];
      availablePorts: string[];
    }> = {};

    const activeGethNodes = await getActiveLocalGethNodes();
    const activeDockerNetworks = await getActiveDockerNetworks();

    // Convert ports to string for uniformity
    const activeGethPorts = new Set(activeGethNodes.map(node => node.port.toString()));
    const dockerIPsToPorts = new Map<string, string>();

    activeDockerNetworks
      .filter(network => network.Name.includes('eth'))
      .forEach(network => {
        Object.values(network.Containers ?? {}).forEach(container => {
          const containerIP = container.IPv4Address.split('/')[0];
          dockerIPsToPorts.set(containerIP, ''); // Initialize with empty string, ports to be updated later
        });
      });

    const allNetworkConfigs = await this.loadAllNetworksConfig();

    for (const { config } of allNetworkConfigs) {
      const chainId = config.chainId.toString();
      let updatedNodes: NetworkNode[] = [];
      availableResourcesByChainId[chainId] = { availableIPs: [], availablePorts: [] };

      config.nodes.forEach(node => {
        if (node.port && node.ip) {
          // Check if node is inactive and thus its IP and port are available
          if (!activeGethPorts.has(node.port.toString()) && !dockerIPsToPorts.has(node.ip)) {
            availableResourcesByChainId[chainId].availableIPs.push(node.ip);
            availableResourcesByChainId[chainId].availablePorts.push(node.port.toString());
          } else {
            updatedNodes.push(node)
          }
        }        
      });

      // Update the network-config.json for each chainId
      const updatedConfig = { ...config, nodes: updatedNodes };
      await this.storageMiddleware.writeFile(this.getNetworkConfigPath(config.chainId.toString()), JSON.stringify(updatedConfig, null, 2));
    }

    return { availableResourcesByChainId };
  }
  

  public async updateGlobalAllocations() {
    const { availableResourcesByChainId } = await this.collectAndCleanupNetworkConfigs();
    // console.log(availableResourcesByChainId)

    await this.ipManager.updateGlobalIPAllocations(availableResourcesByChainId);
    await this.portManager.updateGlobalPortAllocations(availableResourcesByChainId);
  }

  // Ensures a network config file exists for the given chainId, creates if not
  private async ensureNetworkConfigExists(chainId: string): Promise<void> {
    const networkConfigPath = this.getNetworkConfigPath(chainId);
    try {
      let networkConfig = await this.loadNetworkConfig(Number(chainId));
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
    await this.updateGlobalAllocations()    
    await this.ensureNetworkConfigExists(chainId);
    let networkConfig = await this.loadNetworkConfig(Number(chainId));

    // Allocate port, rpcPort and ip
    const port = await this.portManager.allocatePort(chainId);
    const ip = await this.ipManager.allocateIP(chainId)
    const rpcPort = await this.rpcPortManager.allocateRpcPort(chainId)
    if (port === null || ip === null) {
      console.error(`Failed to allocate port/ip for node ${address} in network ${chainId}`);
      return { ip: undefined, port: undefined,  rpcPort: undefined };
    }

    networkConfig.nodes.push({ address, role, port, rpcPort, ip });
    await this.saveNetworkConfig(chainId, networkConfig);

    return { ip, port, rpcPort }
  }

  // Loads the network configuration for a given chainId
  public async loadNetworkConfig(chainId: number): Promise<NetworkConfig> {
    const networkConfigPath = this.getNetworkConfigPath(chainId.toString());
    const content = await this.storageMiddleware.readFile(networkConfigPath);
    return JSON.parse(content);
  }

  public async loadConfig(chainId: number): Promise<any> {
    await this.updateGlobalAllocations()
    const networkConfig = await this.loadNetworkConfig(chainId)
    return networkConfig
  }

  public async loadAllNetworksConfig(): Promise<Array<{ chainId: number, config: NetworkConfig }>> {
    const networksDir = config.networksBasePath;
    const networkConfigs = [];

    try {
      const entries = await this.storageMiddleware.readDir(networksDir);
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const chainId = parseInt(entry.name);
          if (!isNaN(chainId)) { // Ensure that the directory name is a number (chainId)
            try {
              // Load the network config for each valid chainId
              const config = await this.loadNetworkConfig(chainId);
              networkConfigs.push({ chainId, config });
            } catch (error) {
              console.error(`Failed to load network config for chainId ${chainId}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to list network directories:', error);
    }

    return networkConfigs;
  }

  // Saves the network configuration for a given chainId
  private async saveNetworkConfig(chainId: string, networkConfig: NetworkConfig): Promise<void> {
    const networkConfigPath = this.getNetworkConfigPath(chainId);
    await this.storageMiddleware.writeFile(networkConfigPath, JSON.stringify(networkConfig, null, 2));
  }

  // Helper method to get the file path for a network configuration based on chainId
  private getNetworkConfigPath(chainId: string): string {
    return path.join(config.networksBasePath, chainId, 'network-config.json');
  }

  public static getInstance(storageMiddleware: IStorageMiddleware): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager(storageMiddleware);
    }
    return NetworkManager.instance;
  }
}