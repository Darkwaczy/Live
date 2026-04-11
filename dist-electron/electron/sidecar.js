"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidecarManager = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const isDev = process.env.NODE_ENV !== 'production';
class SidecarManager {
    constructor() {
        this.pythonProcess = null;
        this.port = 5003;
    }
    static getInstance() {
        if (!SidecarManager.instance) {
            SidecarManager.instance = new SidecarManager();
        }
        return SidecarManager.instance;
    }
    async start() {
        if (this.pythonProcess) {
            console.log('[Sidecar] N-ATLAS is already running.');
            return;
        }
        const { pythonPath, scriptPath, modelDir } = this.getPaths();
        console.log(`[Sidecar] Starting N-ATLAS on port ${this.port}...`);
        console.log(`[Sidecar] Execution Path: ${pythonPath}`);
        console.log(`[Sidecar] Model Directory: ${modelDir}`);
        this.pythonProcess = (0, child_process_1.spawn)(pythonPath, [
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
            }
            else {
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
    stop() {
        if (this.pythonProcess) {
            console.log('[Sidecar] Stopping N-ATLAS...');
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
    }
    getPaths() {
        let pythonPath;
        let scriptPath;
        let modelDir;
        if (isDev) {
            // In development, use the local .venv and script
            pythonPath = path_1.default.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
            scriptPath = path_1.default.join(process.cwd(), 'services', 'n_atlas_service.py');
            modelDir = path_1.default.join(process.cwd(), 'services', 'model_cache');
        }
        else {
            // In production, everything is in the resources folder
            const resourcesPath = process.resourcesPath;
            pythonPath = path_1.default.join(resourcesPath, 'bin', 'n-atlas-service.exe');
            scriptPath = '';
            // In production, the model_cache is an extraResource
            modelDir = path_1.default.join(resourcesPath, 'model_cache');
        }
        return { pythonPath, scriptPath, modelDir };
    }
}
exports.SidecarManager = SidecarManager;
