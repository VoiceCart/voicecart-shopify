import winston, {createLogger, format, transports} from "winston";
import util from 'util';

const { combine, timestamp, label, splat, colorize, printf, align, simple } = format;

const myFormat = printf(({ level, message, label, timestamp, ...metadata }) => {
  let log = `${timestamp} [${label}]-[${level}]: ${message}`;
  if (metadata) {
    // Pretty-print metadata
    log += `\n${util.inspect(metadata, { depth: null, colors: true })}`;
  }
  return log;

});

export const infoLog= createLogger({
  level: "info",
  format : combine(
    colorize(),
    // timestamp(),
    align(),
    // label({label: "eva-chat-log"}),
    splat(),
    simple()
  ),
  transports: [
    new transports.Console({forceConsole: true}),
    new winston.transports.File({
      filename: "combined.log",
      level: "info"
    })
  ]
});

export const errorLog = createLogger({
  level: "error",
  format : combine(
    colorize(),
    // timestamp(),
    align(),
    // label({label: "eva-chat-log"}),
    splat(),
    simple()
  ),
  transports: [
    new transports.Console({forceConsole: true}),
    new winston.transports.File({
      filename: "combined.log",
      level: "error"
    })
  ]
});
