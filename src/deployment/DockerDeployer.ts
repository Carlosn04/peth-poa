import util from 'util';
import * as path from 'path';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { config } from '../config';
import { IStorageMiddleware } from '../interfaces/IStorageMiddleware';
import NetworkManager from '../management/networks/NetworkManager';
import GenesisFactory from '../management/GenesisManager';

const execAsync = util.promisify(exec);

class DockerDeployer {
  private storageMiddleware: IStorageMiddleware;
  private networkManager: NetworkManager;
  private verbosityLevel: number;

  constructor(storageMiddleware: IStorageMiddleware, verbosityLevel: number = 0) {
    this.storageMiddleware = storageMiddleware
    this.networkManager = NetworkManager.getInstance(this.storageMiddleware)
    this.verbosityLevel = verbosityLevel;
  }

  private log(message: string, level: number = 1): void {
    if (level <= this.verbosityLevel) {
      console.log(message);
    }
  }
  
  private logError(message: string, level: number = 1): void {
    if (level <= this.verbosityLevel) {
      console.error(message);
    }
  }

  async removeNodeContainer(chainId: number, nodeAddress: string): Promise<void> {
    try {
      // Construct a partial match string to identify the container
      const partialNameMatch = `${chainId}-${nodeAddress}`;

      // List all containers (even stopped ones), filtering by partial name match
      const { stdout: containersList } = await execAsync(`docker ps -a --filter "name=${partialNameMatch}" --format "{{.Names}}"`);
      if (!containersList) {
        this.log(`No container found matching chainId=${chainId} and address=${nodeAddress}`, 2);
        return;
      }

      // Split stdout by newline to handle multiple container names, if any
      const containerNames = containersList.split('\n').filter(name => name); // Filter out empty strings
      for (const containerName of containerNames) {
        // Stop the container if it's running
        await execAsync(`docker stop ${containerName.trim()}`);
        this.log(`Container ${containerName} stopped.`, 2);

        // Remove the container
        await execAsync(`docker rm ${containerName.trim()}`);
        this.log(`Container ${containerName} removed.`, 2);
      }
    } catch (error) {
      this.logError(`Error removing container(s) for chainId=${chainId}, address=${nodeAddress}: ${error}`, 1);
    }
  }

  async removeAllByChainId(chainId: number): Promise<void> {
    const networkName = `eth${chainId}`;
    try {
      // Step 1: List all containers in the network
      const { stdout: containerList } = await execAsync(`docker network inspect ${networkName} --format '{{range .Containers}}{{.Name}} {{end}}'`);
      const containerNames = containerList.split(' ').filter(name => name.trim());

      // Step 2: Stop and remove listed containers
      for (const containerName of containerNames) {
        await execAsync(`docker stop ${containerName}`);
        await execAsync(`docker rm ${containerName}`);
        this.log(`Container ${containerName} stopped and removed.`, 2);
      }

      // Step 3: Remove the Docker network
      await execAsync(`docker network rm ${networkName}`);
      this.log(`Docker network ${networkName} removed successfully.`, 2);
    } catch (error) {
      this.logError(`Error removing containers/network for chainId=${chainId}: ${error}`, 1);
    }
  }

