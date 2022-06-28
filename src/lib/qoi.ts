import { readFile } from "fs/promises";

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

class QoiParser {
  private parseHeader(contents: Buffer): QoiHeader | null {
    const magic = Buffer.from("qoif");
    if (!magic.equals(contents.slice(0, 4))) return null;

    // image width in pixels (BE)
    const width = contents.readInt32BE(4);
    // image height in pixels (BE)
    const height = contents.readInt32BE(8);
    // 3 = RGB, 4 = RGBA
    const channels = contents.readInt8(12);
    // 0 = sRGB with linear alpha
    // 1 = all channels linear
    const colorspace = contents.readInt8(13);

    console.log(width, height, channels, colorspace);
    return { width, height, channels, colorspace, headerSize: 14 };
  }

  private parsePixels(header: QoiHeader, contents: Uint8Array) {
    const pixels = new Uint8Array(
      new ArrayBuffer(header.width * header.height * 4)
    );
    let prevArray: QoiPixel[] = Array.from({ length: 64 }, () => ({
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    }));

    const indexPosition = (pixel: QoiPixel) =>
      (pixel.r * 3 + pixel.g * 5 + pixel.b * 7 * pixel.a * 11) % 64;

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

    const opRgba = (rgbOnly: boolean) => {
      const r = contents[p];
      const g = contents[p + 1];
      const b = contents[p + 2];
      const a = rgbOnly ? 255 : contents[p + 3];

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
      const count = tag & 0x3f;
      for (let k = 0; k < count; k++) setPixel(prevPixel);
    };

    const endSequence = Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]);

    while (p < contents.length) {
      // Retrieving last pixel
      const prevPixel: QoiPixel | null =
        idx === 0
          ? { r: 0, g: 0, b: 0, a: 255 }
          : {
              r: pixels[idx - 4],
              g: pixels[idx - 3],
              b: pixels[idx - 2],
              a: pixels[idx - 1],
            };

      if (prevPixel) {
        prevArray[indexPosition(prevPixel)] = prevPixel;
      }

      const requirePrevPixel = (opName: string) => {
        if (!prevPixel)
          throw new Error(`Invalid ${opName} without previous pixel`);
      };

      // Parsing the operation tag
      const tag = contents[p++];
      if (tag === 0) {
        console.log(
          endSequence.equals(contents.slice(p - 1, 8)),
          contents.slice(p - 1, 8).map((v) => v)
        );
      }
      if (tag === 0 && endSequence.equals(contents.slice(p - 1, 8))) {
        console.log("reached end");
        break;
      }

      if (tag === QOI_OP_RGB || tag === QOI_OP_RGBA) {
        opRgba(tag === QOI_OP_RGB);
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
          requirePrevPixel("QOI_OP_DIFF");
          opDiff(tag, prevPixel!);
          break;

        // QOI_OP_LUMA
        case 0b10:
          requirePrevPixel("QOI_OP_LUMA");
          opLuma(tag, prevPixel!);
          break;

        // QOI_OP_RUN
        case 0b11:
          requirePrevPixel("QOI_OP_RUN");
          opRun(tag, prevPixel!);
          break;
      }
    }
  }

  async open() {
    const contents = await readFile("assets/testcard.qoi");

    let header = this.parseHeader(contents);
    if (!header) return false;

    this.parsePixels(header, contents);

    return true;
  }
}

const parser = new QoiParser();
parser.open();
