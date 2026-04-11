export declare class SidecarManager {
    private static instance;
    private pythonProcess;
    private port;
    private constructor();
    static getInstance(): SidecarManager;
    start(): Promise<void>;
    stop(): void;
    private getPaths;
}
