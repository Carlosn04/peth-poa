import { GethCommandExecutor } from '../../GethCommandExecutor';
import { IStorageMiddleware } from '../../interfaces/IStorageMiddleware';
import { config } from '../../config'; // Import the config
import BootstrapManager from './BootstrapManager';

export default class SignerManager {
  private storageMiddleware: IStorageMiddleware;

  constructor(storageMiddleware: IStorageMiddleware) {
    this.storageMiddleware = storageMiddleware;
  }

  async createSignerAccount(password: string): Promise<string> {
    // Initially, we don't know the account name, so we just use a temporary directory for account creation
    const tempDir = `${config.signerPath}/temp`;
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
    const finalDir = `${config.signerPath}/${match[1]}`;
    await this.storageMiddleware.ensureDir(finalDir);

    // Move the account from the temp directory to the final directory
    await this.storageMiddleware.moveDir(`${tempDir}/keystore`, `${finalDir}/keystore`);
    await this.storageMiddleware.moveDir(`${tempDir}/password.txt`, `${finalDir}/password.txt`)

    console.log(`Signer account created with address: ${match[1]}`);
    return match[1];
  }

  public async startSignerNode(chainId: number, address: string, port: number | null | undefined, enr: string) {
    if (!enr) {
      console.error("ENR not available. Cannot start signer node.");
      return;
    }

    if (!port) {
      console.error("Port not provided! Cannot start signer node.");
      return;
    }

    const networkNodeDir = `${config.localStoragePath}/networks/${chainId}/signer/${address}`;
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
      '--mine',
      '--miner.etherbase', address,
      '--ipcpath', ipcPath,
      '--discovery.v4',
      '--discovery.v5'
      // '--ipcdisable'
    ];
  
    try {
      await GethCommandExecutor.execute(gethCommandArgs);
      console.log(`Signer node started for address: ${address} on network: ${chainId}`);
    } catch (error) {
      console.error(`Failed to start signer node for address: ${address}`, error);
    }
  }
}