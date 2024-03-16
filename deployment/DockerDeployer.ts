import { exec } from 'child_process';
import util from 'util';
import fs from 'fs-extra'; // For reading network-config.json and genesis.json
import path from 'path';
import { config } from '../config'; // Ensure this points to your config file correctly

const execAsync = util.promisify(exec);

class DockerDeployer {
    async deployNetwork(chainId: number): Promise<void> {
        try {
            // Load network configuration
            const networkDirectory = path.join(config.localStoragePath, `networks/${chainId}`);
            const networkConfigPath = path.join(networkDirectory, 'network-config.json');
            const networkConfig = await fs.readJson(networkConfigPath);

            // Load genesis configuration
            const genesisFilePath = path.join(networkDirectory, networkConfig.genesisPath);
            const genesisConfig = await fs.readJson(genesisFilePath);

            // Here you could dynamically create the docker-compose.yml content based on the genesis and network configurations

            // Example command setup for a signer node using clique PoA, adjust according to your setup
            let dockerComposeContent = `
version: '3.8'
services:
`;
            // Assuming the presence of at least one signer node for simplicity
            networkConfig.nodes.signers.forEach((signer: { address: string; nodePath: string }, index: number) => {
                dockerComposeContent += `
  signer-node-${index}:
    image: ethereum/client-go:latest
    command:
      - --datadir=/root/.ethereum
      - --networkid=${genesisConfig.config.chainId}
      - --unlock=${signer.address}
      - --password=/root/.ethereum/password.txt
      - --mine
      - --http
      - --http.addr=0.0.0.0
      - --http.api=eth,net,web3,personal
      - --http.corsdomain=*
      - --http.vhosts=*
    volumes:
      - ${path.resolve(signer.nodePath)}:/root/.ethereum
    ports:
      - "${8545 + index}:8545"
`;
            });

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
