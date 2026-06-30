const sharp = require("sharp");
const path = require("path");

const LOGO = "D:/DeltaJalan/Frontend-stable/dist/client/logo.png";
const RES_DIR = "D:/DeltaJalan/Frontend-stable/android/app/src/main/res";

const SIZES = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

async function generate() {
  for (const [dir, size] of Object.entries(SIZES)) {
    const outDir = path.join(RES_DIR, dir);

    // Foreground (original logo with alpha, resized)
    await sharp(LOGO)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outDir, "ic_launcher_foreground.png"));

    // Legacy icon: logo composited on blue background
    const bg = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 30, g: 64, b: 175, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const fg = await sharp(LOGO)
      .resize(Math.round(size * 0.8), Math.round(size * 0.8), { fit: "contain" })
      .png()
      .toBuffer();

    const composited = await sharp(bg)
      .composite([{ input: fg, gravity: "center" }])
      .png()
      .toBuffer();

    await sharp(composited).toFile(path.join(outDir, "ic_launcher.png"));
    await sharp(composited).toFile(path.join(outDir, "ic_launcher_round.png"));

    console.log(`Generated ${dir} (${size}x${size})`);
  }
  console.log("Done!");
}

generate().catch((e) => {
  console.error(e);
  process.exit(1);
});
