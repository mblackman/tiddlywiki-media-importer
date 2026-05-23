const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

let tiddlyWikiProcess = null;
let debounceTimer = null;
let isBuilding = false;

// 1. Initial Build
function runBuild() {
  console.log('\n🔨 Rebuilding plugin...');
  isBuilding = true;
  try {
    execSync('node scripts/build.js', { stdio: 'inherit', cwd: rootDir });
    console.log('✅ Rebuild complete.');
  } catch (error) {
    console.error('❌ Build script failed. Fix errors to trigger server restart.');
  } finally {
    isBuilding = false;
  }
}

// 2. Start TiddlyWiki Server Process
function startServer() {
  if (tiddlyWikiProcess) {
    console.error('⚠️ Server is already running.');
    return;
  }

  console.log('🌐 Starting TiddlyWiki local dev server...');
  tiddlyWikiProcess = spawn('npx', ['tiddlywiki', 'wiki', '--listen', 'port=8080', 'host=127.0.0.1'], {
    stdio: 'inherit',
    shell: true,
    cwd: rootDir
  });

  tiddlyWikiProcess.on('error', (err) => {
    console.error('❌ Failed to start TiddlyWiki server:', err);
  });

  tiddlyWikiProcess.on('exit', (code, signal) => {
    tiddlyWikiProcess = null;
    if (signal) {
      console.log(`⏹️ TiddlyWiki server terminated with signal: ${signal}`);
    } else if (code !== null && code !== 0) {
      console.log(`⏹️ TiddlyWiki server stopped with exit code: ${code}`);
    } else {
      console.log('⏹️ TiddlyWiki server stopped.');
    }
  });
}

// 3. Stop TiddlyWiki Server
function stopServer() {
  return new Promise((resolve) => {
    if (!tiddlyWikiProcess) {
      resolve();
      return;
    }

    console.log('⏹️ Stopping TiddlyWiki server...');
    tiddlyWikiProcess.removeAllListeners('exit');
    tiddlyWikiProcess.on('exit', () => {
      tiddlyWikiProcess = null;
      console.log('⏹️ TiddlyWiki server stopped successfully.');
      resolve();
    });

    // Send SIGTERM, fallback to kill if needed
    tiddlyWikiProcess.kill('SIGTERM');
    // For Windows compatibility, sometimes child process might not respond to standard SIGTERM,
    // so we call kill() which does a TaskKill under Windows shell.
    setTimeout(() => {
      if (tiddlyWikiProcess) {
        tiddlyWikiProcess.kill('SIGKILL');
      }
    }, 1000);
  });
}

// 4. Safe rebuild and restart cycle
async function triggerReload() {
  if (isBuilding) return;

  await stopServer();
  runBuild();
  startServer();
}

// Perform initial build and start
runBuild();
startServer();

// 5. Watch source directory for changes recursively
console.log(`👀 Watching directory for changes: ${srcDir}`);
fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
  if (!filename) return;

  // Ignore editor temporary files, hidden files, or meta/dist files
  if (filename.startsWith('.') || filename.includes('node_modules')) {
    return;
  }

  console.log(`📝 Change detected in: ${filename} (${eventType})`);

  // Debounce to allow multiple fast modifications (e.g. build tool outputs or bulk saves)
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    triggerReload();
  }, 300);
});

// 6. Graceful cleanup on terminal exit
const shutdown = async () => {
  console.log('\n🛑 Shutdown signal received. Cleaning up dev environment...');
  if (tiddlyWikiProcess) {
    await stopServer();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
