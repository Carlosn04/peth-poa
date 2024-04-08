import path from 'path'
import { GethCommandExecutor } from '../../deployment/LocalGethDeployer';
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
        const tempDir = path.join(config[`${nodeType}Path`], 'temp');
        const passwordFilePath = path.join(tempDir, 'password.txt');

        await this.storageMiddleware.ensureDir(tempDir);
        await this.storageMiddleware.writeFile(passwordFilePath, password);

        const { stdout } = await GethCommandExecutor.execute([
            'account', 'new', '--datadir', tempDir, '--password', passwordFilePath
        ], nodeType);

        const match = stdout.match(/Public address of the key:\s+([0-9a-fA-Fx]+)\n/);
        if (!match) throw new Error('Address not found in Geth output.');

        const finalDir = path.join(config[`${nodeType}Path`], match[1]);
        await this.storageMiddleware.ensureDir(finalDir);

        await this.storageMiddleware.moveDir(path.join(tempDir, 'keystore'), path.join(finalDir, 'keystore'));
        await this.storageMiddleware.moveDir(passwordFilePath, path.join(finalDir, 'password.txt'));

        console.log(`${nodeType} account created with address: ${match[1]}`);
        return match[1];
    }

    public async initNode(chainId: number, nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap', nodeAddress: string): Promise<void> {
        const nodeDir = path.join(config[`${nodeType}Path`], nodeAddress);
        const networkNodeDir = path.join(config.localStoragePath, `networks/${chainId}/${nodeType}/${nodeAddress}`);
        const genesisFilePath = path.join(config.localStoragePath, `networks/${chainId}/genesis.json`);

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
            throw new Error(`Node directory or keystore not found for address ${nodeAddress} in ${nodeType}. Node must be setup beforehand: ${message}`);
        }

        await this.storageMiddleware.ensureDir(networkNodeDir);
        await this.storageMiddleware.copyDirectory(nodeDir, networkNodeDir);

        // Execute Geth command to initialize the node with the existing genesis file
        try {
            const stdout = await GethCommandExecutor.execute(['init', '--datadir', networkNodeDir, genesisFilePath], nodeType);
            console.log(`Node ${nodeAddress} of type ${nodeType} initialized with chainId ${chainId}.`);
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(`Failed to initialize node ${nodeAddress}:`, error.message);
                throw error; // Re-throw the original error if it's an instance of Error
            } else {
                console.error(`Failed to initialize node ${nodeAddress}: Unknown error`);
                throw new Error('Unknown error occurred during node initialization');
            }
        }
    }

    public async startNode(chainId: number, nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap', nodeAddress: string, externalIp?: string, subnet?: string) {
        const actualExternalIp = externalIp || '' // config.externalIp;
        const actualSubnet = subnet || '' // config.subnet;
        const enrPath = path.join(config.localStoragePath, `networks/${chainId}/enr.txt`);
        try {
            const enr = nodeType === 'bootstrap' ? '' : await this.storageMiddleware.readFile(enrPath);
            const { ip, port, rpcPort } = await this.networkManager.addNode(chainId.toString(), nodeType, nodeAddress);

            if (!port || !ip) {
                console.error(`Failed to allocate port/ip for node ${nodeAddress} in network ${chainId}.`);
                return;
            }

            switch (nodeType) {
                case 'signer':
                    await this.signerManager.startSignerNode(chainId, nodeAddress, port, enr);
                    break;
                case 'member':
                    await this.memberManager.startMemberNode(chainId, nodeAddress, port, enr);
                    break;
                case 'rpc':
                    await this.rpcManager.startRpcNode(chainId, nodeAddress, enr, port, rpcPort);
                    break;
                case 'bootstrap':
                    await this.bootstrapManager.startBootstrapNode(chainId, nodeAddress, port, rpcPort);
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