import * as dotenv from "dotenv";

dotenv.config();

// 日志级别
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// 配置的日志级别
const configuredLevel = process.env.LOG_LEVEL
  ? (process.env.LOG_LEVEL.toLowerCase() as keyof typeof LogLevel)
  : "info";

// 当前运行的日志级别
const currentLevel =
  LogLevel[configuredLevel.toUpperCase() as keyof typeof LogLevel] !== undefined
    ? LogLevel[configuredLevel.toUpperCase() as keyof typeof LogLevel]
    : LogLevel.INFO;

class Logger {
  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (data) {
      const dataString =
        typeof data === "object"
          ? JSON.stringify(data, null, 2)
          : data.toString();

      formattedMessage += `\n${dataString}`;
    }

    return formattedMessage;
  }

  public debug(message: string, data?: any): void {
    if (currentLevel >= LogLevel.DEBUG) {
      console.debug(this.formatMessage("debug", message, data));
    }
  }

  public info(message: string, data?: any): void {
    if (currentLevel >= LogLevel.INFO) {
      console.info(this.formatMessage("info", message, data));
    }
  }

  public warn(message: string, data?: any): void {
    if (currentLevel >= LogLevel.WARN) {
      console.warn(this.formatMessage("warn", message, data));
    }
  }

  public error(message: string, error?: any): void {
    if (currentLevel >= LogLevel.ERROR) {
      console.error(this.formatMessage("error", message, error));
    }
  }
}

// 导出单例
export const logger = new Logger();
