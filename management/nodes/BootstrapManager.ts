import { GethCommandExecutor } from '../../GethCommandExecutor';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config'; // Import the config
import path from 'path'

async function cleanupCallback(tempFilesPahts: string[], storageMiddleware: IStorageMiddleware) {
    console.log('Performing cleanup...');
    // Iterate over temporary files and delete them
    for (const filePath of tempFilesPahts) {
        try {
            await storageMiddleware.readFile(filePath);
            await storageMiddleware.deleteFile(filePath);
            console.log(`Deleted temporary file: ${filePath}`);
        } catch (error) {
            console.error(`Error deleting temporary file: ${filePath}`, error);
        }
    }
    console.log('Cleanup completed.');
}

export default class BootstrapManager {
    private storageMiddleware: IStorageMiddleware;
    private _enr: string | null = null;

    constructor(storageMiddleware: IStorageMiddleware) {
        this.storageMiddleware = storageMiddleware;
    }

    get enr(): string | null {
        return this._enr;
    }

    async createBootstrapAccount(password: string): Promise<string> {
        // Initially, we don't know the account name, so we just use a temporary directory for account creation
        const tempDir = `${config.bootstrapPath}/temp`;
        const passwordFilePath = `${tempDir}/password.txt`;

        // Ensure the temporary data directory exists
        await this.storageMiddleware.ensureDir(tempDir);

        // Use the storage middleware to handle file operations
        await this.storageMiddleware.writeFile(passwordFilePath, password);

        const { stdout } = await GethCommandExecutor.execute([
            'account', 'new', '--datadir', tempDir, '--password', passwordFilePath
        ]);

        // Extract the account address from the output
        const match = stdout.match(/Public address of the key:\s+([0-9a-fA-Fx]+)\n/);
        if (!match) throw new Error('Address not found in Geth output.');

        // Now that we have the address, determine the final storage path
        const finalDir = `${config.bootstrapPath}/${match[1]}`;
        await this.storageMiddleware.ensureDir(finalDir);

        // Move the account and password from the temp directory to the final directory
        await this.storageMiddleware.moveDir(`${tempDir}/keystore`, `${finalDir}/keystore`);
        await this.storageMiddleware.moveDir(`${tempDir}/password.txt`, `${finalDir}/password.txt`)

        console.log(`Signer account created with address: ${match[1]}`);
        return match[1];
    }

    async startBootstrapNode(chainId: number, address: string, externalIp: string, subnet: string, port: number): Promise<void> {
        const networkNodeDir = `${config.localStoragePath}/networks/${chainId}/bootstrap/${address}`;
        const passwordFilePath = `${networkNodeDir}/password.txt`;
        const ipcPath = `${config.localStoragePath}/networks/${chainId}/geth.ipc`
        const enrPath = `${config.localStoragePath}/networks/${chainId}/enr.txt`

        // Ensure the network node directory and password file exist
        try {
            await this.storageMiddleware.readFile(passwordFilePath);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Bootstrap directory or password not found for address ${address} in network ${chainId}: ${message}`);
        }

        // Construct the geth command to start the bootstrap node
        const gethCommandArgs = [
            '--datadir', networkNodeDir,
            '--networkid', chainId.toString(),
            '--ipcpath', ipcPath, // Example of a shorter path for IPC
            // '--ipcdisable',
            '--port', port.toString(),
            '--authrpc.port', port.toString(),
            '--nat', `extip:${externalIp}`,
            '--netrestrict', subnet,
            '--verbosity', '3',
            // Add additional flags as needed
        ];

        const encapsulatedCleanup = () => {
            cleanupCallback([enrPath], this.storageMiddleware).catch(console.error);
        };

        try {
            const process = GethCommandExecutor.startNonBlocking(gethCommandArgs, encapsulatedCleanup);
            console.log('Geth node started (non-blocking)');
            await this.extractNodeRecord(ipcPath, enrPath);
        } catch (error) {
            console.error('Failed to start Geth command:', error);
        }        
    }

    private async extractNodeRecord(ipcPath: string, enrPath: string): Promise<void> {
        // Wait for a moment to ensure Geth has started
        setTimeout(async () => {
            try {
                const { stdout: enrOutput } = await GethCommandExecutor.execute(['attach', '--exec', 'admin.nodeInfo.enr', ipcPath]);
                this._enr = enrOutput.trim().replace(/^"|"$/g, '');
                this.storageMiddleware.writeFile(enrPath, this._enr);
            } catch (error) {
                console.error(`Failed to extract ENR for the bootstrap node in network `, error);
            }
        }, 1500); // Adjust the delay as necessary based on your setup
    }
}