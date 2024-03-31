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

    const enrPath = `${config.localStoragePath}/networks/${chainId}/enr.txt`

    await this.storageMiddleware.ensureDir(absoluteNetworkNodeDir);
    await this.storageMiddleware.copyDirectory(nodeDir, absoluteNetworkNodeDir);

    const { ip, port } = await this.networkManager.addNode(chainId.toString(), nodeType, nodeAddress);
    if (!port) {
      console.error(`Failed to allocate port for node ${nodeAddress} in network ${chainId}.`);
      return;
    }

    const enr = nodeType === 'bootstrap' ? '' : await this.storageMiddleware.readFile(enrPath);

    const networkConfig = await this.networkManager.loadNetworkConfig(chainId.toString())
    const SUBNET = networkConfig.subnet
    const uniqueIdentity = `${nodeType}-${chainId}-${nodeAddress}`
    const httpRpcPort = '8549'

    const gethNodeCommand = config.gethCommandArgs[nodeType]({
      networkNodeDir: '/root/.ethereum',
      chainId: chainId.toString(),
      address: nodeAddress,
      enr: enr,
      ipcPath: '/root/ipc/geth.ipc',
      port: port.toString(),
      authRpcPort: port.toString(),
      httpPort: httpRpcPort
    }).join(' ');

    const networkflags = `--nat "extip:${ip}" --netrestrict ${SUBNET}`
    const portsSection = nodeType === 'rpc' ? `ports:\n          - ${port}:${httpRpcPort}` : '';

    //     const networkSection = `
    // networks:
    //   eth${chainId}:
    //     external: true
    //     ipam:
    //       config:
    //         - subnet: "${SUBNET}"
    // `;

    const createDockerNetwork = nodeType !== 'bootstrap' ? '' : await execAsync(`docker network create --driver bridge --subnet=${SUBNET} eth${chainId}`);

    const dockerComposeContent = `
    version: '3.8'
    services:
      ${uniqueIdentity}:
        container_name: ${uniqueIdentity}
        image: ethereum/client-go:stable
        entrypoint: /bin/sh -c
        command: >
          "geth --datadir /root/.ethereum init /root/genesis.json &&
          geth ${gethNodeCommand} ${networkflags}"
        volumes:
          - ${absoluteNetworkNodeDir}:/root/.ethereum
          - ${absoluteGenesisPath}:/root/genesis.json
        ${portsSection}
        networks:
          eth${chainId}:
            ipv4_address: ${ip}
    
    networks:
      eth${chainId}:
        external: true    
`;

    // Write or update the docker-compose.yml file for the node
    const composeFilePath = path.join(networkNodeDir, 'docker-compose.yml');
    await fs.writeFile(composeFilePath, dockerComposeContent);

    // Create docker network for the chainId - docker network ls to view networks

    // Start the node using Docker Compose
    await execAsync(`docker-compose -p eth${chainId} -f ${composeFilePath} up -d`);
    console.log('container started')

    // If bootstrap node extract the ENR
    if (nodeType === 'bootstrap') {
      // Wait a bit to ensure the Geth node is fully up and running
      setTimeout(async () => {
        // uniqueIdentity to find the specific bootstrap node container
        const enrCommand = `docker exec ${uniqueIdentity} geth attach --exec admin.nodeInfo.enr /root/ipc/geth.ipc`;
        try {
          const { stdout, stderr } = await execAsync(enrCommand);
          if (stderr) {
            console.error('Error extracting ENR:', stderr);
            return;
          }
          const enr = stdout.trim().replace(/^"|"$/g, '');
          await this.storageMiddleware.writeFile(enrPath, enr);
          console.log('Extracted ENR:', enr);
        } catch (error) {
          console.error('Failed to extract ENR:', error);
        }
      }, 1500); // Adjust delay as necessary
    }
    
  }

}

export default DockerDeployer;