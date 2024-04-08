#!/usr/bin/env node

import { pethPoa } from './main';
import yargs, { Arguments, Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { execSync } from 'child_process';
import path from 'path';

interface CommandLineArgs {
    docker?: string;
    chainId?: number;
    network?: string;
}

yargs(hideBin(process.argv))
  .scriptName("peth-poa")
  .usage('$0 <cmd> [args]')
  .option('docker', {
    describe: 'Docker-related commands',
    type: 'string'
  })
  .option('chainId', {
    describe: 'Chain ID for the network',
    type: 'number'
  })
  .option('network', {
    describe: 'Network-related commands',
    type: 'string'
  })
  .check((argv: Arguments<CommandLineArgs>) =>{
    // Ensuring that either docker or network options are used but not both
    if ('docker' in argv && 'network' in argv) {
      throw new Error('Use either --docker or --network options, not both.');
    }
    // Ensuring chainId is provided for docker run command
    if ('docker' in argv && argv.docker === 'run' && !argv.chainId) {
      throw new Error('--chainId is required for --docker run command.');
    }
    return true;
  })
  .middleware(async (argv: Arguments<CommandLineArgs>) => {
    if (argv.docker && argv.docker === 'run' && argv.chainId) {
      await pethPoa.docker.initAndDeployNetwork(argv.chainId);
      console.log(`Docker network for chain ID ${argv.chainId} initialized and deployed successfully.`);
    }
    if (argv.network && argv.network === 'reset') {
      // Assuming ResetNetworks.js is compiled and available in the dist/storage directory
      const resetScriptPath = path.join(__dirname, '..', 'storage', 'ResetNetworks.js');
      execSync(`node ${resetScriptPath}`, { stdio: 'inherit' });
      console.log(`Networks have been reset.`);
    }
  })
  .help()
  .demandCommand(1, 'You need at least one command before moving on')
  .argv;