  async initAndDeployNetwork(chainId: number) {
    // Default addresses within the package
    const addresses = {
      bootstrapNodeAddress: "0xCeB5ca48b5DE1839379FAEDD0572F7D59B279749",
      signerNodeAddress: "0x64fB496Bbfd447Dba254aFe4E28a325cb19ec25f",
      rpcNodeAddress: '0x46198b00f237407133da9CcFb2D567dF159284D4',
      memberNodeAddress: '0xBa551f402cfC912482cB15466641E6FC3B2D63f2',
    };

    const alloc = {
      [addresses.signerNodeAddress]: { balance: '100' }, // This value is converted to gwei
      [addresses.memberNodeAddress]: { balance: '100' }, //
    };
    const signers = [addresses.signerNodeAddress];

    await GenesisFactory.createGenesis(chainId, signers, alloc)
    await this.initAndDeployNode(chainId, 'bootstrap', addresses.bootstrapNodeAddress)
    await this.delay(500)
    await this.initAndDeployNode(chainId, 'signer', addresses.signerNodeAddress)
    await this.delay(500)
    await this.initAndDeployNode(chainId, 'rpc', addresses.rpcNodeAddress)
    await this.delay(500)
    await this.initAndDeployNode(chainId, 'member', addresses.memberNodeAddress)
    this.log(chalk.blue('Docker Network succesfully deployed!'), 0)
    const rpcUrl = await this.networkManager.loadRpcPort(chainId)
    this.log(chalk.green(rpcUrl), 0)
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async initAndDeployNode(chainId: number, nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap', nodeAddress: string): Promise<void> {
    try {
      const nodeDirectories = this.getNodeDirectories(chainId, nodeType, nodeAddress);
      await this.prepareDirectories(nodeDirectories);
      await this.copyNodeData(nodeDirectories.absoluteNodeDir, nodeDirectories.absoluteNetworkNodeDir);

      const { ip, port, rpcPort } = await this.allocateNodePort(chainId, nodeType, nodeAddress);
      if (!port || !ip ) return; // Port allocation failed, already logged

      const networkConfig = await this.networkManager.loadNetworkConfig(chainId);
      const uniqueIdentity = this.getUniqueIdentity(chainId, nodeType, nodeAddress);
      const enr = await this.waitForEnrAndRead(nodeDirectories.absoluteEnrPath, nodeType);
      if (!enr) return // Enr allocation failed, already logged

      const dockerComposeContent = this.generateDockerCompose(chainId, nodeType, nodeAddress, nodeDirectories, ip, port, rpcPort, enr, networkConfig);
      await this.writeDockerComposeFile(nodeDirectories.absoluteNetworkNodeDir, dockerComposeContent);
      await this.handleDockerNetwork(chainId, networkConfig.subnet);
      await this.startDockerCompose(chainId, nodeDirectories.absoluteNetworkNodeDir);
      await this.extractEnrIfNeeded(chainId, nodeType, uniqueIdentity);
    } catch (error) {
      console.error('Failed to initialize and deploy node:', error);
    }
  }

  private getNodeDirectories(chainId: number, nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap', nodeAddress: string): { absoluteNodeDir: string, absoluteNetworkNodeDir: string, absoluteNetworkDir: string, absoluteGenesisPath: string, absoluteEnrPath: string } {
    const nodeDir = path.join(config[`${nodeType}Path`], nodeAddress);
    const networkNodeDir = path.join(config.localStoragePath, `networks/${chainId}/${nodeType}/${nodeAddress}`);
    const networkDir = path.join(config.localStoragePath, `networks/${chainId}`);
    const genesisFilePath = path.join(config.localStoragePath, `networks/${chainId}/genesis.json`);
    const enrPath = path.join(config.localStoragePath, `networks/${chainId}/enr.txt`);
  
    // Using path.resolve to ensure absolute paths
    const absoluteNodeDir = path.resolve(nodeDir)
    const absoluteNetworkNodeDir = path.resolve(networkNodeDir);
    const absoluteNetworkDir = path.resolve(networkDir);
    const absoluteGenesisPath = path.resolve(genesisFilePath)
    const absoluteEnrPath = path.resolve(enrPath);
  
    return { absoluteNodeDir, absoluteNetworkNodeDir, absoluteNetworkDir, absoluteGenesisPath, absoluteEnrPath };
  }

  private async prepareDirectories(nodeDirectories: { absoluteNetworkNodeDir: string }): Promise<void> {
    await this.storageMiddleware.ensureDir(nodeDirectories.absoluteNetworkNodeDir);
  }

  private async copyNodeData(sourceDir: string, targetDir: string): Promise<void> {
    await this.storageMiddleware.copyDirectory(sourceDir, targetDir);
  }

  private async allocateNodePort(chainId: number, nodeType: string, nodeAddress: string): Promise<{ ip: string, port: number, rpcPort:  number | undefined}> {
    const { ip, port, rpcPort } = await this.networkManager.addNode(chainId.toString(), nodeType, nodeAddress);
    if (!port || !ip) {
      throw new Error(`Failed to allocate port/ip for node ${nodeAddress} in network ${chainId}.`);
    }
    return { ip, port, rpcPort };
  }  

  private async waitForEnrAndRead(enrPath: string, nodeType: string, timeoutMs: number = 30000): Promise<string | null> {
    if (nodeType === 'bootstrap') return 'continue'
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Attempt to read the ENR file
        const enr = await this.storageMiddleware.readFile(enrPath);
        if (enr.trim().length > 0) {
          this.log(`ENR found and read successfully: ${enr}`, 2)
          return enr; // Successfully read ENR
        }
      } catch (error) {
        // ENR file not ready or does not exist yet, wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };
    this.logError(`Timeout reached without finding a valid ENR in: ${enrPath}`)
    return null; 
  }  

  private getUniqueIdentity(chainId: number, nodeType: string, nodeAddress: string): string {
    return `${nodeType}-${chainId}-${nodeAddress}`;
  }  

  private generateDockerCompose(chainId: number, nodeType: string, nodeAddress: string, nodeDirectories: { absoluteNetworkNodeDir: string, absoluteGenesisPath: string }, ip: string, port: number, rpcPort: number | undefined, enr: string, networkConfig: any): string {
  const uniqueIdentity = this.getUniqueIdentity(chainId, nodeType, nodeAddress);
  const httpRpcPort = rpcPort
  const gethNodeCommand = this.getGethNodeCommand(chainId, nodeType, nodeAddress, port, rpcPort, enr, ip, networkConfig.subnet);

  //const portsSection = nodeType === 'rpc' ? `ports:\n      - "${port}:${httpRpcPort}"` : '';
  const portsSection = nodeType === 'rpc' ? `ports:\n      - "${httpRpcPort}:${httpRpcPort}"` : '';

  return `
version: '3.8'
services:
  ${uniqueIdentity}:
    container_name: ${uniqueIdentity}
    image: ethereum/client-go:stable
    entrypoint: /bin/sh -c
    command: >
     "geth --datadir /root/.ethereum init /root/genesis.json && geth ${gethNodeCommand}"
    volumes:
      - ${nodeDirectories.absoluteNetworkNodeDir}:/root/.ethereum
      - ${nodeDirectories.absoluteGenesisPath}:/root/genesis.json
    ${portsSection}
    networks:
      customnet:
        ipv4_address: ${ip}

networks:
 customnet:
  name: eth${chainId}
  external: true
`;
  }

  private getGethNodeCommand(chainId: number, nodeType: string, nodeAddress: string, port: number, rpcPort: number | undefined, enr: string, ip: string, subnet: string): string {
    const httpRpcPort = rpcPort
    const networkflags = `--nat "extip:${ip}" --netrestrict ${subnet}` // exclusive for Docker deployment

    // Retrieve the base command arguments for the node type from your config mapping
    const baseCommandArgs = config.gethCommandArgs[nodeType]({
      networkNodeDir: '/root/.ethereum',
      chainId: chainId.toString(),
      address: nodeAddress,
      enr: enr,
      ipcPath: '/root/ipc/geth.ipc',
      port: port.toString(),
      authRpcPort: port.toString(),
      httpPort: httpRpcPort,
      httpIp: '0.0.0.0'
    });

    const fullCommand = baseCommandArgs.concat(networkflags).join(' ');
    return fullCommand;
  }

  private async writeDockerComposeFile(networkNodeDir: string, dockerComposeContent: string): Promise<void> {
    const composeFilePath = path.join(networkNodeDir, 'docker-compose.yml');
    await fs.writeFile(composeFilePath, dockerComposeContent);
  }  

  private async findOverlappingNetwork(subnet: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('docker network ls --quiet');
      const networkIds = stdout.split('\n').filter(id => id.trim());
      for (const id of networkIds) {
        const { stdout: inspectOut } = await execAsync(`docker network inspect ${id} --format '{{json .IPAM.Config}}'`);
        // Parse JSON safely, use try-catch if necessary
        let ipamConfigs;
        try {
          ipamConfigs = JSON.parse(inspectOut);
        } catch (parseError) {
          // console.error(`Failed to parse IPAM config for network ID ${id}:`, parseError);
          continue; // Skip this iteration if parsing fails
        }

        // Proceed if ipamConfigs is an array and not null
        if (Array.isArray(ipamConfigs) && ipamConfigs.some((config: { Subnet: string }) => config.Subnet === subnet)) {
          return id; // Found an overlapping network, return its ID
        }
      }
      return null; // No overlap found
    } catch (error) {
      console.error(`Error checking for overlapping networks: ${error}`);
      return null; // Error case, return null to indicate failure in checking
    }
  }

