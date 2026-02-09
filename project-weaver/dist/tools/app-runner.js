import { z } from 'zod';
import { spawn } from 'node:child_process';
import * as readline from 'node:readline';
import { BoardManager } from '../context/board.js';
// In-memory process registry — not persisted across MCP server restarts
const runningProcesses = new Map();
const MAX_RECENT_LOGS = 200;
function inferLogLevel(line) {
    if (/\b(error|ERR!?|Error|FATAL|fatal|ENOENT|EACCES|ECONNREFUSED|TypeError|ReferenceError|SyntaxError)\b/.test(line)) {
        return 'error';
    }
    if (/^\s+at\s+/.test(line)) {
        return 'error';
    }
    if (/\b(warn|Warning|WARN|deprecat)/i.test(line)) {
        return 'warn';
    }
    if (/\b(debug|DEBUG|verbose|VERBOSE)\b/.test(line)) {
        return 'debug';
    }
    return 'info';
}
function processKey(name, workspacePath) {
    return `${workspacePath}::${name}`;
}
export function registerAppRunner(server) {
    // --- launch_app ---
    server.tool('launch_app', 'Launch an application process (e.g., npm run dev) in the workspace and continuously monitor its stdout/stderr. Logs are parsed into WeaverEvents and written to .weaver/logs/. Errors are auto-promoted to context board entries.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        command: z.string().describe('Command to run (e.g., "npm run dev", "python app.py")'),
        name: z.string().optional().describe('Label for this process (default: "app")'),
    }, async ({ workspacePath, command, name: processName }) => {
        const manager = new BoardManager(workspacePath);
        const label = processName ?? 'app';
        const key = processKey(label, workspacePath);
        // Check if already running
        const existing = runningProcesses.get(key);
        if (existing && existing.info.status === 'running') {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: `Process "${label}" is already running (PID ${existing.info.pid}). Stop it first.`,
                        }),
                    }],
            };
        }
        // Parse command into parts
        const parts = command.split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);
        // Spawn the process
        const child = spawn(cmd, args, {
            cwd: workspacePath,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, FORCE_COLOR: '0' },
        });
        const info = {
            pid: child.pid ?? 0,
            name: label,
            command,
            workspacePath,
            startedAt: new Date().toISOString(),
            status: 'running',
            recentLogs: [],
        };
        runningProcesses.set(key, { process: child, info });
        // Accumulate error lines for batched context board entries
        let errorBuffer = [];
        let errorFlushTimer = null;
        const flushErrors = () => {
            if (errorBuffer.length > 0 && manager.exists()) {
                const combined = errorBuffer.join('\n');
                manager.addEntry({
                    agent: 'developer',
                    phase: 'ready',
                    type: 'question',
                    title: `Runtime Error in ${label}`,
                    content: `**Process:** ${label} (PID ${info.pid})\n**Output:**\n\`\`\`\n${combined}\n\`\`\``,
                    metadata: { source: 'app-runner', pid: info.pid, autoDetected: true },
                });
                errorBuffer = [];
            }
            errorFlushTimer = null;
        };
        const handleLine = (line, source) => {
            const level = source === 'stderr' && inferLogLevel(line) === 'info'
                ? 'warn'
                : inferLogLevel(line);
            const logLine = {
                timestamp: new Date().toISOString(),
                level,
                source,
                message: line,
                raw: line,
            };
            info.recentLogs.push(logLine);
            if (info.recentLogs.length > MAX_RECENT_LOGS) {
                info.recentLogs.shift();
            }
            if (manager.exists()) {
                manager.logEvent({
                    level,
                    action: source === 'stdout' ? 'app_output' : 'app_stderr',
                    message: `[${label}] ${line}`,
                    data: { source, processName: label, pid: info.pid },
                });
                // Batch errors together (flush after 500ms of no new errors)
                if (level === 'error') {
                    errorBuffer.push(line);
                    if (errorFlushTimer)
                        clearTimeout(errorFlushTimer);
                    errorFlushTimer = setTimeout(flushErrors, 500);
                }
            }
        };
        // Line-by-line processing
        if (child.stdout) {
            const stdoutRL = readline.createInterface({ input: child.stdout });
            stdoutRL.on('line', (line) => handleLine(line, 'stdout'));
        }
        if (child.stderr) {
            const stderrRL = readline.createInterface({ input: child.stderr });
            stderrRL.on('line', (line) => handleLine(line, 'stderr'));
        }
        // Handle process exit
        child.on('exit', (code, signal) => {
            info.status = code === 0 ? 'stopped' : 'crashed';
            info.exitCode = code ?? undefined;
            flushErrors();
            if (manager.exists()) {
                manager.logEvent({
                    level: code === 0 ? 'info' : 'error',
                    action: 'app_exited',
                    message: `[${label}] Process exited with code ${code} (signal: ${signal})`,
                    data: { processName: label, pid: info.pid, exitCode: code, signal },
                });
            }
        });
        child.on('error', (err) => {
            info.status = 'crashed';
            if (manager.exists()) {
                manager.logEvent({
                    level: 'error',
                    action: 'app_spawn_error',
                    message: `[${label}] Failed to start: ${err.message}`,
                    data: { processName: label, error: err.message },
                });
            }
        });
        // Log the launch
        if (manager.exists()) {
            manager.logEvent({
                level: 'info',
                action: 'app_launched',
                message: `Launched "${label}": ${command} (PID ${info.pid})`,
                data: { processName: label, command, pid: info.pid },
            });
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        pid: info.pid,
                        name: label,
                        command,
                        message: `Process "${label}" launched with PID ${info.pid}`,
                    }),
                }],
        };
    });
    // --- get_app_status ---
    server.tool('get_app_status', 'Check the status of running app processes. Returns PID, uptime, status, and recent log lines.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        name: z.string().optional().describe('Process name to check (default: show all for this workspace)'),
    }, async ({ workspacePath, name: processName }) => {
        const results = [];
        for (const [key, entry] of runningProcesses) {
            if (!key.startsWith(workspacePath + '::'))
                continue;
            if (processName && entry.info.name !== processName)
                continue;
            const uptimeMs = Date.now() - new Date(entry.info.startedAt).getTime();
            results.push({
                name: entry.info.name,
                pid: entry.info.pid,
                command: entry.info.command,
                status: entry.info.status,
                startedAt: entry.info.startedAt,
                uptimeSeconds: Math.floor(uptimeMs / 1000),
                exitCode: entry.info.exitCode,
                recentLogs: entry.info.recentLogs.slice(-20),
            });
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        processCount: results.length,
                        processes: results,
                    }),
                }],
        };
    });
    // --- stop_app ---
    server.tool('stop_app', 'Stop a running app process. Sends SIGTERM first, then SIGKILL after a timeout if the process does not exit.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        name: z.string().optional().describe('Process name to stop (default: "app")'),
    }, async ({ workspacePath, name: processName }) => {
        const label = processName ?? 'app';
        const key = processKey(label, workspacePath);
        const entry = runningProcesses.get(key);
        if (!entry || entry.info.status !== 'running') {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: `No running process found with name "${label}"`,
                        }),
                    }],
            };
        }
        const manager = new BoardManager(workspacePath);
        // Graceful shutdown
        entry.process.kill('SIGTERM');
        const forceKillTimeout = setTimeout(() => {
            try {
                if (entry.info.status === 'running') {
                    entry.process.kill('SIGKILL');
                }
            }
            catch {
                // Process may already be gone
            }
        }, 5000);
        // Wait for exit
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (entry.info.status !== 'running') {
                    clearInterval(checkInterval);
                    clearTimeout(forceKillTimeout);
                    resolve();
                }
            }, 200);
            setTimeout(() => {
                clearInterval(checkInterval);
                clearTimeout(forceKillTimeout);
                entry.info.status = 'stopped';
                resolve();
            }, 6000);
        });
        if (manager.exists()) {
            manager.logEvent({
                level: 'info',
                action: 'app_stopped',
                message: `Process "${label}" (PID ${entry.info.pid}) stopped`,
                data: { processName: label, pid: entry.info.pid },
            });
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Process "${label}" (PID ${entry.info.pid}) stopped`,
                        pid: entry.info.pid,
                        name: label,
                    }),
                }],
        };
    });
    // --- get_app_logs ---
    server.tool('get_app_logs', 'Get recent log output from a running (or recently stopped) app process. Supports level filtering.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory'),
        name: z.string().optional().describe('Process name (default: "app")'),
        lines: z.number().optional().describe('Number of lines to return (default: 50)'),
        level: z.enum(['info', 'warn', 'error', 'debug']).optional().describe('Filter by log level'),
    }, async ({ workspacePath, name: processName, lines, level }) => {
        const label = processName ?? 'app';
        const key = processKey(label, workspacePath);
        const entry = runningProcesses.get(key);
        if (!entry) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: `No process found with name "${label}"`,
                        }),
                    }],
            };
        }
        let logs = entry.info.recentLogs;
        if (level) {
            logs = logs.filter(l => l.level === level);
        }
        const limit = lines ?? 50;
        const result = logs.slice(-limit);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        processName: label,
                        pid: entry.info.pid,
                        status: entry.info.status,
                        totalLogsInBuffer: entry.info.recentLogs.length,
                        returnedLogs: result.length,
                        logs: result,
                    }),
                }],
        };
    });
}
//# sourceMappingURL=app-runner.js.map