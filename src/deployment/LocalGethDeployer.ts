import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import chalk from 'chalk';

// Define the node types as a type rather than an interface to restrict the values
type NodeType = 'bootstrap' | 'signer' | 'rpc' | 'member' | 'account';

interface ColorTypes {
    bootstrap: chalk.Chalk;
    signer: chalk.Chalk;
    rpc: chalk.Chalk;
    member: chalk.Chalk;
    account: chalk.Chalk;
}

const nodeTypeColors: ColorTypes = {
    bootstrap: chalk.blue,
    signer: chalk.green,
    rpc: chalk.yellow,
    member: chalk.magenta,
    account: chalk.white
};


export class GethCommandExecutor {
    static execute(command: string[], nodeType: NodeType): Promise<{ stdout: string, stderr: string, exitCode: number | null }> {
        return new Promise((resolve, reject) => {
            const process = spawn('geth', command);
            let stdout = '';
            let stderr = '';

            const colorize = nodeTypeColors[nodeType] || chalk.white;

            const logData = (data: string) => console.log(colorize(`[${nodeType}] ${data}`));
            const logError = (data: string) => console.error(colorize(`[${nodeType}] ${data}`));

            process.stdout.on('data', (data) => {
                stdout += data.toString();
                logData(data.toString());
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
                logError(data.toString());
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr, exitCode: code });
                } else {
                    reject(new Error(`Geth command failed with code ${code}: stdout: ${stdout}, stderr: ${stderr}`));
                }
            });
        });
    }

    static startNonBlocking(command: string[], nodeType: NodeType, cleanupCallback?: () => void): ChildProcessWithoutNullStreams {
        const process = spawn('geth', command);

        const colorize = nodeTypeColors[nodeType] || chalk.white;

        const logData = (data: string) => console.log(colorize(`[${nodeType}] ${data}`));
        const logError = (data: string) => console.error(colorize(`[${nodeType}] ${data}`));

        process.stdout.on('data', data => logData(data.toString()));
        process.stderr.on('data', data => logError(data.toString()));

        process.on('close', (code) => {
            logData(`Geth process exited with code ${code}`);
            cleanupCallback?.();
        });

        process.on('SIGINT', () => {
            logData('Geth process interrupted with SIGINT');
            cleanupCallback?.();
        });

        return process;
    }
}