  private async handleDockerNetwork(chainId: number, subnet: string): Promise<void> {
    const networkName = `eth${chainId}`;
    const existingNetworksCommandResult = await execAsync(`docker network ls --filter name=^${networkName}$ --format "{{.Name}}"`);
    const existingNetwork = existingNetworksCommandResult.stdout.trim();

    const overlappingNetworkId = await this.findOverlappingNetwork(subnet);

    if (!existingNetwork && overlappingNetworkId) {
      this.log(`Removing overlapping Docker network with ID: ${overlappingNetworkId}`, 2);
      await execAsync(`docker network rm ${overlappingNetworkId}`); // Remove the overlapping network
      this.log(`Creating Docker network: ${networkName} with subnet: ${subnet}`, 2);
      await execAsync(`docker network create --driver bridge --subnet=${subnet} ${networkName}`); // Create the new network
    } else if (!existingNetwork) {
      this.log(`Creating Docker network: ${networkName} with subnet: ${subnet}`, 2);
      await execAsync(`docker network create --driver bridge --subnet=${subnet} ${networkName}`);
    } else {
      this.log(`Docker network ${networkName} already exists.`, 2);
    }
  }  

  private async startDockerCompose(chainId: number, networkNodeDir: string): Promise<void> {
    const composeCommand = `docker-compose -p eth${chainId} -f ${path.join(networkNodeDir, 'docker-compose.yml')} up -d`;
    this.log(`Starting Docker Compose with command: ${composeCommand}`, 2);
    await execAsync(composeCommand);
  }

