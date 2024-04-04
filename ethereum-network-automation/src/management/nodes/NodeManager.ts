import { exec, spawn } from 'child_process';
import { GethCommandExecutor } from '../../GethCommandExecutor';
import { config } from '../../config'
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import SignerManager from './SignerManager';
import NetworkManager from '../networks/NetworkManager';
import BootstrapManager from './BootstrapManager';
import MemberManager from './MemberManager';
import RpcManager from './RpcManager';

class NodeManager {
    private storageMiddleware: IStorageMiddleware;
    private signerManager: SignerManager;
    private networkManager: NetworkManager
    private bootstrapManager: BootstrapManager;
    private memberManager: MemberManager;
    private rpcManager: RpcManager;

    constructor(storageMiddleware: IStorageMiddleware) {
        this.storageMiddleware = storageMiddleware;
        this.signerManager = new SignerManager(this.storageMiddleware)
        this.networkManager = new NetworkManager(this.storageMiddleware)
        this.bootstrapManager = new BootstrapManager(this.storageMiddleware)
        this.memberManager = new MemberManager(this.storageMiddleware)
        this.rpcManager = new RpcManager(this.storageMiddleware)
    }

    public async createNode(nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap', password: string): Promise<string> {
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
        const tempDir: string = `${getNodeDirPath(nodeType)}/temp`;
        const passwordFilePath: string = `${tempDir}/password.txt`;

        // Ensure the temporary data directory exists
        await this.storageMiddleware.ensureDir(tempDir);

        // Write the password to a file
        await this.storageMiddleware.writeFile(passwordFilePath, password);

        // Execute Geth command to create a new account
        const { stdout } = await GethCommandExecutor.execute([
            'account', 'new', '--datadir', tempDir, '--password', passwordFilePath
        ]);

        // Extract the account address from the output
        const match = stdout.match(/Public address of the key:\s+([0-9a-fA-Fx]+)\n/);
        if (!match) throw new Error('Address not found in Geth output.');

        // Determine the final storage path based on the account address
        const finalDir: string = `${getNodeDirPath(nodeType)}/${match[1]}`;
        await this.storageMiddleware.ensureDir(finalDir);

        // Move the keystore and password file to the final directory
        await this.storageMiddleware.moveDir(`${tempDir}/keystore`, `${finalDir}/keystore`);
        await this.storageMiddleware.moveDir(passwordFilePath, `${finalDir}/password.txt`);

        // console.log(`${nodeType} account created with address: ${match[1]}`);
        return match[1];
    }

    public async initNode(nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap', address: string, chainId: string): Promise<void> {   
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

        const nodeDir = `${getNodeDirPath(nodeType)}/${address}`;
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
        const actualExternalIp = externalIp || '' // config.externalIp;
        const actualSubnet = subnet || '' // config.subnet;

        const enrPath = `${config.localStoragePath}/networks/${chainId}/enr.txt`;
        try {
            const enr = nodeType === 'bootstrap' ? '' : await this.storageMiddleware.readFile(enrPath);
            // console.log(`ENR for network ${chainId}: ${enr}`);

            const { ip, port } = await this.networkManager.addNode(chainId.toString(), nodeType, address);
            if (!port) {
                console.error(`Failed to allocate port for node ${address} in network ${chainId}.`);
                return;
            }

            switch (nodeType) {
                case 'signer':
                    await this.signerManager.startSignerNode(chainId, address, port, enr);
                    break;
                case 'member':
                    await this.memberManager.startMemberNode(chainId, address, port, enr);
                    break;
                case 'rpc':
                    await this.rpcManager.startRpcNode(chainId, address, port, enr);
                    break;
                case 'bootstrap':
                    // Ensure externalIp and subnet are provided for bootstrap nodes
                    // if (!actualExternalIp || !actualSubnet) {
                    //     console.error('Missing externalIp or subnet for bootstrap node start.');
                    //     return;
                    // }
                    await this.bootstrapManager.startBootstrapNode(chainId, address, port, actualExternalIp, actualSubnet);
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