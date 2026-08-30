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

const regexReplace = [
    // Background and border overlays
    { regex: /border-white\/\d+/g, replace: 'border-edge' },
    { regex: /bg-white\/5/g, replace: 'bg-overlay' },
    { regex: /bg-white\/10/g, replace: 'bg-overlay-hover' },
    { regex: /bg-white\/15/g, replace: 'bg-overlay-hover' },
    { regex: /bg-white\/20/g, replace: 'bg-overlay-hover' },
    { regex: /hover:bg-white\/\d+/g, replace: 'hover:bg-overlay-hover' },
    
    // Text opacity
    { regex: /text-white\/(\d+)/g, replace: 'text-snow/$1' },
    
    // Hardcoded bg-black for inputs -> use bg-night or bg-overlay
    { regex: /bg-black\/20/g, replace: 'bg-night' },
    { regex: /bg-black\/30/g, replace: 'bg-night' },
];

walk(path.join(__dirname, 'src'), (filepath) => {
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;

    // Apply regex replacements
    for (const rule of regexReplace) {
        content = content.replace(rule.regex, rule.replace);
    }

    // Smart replace text-white and hover:text-white
    // We only replace if the className string DOES NOT contain a solid background color
    content = content.replace(/className=(["'])(.*?)\1|className=\{`(.*?)`\}/g, (match, quote, p2, p3) => {
        let classStr = p2 || p3;
        if (!classStr) return match;

        const hasSolidBg = /bg-(brand|red|green|blue|yellow)/.test(classStr);
        if (!hasSolidBg) {
            classStr = classStr.replace(/\btext-white\b/g, 'text-snow');
            classStr = classStr.replace(/\bhover:text-white\b/g, 'hover:text-snow');
        }

        if (p2) return `className="${classStr}"`;
        if (p3) return `className={\`${classStr}\`}`;
        return match;
    });

    if (content !== original) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated ${filepath}`);
    }
});
