interface Config {
    [key: string]: string;
    localStoragePath: string;
    accountPath: string;
    nodePath: string;
    signerPath: string;
    memberPath: string;
    rpcPath: string;
    // bootnodePath: string;
    bootstrapPath: string;
    genesisBasePath: string;
    portsBasePath: string;
}

export const config: Config = {
    localStoragePath: '../local-storage',
    accountPath: '../local-storage/accounts',
    nodePath: '../local-storage/nodes',
    signerPath: '../local-storage/nodes/signer',
    memberPath: '../local-storage/nodes/member',
    rpcPath: '../local-storage/nodes/rpc',
    // bootnodePath: '../local-storage/nodes/bootnode',
    bootstrapPath: '../local-storage/nodes/bootstrap',
    genesisBasePath: '../local-storage/genesis',
    portsBasePath: '../local-storage/networks'
    // Add other global configuration parameters here
};