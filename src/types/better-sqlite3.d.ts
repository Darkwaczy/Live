declare module 'better-sqlite3' {
  interface DatabaseOptions {
    readonly: boolean;
    fileMustExist: boolean;
    memory: boolean;
    timeout: number;
    verbose: (message: string) => void;
  }
  interface Statement {
    run(...params: any[]): any;
    get(...params: any[]): any;
    all(...params: any[]): any[];
  }
  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): void;
    close(): void;
  }
  function Database(filename: string, options?: Partial<DatabaseOptions>): Database;
  export = Database;
}
