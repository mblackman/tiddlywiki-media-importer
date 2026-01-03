const fs = require('fs');
const path = require('path');

// Configuration
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const pluginInfoPath = path.join(rootDir, 'plugin.info');
const outputFile = path.join(distDir, 'media-importer.json');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Read plugin metadata
console.log(`Reading plugin info from ${pluginInfoPath}...`);
const pluginInfo = JSON.parse(fs.readFileSync(pluginInfoPath, 'utf8'));

// Sync version from package.json
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
console.log(`Setting plugin version to ${packageJson.version} from package.json`);
pluginInfo.version = packageJson.version;

// Helper to parse TiddlyWiki headers
function parseFile(filename, content) {
    if (filename.endsWith('.json')) {
        return JSON.parse(content);
    }

    const fields = {};
    let text = content;

    // Parse JS TiddlyWiki header block /*\ ... \*/
    if (filename.endsWith('.js')) {
        const match = content.match(/^\/\*\\([\s\S]*?)\\\*\//);
        if (match) {
            const headerBlock = match[1];
            text = content.substring(match[0].length).trim();
            headerBlock.split('\n').forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const key = parts.shift().trim();
                    const value = parts.join(':').trim();
                    if (key) fields[key] = value;
                }
            });
        }
    } else if (filename.endsWith('.tid')) {
        const splitMatch = content.match(/\r?\n\r?\n/);
        if (splitMatch) {
            const headerBlock = content.substring(0, splitMatch.index);
            text = content.substring(splitMatch.index + splitMatch[0].length);
            headerBlock.split('\n').forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const key = parts.shift().trim();
                    const value = parts.join(':').trim();
                    if (key) fields[key] = value;
                }
            });
        }
    }
    
    fields.text = text;
    return fields;
}

// Collect tiddlers from src
const tiddlers = {};
if (fs.existsSync(srcDir)) {
    fs.readdirSync(srcDir).forEach(file => {
        const ext = path.extname(file);
        if (['.js', '.tid', '.json'].includes(ext)) {
            const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
            const fields = parseFile(file, content);
            if (fields.title) {
                tiddlers[fields.title] = fields;
            }
        }
    });
}

// Embed tiddlers into plugin info
pluginInfo.text = JSON.stringify({ tiddlers: tiddlers });

// Output as array (TiddlyWiki JSON import format)
fs.writeFileSync(outputFile, JSON.stringify([pluginInfo], null, 2));
console.log(`Plugin built successfully to ${outputFile}`);