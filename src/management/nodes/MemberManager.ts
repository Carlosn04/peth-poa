import { GethCommandExecutor } from '../../deployment/LocalGethDeployer';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config';
import path from 'path'

export default class MemberManager {
  private storageMiddleware: IStorageMiddleware;

  constructor(storageMiddleware: IStorageMiddleware) {
    this.storageMiddleware = storageMiddleware;
  }

  public async startMemberNode(chainId: number, address: string, port: number | null | undefined, enr: string) {
    if (!enr || !port) {
      const error = !enr ? "ENR not available. Cannot start signer node." : "Port not provided! Cannot start signer node."
      console.error(error);
      return;
    }

    const networkNodeDir = path.join(config.localStoragePath, `networks/${chainId}/member/${address}`);
    const ipcPath = path.join(config.ipcNodePath, `${chainId}/${address}`, 'geth.ipc');

    const memberArgs = config.gethCommandArgs.member({
      networkNodeDir,
      chainId: chainId.toString(),
      port: port.toString(),
      address,
      enr,
      ipcPath,
    })

    const extraFlags: string[] = [
      '--authrpc.port', port?.toString()
    ]
    const fullCommand = [...memberArgs, ...extraFlags]

    try {
      await GethCommandExecutor.execute(fullCommand, 'member');
      console.log(`Member node started for address: ${address} on network: ${chainId}`);
    } catch (error) {
      console.error(`Failed to start member node for address: ${address}`, error);
    }
  }
}