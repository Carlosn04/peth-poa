import { exec, spawn } from 'child_process';
import { GethCommandExecutor } from '../../GethCommandExecutor';
import { config } from '../../config'
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import SignerManager from './SignerManager';
import PortManager from '../networks/PortManager';
import BootstrapManager from './BootstrapManager';

class NodeManager {
    private storageMiddleware: IStorageMiddleware;
    private signerManager: SignerManager;
    private portManager: PortManager
    private bootstrapManager: BootstrapManager;

    constructor(storageMiddleware: IStorageMiddleware) {
        this.storageMiddleware = storageMiddleware;
        this.signerManager = new SignerManager(this.storageMiddleware)
        this.portManager = new PortManager(this.storageMiddleware)
        this.bootstrapManager = new BootstrapManager(this.storageMiddleware)
    }

    public async initNode(nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap', address: string, chainId: string): Promise<void> {        
        const nodeDir = `${config[nodeType + "Path"]}/${address}`;
        const networkNodeDir = `${config.localStoragePath}/networks/${chainId}/${nodeType}/${address}`;
        const genesisFilePath = `${config.localStoragePath}/networks/${chainId}/genesis.json`;

        // Check if the genesis file exists. If not, it should throw an error.
        try {
            await this.storageMiddleware.readFile(genesisFilePath);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Genesis file not found for chainId ${chainId}: ${message}`);
        }
        // Check if the node directory exists
        try {
            await this.storageMiddleware.readFile(`${nodeDir}/password.txt`); // Example check for keystore directory
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Node directory or keystore not found for address ${address} in ${nodeType}. Node must be setup beforehand: ${message}`);
        }

        await this.storageMiddleware.ensureDir(networkNodeDir);
        // Copy the node directory inside the network directory
        await this.storageMiddleware.copyDirectory(nodeDir, networkNodeDir);


        // Execute Geth command to initialize the node with the existing genesis file
        try {
            const stdout = await GethCommandExecutor.execute(['init', '--datadir', networkNodeDir, genesisFilePath]);
            console.log(`Node ${address} of type ${nodeType} initialized with chainId ${chainId}.`);
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(`Failed to initialize node ${address}:`, error.message);
                throw error; // Re-throw the original error if it's an instance of Error
            } else {
                console.error(`Failed to initialize node ${address}: Unknown error`);
                throw new Error('Unknown error occurred during node initialization');
            }
        }
    }

    public async startNode(nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap', address: string, chainId: number, externalIp?: string, subnet?: string) {
        const actualExternalIp = externalIp || config.externalIp;
        const actualSubnet = subnet || config.subnet;

        const enrPath = `${config.localStoragePath}/networks/${chainId}/enr.txt`;
        try {
            const enr = nodeType === 'bootstrap' ? '' : await this.storageMiddleware.readFile(enrPath);
            // console.log(`ENR for network ${chainId}: ${enr}`);

            const port = await this.portManager.allocatePort(chainId.toString());
            if (!port) {
                console.error(`Failed to allocate port for node ${address} in network ${chainId}.`);
                return;
            }

            switch (nodeType) {
                case 'signer':
                    await this.signerManager.startSignerNode(chainId, address, port, enr);
                    break;
                case 'bootstrap':
                    // Ensure externalIp and subnet are provided for bootstrap nodes
                    if (!actualExternalIp || !actualSubnet) {
                        console.error('Missing externalIp or subnet for bootstrap node start.');
                        return;
                    }
                    await this.bootstrapManager.startBootstrapNode(chainId, address, actualExternalIp, actualSubnet, port);
                    break;
                default:
                    console.error(`Node type ${nodeType} is not supported.`);
            }
        } catch (error) {
            console.error(`Error starting node: ${error}`);
        }
      }
}

export default NodeManager;