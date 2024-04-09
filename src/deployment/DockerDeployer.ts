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
    function drawContainer(label: string, status: string, color: (text: string) => string) {
      // Drawing the top of the container
      console.log(color('+-----------------+'));
      console.log(color(`|   ${label.padEnd(13)}|`));
      console.log(color('|                 |'));
      
      // Drawing the deployment status inside the container
      if (status === 'Deployed') {
        console.log(color(`|   [${status}]   |`));
      } else {
        console.log(color('|                 |'));
      }
      
      // Drawing the bottom of the container
      console.log(color('+-----------------+\n'));
    }
    
    console.log(chalk.blue(`
                    ##         .
              ## ## ##        ==
           ## ## ## ## ##    ===
       /"""""""""""""""""\___/ ===
  ~~~ {~~ ~~~~ ~~~ ~~~~ ~~~ ~ /  ===- ~~~
       \\______ o           __/
         \\    \\         __/
          \\____\\_______/
  `));
    console.log(chalk.blue('╔══════════════════════════════════════════════════╗'));
    console.log(chalk.blue('║           Docker Network Deployment              ║'));
    console.log(chalk.blue('╚══════════════════════════════════════════════════╝'));

    await this.delay(500)
    console.log(chalk.gray('-- NODES -------------------------------------------\n'));

    const nodeTypes = ['Bootstrap Node', 'Signer Node', 'RPC Node', 'Member Node'];
    const colors = {
      bootstrap: chalk.bgCyan,
      signer: chalk.bgGreen,
      rpc: chalk.bgMagenta,
      member: chalk.bgYellow,
    };


    // Default addresses within the package
    const addresses = {
      bootstrapNodeAddress: "0xCeB5ca48b5DE1839379FAEDD0572F7D59B279749",
      signerNodeAddress: "0x64fB496Bbfd447Dba254aFe4E28a325cb19ec25f",
      rpcNodeAddress: '0x46198b00f237407133da9CcFb2D567dF159284D4',
      memberNodeAddress: '0xBa551f402cfC912482cB15466641E6FC3B2D63f2',
    };

    const alloc = {
      [addresses.signerNodeAddress]: { balance: '100' }, // This value is converted to gwei
      [addresses.rpcNodeAddress]: { balance: '100' },
      [addresses.bootstrapNodeAddress]: { balance: '100' },
      [addresses.memberNodeAddress]: { balance: '100' },
    };
    const signers = [addresses.signerNodeAddress];

    await GenesisFactory.createGenesis(chainId, signers, alloc)

    // Deploy Bootstrap Node
    await this.initAndDeployNode(chainId, 'bootstrap', addresses.bootstrapNodeAddress);
    console.log(`${' Bootstrap Deployed | '}${chalk.bgCyan(' '.repeat(25 + 5))}`);
    console.log('')
    await this.delay(500)
    // Deploy Signer Node
    await this.initAndDeployNode(chainId, 'signer', addresses.signerNodeAddress);
    console.log(`${' Signer Deployed | '}${chalk.bgGreen(' '.repeat(27 + 6))}`);
    console.log('')
    await this.delay(500)
    // Deploy RPC Node
    await this.initAndDeployNode(chainId, 'rpc', addresses.rpcNodeAddress);
    console.log(`${' RPC Deployed | '}${chalk.bgMagenta(' '.repeat(30 + 6))}`);
    console.log('')
    await this.delay(500)
    // Deploy Member Node
    await this.initAndDeployNode(chainId, 'member', addresses.memberNodeAddress);
    console.log(`${' Member Deployed | '}${chalk.bgYellow(' '.repeat(22 + 11))}`);
    console.log('')
    console.log(chalk.gray('------------------------------------------- NODES --\n'));
    await this.delay(500)

    console.log(chalk.cyan('╔══════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║       Docker Network Successfully Deployed!      ║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════╝'));

    await this.delay(1000)

    const memberLog = `
${chalk.yellow('═══════════════| Member Node Keys |════════════════')}
${chalk.yellow('Public Key')}
  ${addresses.memberNodeAddress}
${chalk.yellow('Private Key')}
  0xa983991c76c5f6747abb5b6b6c5ecf488c7cf0f09ee9a283224c89a1a0455964
      `;
    console.log(memberLog);

    await this.delay(1000)

    const rpcUrl = await this.networkManager.loadRpcPort(chainId)
    console.log(chalk.green(`═══| RPC URL\n═══| ${rpcUrl}
    `));

    await this.delay(1000)
    const hardhatConfigSnippet = `${chalk.magenta('══════| Hardhat Configuration Snippet |══════')}
${chalk.magenta('Add the following code to your Hardhat config\nto connect to this network using the member node')}

    module.exports = {
      solidity: "0.8.4",
      networks: {
        custom: {
          url: "${rpcUrl}",
          accounts: ["0xa983991c76c5f6747abb5b6b6c5ecf488c7cf0f09ee9a283224c89a1a0455964"]
        }
      }
    };
    `;
    console.log(chalk.grey(hardhatConfigSnippet));
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

  private async findNetworkIdByName(networkName: string): Promise<string | null> {
    const { stdout } = await execAsync(`docker network ls --filter name=^${networkName}$ --format "{{.ID}}"`);
    return stdout.trim() || null;
  }
  
  private async isSubnetMismatch(networkId: string, subnet: string): Promise<boolean> {
    const { stdout: inspectOut } = await execAsync(`docker network inspect ${networkId} --format '{{json .IPAM.Config}}'`);
    let ipamConfigs;
    try {
      ipamConfigs = JSON.parse(inspectOut);
    } catch (error) {
      console.error(`Failed to parse IPAM config for network ID ${networkId}:`, error);
      return true; // Assume mismatch if parsing fails
    }
    return !ipamConfigs.some((config: { Subnet: string }) => config.Subnet === subnet);
  }  

  private async handleDockerNetwork(chainId: number, subnet: string): Promise<void> {
    const networkName = `eth${chainId}`;
  
    // Check for an existing network with the exact name
    const existingNetworkIdByName = await this.findNetworkIdByName(networkName);
  
    // Find any network that overlaps with the desired subnet, including the one with the exact name but wrong subnet
    const overlappingNetworkId = await this.findOverlappingNetwork(subnet);
  
    // Determine if the existing network by name and the overlapping network by subnet are the same
    const isSameNetwork = existingNetworkIdByName && overlappingNetworkId && existingNetworkIdByName === overlappingNetworkId;

    // If there's an existing network by name but it's not the same as the overlapping network, remove it
    if (existingNetworkIdByName && !isSameNetwork) {
        this.log(`Removing existing Docker network by name: ${networkName}`, 2);
        await execAsync(`docker network rm ${existingNetworkIdByName}`);
    }

    // If there's an overlapping network by subnet and it's not the same as the existing network by name, remove it
    if (overlappingNetworkId && !isSameNetwork) {
        this.log(`Removing overlapping Docker network with ID: ${overlappingNetworkId}`, 2);
        await execAsync(`docker network rm ${overlappingNetworkId}`);
    }

    // After ensuring no conflicts, create the new network if no existing network matched the criteria
    if (!existingNetworkIdByName || !isSameNetwork) {
        this.log(`Creating Docker network: ${networkName} with subnet: ${subnet}`, 2);
        await execAsync(`docker network create --driver bridge --subnet=${subnet} ${networkName}`);
    } else {
        this.log(`Docker network ${networkName} already exists with the correct subnet, no action needed.`, 2);
    }
  }
  
  private async removeNetworkByName(networkName: string): Promise<void> {
    // Using `--format` to directly extract the ID might streamline operations
    const commandResult = await execAsync(`docker network ls --filter name=^${networkName}$ --format "{{.ID}}"`);
    const networkId = commandResult.stdout.trim();
    if (networkId) {
      await execAsync(`docker network rm ${networkId}`);
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