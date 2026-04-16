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
        this.processes = new Map();
    }
    static getInstance() {
        if (!SidecarManager.instance) {
            SidecarManager.instance = new SidecarManager();
        }
        return SidecarManager.instance;
    }
    async startAll() {
        const sidecars = [
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
    startSidecar(config) {
        if (this.processes.has(config.name)) {
            console.log(`[Sidecar] ${config.name} is already running.`);
            return;
        }
        const { execPath, scriptArg } = this.getPaths(config);
        const args = scriptArg ? [scriptArg] : [];
        args.push('--port', config.port.toString());
        if (config.args)
            args.push(...config.args);
        console.log(`[Sidecar] Starting ${config.name} on port ${config.port}...`);
        // On Windows, spawn handles spaces in paths correctly IF shell: false is used.
        const proc = (0, child_process_1.spawn)(execPath, args, {
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
            }
            else {
                console.log(`[${config.name} Log] ${msg}`);
            }
        });
        proc.on('close', (code) => {
            console.log(`[Sidecar] ${config.name} process exited with code ${code}`);
            this.processes.delete(config.name);
        });
        this.processes.set(config.name, proc);
    }
    stopAll() {
        for (const [name, proc] of this.processes.entries()) {
            console.log(`[Sidecar] Stopping ${name}...`);
            proc.kill();
        }
        this.processes.clear();
    }
    getModelDir() {
        return isDev
            ? path_1.default.join(process.cwd(), 'services', 'model_cache')
            : path_1.default.join(process.resourcesPath, 'model_cache');
    }
    getPaths(config) {
        let execPath;
        let scriptArg = null;
        if (isDev) {
            execPath = path_1.default.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
            scriptArg = path_1.default.join(process.cwd(), 'services', config.script);
        }
        else {
            execPath = path_1.default.join(process.resourcesPath, 'bin', config.binary);
        }
        return { execPath, scriptArg };
    }
}
exports.SidecarManager = SidecarManager;
