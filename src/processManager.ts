import { spawn, ChildProcess } from 'child_process';
import path from 'path';

class ProcessManager {
    private childProcess: ChildProcess | null = null;
    private isShuttingDown: boolean = false;

    start() {
        if (this.childProcess) {
            console.log('Process is already running');
            return;
        }

        const scriptPath = path.join(__dirname, 'index.js');
        this.childProcess = spawn('node', [scriptPath], {
            stdio: ['inherit', 'pipe', 'pipe']
        });

        if (this.childProcess.stdout) {
            this.childProcess.stdout.on('data', (data) => {
                console.log(data.toString());
            });
        }

        if (this.childProcess.stderr) {
            this.childProcess.stderr.on('data', (data) => {
                const errorMessage = data.toString();
                console.error(errorMessage);

                if (errorMessage.includes('WebSocket error: Error: Unexpected server response: 403')) {
                    console.log('403 error detected, restarting process...');
                    this.restart();
                }
            });
        }

        this.childProcess.on('close', (code) => {
            console.log(`Child process exited with code ${code}`);
            this.childProcess = null;

            if (!this.isShuttingDown) {
                console.log('Restarting process...');
                setTimeout(() => this.start(), 5000);
            }
        });

        console.log('Started whale tracking process');
    }

    restart() {
        if (this.childProcess) {
            this.childProcess.kill();
            // The close event handler will trigger a restart
        } else {
            this.start();
        }
    }

    shutdown() {
        this.isShuttingDown = true;
        if (this.childProcess) {
            this.childProcess.kill();
        }
    }
}

// Handle process termination
process.on('SIGTERM', () => {
    console.log('Received SIGTERM signal');
    processManager.shutdown();
});

process.on('SIGINT', () => {
    console.log('Received SIGINT signal');
    processManager.shutdown();
});

const processManager = new ProcessManager();
processManager.start(); 