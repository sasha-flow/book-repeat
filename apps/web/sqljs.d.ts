declare module "sql.js" {
  interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  interface SqlExecResult {
    columns: string[];
    values: unknown[][];
  }

  interface SqlDatabase {
    exec(sql: string): SqlExecResult[];
    close(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: Uint8Array) => SqlDatabase;
  }

  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;

  export default initSqlJs;
}

declare module "sql.js/dist/sql-asm.js" {
  interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  interface SqlExecResult {
    columns: string[];
    values: unknown[][];
  }

  interface SqlDatabase {
    exec(sql: string): SqlExecResult[];
    close(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: Uint8Array) => SqlDatabase;
  }

  function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;

  export default initSqlJs;
}
