import sharp from 'sharp';

/** Produce variantes de contraste para texto multicolor sobre fondo rojo. */
export class CaptchaPreprocessor {
  async prepare(buffer) {
    const source = sharp(buffer);
    const { width } = await source.metadata();
    const enlarged = source.resize({ width: width * 4, kernel: 'nearest' });
    const raw = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const mask = Buffer.alloc(raw.info.width * raw.info.height, 255);
    for (let index = 0; index < mask.length; index++) {
      const [red, green, blue] = raw.data.subarray(index * 3, index * 3 + 3);
      const dark = Math.max(red, green, blue) < 110;
      const yellow = red > 110 && green > 95 && blue < 140 && green > blue * 1.4;
      if (dark || yellow) mask[index] = 0;
    }
    const monochrome = sharp(mask, { raw: { width: raw.info.width, height: raw.info.height, channels: 1 } })
      .resize({ width: width * 4, kernel: 'nearest' });
    const padded = image => image.extend({ top: 20, bottom: 20, left: 20, right: 20, background: 'white' });
    return [
      { name: 'color', image: await padded(enlarged.clone()).png().toBuffer() },
      { name: 'contrast', image: await padded(enlarged.clone().grayscale().normalize()).png().toBuffer() },
      { name: 'mask', image: await padded(monochrome).png().toBuffer() },
    ];
  }
}
