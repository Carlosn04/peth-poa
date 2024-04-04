import GenesisFactory from './management/GenesisManager';
import FileSystemStorageMiddleware from './storage/FileSystemStorageMiddleware';
import AccountManager from './management/accounts/AccountManager';
import NodeManager from './management/nodes/NodeManager';
import NetworkManager from './management/networks/NetworkManager';
import DockerDeployer from './deployment/DockerDeployer';

const storageMiddleware = new FileSystemStorageMiddleware();
const accountManager = new AccountManager(storageMiddleware);
const nodeManager = new NodeManager(storageMiddleware)
const networkManager = NetworkManager.getInstance(storageMiddleware)
const dockerDeployer = new DockerDeployer(storageMiddleware, 0) // Verbosity Level
  
export const pethPoa = {
  accounts: {
    createAccount: accountManager.createAccount.bind(accountManager),
  },
  nodes: {
    createNode: nodeManager.createNode.bind(nodeManager),
    initNode: nodeManager.initNode.bind(nodeManager),
    startNode: nodeManager.startNode.bind(nodeManager),
  },
  genesis: {
    createGenesis: GenesisFactory.createGenesis.bind(GenesisFactory),
  },
  network: {
    getConfig: networkManager.loadNetworkConfig.bind(networkManager)
  },
  docker: {
    initAndDeployNode: dockerDeployer.initAndDeployNode.bind(dockerDeployer),
    removeNodeContainer: dockerDeployer.removeNodeContainer.bind(dockerDeployer),
    removeNetwork: dockerDeployer.removeAllByChainId.bind(dockerDeployer)
  }
};

export default pethPoa;