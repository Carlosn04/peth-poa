import fs from 'fs-extra';
import path from 'path';
import { config } from '../../config';

export default class NetworkConfigManager {
  private networkId: string;

  constructor(networkId: string) {
    this.networkId = networkId;
  }

  private async loadConfig() {
    const networkDirectory = path.join(config.localStoragePath, `networks/${this.networkId}`);
    const configPath = path.join(networkDirectory, 'network-config.json');
    try {
      const configData = await fs.readJson(configPath);
      return configData;
    } catch (error) {
      console.error('Failed to load network config:', error);
      throw error;
    }
  }

  private async saveConfig(updatedConfig: any) {
    const networkDirectory = path.join(config.localStoragePath, `networks/${this.networkId}`);
    const configPath = path.join(networkDirectory, 'network-config.json');
    await fs.writeJson(configPath, updatedConfig, { spaces: 2 });
  }

  public async addSigners(...signerNames: string[]) {
    const configData = await this.loadConfig();
    signerNames.forEach(signerName => {
      if (!configData.nodes.signers) {
        configData.nodes.signers = [];
      }
      if (!configData.nodes.signers.includes(signerName)) {
        configData.nodes.signers.push(signerName);
      }
    });
    await this.saveConfig(configData);
    console.log(`Signers added: ${signerNames.join(', ')}`);
  }

  // Similar methods for removeSigners, addMembers, removeMembers, etc.
}