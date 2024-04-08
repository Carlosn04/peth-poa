import path from 'path'
const basePath = path.resolve(__dirname, '..');

interface IGethCommandArgs {
    [nodeType: string]: (params: any) => string[];
}

interface IConfig {
    localStoragePath: string;
    ipcNodePath: string,
    accountPath: string;
    nodePath: string;
    signerPath: string;
    memberPath: string;
    rpcPath: string;
    bootstrapPath: string;
    portsBasePath: string;
    rpcPortsBasePath: string;
    ipsBasePath: string;
    networksBasePath: string;
    gethCommandArgs: IGethCommandArgs;
}

const verbosity = '3'

const gethCommandArgs: IGethCommandArgs = {
    bootstrap: (params) => [
        '--datadir', params.networkNodeDir,
        '--networkid', params.chainId,
        '--ipcpath', params.ipcPath,
        '--port', params.port,
        '--discovery.v5', // needed for enr
        '--verbosity', verbosity,
    ],
    signer: (params) => [
        '--datadir', params.networkNodeDir,
        '--port', params.port,
        '--bootnodes', params.enr,
        '--networkid', params.chainId,
        '--unlock', params.address,
        '--password', `${params.networkNodeDir}/password.txt`,
        '--mine',
        '--miner.etherbase', params.address,
        '--ipcpath', params.ipcPath,
        '--discovery.v5',
        '--verbosity', verbosity,
    ],
    member: (params) => [
        '--datadir', params.networkNodeDir,
        '--networkid', params.chainId,
        '--port', params.port,
        '--bootnodes', params.enr,
        '--networkid', params.chainId,
        '--unlock', params.address,
        '--password', `${params.networkNodeDir}/password.txt`,
        '--ipcdisable',
        '--discovery.v5',
        '--verbosity', verbosity,
        // '--mine',
        // '--miner.etherbase', params.address, In case you want to add a member as signer in the consensus
    ],
    rpc: (params) => [
        '--datadir', params.networkNodeDir,
        '--networkid', params.chainId,
        '--port', params.port,
        '--bootnodes', params.enr,
        '--ipcpath', params.ipcPath,
        '--discovery.v5',
        '--http', '--http.addr', params.httpIp, '--http.port', params.httpPort, '--http.corsdomain=*',// '"*"',
        '--verbosity', verbosity,
    ],
};

export const config: IConfig = {
    localStoragePath: path.resolve(basePath, 'local-storage'),
    ipcNodePath: 'ipc',
    accountPath: path.resolve(basePath, 'local-storage/accounts'),
    nodePath: path.resolve(basePath, 'local-storage/nodes'),
    signerPath: path.resolve(basePath, 'local-storage/nodes/signer'),
    memberPath: path.resolve(basePath, 'local-storage/nodes/member'),
    rpcPath: path.resolve(basePath, 'local-storage/nodes/rpc'),
    bootstrapPath: path.resolve(basePath, 'local-storage/nodes/bootstrap'),
    portsBasePath: path.resolve(basePath, 'local-storage/networks'),
    rpcPortsBasePath: path.resolve(basePath, 'local-storage/networks'),
    ipsBasePath: path.resolve(basePath, 'local-storage/networks'),
    networksBasePath: path.resolve(basePath, 'local-storage/networks'),
    gethCommandArgs: gethCommandArgs,
    // Add other global configuration parameters here
};