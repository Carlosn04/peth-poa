import { exec, spawn, ChildProcessWithoutNullStreams } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export class GethCommandExecutor {
    static execute(command: string[]): Promise<{ stdout: string, stderr: string, exitCode: number | null }> {
        return new Promise((resolve, reject) => {
            const process = spawn('geth', command);

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(data.toString())
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(data.toString())
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr, exitCode: code });
                } else {
                    reject(new Error(`Geth command failed with code ${code}: stdout: ${stdout}, stderr: ${stderr}`));
                }
            });

            process.on('exit', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr, exitCode: code });
                } else {
                    reject(new Error(`Geth command failed with code ${code}: stdout: ${stdout}, stderr: ${stderr}`));
                }
            });
        });
    }

    static startNonBlocking(command: string[], cleanupCallback?: () => void): ChildProcessWithoutNullStreams {
        const process = spawn('geth', command);

        process.stdout.on('data', (data) => console.log(data.toString()));
        process.stderr.on('data', (data) => console.error(data.toString()));

         // Listen for process termination signals to perform cleanup
         process.on('close', (code) => {
            console.log(`Geth process exited with code ${code}`);
            if (cleanupCallback) cleanupCallback?.(); // Perform cleanup if callback is provided
        });

        // Optionally, listen for other termination signals for additional cleanup
        process.on('SIGINT', () => {
            console.log('Geth process interrupted with SIGINT');
            if (cleanupCallback) cleanupCallback?.();
        });


        return process;
    }
}