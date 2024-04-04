import { GethCommandExecutor } from '../../deployment/LocalGethDeployer';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config';
import path from 'path';

export default class BootstrapManager {
    private storageMiddleware: IStorageMiddleware;
    private _enr: string | null = null;

    constructor(storageMiddleware: IStorageMiddleware) {
        this.storageMiddleware = storageMiddleware;
    }

    get enr(): string | null {
        return this._enr;
    }

    async startBootstrapNode(chainId: number, address: string, port: number, externalIp: string, subnet: string): Promise<void> {
        const networkNodeDir = path.join(config.localStoragePath, `networks/${chainId}/bootstrap/${address}`);
        const passwordFilePath = path.join(networkNodeDir, 'password.txt');
        const ipcPath = path.join(config.ipcNodePath, `${chainId}/${address}`, 'geth.ipc');
        const enrPath = path.join(config.localStoragePath, `networks/${chainId}`, 'enr.txt');

        try {
            await this.storageMiddleware.readFile(passwordFilePath);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Bootstrap directory or password not found for address ${address} in network ${chainId}: ${message}`);
        }

        const bootstrapArgs = config.gethCommandArgs.bootstrap({
            networkNodeDir,
            chainId: chainId.toString(),
            ipcPath,
            port: port.toString(),
        });

        const extraFlags: string[] = [
            '--authrpc.port', port?.toString()
        ]
        const fullCommand = [...bootstrapArgs, ...extraFlags]

        try {
            GethCommandExecutor.startNonBlocking(fullCommand, 'bootstrap');
            console.log('Geth node started (non-blocking)');
            await this.extractNodeRecord(ipcPath, enrPath);
        } catch (error) {
            console.error('Failed to start Geth command:', error);
        }
    }

    private async extractNodeRecord(ipcPath: string, enrPath: string): Promise<void> {
        setTimeout(async () => {
            try {
                const { stdout: enrOutput } = await GethCommandExecutor.execute(['attach', '--exec', 'admin.nodeInfo.enr', ipcPath], 'bootstrap');
                this._enr = enrOutput.trim().replace(/^"|"$/g, '');
                await this.storageMiddleware.writeFile(enrPath, this._enr);
            } catch (error) {
                console.error(`Failed to extract ENR for the bootstrap node in network`, error);
            }
        }, 1500);
    }
}