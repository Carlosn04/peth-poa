import { GethCommandExecutor } from '../../GethCommandExecutor';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config'; // Import the config

export default class RpcManager {
  private storageMiddleware: IStorageMiddleware;

  constructor(storageMiddleware: IStorageMiddleware) {
    this.storageMiddleware = storageMiddleware;
  }

  public async startRpcNode(chainId: number, address: string, port: number | null | undefined, enr: string) {
    if (!enr) {
      console.error("ENR not available. Cannot start signer node.");
      return;
    }

    if (!port) {
      console.error("Port not provided! Cannot start signer node.");
      return;
    }

    const networkNodeDir = `${config.localStoragePath}/networks/${chainId}/rpc/${address}`;
    const ipcPath = `${config.localStoragePath}/geth.ipc`
    
    // Construct the Geth command arguments including the --bootnodes flag with the ENR
    const gethCommandArgs = [
      '--datadir', networkNodeDir,
      '--port', port.toString(),
      '--authrpc.port', port.toString(), // Geth connection
      '--bootnodes', enr,
      '--networkid', chainId.toString(),
      '--password', `${networkNodeDir}/password.txt`,
      '--ipcdisable',
      '--discovery.v5',
      '--http', '--http.addr', '0.0.0.0', '--http.port', '8545', '--http.corsdomain', '"*"',  
      // '--ipcdisable'
    ];

    const rpcArgs = config.gethCommandArgs.rpc({
        networkNodeDir,
        port: port.toString(),
        chainId: chainId.toString(),
        enr
    })
  
    try {
      await GethCommandExecutor.execute(rpcArgs);
      console.log(`Rpc node started for address: ${address} on network: ${chainId}`);
    } catch (error) {
      console.error(`Failed to start member node for address: ${address}`, error);
    }
  }
}