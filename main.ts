import GenesisCreator from './GenesisCreator';
import FileSystemStorageMiddleware from './storage/FileSystemStorageMiddleware';
import AccountManager from './management/accounts/AccountManager';
import SignerManager from './management/nodes/SignerManager';
import BootstrapManager from './management/nodes/BootstrapManager';
import NodeManager from './management/nodes/NodeManager';
import NetworkManager from './management/networks/NetworkManager';
import DockerDeployer from './deployment/DockerDeployer';

const storageMiddleware = new FileSystemStorageMiddleware();

const accountManager = new AccountManager(storageMiddleware);
const signerManager = new SignerManager(storageMiddleware);
const bootstrapManager = new BootstrapManager(storageMiddleware)
const nodeManager = new NodeManager(storageMiddleware)
const dockerDeployer = new DockerDeployer(storageMiddleware, 2) // Verbosity Level

async function createGenesis(chainId: number, period: number, epoch: number, signers: string[], alloc: Record<string, { balance: string }>) {
    const genesisCreator = new GenesisCreator({
      chainId,
      period,
      epoch,
      signers,
      alloc,
    });
    await genesisCreator.generateGenesisFile();
}
  
export const pethPoa = {
  accounts: {
    createAccount: accountManager.createAccount.bind(accountManager),
  },
  nodes: {
    createSignerAccount: signerManager.createSignerAccount.bind(signerManager),
    createBootstrapAccount: bootstrapManager.createBootstrapAccount.bind(bootstrapManager),
    createNode: nodeManager.createNode.bind(nodeManager),
    initNode: nodeManager.initNode.bind(nodeManager),
    startNode: nodeManager.startNode.bind(nodeManager),
    startBootstrapNode: bootstrapManager.startBootstrapNode.bind(bootstrapManager)
  },
  genesis: {
    createGenesis: createGenesis,
  },
  network: {
    // getNetworkConfigManager: (chainId: string) => new NetworkManager()
  },
  docker: {
    // initAndDeployNetwork: async (chainId: number) => {
    //   await dockerDeployer.initAndDeployNetwork(chainId)
    // },
    initAndDeployNode: dockerDeployer.initAndDeployNode.bind(dockerDeployer),
    removeNodeContainer: dockerDeployer.removeNodeContainer.bind(dockerDeployer)
  }
};

export default pethPoa;