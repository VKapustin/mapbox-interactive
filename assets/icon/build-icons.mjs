// Builds the app icons in src/app from the drawings in this folder:
//   favicon.ico     16px (icon-16.svg, drawn on the pixel grid) and
//                   32px, 48px (icon.svg), as PNG images in an ICO file
//   apple-icon.png  180px (icon.svg) on white; iOS shows transparency as black
//
// Run from the project root after changing a drawing:
//   node assets/icon/build-icons.mjs
//
// Uses sharp, which Next.js installs for image optimization.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const appDir = fileURLToPath(new URL('../../src/app/', import.meta.url));

// An SVG drawn on a `viewBox` this wide, rendered at `size` pixels.
const render = async (svgFile, viewBoxSize, size) =>
  sharp(await readFile(here(svgFile)), { density: (72 * size * 4) / viewBoxSize })
    .resize(size, size)
    .png()
    .toBuffer();

// ICO with PNG images: a 6-byte header, a 16-byte entry per image, then the images.
const toIco = (images) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0); // width
    entry.writeUInt8(size, 1); // height
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
};

const favicon = toIco([
  { size: 16, png: await render('icon-16.svg', 16, 16) },
  { size: 32, png: await render('icon.svg', 32, 32) },
  { size: 48, png: await render('icon.svg', 32, 48) },
]);
await writeFile(`${appDir}favicon.ico`, favicon);

const appleIcon = await sharp({ create: { width: 180, height: 180, channels: 4, background: '#ffffff' } })
  .composite([{ input: await render('icon.svg', 32, 140), top: 20, left: 20 }])
  .png()
  .toBuffer();
await writeFile(`${appDir}apple-icon.png`, appleIcon);

console.log('Wrote src/app/favicon.ico and src/app/apple-icon.png');
