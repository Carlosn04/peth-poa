#!/usr/bin/env node

import * as path from 'path';
import { execSync } from 'child_process';
import { pethPoa } from './main'
import chalk from 'chalk';
type NodeType = "bootstrap" | "signer" | "rpc" | "member";

function printNodeAddresses() {
    // console.log(chalk.blue('Nodes Information:\n'));
    console.log(chalk.cyan('Bootstrap |═══════════════════════════════════╗'));
    console.log('')
    console.log(chalk.whiteBright('- "0xCeB5ca48b5DE1839379FAEDD0572F7D59B279749"'));
    console.log(chalk.whiteBright('- "0x3DACb6190a02bB8762b769fA3805A53ced2daecD"'));
    console.log(chalk.whiteBright('- "0xeA9c0401958De72D6ccED22dA3134e296282fc1b"\n'));

    console.log(chalk.green('Signer |══════════════════════════════════════╗'));
    console.log('')
    console.log(chalk.whiteBright('- "0x64fB496Bbfd447Dba254aFe4E28a325cb19ec25f"'));
    console.log(chalk.whiteBright('- "0x6D327167519f708706CaA82c22A51f9170E3dE0F"'));
    console.log(chalk.whiteBright('- "0x593137Db85160Ae8E9047f539141DD04d5251381"\n'));

    console.log(chalk.magenta('RPC |═════════════════════════════════════════╗'));
    console.log('')
    console.log(chalk.whiteBright('- "0x46198b00f237407133da9CcFb2D567dF159284D4"'));
    console.log(chalk.whiteBright('- "0xec326126b342dbEa16FFe17c401bE6560B524d69"'));
    console.log(chalk.whiteBright('- "0xEEA50912a99B1F8D4E94565f9e44c30A1a961caa"\n'));

    console.log(chalk.yellow('Member |══════════════════════════════════════╗'));
    console.log('')
    console.log(chalk.whiteBright('- "0xBa551f402cfC912482cB15466641E6FC3B2D63f2"'));
    console.log(chalk.whiteBright('- "0x8D9711f5793A1122dB151568FA67DacCC16B2326"'));
    console.log(chalk.whiteBright('- "0x46B7954f9FA8992bE5B27c3de46A87F83314Bb25"\n'));
}

function printNodeAction(nodeType: NodeType, action: 'Deployed' | 'Removed', chainId: number, address: string) {
    const nodeTypesConfig = {
        bootstrap: chalk.cyan,
        signer: chalk.green,
        rpc: chalk.magenta,
        member: chalk.yellow
    };

    const color = nodeTypesConfig[nodeType];
    if (!color) {
        console.log(chalk.red('Unknown node type.'));
        return;
    }

    // Construct the message
    const statusMsg = `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node ${action}`;
    const chainMsg = `Chain ID: ${chainId}`;
    const addressMsg = `Address: ${address}`;
    const padding = 50 - (statusMsg.length + chainMsg.length + addressMsg.length);
    const paddingStr = padding > 0 ? ' '.repeat(padding) : '';

    // Print with ASCII art and color
    console.log('')
    console.log(color(` ${statusMsg} | ${chainMsg} | ${addressMsg}${paddingStr} `));
    console.log('');
}

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
    const chainId = getOptionValue('--chain');
    if (chainId && Number(chainId)) {
        pethPoa.docker.initAndDeployNetwork(Number(chainId))
    } else {
        console.error('Error: --chain option and value required for the --docker run command.');
    }
}

else if (hasCommand({ command: 'docker', options: ['rm'] })) {
    const chainId = getOptionValue('--chain');
    if (chainId && Number(chainId)) {
        pethPoa.docker.removeNetwork(Number(chainId))
            .then(() => {
                console.log('')
                console.log(chalk.cyan('╔══════════════════════════════════════════════════╗'));
                console.log(chalk.cyan('║       Docker Network Successfully Removed!       ║'));
                console.log(chalk.cyan('╚══════════════════════════════════════════════════╝'));
                console.log('')

            })
            .catch((error) => {
                console.error(chalk.red(`Error: ${error.message}`));
            });

    } else {
        console.error('Error: --chain option and value required for the --docker rm command.');
    }
}

else if (hasCommand({ command: 'docker-node', options: ['run'] })) {
    const chainId = getOptionValue('--chain');
    const nodeType = getOptionValue('--type');
    const address = getOptionValue('--address');

    const validNodeTypes: NodeType[] = ["bootstrap", "signer", "rpc", "member"];

    // Check if nodeType is valid
    if (!nodeType || !validNodeTypes.includes(nodeType as NodeType)) {
        console.error(`Error: Invalid nodeType "${nodeType}", only: ${validNodeTypes.join(', ')} are allowed.`);
        // Stop execution if nodeType is invalid
    } else if (Number(chainId) && nodeType && address) {
        pethPoa.docker.initAndDeployNode(Number(chainId), nodeType as NodeType, address)
            .then(() => {
                printNodeAction(nodeType as NodeType, 'Deployed', Number(chainId), address);
            })
            .catch((error) => {
                console.error(chalk.red(`Error: ${error.message}`));
            });
    } else {
        console.error('Error: Missing required options for --docker --node command.');
    }
}

else if (hasCommand({ command: 'docker-node', options: ['rm'] })) {
    const chainId = getOptionValue('--chain');
    const nodeType = getOptionValue('--type');
    const address = getOptionValue('--address');

    const validNodeTypes: NodeType[] = ["bootstrap", "signer", "rpc", "member"];

    // Check if nodeType is valid
    if (!nodeType || !validNodeTypes.includes(nodeType as NodeType)) {
        console.error(`Error: Invalid nodeType "${nodeType}", only: ${validNodeTypes.join(', ')} are allowed.`);
        // Stop execution if nodeType is invalid
    } else if (Number(chainId) && nodeType && address) {
        pethPoa.docker.removeNodeContainer(Number(chainId), address)
            .then(() => {
                printNodeAction(nodeType as NodeType, 'Removed', Number(chainId), address);
            })
            .catch((error) => {
                console.error(chalk.red(`Error: ${error.message}`));
            });
    } else {
        console.error('Error: Missing required options for --docker --node command.');
    }
}

else if (hasCommand({ command: 'nodes', options: ['get'] })) {
    printNodeAddresses();
    // const chainId = getOptionValue('--bootstrap');
    // const nodeType = getOptionValue('--signer');
    // const address = getOptionValue('--address');

    // if (chainId && nodeType && address) {
    //     // Example: Add a Docker node
    //     console.log(`Removing Docker node: Type: ${nodeType}, Chain ID: ${chainId}, Address: ${address}`);
    // } else {
    //     console.error('Error: Missing required options for --docker --node command.');
    // }
}

else if (hasCommand({ command: 'network', options: ['reset'] })) {
    // Assuming a command to reset network
    const resetScriptPath = path.join(__dirname, 'storage', 'ResetNetworks.js');
    execSync(`node ${resetScriptPath}`, { stdio: 'inherit' });
    console.log('Networks have been reset.');
} else {
    console.log('Error: Invalid command or options.');
    // Ideally, display help or usage information here
}