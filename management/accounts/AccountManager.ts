import { GethCommandExecutor } from '../../GethCommandExecutor';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config';

export default class AccountManager {
    private storageMiddleware: IStorageMiddleware;

    constructor(storageMiddleware: IStorageMiddleware) {
        this.storageMiddleware = storageMiddleware;
    }

    async createAccount(accountName: string, password: string): Promise<string> {
        const dataDir = `${config.accountPath}/${accountName}`;
        const passwordFilePath = `${dataDir}/password.txt`;

        // Use the storage middleware to ensure the directory exists
        await this.storageMiddleware.ensureDir(dataDir);

        // Proceed with middleware for file operations
        await this.storageMiddleware.writeFile(passwordFilePath, password);

        try {
            const { stdout } = await GethCommandExecutor.execute(['account', 'new', '--datadir', dataDir, '--password', passwordFilePath]);
            // await this.storageMiddleware.deleteFile(passwordFilePath); // Cleanup

            const match = stdout.match(/Public address of the key:\s+([0-9a-fA-Fx]+)\n/);
            if (!match) throw new Error('Failed to parse account address.');
            
            console.log(`Account created with address: ${match[1]}`);
            return match[1];
        } catch (error) {
            console.error('Failed to create account:', error);
            throw error;
        }
    }
}