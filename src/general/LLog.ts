/**
 * A simple, general, log tool
 * 
 * feat:
 * - level
 * - log & notice & file
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "none";
export type LogLevel2 = "debug" | "info" | "warn" | "error";

interface LLog_Config {
  level?: LogLevel;              // min output level
  enableTimestamp?: boolean;     // is output timestamp
  tag?: string;                  // tag prefix
}

const levelOrder: LogLevel[] = ["debug", "info", "warn", "error", "none"];

export class LLog {
  config: Required<LLog_Config> = {
    level: "debug",
    enableTimestamp: true,
    tag: "",
  }

  set_config(cfg: LLog_Config): void {
    this.config = { ...this.config, ...cfg }
  }

  debug(...args: unknown[]): void {
    this.logCore("debug", ...args)
  }

  info(...args: unknown[]): void {
    this.logCore("info", ...args)
  }

  warn(...args: unknown[]): void {
    this.logCore("warn", ...args)
  }

  error(...args: unknown[]): void {
    this.logCore("error", ...args)
  }

  static consoleMap = {
    debug: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  } as const;

  // can override
  /// // @return 返回打印内容。可以通过这种方式链式调用添加Notice等操作，进行多重输出
  logCore(level: LogLevel2, ...args: unknown[]): void {
    if (levelOrder.indexOf(level) < levelOrder.indexOf(this.config.level)) return

    const now = this.config.enableTimestamp ? `[${new Date().toISOString()}]` : ""
    const tag = this.config.tag ? `[${this.config.tag}]` : ""
    const prefix = [now, tag, `[${level.toUpperCase()}]`].filter(Boolean).join(" ")

    LLog.consoleMap[level]?.(prefix, ...args)
  }
}
// Provide an object that is ready to use out of the box.
export const LLOG = new LLog()
