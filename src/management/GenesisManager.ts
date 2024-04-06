import fs from 'fs-extra';
import path from 'path';
import { config } from '../config';

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
    this.validateConfig(genesisConfig);
    this.genesisConfig = {
      period: 3, // Default period
      epoch: 30000, // Default epoch
      ...genesisConfig,
    };  
  }

  private validateConfig(config: GenesisConfig): void {
    if (!config.chainId || !config.signers || !config.alloc) {
      throw new Error("Invalid Genesis Config: Missing required properties.");
    }
    // Additional validation logic here, e.g., check for valid addresses
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

  private ethToGwei(ethAmount: string): string {
    const ethInWei = BigInt(Math.floor(parseFloat(ethAmount) * 1e9)).toString();
    return ethInWei;
  }

  private composeGenesisData(): object {
    const allocInGwei = Object.entries(this.genesisConfig.alloc).reduce((acc, [address, { balance }]) => {
      acc[address] = { balance: this.ethToGwei(balance) };
      return acc;
    }, {} as Record<string, { balance: string }>);

    return {
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
      alloc: allocInGwei,
    };
  }

  private getNetworkDirectory(): string {
    return path.join(config.localStoragePath, `networks/${this.genesisConfig.chainId}`);
  }

  private async ensureDirectoryExists(directoryPath: string): Promise<void> {
    await fs.ensureDir(directoryPath);
  }

  private async writeGenesisFile(filePath: string, data: object): Promise<void> {
    await fs.writeJson(filePath, data, { spaces: 2 });
    console.log(`Genesis file created!`);
  }

  public async generateGenesisFile(): Promise<void> {
    const genesisData = this.composeGenesisData();
    const networkDirectory = this.getNetworkDirectory();
    const genesisFilePath = path.join(networkDirectory, 'genesis.json');

    await this.ensureDirectoryExists(networkDirectory);
    await this.writeGenesisFile(genesisFilePath, genesisData);
  }
}

class GenesisFactory {
  static async createGenesis(chainId: number, signers: string[], alloc: Record<string, { balance: string }>, period: number = 3, epoch: number = 30000) {
      const genesisCreator = new GenesisCreator({
        chainId,
        period,
        epoch,
        signers,
        alloc,
      });
      await genesisCreator.generateGenesisFile(); 
  }
}

export default GenesisFactory;