  private async isContainerRunning(containerName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`docker inspect --format='{{.State.Running}}' ${containerName}`);
      return stdout.trim() === 'true';
    } catch (error) {
      this.logError(`Error checking container status: ${error}`, 3);
      return false;
    }
  }

  private async waitForContainer(containerName: string, timeoutMs: number = 2500): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await this.isContainerRunning(containerName)) {
        return true; // Container is running
      }
      // Wait for a short period before checking again
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    return false; // Timeout reached without container running
  } 

  private async waitForGethReady(containerName: string, timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Try a simple command to check geth readiness; adjust as necessary
        const { stdout } = await execAsync(`docker exec ${containerName} ls /root/ipc/geth.ipc`);
        if (stdout.includes('geth.ipc')) {
          return true; // Geth is ready
        }
      } catch (error) {
        // Geth not ready, wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return false; // Timeout reached without geth being ready
  }

  private async extractEnrIfNeeded(chainId: number, nodeType: string, uniqueIdentity: string): Promise<void> {
    if (nodeType !== 'bootstrap') return;
  
    this.log(`Extracting ENR for bootstrap node: ${uniqueIdentity}`);
    // Wait to ensure the Geth node is fully up and running
    const isRunning = await this.waitForGethReady(uniqueIdentity)
    if (!isRunning) {
      this.logError(`Container ${uniqueIdentity} did not start in time. Unable to extract ENR.`);
      return;
    }
      const enrCommand = `docker exec ${uniqueIdentity} geth attach --exec admin.nodeInfo.enr /root/ipc/geth.ipc`;
      try {
        const { stdout, stderr } = await execAsync(enrCommand);
        if (stderr) {
          console.error('Error extracting ENR:', stderr);
          return;
        }
        const enr = stdout.trim().replace(/^"|"$/g, '');
        const enrPath = path.join(config.localStoragePath, `networks/${chainId}/enr.txt`);
        const absoluteEnrPath = path.resolve(enrPath)
        await this.storageMiddleware.writeFile(absoluteEnrPath, enr);
        this.log('Extracted ENR');
      } catch (error) {
        this.logError(`Failed to extract ENR: ${error}`);
      }
  }  
}

export default DockerDeployer;