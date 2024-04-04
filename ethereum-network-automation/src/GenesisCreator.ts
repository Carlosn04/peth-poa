import fs from 'fs-extra';
import path from 'path';
import { config } from './config';

interface GenesisConfig {
  chainId: number;
  period?: number;
  epoch?: number;
  signers: string[];
  alloc: Record<string, { balance: string }>;
}

class GenesisCreator {
  private genesisConfig: GenesisConfig;

  constructor(genesisConfig: GenesisConfig) {
    this.genesisConfig = {
      ...genesisConfig,
      period: genesisConfig.period || 5, // Default to 5 if not provided
      epoch: genesisConfig.epoch || 30000, // Default to 30000 if not provided
    };
  }

  private generateExtradata(): string {
    const prefix = '0x' + '0'.repeat(64);
    const suffix = '0'.repeat(130);
    const middle = this.genesisConfig.signers.map(address => {
      if (typeof address !== 'string') {
        throw new Error(`Invalid signer address type: ${typeof address}`);
      }
      return address.slice(2);
    }).join('');

    return prefix + middle + suffix;
  }

  public async generateGenesisFile(): Promise<boolean> {
    // Generate genesis data
    const genesisData = {
      config: {
        chainId: this.genesisConfig.chainId,
        homesteadBlock: 0,
        eip150Block: 0,
        eip155Block: 0,
        eip158Block: 0,
        byzantiumBlock: 0,
        constantinopleBlock: 0,
        petersburgBlock: 0,
        istanbulBlock: 0,
        berlinBlock: 0,
        clique: {
          period: this.genesisConfig.period,
          epoch: this.genesisConfig.epoch,
        },
      },
      difficulty: "1",
      gasLimit: "8000000",
      extradata: this.generateExtradata(),
      alloc: this.genesisConfig.alloc,
    };

    // Define network directory
    const networkDirectory = path.join(config.localStoragePath, `networks/${this.genesisConfig.chainId}`);
    const genesisFilePath = path.join(networkDirectory, 'genesis.json');

    // Ensure the directory exists
    await fs.ensureDir(networkDirectory);

    // Write genesis.json
    await fs.writeJson(genesisFilePath, genesisData, { spaces: 2 });
    console.log(`Genesis file created at ${genesisFilePath}`);

    return true

    // Update network-config.json
    // const networkConfigPath = path.join(networkDirectory, 'network-config.json');
    // const networkConfig = {
    //   genesisPath: 'genesis.json', // Relative path within the network directory
    //   nodes: {}, // Placeholder for node paths
    //   deployed: false,
    //   running: false,
    // };

    // // Write or update network-config.json
    // await fs.writeJson(networkConfigPath, networkConfig, { spaces: 2 });
    // console.log(`Network configuration updated: ${networkConfigPath}`);
  }
}

export default GenesisCreator;
