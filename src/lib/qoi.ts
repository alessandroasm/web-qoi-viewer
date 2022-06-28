import { Bitmap } from "./bitmap";

type QoiHeader = {
  width: number;
  height: number;
  channels: number;
  colorspace: number;
  headerSize: number;
};

type QoiPixel = {
  r: number;
  g: number;
  b: number;
  a: number;
};

function uintArrayContains(
  str: Uint8ClampedArray,
  array: Uint8ClampedArray,
  offset: number = 0
) {
  if (str.length + offset > array.length) return false;

  for (let k = 0; k < str.length; k++) {
    if (str[k] !== array[k + offset]) return false;
  }

  return true;
}

function uintArrayReadInt32BE<T extends Uint8ClampedArray | Uint8Array>(
  array: T,
  offset: number
) {
  return (
    array[offset + 3] |
    (array[offset + 2] << 8) |
    (array[offset + 1] << 16) |
    (array[offset] << 24)
  );
}

export class QoiParser {
  private parseHeader(contents: Uint8ClampedArray): QoiHeader | null {
    const enc = new TextEncoder();
    const magic = new Uint8ClampedArray(enc.encode("qoif"));
    if (!uintArrayContains(magic, contents)) return null;

    // image width in pixels (BE)
    const width = uintArrayReadInt32BE(contents, 4);
    // image height in pixels (BE)
    const height = uintArrayReadInt32BE(contents, 8);
    // 3 = RGB, 4 = RGBA
    const channels = contents[12];
    // 0 = sRGB with linear alpha
    // 1 = all channels linear
    const colorspace = contents[12];

    //console.log(width, height, channels, colorspace);
    return { width, height, channels, colorspace, headerSize: 14 };
  }

  private parsePixels(header: QoiHeader, contents: Uint8ClampedArray) {
    const pixels = new Uint8ClampedArray(
      new ArrayBuffer(header.width * header.height * 4)
    );
    let prevArray: QoiPixel[] = Array.from({ length: 64 }, () => ({
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    }));

    const indexPosition = (pixel: QoiPixel) =>
      (pixel.r * 3 + pixel.g * 5 + pixel.b * 7 + pixel.a * 11) % 64;

    let p = header.headerSize;
    let idx = 0;

    const QOI_OP_RGB = 0b11111110;
    const QOI_OP_RGBA = 0b11111111;

    const setPixel = (pixel: QoiPixel) => {
      pixels[idx] = pixel.r;
      pixels[idx + 1] = pixel.g;
      pixels[idx + 2] = pixel.b;
      pixels[idx + 3] = pixel.a;

      idx += 4;
    };

    const wrapUint8 = (n: number) => {
      let x = n;
      while (x < 0) x += 256;
      return x % 256;
    };

    const opRgba = (rgbOnly: boolean, prevPixel: QoiPixel) => {
      const r = contents[p];
      const g = contents[p + 1];
      const b = contents[p + 2];
      const a = rgbOnly ? prevPixel.a : contents[p + 3];

      setPixel({ r, g, b, a });
      p = rgbOnly ? p + 3 : p + 4;
    };

    const opIndex = (tag: number) => {
      const index = tag & 0x3f;
      const pixel = prevArray[index];
      setPixel(pixel);
    };

    const opDiff = (tag: number, prevPixel: QoiPixel) => {
      const dr = ((tag >> 4) & 0x3) - 2;
      const dg = ((tag >> 2) & 0x3) - 2;
      const db = (tag & 0x3) - 2;

      const pixel: QoiPixel = {
        r: wrapUint8(prevPixel.r + dr),
        g: wrapUint8(prevPixel.g + dg),
        b: wrapUint8(prevPixel.b + db),
        a: prevPixel.a,
      };

      setPixel(pixel);
    };

    const opLuma = (tag: number, prevPixel: QoiPixel) => {
      const payload = contents[p++];

      const diffGreen = (tag & 0x3f) - 32;
      const drDg = ((payload >> 4) & 0x0f) - 8;
      const dbDg = (payload & 0x0f) - 8;

      const pixel: QoiPixel = {
        r: wrapUint8(diffGreen + drDg + prevPixel.r),
        g: wrapUint8(diffGreen + prevPixel.g),
        b: wrapUint8(diffGreen + dbDg + prevPixel.b),
        a: prevPixel.a,
      };

      setPixel(pixel);
    };

    const opRun = (tag: number, prevPixel: QoiPixel) => {
      const count = (tag & 0x3f) + 1;
      for (let k = 0; k < count; k++) setPixel(prevPixel);
    };

    const endSequence = Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 1]);
    const detectEndSequence = (p: number) => {
      for (let k = 0; k < endSequence.length; k++) {
        if (contents[p + k] !== endSequence[k]) return false;
      }

      return true;
    };

    while (p < contents.length) {
      // Retrieving last pixel
      const prevPixel: QoiPixel =
        idx === 0
          ? { r: 0, g: 0, b: 0, a: 255 }
          : {
              r: pixels[idx - 4],
              g: pixels[idx - 3],
              b: pixels[idx - 2],
              a: pixels[idx - 1],
            };
      prevArray[indexPosition(prevPixel)] = prevPixel;

      // Parsing the operation tag
      const tag = contents[p++];
      if (tag === 0 && detectEndSequence(p - 1)) {
        break;
      }

      if (tag === QOI_OP_RGB || tag === QOI_OP_RGBA) {
        opRgba(tag === QOI_OP_RGB, prevPixel);
        continue;
      }

      const tagOp = tag >> 6;
      switch (tagOp) {
        // QOI_OP_INDEX
        case 0b00:
          opIndex(tag);
          break;

        // QOI_OP_DIFF
        case 0b01:
          opDiff(tag, prevPixel);
          break;

        // QOI_OP_LUMA
        case 0b10:
          opLuma(tag, prevPixel);
          break;

        // QOI_OP_RUN
        case 0b11:
          opRun(tag, prevPixel);
          break;
      }
    }

    return pixels;
  }

  parse(buffer: Uint8ClampedArray): Bitmap | null {
    const header = this.parseHeader(buffer);
    if (!header) return null;

    const pixels = this.parsePixels(header, buffer);
    if (!pixels) return null;

    return new Bitmap(header.width, header.height, pixels);
  }
}
