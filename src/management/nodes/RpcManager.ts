import { GethCommandExecutor } from '../../deployment/LocalGethDeployer';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config'; // Import the config
import path from 'path'

export default class RpcManager {
  private storageMiddleware: IStorageMiddleware;

  constructor(storageMiddleware: IStorageMiddleware) {
    this.storageMiddleware = storageMiddleware;
  }

  public async startRpcNode(chainId: number, address: string, enr: string, port: number | null | undefined, ip: string | null) {
    if (!enr || !port) {
      const error = !enr ? "ENR not available. Cannot start signer node." : "Port not provided! Cannot start signer node."
      console.error(error);
      return;
    }

    const networkNodeDir = path.join(config.localStoragePath, `networks/${chainId}/rpc/${address}`);
    const ipcPath = path.join(config.ipcNodePath, `${chainId}/${address}`, 'geth.ipc');

    const rpcArgs = config.gethCommandArgs.rpc({
      networkNodeDir,
      port: port.toString(),
      chainId: chainId.toString(),
      enr,
      httpPort: port.toString(),
      httpIp: '0.0.0.0',
      ipcPath
    })

    const extraFlags: string[] = [
      '--authrpc.port', port?.toString()
    ]
    const fullCommand = [...rpcArgs, ...extraFlags]

    try {
      GethCommandExecutor.startNonBlocking(fullCommand, 'rpc');
      console.log(`Rpc node started for address: ${address} on network: ${chainId}`);
    } catch (error) {
      console.error(`Failed to start member node for address: ${address}`, error);
    }
  }
}