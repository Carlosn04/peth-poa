import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { IStorageMiddleware } from '../interfaces/IStorageMiddleware'
import chalk from 'chalk';
import NodeManager from '../management/nodes/NodeManager'
import GenesisFactory from '../management/GenesisManager';

// Define the node types as a type rather than an interface to restrict the values
type NodeType = 'bootstrap' | 'signer' | 'rpc' | 'member' | 'account';

interface ColorTypes {
    bootstrap: chalk.Chalk;
    signer: chalk.Chalk;
    rpc: chalk.Chalk;
    member: chalk.Chalk;
    account: chalk.Chalk;
}

const nodeTypeColors: ColorTypes = {
    bootstrap: chalk.blue,
    signer: chalk.green,
    rpc: chalk.yellow,
    member: chalk.magenta,
    account: chalk.white
};


export class GethCommandExecutor {
    static execute(command: string[], nodeType: NodeType): Promise<{ stdout: string, stderr: string, exitCode: number | null }> {
        return new Promise((resolve, reject) => {
            const process = spawn('geth', command);
            let stdout = '';
            let stderr = '';

            const colorize = nodeTypeColors[nodeType] || chalk.white;

            const logData = (data: string) => console.log(colorize(`[${nodeType}] ${data}`));
            const logError = (data: string) => console.error(colorize(`[${nodeType}] ${data}`));

            process.stdout.on('data', (data) => {
                stdout += data.toString();
                logData(data.toString());
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
                logError(data.toString());
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr, exitCode: code });
                } else {
                    reject(new Error(`Geth command failed with code ${code}: stdout: ${stdout}, stderr: ${stderr}`));
                }
            });
        });
    }

    static startNonBlocking(command: string[], nodeType: NodeType): ChildProcessWithoutNullStreams {
        const process = spawn('geth', command);

        const colorize = nodeTypeColors[nodeType] || chalk.white;

        const logData = (data: string) => console.log(colorize(`[${nodeType}] ${data}`));
        const logError = (data: string) => console.error(colorize(`[${nodeType}] ${data}`));

        process.stdout.on('data', data => logData(data.toString()));
        process.stderr.on('data', data => logError(data.toString()));

        process.on('close', (code) => {
            logData(`Geth process exited with code ${code}`);
        });

        process.on('SIGINT', () => {
            logData('Geth process interrupted with SIGINT');
        });

        return process;
    }
}

export default class LocalGethDeployer {
    private nodeManager: NodeManager;

    constructor(storageMiddleware: IStorageMiddleware) {
        this.nodeManager = new NodeManager(storageMiddleware);
    }

    async initAndStartNode(chainId: number, nodeType: 'signer' | 'member' | 'rpc' | 'bootstrap', nodeAddress: string, externalIp?: string, subnet?: string): Promise<void> {
        try {
            // Step 1: Create Node and Get Address 
            // const address = await this.nodeManager.createNode(nodeType, password);
            // console.log(`${nodeType} node created at address: ${address}`);

            // Step 2: Initialize Node with given Chain ID
            await this.nodeManager.initNode(chainId, nodeType, nodeAddress);

            // Step 3: Start Node
            await this.nodeManager.startNode(chainId, nodeType, nodeAddress);
        } catch (error) {
            console.error(`Failed to initialize and start ${nodeType} node:`, error);
        }
    }

    async initAndStartNetwork(chainId: number) {
        // Default addresses within the package
        const addresses = {
            bootstrapNodeAddress: "0xCeB5ca48b5DE1839379FAEDD0572F7D59B279749",
            signerNodeAddress: "0x64fB496Bbfd447Dba254aFe4E28a325cb19ec25f",
            rpcNodeAddress: '0x46198b00f237407133da9CcFb2D567dF159284D4',
            memberNodeAddress: '0xBa551f402cfC912482cB15466641E6FC3B2D63f2',
        };

        const alloc = {
            [addresses.signerNodeAddress]: { balance: '100' }, // This value is converted to gwei
            [addresses.rpcNodeAddress]: { balance: '100' }, //
        };
        const signers = [addresses.signerNodeAddress];

        await GenesisFactory.createGenesis(chainId, signers, alloc)
        await this.initAndStartNode(chainId, 'bootstrap', addresses.bootstrapNodeAddress)
        await this.delay(1500)
        await this.initAndStartNode(chainId, 'signer', addresses.signerNodeAddress)
        await this.delay(500)
        await this.initAndStartNode(chainId, 'rpc', addresses.rpcNodeAddress)
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}