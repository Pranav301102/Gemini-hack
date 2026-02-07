import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BoardManager } from '../context/board.js';
// Directories to always skip
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '__pycache__',
    '.cache', '.vscode', '.idea', 'coverage', '.weaver', '.turbo', '.output',
    'vendor', 'target', 'bin', 'obj', '.gradle', '.mvn', 'venv', '.venv', 'env',
]);
// Binary/large file extensions to skip
const SKIP_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib', '.o', '.a',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.db', '.sqlite', '.sqlite3',
    '.lock', '.map',
]);
// Language detection by extension
const LANG_MAP = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.mjs': 'JavaScript', '.cjs': 'JavaScript',
    '.py': 'Python', '.pyw': 'Python',
    '.rs': 'Rust',
    '.go': 'Go',
    '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
    '.rb': 'Ruby', '.erb': 'Ruby',
    '.cs': 'C#', '.fs': 'F#',
    '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.c': 'C', '.h': 'C/C++', '.hpp': 'C++',
    '.swift': 'Swift',
    '.php': 'PHP',
    '.html': 'HTML', '.htm': 'HTML',
    '.css': 'CSS', '.scss': 'SCSS', '.sass': 'SASS', '.less': 'LESS',
    '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
    '.md': 'Markdown', '.mdx': 'MDX',
    '.sql': 'SQL',
    '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
    '.dockerfile': 'Docker', '.proto': 'Protobuf',
};
const TECH_HINTS = [
    {
        file: 'package.json', tech: 'Node.js',
        depsField: 'dependencies',
        detectors: {
            'react': 'React', 'react-dom': 'React', 'next': 'Next.js', 'nuxt': 'Nuxt',
            'vue': 'Vue', 'svelte': 'Svelte', '@sveltejs/kit': 'SvelteKit',
            'express': 'Express', 'fastify': 'Fastify', 'koa': 'Koa', 'hono': 'Hono',
            '@nestjs/core': 'NestJS', 'prisma': 'Prisma', 'drizzle-orm': 'Drizzle',
            'tailwindcss': 'Tailwind CSS', '@angular/core': 'Angular',
            'electron': 'Electron', 'vite': 'Vite', 'webpack': 'webpack',
            'typescript': 'TypeScript',
        },
    },
    { file: 'Cargo.toml', tech: 'Rust' },
    { file: 'requirements.txt', tech: 'Python' },
    { file: 'pyproject.toml', tech: 'Python' },
    { file: 'setup.py', tech: 'Python' },
    { file: 'go.mod', tech: 'Go' },
    { file: 'pom.xml', tech: 'Java' },
    { file: 'build.gradle', tech: 'Java/Kotlin' },
    { file: 'build.gradle.kts', tech: 'Kotlin' },
    { file: 'Gemfile', tech: 'Ruby' },
    { file: 'composer.json', tech: 'PHP' },
    { file: 'Package.swift', tech: 'Swift' },
    { file: 'Dockerfile', tech: 'Docker' },
    { file: 'docker-compose.yml', tech: 'Docker Compose' },
    { file: 'docker-compose.yaml', tech: 'Docker Compose' },
    { file: '.github/workflows', tech: 'GitHub Actions' },
    { file: 'vercel.json', tech: 'Vercel' },
    { file: 'netlify.toml', tech: 'Netlify' },
    { file: 'tsconfig.json', tech: 'TypeScript' },
];
function loadGitignorePatterns(rootPath) {
    const gitignorePath = path.join(rootPath, '.gitignore');
    if (!fs.existsSync(gitignorePath))
        return [];
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
}
function matchesGitignore(relativePath, patterns) {
    for (const pattern of patterns) {
        const cleanPattern = pattern.replace(/^\//, '').replace(/\/$/, '');
        // Simple glob matching: exact dir name match or starts-with
        if (relativePath === cleanPattern || relativePath.startsWith(cleanPattern + '/')) {
            return true;
        }
        // Wildcard extension match (e.g., *.log)
        if (cleanPattern.startsWith('*.')) {
            const ext = cleanPattern.slice(1);
            if (relativePath.endsWith(ext))
                return true;
        }
    }
    return false;
}
function walkTree(rootPath, gitignorePatterns, maxDepth = 10) {
    const entries = [];
    function walk(dirPath, depth) {
        if (depth > maxDepth)
            return;
        let items;
        try {
            items = fs.readdirSync(dirPath, { withFileTypes: true });
        }
        catch {
            return; // Permission denied or other read error
        }
        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            const relativePath = path.relative(rootPath, fullPath);
            if (item.isDirectory()) {
                if (SKIP_DIRS.has(item.name))
                    continue;
                if (matchesGitignore(relativePath, gitignorePatterns))
                    continue;
                entries.push({ path: relativePath, size: 0, type: 'directory' });
                walk(fullPath, depth + 1);
            }
            else if (item.isFile()) {
                const ext = path.extname(item.name).toLowerCase();
                if (SKIP_EXTENSIONS.has(ext))
                    continue;
                if (matchesGitignore(relativePath, gitignorePatterns))
                    continue;
                try {
                    const stat = fs.statSync(fullPath);
                    entries.push({ path: relativePath, size: stat.size, type: 'file' });
                }
                catch {
                    // Skip unreadable files
                }
            }
        }
    }
    walk(rootPath, 0);
    return entries;
}
function detectTechStack(rootPath) {
    const stack = new Set();
    for (const hint of TECH_HINTS) {
        const hintPath = path.join(rootPath, hint.file);
        if (fs.existsSync(hintPath)) {
            stack.add(hint.tech);
            // Deep inspection for package.json deps
            if (hint.depsField && hint.detectors && hint.file === 'package.json') {
                try {
                    const pkg = JSON.parse(fs.readFileSync(hintPath, 'utf-8'));
                    const allDeps = {
                        ...(pkg.dependencies ?? {}),
                        ...(pkg.devDependencies ?? {}),
                    };
                    for (const [dep, label] of Object.entries(hint.detectors)) {
                        if (allDeps[dep])
                            stack.add(label);
                    }
                }
                catch {
                    // Malformed package.json
                }
            }
        }
    }
    return [...stack];
}
function getProjectDescription(rootPath) {
    // Try README.md
    const readmePath = path.join(rootPath, 'README.md');
    if (fs.existsSync(readmePath)) {
        try {
            const content = fs.readFileSync(readmePath, 'utf-8');
            // Get first meaningful paragraph (skip title)
            const lines = content.split('\n');
            let description = '';
            let pastTitle = false;
            for (const line of lines) {
                if (line.startsWith('#')) {
                    pastTitle = true;
                    continue;
                }
                if (pastTitle && line.trim()) {
                    description = line.trim();
                    break;
                }
            }
            if (description)
                return description.substring(0, 500);
        }
        catch { /* ignore */ }
    }
    // Try package.json description
    const pkgPath = path.join(rootPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.description)
                return pkg.description;
        }
        catch { /* ignore */ }
    }
    return undefined;
}
export function registerReadProject(server) {
    server.tool('read_project', 'Scan an existing codebase to auto-detect project structure, tech stack, and patterns. Initializes .weaver/ without asking questions. Use this for existing projects instead of init_project + gather_requirements.', {
        workspacePath: z.string().describe('Absolute path to the workspace directory to scan'),
    }, async ({ workspacePath }) => {
        if (!fs.existsSync(workspacePath)) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Path does not exist: ${workspacePath}` }) }],
            };
        }
        const gitignorePatterns = loadGitignorePatterns(workspacePath);
        const fileTree = walkTree(workspacePath, gitignorePatterns);
        const techStack = detectTechStack(workspacePath);
        const description = getProjectDescription(workspacePath);
        const projectName = path.basename(workspacePath);
        // Count files by language
        const langCounts = {};
        const files = fileTree.filter(e => e.type === 'file');
        const dirs = fileTree.filter(e => e.type === 'directory');
        for (const file of files) {
            const ext = path.extname(file.path).toLowerCase();
            const lang = LANG_MAP[ext] ?? 'Other';
            langCounts[lang] = (langCounts[lang] ?? 0) + 1;
        }
        // Build directory tree (top 3 levels)
        const topDirs = dirs
            .filter(d => d.path.split(path.sep).length <= 3)
            .map(d => d.path);
        // Initialize the .weaver/ project
        const manager = new BoardManager(workspacePath);
        if (manager.exists()) {
            // Already initialized — just return scan results
            const board = manager.readBoard();
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: `Project already initialized as "${board.project.name}". Returning fresh scan results.`,
                            projectId: board.projectId,
                            scan: {
                                totalFiles: files.length,
                                totalDirectories: dirs.length,
                                techStack,
                                languageCounts: langCounts,
                                directoryTree: topDirs,
                                totalSize: files.reduce((sum, f) => sum + f.size, 0),
                            },
                        }),
                    }],
            };
        }
        // Auto-init the project with detected info
        const board = manager.initProject(projectName, description ?? `Existing ${techStack[0] ?? 'software'} project`, [], // No requirements — read mode skips questions
        techStack);
        manager.logEvent({
            level: 'info',
            agent: 'architect',
            stage: 'read',
            action: 'project_scanned',
            message: `Scanned ${files.length} files across ${dirs.length} directories. Tech stack: ${techStack.join(', ')}`,
            data: { fileCount: files.length, dirCount: dirs.length, techStack, langCounts },
        });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Project "${projectName}" scanned and initialized at ${workspacePath}/.weaver/`,
                        projectId: board.projectId,
                        scan: {
                            totalFiles: files.length,
                            totalDirectories: dirs.length,
                            techStack,
                            languageCounts: langCounts,
                            directoryTree: topDirs,
                            totalSize: files.reduce((sum, f) => sum + f.size, 0),
                        },
                        nextStep: 'Run index_project to build the code index, then run_pipeline to start the development lifecycle.',
                    }),
                }],
        };
    });
}
//# sourceMappingURL=read-project.js.map