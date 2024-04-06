import { GethCommandExecutor } from '../../deployment/LocalGethDeployer';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config';
import path from 'path';

export default class SignerManager {
  private storageMiddleware: IStorageMiddleware;

  constructor(storageMiddleware: IStorageMiddleware) {
    this.storageMiddleware = storageMiddleware;
  }

  public async startSignerNode(chainId: number, address: string, port: number | null | undefined, enr: string) {
    if (!enr || !port) {
      const error = !enr ? "ENR not available. Cannot start signer node." : "Port not provided! Cannot start signer node."
      console.error(error);
      return;
    }

    const networkNodeDir = path.join(config.localStoragePath, `networks/${chainId}/signer/${address}`);
    const ipcPath = path.join(config.ipcNodePath, `${chainId}/${address}`, 'geth.ipc');

    const signerArgs = config.gethCommandArgs.signer({
      networkNodeDir: networkNodeDir,
      port: port?.toString(),
      authRpcPort: port?.toString(),
      enr,
      chainId,
      address,
      ipcPath,
    });

    const extraFlags: string[] = [
      '--authrpc.port', port?.toString()
    ]
    const fullCommand = [...signerArgs, ...extraFlags]

    try {
      GethCommandExecutor.startNonBlocking(fullCommand, 'signer');
      console.log(`Signer node started for address: ${address} on network: ${chainId}`);
    } catch (error) {
      console.error(`Failed to start signer node for address: ${address}`, error);
    }
  }
}