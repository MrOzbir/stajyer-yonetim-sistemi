import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const walk = (dir, callback) => {
    fs.readdirSync(dir).forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            walk(filepath, callback);
        } else if (filepath.endsWith('.jsx')) {
            callback(filepath);
        }
    });
};

walk(path.join(__dirname, 'src'), (filepath) => {
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;

    content = content.replace(/text-snow\/(\d+)/g, (match, p1) => {
        const opacity = parseInt(p1, 10);
        if (opacity <= 40) return 'text-snow-faint';
        if (opacity <= 75) return 'text-snow-muted';
        return 'text-snow';
    });

    if (content !== original) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated ${filepath}`);
    }
});
