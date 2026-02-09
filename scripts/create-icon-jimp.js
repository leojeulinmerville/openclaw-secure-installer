const Jimp = require('jimp');
const path = require('path');

const iconPath = path.join(__dirname, '../desktop/assets/icon.png');

new Jimp(1024, 1024, 0x0000FFFF, (err, image) => {
  if (err) throw err;
  image.write(iconPath, () => {
    console.log('Generated valid 1024x1024 PNG at', iconPath);
  });
});
