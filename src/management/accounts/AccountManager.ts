import { GethCommandExecutor } from '../../deployment/LocalGethDeployer';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config';
import path from 'path'

export default class AccountManager {
    private storageMiddleware: IStorageMiddleware;

    constructor(storageMiddleware: IStorageMiddleware) {
        this.storageMiddleware = storageMiddleware;
    }

    async createAccount(accountName: string, password: string): Promise<string> {
        const dataDir = path.join(config.accountPath, accountName);
        const passwordFilePath = path.join(dataDir, 'password.txt');

        await this.storageMiddleware.ensureDir(dataDir);
        await this.storageMiddleware.writeFile(passwordFilePath, password);

        const { stdout } = await GethCommandExecutor.execute([
            'account', 'new', '--datadir', dataDir, '--password', passwordFilePath
        ], 'account');

        const match = stdout.match(/Public address of the key:\s+([0-9a-fA-Fx]+)\n/);
        if (!match) throw new Error('Address not found in Geth output.');

        console.log(`Account created with address: ${match[1]}`);
        return match[1];
    }
}