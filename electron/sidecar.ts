import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

const isDev = process.env.NODE_ENV !== 'production';

export class SidecarManager {
  private static instance: SidecarManager;
  private pythonProcess: ChildProcess | null = null;
  private port: number = 5003;

  private constructor() {}

  public static getInstance(): SidecarManager {
    if (!SidecarManager.instance) {
      SidecarManager.instance = new SidecarManager();
    }
    return SidecarManager.instance;
  }

  public async start(): Promise<void> {
    if (this.pythonProcess) {
      console.log('[Sidecar] N-ATLAS is already running.');
      return;
    }

    const { pythonPath, scriptPath, modelDir } = this.getPaths();

    console.log(`[Sidecar] Starting N-ATLAS on port ${this.port}...`);
    console.log(`[Sidecar] Execution Path: ${pythonPath}`);
    console.log(`[Sidecar] Model Directory: ${modelDir}`);

    this.pythonProcess = spawn(pythonPath, [
      scriptPath,
      '--port', this.port.toString(),
      '--model-dir', modelDir
    ], {
      env: { ...process.env }
    });

    this.pythonProcess.stdout?.on('data', (data) => {
      console.log(`[N-ATLAS Service] ${data.toString().trim()}`);
    });

    this.pythonProcess.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg.toLowerCase().includes('error')) {
        console.error(`[N-ATLAS Error] ${msg}`);
      } else {
        console.log(`[N-ATLAS Log] ${msg}`);
      }
    });

    this.pythonProcess.on('close', (code) => {
      console.log(`[Sidecar] N-ATLAS process exited with code ${code}`);
      this.pythonProcess = null;
    });

    // We don't wait for loading here as it takes ~20s. 
    // The frontend handles health checks.
  }

  public stop(): void {
    if (this.pythonProcess) {
      console.log('[Sidecar] Stopping N-ATLAS...');
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }

  private getPaths() {
    let pythonPath: string;
    let scriptPath: string;
    let modelDir: string;

    if (isDev) {
      // In development, use the local .venv and script
      pythonPath = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
      scriptPath = path.join(process.cwd(), 'services', 'n_atlas_service.py');
      modelDir = path.join(process.cwd(), 'services', 'model_cache');
    } else {
      // In production, everything is in the resources folder
      const resourcesPath = process.resourcesPath;
      pythonPath = path.join(resourcesPath, 'bin', 'n-atlas-service.exe');
      scriptPath = ''; 
      // In production, the model_cache is an extraResource
      modelDir = path.join(resourcesPath, 'model_cache');
    }

    return { pythonPath, scriptPath, modelDir };
  }
}
