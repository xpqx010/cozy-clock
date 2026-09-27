const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

async function generate() {
  const { default: pngToIco } = await import("png-to-ico");
  const root = path.join(__dirname, "..");
  const source = path.join(root, "assets", "icon.svg");
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngPaths = [];

  for (const size of sizes) {
    const output = path.join(root, "assets", `icon-${size}.png`);
    await sharp(source).resize(size, size).png().toFile(output);
    pngPaths.push(output);
  }

  await fs.copyFile(path.join(root, "assets", "icon-256.png"), path.join(root, "assets", "icon.png"));
  await fs.writeFile(path.join(root, "assets", "icon.ico"), await pngToIco(pngPaths));
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
