import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const childProcess = require("node:child_process");
const originalExec = childProcess.exec.bind(childProcess);

childProcess.exec = function patchedExec(command, options, callback) {
  const cmd = typeof command === "string" ? command.trim().toLowerCase() : "";
  if (cmd === "net use") {
    const cb =
      typeof options === "function"
        ? options
        : typeof callback === "function"
          ? callback
          : undefined;
    if (cb) {
      queueMicrotask(() => cb(new Error("net use disabled"), "", ""));
    }
    return {
      kill: () => false,
      pid: 0,
      stdin: null,
      stdout: null,
      stderr: null,
      on: () => {},
      once: () => {},
      removeListener: () => {},
    };
  }
  return originalExec(command, options, callback);
};

