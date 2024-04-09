#!/usr/bin/env node

import * as path from 'path';
import { execSync } from 'child_process';
import { pethPoa } from './main'

type CommandParams = {
    command: string;
    options?: string[];
};

// Utility function to check for command presence
function hasCommand(params: CommandParams): boolean {
    const { command, options } = params;
    const commandIndex = args.indexOf(`--${command}`);
    if (commandIndex === -1) return false;

    if (!options) return true; // If no options are required, just the presence of the command is enough

    // Check each option; if options are provided, they don't need `--` prefix
    return options.every(option => args.includes(option, commandIndex + 1));
}

function getOptionValue(optionName: string): string | null {
    const index = args.indexOf(optionName);
    if (index !== -1 && index + 1 < args.length) {
        return args[index + 1];
    }
    return null;
}

// Manual argument parsing
const args = process.argv.slice(2); // Skip the first two elements (node path and script path)

if (hasCommand({ command: 'docker', options: ['run'] })) {
    // Check for --chainId following the 'run' operation
    const chainIdIndex = args.indexOf('--chain');
    const addressIndex = args.indexOf('')
    if (chainIdIndex !== -1 && args.length > chainIdIndex + 1) {
      const chainId = parseInt(args[chainIdIndex + 1], 10);
      if (!isNaN(chainId)) {
        // pethPoa.docker.initAndDeployNetwork(chainId)
        console.log('network', chainId)
      } else {
        console.error('Error: Invalid chainId provided.');
      }
    } else {
      console.error('Error: --chain option and value required for the --docker run command.');
    }
}

else if (hasCommand({ command: 'docker', options: ['rm'] })) {
    const chainId = getOptionValue('--chain');
    if (chainId) {
      console.log(`Removing Docker network for chain ID: ${chainId}`);
      // Implement the removal logic here
    } else {
      console.error('Error: --chain option and value required for the --docker rm command.');
    }
}

else if (hasCommand({ command: 'docker-node', options: ['run'] })) {
    const chainId = getOptionValue('--chain');
    const nodeType = getOptionValue('--type');
    const address = getOptionValue('--address');

    if (chainId && nodeType && address) {
        // Example: Add a Docker node
        console.log(`Adding a Docker node: Type: ${nodeType}, Chain ID: ${chainId}, Address: ${address}`);
    } else {
        console.error('Error: Missing required options for --docker --node command.');
    }
}

else if (hasCommand({ command: 'docker-node', options: ['rm'] })) {
    const chainId = getOptionValue('--chain');
    const nodeType = getOptionValue('--type');
    const address = getOptionValue('--address');

    if (chainId && nodeType && address) {
        // Example: Add a Docker node
        console.log(`Removing Docker node: Type: ${nodeType}, Chain ID: ${chainId}, Address: ${address}`);
    } else {
        console.error('Error: Missing required options for --docker --node command.');
    }
}

// else if (hasCommand({ command: 'nodes', options: ['get'] })) {
//     '- **Bootstrap**:
//     - **`"0xCeB5ca48b5DE1839379FAEDD0572F7D59B279749"`**
//     - **`"0x3DACb6190a02bB8762b769fA3805A53ced2daecD"`**
//     - **`"0xeA9c0401958De72D6ccED22dA3134e296282fc1b"`**
// - **Signer**:
//     - **`"0x64fB496Bbfd447Dba254aFe4E28a325cb19ec25f"`**
//     - **`"0x6D327167519f708706CaA82c22A51f9170E3dE0F"`**
//     - **`"0x593137Db85160Ae8E9047f539141DD04d5251381"`**
// - **RPC**:
//     - **`"0x46198b00f237407133da9CcFb2D567dF159284D4"`**
//     - **`"0xec326126b342dbEa16FFe17c401bE6560B524d69"`**
//     - **`"0xEEA50912a99B1F8D4E94565f9e44c30A1a961caa"`**
// - **Member**:
//     - **`"0xBa551f402cfC912482cB15466641E6FC3B2D63f2"`**
//     - **`"0x8D9711f5793A1122dB151568FA67DacCC16B2326"`**
//     - **`"0x46B7954f9FA8992bE5B27c3de46A87F83314Bb25"`**'

//     if (chainId && nodeType && address) {
//         // Example: Add a Docker node
//         console.log(`Removing Docker node: Type: ${nodeType}, Chain ID: ${chainId}, Address: ${address}`);
//     } else {
//         console.error('Error: Missing required options for --docker --node command.');
//     }
// }

else if (hasCommand({ command: 'network', options: ['reset'] })) {
    // Assuming a command to reset network
    const resetScriptPath = path.join(__dirname, 'storage', 'ResetNetworks.js');
    execSync(`node ${resetScriptPath}`, { stdio: 'inherit' });
    console.log('Networks have been reset.');
  } else {
    console.log('Error: Invalid command or options.');
    // Ideally, display help or usage information here
  }