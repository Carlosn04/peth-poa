import { exec } from 'child_process';
import util from 'util';
import fs from 'fs-extra'; // For reading network-config.json and genesis.json
import path from 'path';
import { config } from '../config'; // Ensure this points to your config file correctly

const execAsync = util.promisify(exec);

class DockerDeployer {
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
}

export default DockerDeployer;