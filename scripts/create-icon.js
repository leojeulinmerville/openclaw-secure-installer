const fs = require('fs');
const path = require('path');
// Minimal 1x1 transparent PNG
const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
fs.writeFileSync(path.join('desktop', 'assets', 'icon.png'), buffer);
console.log('Wrote minimal PNG to desktop/assets/icon.png');
