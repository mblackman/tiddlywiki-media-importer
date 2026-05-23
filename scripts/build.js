const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src', 'media-importer');
const distPluginDir = path.join(rootDir, 'dist', 'plugins', 'mblackman', 'media-importer');
const wikiPluginDir = path.join(rootDir, 'wiki', 'plugins', 'media-importer');

console.log('🧹 Cleaning build directories...');
fs.rmSync(path.join(rootDir, 'dist'), { recursive: true, force: true });
fs.rmSync(path.join(rootDir, 'wiki', 'plugins'), { recursive: true, force: true });

console.log('🚀 Compiling TypeScript widgets...');
try {
  execSync('npx tsc --project tsconfig.build.json', { stdio: 'inherit', cwd: rootDir });
  console.log('✅ TypeScript widgets compiled successfully.');
} catch (error) {
  console.error('❌ TypeScript compilation failed:', error.message);
  process.exit(1);
}

console.log('📁 Copying assets and metadata files...');

// Recursive walker to copy static files and map meta files
function copyFolderRecursive(src, dest) {
  if (!fs.existsSync(src)) return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyFolderRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    const ext = path.extname(src);
    const basename = path.basename(src);

    // Skip TS files as they are compiled by tsc
    if (ext === '.ts') {
      return;
    }

    // Map .ts.meta files to .js.meta
    if (basename.endsWith('.ts.meta')) {
      const newDest = path.join(path.dirname(dest), basename.replace('.ts.meta', '.js.meta'));
      fs.copyFileSync(src, newDest);
      return;
    }

    // Default copy for all other files (.tid, .css, .js, .json, .multids, etc.)
    fs.copyFileSync(src, dest);
  }
}

copyFolderRecursive(srcDir, distPluginDir);
console.log('✅ Static assets, stylesheets, templates, and metadata copied.');

console.log('⚙️ Generating tiddlywiki.files descriptor...');
const tiddlywikiFilesContent = {
  directories: [
    {
      path: '.',
      filesRegExp: '^.*\\.(js|tid|css|multids)$',
      isTiddlerFile: true,
      searchSubdirectories: true
    }
  ]
};

fs.writeFileSync(
  path.join(distPluginDir, 'tiddlywiki.files'),
  JSON.stringify(tiddlywikiFilesContent, null, 2),
  'utf8'
);
console.log('✅ tiddlywiki.files descriptor written.');

console.log('📦 Mirroring plugin to local wiki for development...');
fs.mkdirSync(path.dirname(wikiPluginDir), { recursive: true });
fs.cpSync(distPluginDir, wikiPluginDir, { recursive: true });
console.log('✅ Plugin successfully mirrored to wiki/plugins.');

console.log('\n🌟 Build Completed successfully! 🌟\n');
