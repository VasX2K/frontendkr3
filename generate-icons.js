// Скрипт для генерации иконок — создаёт простые PNG нужных размеров
// Запуск: node generate-icons.js
// Требует: canvas (npm install canvas) или можно использовать альтернативу

const fs = require('fs');
const path = require('path');

// Если canvas недоступен, создадим минимальные PNG вручную
// Минимальный валидный 1x1 PNG (прозрачный) — используем как базу
// Но лучше создадим через простой подход: сгенерируем PNG через буфер

// Простой PNG 1x1 синий пиксель — минимальный валидный PNG
// Для создания полноценных PNG без canvas используем готовый буфер

// Создаём папку icons
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Минимальный валидный PNG (1x1 синий пиксель) в виде base64
// Сгенерируем программно PNG с синим фоном и буквой "З"
// Для простоты используем подход с созданием PNG через raw данные

// PNG сигнатура
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    
    const typeBuf = Buffer.from(type);
    const crcData = Buffer.concat([typeBuf, data]);
    
    const crcVal = crc32(crcData) >>> 0; // ensure unsigned
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crcVal, 0);
    
    return Buffer.concat([length, typeBuf, data, crc]);
}

function crc32(buf) {
    let c = 0xFFFFFFFF;
    const table = [];
    
    for (let n = 0; n < 256; n++) {
        let c2 = n;
        for (let k = 0; k < 8; k++) {
            c2 = c2 & 1 ? 0xEDB88320 ^ (c2 >>> 1) : c2 >>> 1;
        }
        table[n] = c2;
    }
    
    for (let i = 0; i < buf.length; i++) {
        c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    
    return c ^ 0xFFFFFFFF;
}

function createPNG(width, height, r, g, b) {
    // Создаём raw image data
    const rawData = Buffer.alloc(width * height * 3 + height);
    let idx = 0;
    
    for (let y = 0; y < height; y++) {
        rawData[idx++] = 0; // filter byte
        for (let x = 0; x < width; x++) {
            // Градиент от тёмно-синего к светло-синему
            const factor = (x + y) / (width + height);
            const pr = Math.round(r * (1 - factor * 0.3));
            const pg = Math.round(g * (1 - factor * 0.3));
            const pb = Math.round(Math.min(255, b + factor * 60));
            rawData[idx++] = pr;
            rawData[idx++] = pg;
            rawData[idx++] = pb;
        }
    }
    
    // Сжимаем через zlib (deflate)
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(rawData);
    
    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 0);
    ihdrData[8] = 8;  // bit depth
    ihdrData[9] = 2;  // color type: RGB
    ihdrData[10] = 0; // compression
    ihdrData[11] = 0; // filter
    ihdrData[12] = 0; // interlace
    
    const ihdr = createChunk('IHDR', ihdrData);
    const idat = createChunk('IDAT', compressed);
    const iend = createChunk('IEND', Buffer.alloc(0));
    
    return Buffer.concat([PNG_SIGNATURE, ihdr, idat, iend]);
}

const sizes = [16, 32, 48, 64, 128, 256, 512];
const colors = [
    { r: 66, g: 133, b: 244 },  // #4285f4 — основной цвет темы
];

sizes.forEach(size => {
    const png = createPNG(size, size, colors[0].r, colors[0].g, colors[0].b);
    const filename = `favicon-${size}x${size}.png`;
    fs.writeFileSync(path.join(iconsDir, filename), png);
    console.log(`Создан: ${filename} (${png.length} байт)`);
});

// Создаём favicon.ico (просто копируем 32x32 как основу для .ico)
// ICO формат — упрощённо: заголовок + DIR_ENTRY + данные (XOR маска)
function createICO(pngData) {
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0);  // reserved
    icoHeader.writeUInt16LE(1, 2);  // type: 1 = ICO
    icoHeader.writeUInt16LE(1, 4);  // count: 1 image
    
    const pngBuf = pngData;
    const dirEntry = Buffer.alloc(16);
    dirEntry[0] = 0;  // width (0 = 256)
    dirEntry[1] = 0;  // height
    dirEntry[2] = 0;  // color palette
    dirEntry[3] = 0;  // reserved
    dirEntry.writeUInt16LE(1, 4);  // color planes
    dirEntry.writeUInt16LE(32, 6); // bits per pixel
    
    dirEntry.writeUInt32LE(pngBuf.length, 8);  // size of image data
    dirEntry.writeUInt32LE(22, 12);            // offset to image data (6 + 16)
    
    return Buffer.concat([icoHeader, dirEntry, pngBuf]);
}

const png32 = createPNG(32, 32, colors[0].r, colors[0].g, colors[0].b);
const icoData = createICO(png32);
fs.writeFileSync(path.join(iconsDir, 'favicon.ico'), icoData);
console.log('Создан: favicon.ico');

// Создаём icon-152x152.png для iOS
const png152 = createPNG(152, 152, colors[0].r, colors[0].g, colors[0].b);
fs.writeFileSync(path.join(iconsDir, 'icon-152x152.png'), png152);
console.log('Создан: icon-152x152.png');

console.log('\nВсе иконки созданы в папке icons/');
