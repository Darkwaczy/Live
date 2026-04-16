export declare class SidecarManager {
    private static instance;
    private processes;
    private constructor();
    static getInstance(): SidecarManager;
    startAll(): Promise<void>;
    private startSidecar;
    stopAll(): void;
    private getModelDir;
    private getPaths;
}
