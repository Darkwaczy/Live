import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';

const isDev = process.env.NODE_ENV !== 'production';

interface SidecarConfig {
  name: string;
  port: number;
  script: string;
  binary: string;
  args?: string[];
}

export class SidecarManager {
  private static instance: SidecarManager;
  private processes: Map<string, ChildProcess> = new Map();

  private constructor() {}

  public static getInstance(): SidecarManager {
    if (!SidecarManager.instance) {
      SidecarManager.instance = new SidecarManager();
    }
    return SidecarManager.instance;
  }

  public async startAll(): Promise<void> {
    const sidecars: SidecarConfig[] = [
      {
        name: 'N-ATLAS',
        port: 5003,
        script: 'n_atlas_service.py',
        binary: 'n-atlas-service.exe',
        args: ['--model-dir', this.getModelDir()]
      },
      {
        name: 'NDI-Broadcast',
        port: 5004,
        script: 'ndi_broadcast_service.py',
        binary: 'ndi-broadcast-service.exe'
      }
    ];

    for (const config of sidecars) {
      this.startSidecar(config);
    }
  }

  private startSidecar(config: SidecarConfig) {
    if (this.processes.has(config.name)) {
      console.log(`[Sidecar] ${config.name} is already running.`);
      return;
    }

    const { execPath, scriptArg } = this.getPaths(config);

    const args = scriptArg ? [scriptArg] : [];
    args.push('--port', config.port.toString());
    if (config.args) args.push(...config.args);

    console.log(`[Sidecar] Starting ${config.name} on port ${config.port}...`);
    
    // On Windows, spawn handles spaces in paths correctly IF shell: false is used.
    const proc = spawn(execPath, args, {
      env: { ...process.env },
      shell: false
    });

    proc.stdout?.on('data', (data) => {
      console.log(`[${config.name}] ${data.toString().trim()}`);
    });

    proc.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg.toLowerCase().includes('error')) {
        console.error(`[${config.name} Error] ${msg}`);
      } else {
        console.log(`[${config.name} Log] ${msg}`);
      }
    });

    proc.on('close', (code) => {
      console.log(`[Sidecar] ${config.name} process exited with code ${code}`);
      this.processes.delete(config.name);
    });

    this.processes.set(config.name, proc);
  }

  public stopAll(): void {
    for (const [name, proc] of this.processes.entries()) {
      console.log(`[Sidecar] Stopping ${name}...`);
      proc.kill();
    }
    this.processes.clear();
  }

  private getModelDir(): string {
    return isDev 
      ? path.join(process.cwd(), 'services', 'model_cache')
      : path.join(process.resourcesPath, 'model_cache');
  }

  private getPaths(config: SidecarConfig) {
    let execPath: string;
    let scriptArg: string | null = null;

    if (isDev) {
      execPath = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
      scriptArg = path.join(process.cwd(), 'services', config.script);
    } else {
      execPath = path.join(process.resourcesPath, 'bin', config.binary);
    }

    return { execPath, scriptArg };
  }
}
