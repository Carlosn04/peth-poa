import { exec } from 'child_process';
import util from 'util';
import fs from 'fs-extra'; // For reading network-config.json and genesis.json
import path from 'path';
import { config } from '../config'; // Ensure this points to your config file correctly
import NetworkManager from '../management/networks/NetworkManager';
import { IStorageMiddleware } from '../interfaces/IStorageMiddleware';

const execAsync = util.promisify(exec);

class DockerDeployer {
  private networkManager: NetworkManager;
  private storageMiddleware: IStorageMiddleware;

  constructor(storageMiddleware: IStorageMiddleware) {
    this.storageMiddleware = storageMiddleware
    this.networkManager = new NetworkManager(this.storageMiddleware)
  }

  async initAndDeployNetwork(chainId: number): Promise<void> {
    try {
      const networkDirectory = path.join(config.localStoragePath, `networks/${chainId}`);
      const networkConfigPath = path.join(networkDirectory, 'network-config.json');
      const networkConfig = await fs.readJson(networkConfigPath);
      const genesisFilePath = path.join(networkDirectory, networkConfig.genesisPath);
      const genesisConfig = await fs.readJson(genesisFilePath);

      function getNodeDirPath(nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap'): string {
        switch (nodeType) {
          case 'signer':
            return config.signerPath;
          case 'member':
            return config.memberPath;
          case 'rpc':
            return config.rpcPath;
          case 'bootstrap':
            return config.bootstrapPath;
          default:
            throw new Error(`Unknown node type: ${nodeType}`);
        }
      }

      let dockerComposeContent = `
version: '3.8'
services:
`;

      for (const node of networkConfig.nodes) {
        // Initialize node directory and genesis block for each node
        const nodeDir = path.join(getNodeDirPath(node), node.address);
        const networkNodeDir = path.join(config.localStoragePath, `networks/${chainId}/${node.role}/${node.address}`);
        await fs.ensureDir(networkNodeDir);
        await fs.copy(nodeDir, networkNodeDir);
        await execAsync(`geth --datadir ${networkNodeDir} init ${genesisFilePath}`);

        // Docker container setup for each node
        dockerComposeContent += `
${node.role}-${node.address}:
  image: ethereum/client-go:latest
  command:
    - --datadir=/root/.ethereum
    - --networkid=${genesisConfig.config.chainId}
    - --nodiscover
    - --http
    - --http.addr=0.0.0.0
    - --http.port=8545
    - --http.corsdomain="*"
    - --http.vhosts="*"
    - --port=${node.port}
    ${node.role === 'signer' ? '- --mine' : ''}
    ${node.role === 'signer' ? '- --unlock=' + node.address : ''}
    ${node.role === 'signer' ? '- --password=/root/.ethereum/password.txt' : ''}
  volumes:
    - ${networkNodeDir}:/root/.ethereum
  ports:
    - "${node.port}:${node.port}"
`;

      }

      // Write the docker-compose.yml file
      await fs.writeFile(path.join(networkDirectory, 'docker-compose.yml'), dockerComposeContent);

      console.log('Starting network with Docker Compose...');
      await execAsync(`cd ${networkDirectory} && docker-compose up -d`);
      console.log('Network started successfully.');
    } catch (error) {
      console.error('Failed to deploy network:', error);
    }
  }

  async initAndDeployNode(chainId: number, nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap', nodeAddress: string): Promise<void> {
    const nodeDir = path.join(config[`${nodeType}Path`], nodeAddress);
    const networkNodeDir = path.join(config.localStoragePath, `networks/${chainId}/${nodeType}/${nodeAddress}`);
    // const genesisFilePath = path.join(config.localStoragePath, `networks/${chainId}/genesis.json`);
    const genesisFilePath = path.join(config.localStoragePath, `networks/${chainId}/genesis.json`);
    const absoluteGenesisPath = path.resolve(genesisFilePath)
    const absoluteNetworkNodeDir = path.resolve(networkNodeDir)

    await this.storageMiddleware.ensureDir(absoluteNetworkNodeDir);
    // Copy the node directory inside the network directory
    await this.storageMiddleware.copyDirectory(nodeDir, absoluteNetworkNodeDir);

    const port = await this.networkManager.addNode(chainId.toString(), nodeType, nodeAddress);
    if (!port) {
      console.error(`Failed to allocate port for node ${nodeAddress} in network ${chainId}.`);
      return;
    }

    const networkConfig = await this.networkManager.loadNetworkConfig(chainId.toString())
    const SUBNET = networkConfig.subnet    

    const gethNodeCommand = config.gethCommandArgs[nodeType]({
      networkNodeDir: '/root/.ethereum',
      chainId: chainId.toString(),
      ipcPath: '/root/ipc',
      port: port.toString(),
    }).join(' ');

    const dockerComposeContent = `
    version: '3.8'
    services:
      ${nodeType}-${nodeAddress}:
        image: ethereum/client-go:stable
        entrypoint: /bin/sh -c
        command: >
          "geth --datadir /root/.ethereum init /root/genesis.json &&
          geth ${gethNodeCommand}"
        volumes:
          - ${absoluteNetworkNodeDir}:/root/.ethereum
          - ${absoluteGenesisPath}:/root/genesis.json
        ports:
          - "${port}:${port}"
        networks:
          ethnetwork:
    
    networks:
      ethnetwork:
        driver: bridge
        ipam:
          config:
            - subnet: "${SUBNET}"    
`;

    // Write or update the docker-compose.yml file for the node
    const composeFilePath = path.join(networkNodeDir, 'docker-compose.yml');
    await fs.writeFile(composeFilePath, dockerComposeContent);

    // Start the node using Docker Compose
    await execAsync(`docker-compose -f ${composeFilePath} up -d`);
    console.log('container started')
  }

}

export default DockerDeployer;