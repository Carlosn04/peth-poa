import { GethCommandExecutor } from '../../GethCommandExecutor';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config'; // Import the config
import BootstrapManager from './BootstrapManager';

export default class MemberManager {
  private storageMiddleware: IStorageMiddleware;

  constructor(storageMiddleware: IStorageMiddleware) {
    this.storageMiddleware = storageMiddleware;
  }

  public async startMemberNode(chainId: number, address: string, port: number | null | undefined, enr: string) {
    if (!enr) {
      console.error("ENR not available. Cannot start signer node.");
      return;
    }

    if (!port) {
      console.error("Port not provided! Cannot start signer node.");
      return;
    }

    const networkNodeDir = `${config.localStoragePath}/networks/${chainId}/member/${address}`;
    const ipcPath = `${config.localStoragePath}/geth.ipc`
    
    // Construct the Geth command arguments including the --bootnodes flag with the ENR
    const gethCommandArgs = [
      '--datadir', networkNodeDir,
      '--port', port.toString(),
      '--authrpc.port', port.toString(), // Geth connection
      '--bootnodes', enr,
      '--networkid', chainId.toString(),
      '--unlock', address,
      '--password', `${networkNodeDir}/password.txt`,
      '--ipcdisable',
      '--discovery.v4',
      '--discovery.v5'  
      // '--ipcdisable'
    ];
  
    try {
      await GethCommandExecutor.execute(gethCommandArgs);
      console.log(`Member node started for address: ${address} on network: ${chainId}`);
    } catch (error) {
      console.error(`Failed to start member node for address: ${address}`, error);
    }
  }
}