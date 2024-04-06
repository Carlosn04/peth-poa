import GenesisFactory from './management/GenesisManager';
import FileSystemStorageMiddleware from './storage/FileSystemStorageMiddleware';
import AccountManager from './management/accounts/AccountManager';
import NodeManager from './management/nodes/NodeManager';
import NetworkManager from './management/networks/NetworkManager';
import DockerDeployer from './deployment/DockerDeployer';
import LocalGethDeployer from './deployment/LocalGethDeployer';

const storageMiddleware = new FileSystemStorageMiddleware();
const accountManager = new AccountManager(storageMiddleware);
const nodeManager = new NodeManager(storageMiddleware)
const networkManager = NetworkManager.getInstance(storageMiddleware)
const dockerDeployer = new DockerDeployer(storageMiddleware, 0) // Verbosity Level
const localGethDeployer = new LocalGethDeployer(storageMiddleware)
  
export const pethPoa = {
  accounts: {
    createAccount: accountManager.createAccount.bind(accountManager),
  },
  genesis: {
    createGenesis: GenesisFactory.createGenesis.bind(GenesisFactory),
  },
  network: {
    getConfig: networkManager.loadConfig.bind(networkManager)
  },
  geth: {
    createNode: nodeManager.createNode.bind(nodeManager),
    initNode: nodeManager.initNode.bind(nodeManager),
    startNode: nodeManager.startNode.bind(nodeManager),
    initAndStartNode: localGethDeployer.initAndStartNode.bind(localGethDeployer),
    initAndStartNetwork: localGethDeployer.initAndStartNetwork.bind(localGethDeployer)
  },
  docker: {
    initAndDeployNode: dockerDeployer.initAndDeployNode.bind(dockerDeployer),
    initAndDeployNetwork: dockerDeployer.initAndDeployNetwork.bind(dockerDeployer),
    removeNodeContainer: dockerDeployer.removeNodeContainer.bind(dockerDeployer),
    removeNetwork: dockerDeployer.removeAllByChainId.bind(dockerDeployer)
  }
};

export default pethPoa;