import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconPath = path.join(__dirname, '../desktop/assets/icon.png');

// Create a 1024x1024 PNG
const png = new PNG({ width: 1024, height: 1024 });

// Fill with blue color (OpenClaw brand-ish)
for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
        const idx = (png.width * y + x) << 2;
        png.data[idx] = 0;     // R
        png.data[idx + 1] = 120; // G
        png.data[idx + 2] = 255; // B
        png.data[idx + 3] = 255; // Alpha
    }
}

png.pack().pipe(fs.createWriteStream(iconPath))
    .on('finish', () => {
        console.log('Generated valid 1024x1024 PNG at', iconPath);
    });
