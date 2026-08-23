const { spawn } = require("node:child_process");

const expoCli = require.resolve("expo/bin/cli");
const metro = spawn(process.execPath, [expoCli, "start", ...process.argv.slice(2)], {
  env: {
    ...process.env,
    EXPO_UNSTABLE_MCP_SERVER: "1",
  },
  stdio: "inherit",
});

metro.on("error", (error) => {
  console.error("Failed to start Expo Metro with MCP enabled:", error);
  process.exitCode = 1;
});

metro.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 0;
});
