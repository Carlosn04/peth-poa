interface IGethCommandArgs {
    [nodeType: string]: (params: any) => string[];
}

interface IConfig {
    localStoragePath: string;
    accountPath: string;
    nodePath: string;
    signerPath: string;
    memberPath: string;
    rpcPath: string;
    bootstrapPath: string;
    genesisBasePath: string;
    portsBasePath: string;
    networksBasePath: string;
    gethCommandArgs: IGethCommandArgs;
}

const verbosity = '3'

const gethCommandArgs: IGethCommandArgs = {
    bootstrap: (params) => [
        '--datadir', params.networkNodeDir,
        '--networkid', params.chainId,
        '--ipcpath', params.ipcPath,
        // '--ipcdisable',
        '--port', params.port,
        '--authrpc.port', params.port,
        // '--discovery.v4',
        '--discovery.v5', // needed for enr in localhost
        // '--nat', `extip:${externalIp}`,
        // '--netrestrict', subnet,
        '--verbosity', verbosity,
    ],
    signer: (params) => [
        '--datadir', params.networkNodeDir,
        '--port', params.port,
        '--authrpc.port', params.authRpcPort,
        '--bootnodes', params.enr,
        '--networkid', params.chainId,
        '--unlock', params.address,
        '--password', `${params.networkNodeDir}/password.txt`,
        '--mine',
        '--miner.etherbase', params.address,
        '--ipcpath', params.ipcPath,
        '--discovery.v5',
        '--verbosity', verbosity,
        // Additional custom params as needed
    ],
    member: (params) => [
        '--datadir', params.networkNodeDir,
        '--networkid', params.chainId,
        '--port', params.port,
        '--authrpc.port', params.port,
        '--bootnodes', params.enr,
        '--networkid', params.chainId,
        '--unlock', params.address,
        '--password', `${params.networkNodeDir}/password.txt`,
        '--ipcdisable',
        '--discovery.v5',
        '--verbosity', verbosity,
        // '--mine',
        // '--miner.etherbase', params.address,
    ],
    rpc: (params) => [
        '--datadir', params.networkNodeDir,
        '--networkid', params.chainId,
        '--port', params.port,
        '--authrpc.port', params.port,
        '--bootnodes', params.enr,
        '--networkid', params.chainId,
        '--ipcdisable',
        '--discovery.v5',
        '--http', '--http.addr', '0.0.0.0', '--http.port', '8549', '--http.corsdomain', '"*"',
        '--verbosity', verbosity,
        // Additional args for RPC nodes
    ],
};

export const config: IConfig = {
    localStoragePath: '../local-storage',
    accountPath: '../local-storage/accounts',
    nodePath: '../local-storage/nodes',
    signerPath: '../local-storage/nodes/signer',
    memberPath: '../local-storage/nodes/member',
    rpcPath: '../local-storage/nodes/rpc',
    // bootnodePath: '../local-storage/nodes/bootnode',
    bootstrapPath: '../local-storage/nodes/bootstrap',
    genesisBasePath: '../local-storage/genesis',
    portsBasePath: '../local-storage/networks',
    networksBasePath: '../local-storage/networks',
    gethCommandArgs: gethCommandArgs,
    // Add other global configuration parameters here
};