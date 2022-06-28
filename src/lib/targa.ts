import { Bitmap } from "./bitmap";

type TargaHeader = {
  idLength: number;
  colorMapType: number;
  dataTypeCode: TargaDataType;
  colorMapOrigin: number;
  colorMapLength: number;
  colorMapDepth: number;
  xOrigin: number;
  yOrigin: number;
  width: number;
  height: number;
  bitsPerPixel: number;
  imageDescriptor: number;
  headerSize: number;
};

type TargaPixel = {
  r: number;
  g: number;
  b: number;
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
function uintArrayReadInt16LE<T extends Uint8ClampedArray | Uint8Array>(
  array: T,
  offset: number
) {
  return array[offset] | (array[offset + 1] << 8);
}

class ArrayView<T extends Uint8ClampedArray | Uint8Array> {
  readonly data: T;
  offset: number;

  constructor(data: T, offset: number = 0) {
    this.data = data;
    this.offset = offset;
  }

  getByte() {
    if (this.offset < this.data.length) return this.data[this.offset++];
    throw new Error("Out of bounds");
  }
}

enum TargaDataType {
  NoImage = 0,
  ColorMapped = 1,
  Rgb = 2,
  BlackAndWhite = 3,
  ColorMappedRLE = 9,
  RgbRLE = 10,
  BlackAndWhiteCompressed = 11,
}

export class TargaParser {
  private parseHeader(contents: Uint8ClampedArray): TargaHeader | null {
    const idLength = contents[0];
    const colorMapType = contents[1];
    const dataTypeCode = contents[2] as TargaDataType;
    const colorMapOrigin = uintArrayReadInt16LE(contents, 3);
    const colorMapLength = uintArrayReadInt16LE(contents, 5);
    const colorMapDepth = contents[7];
    const xOrigin = uintArrayReadInt16LE(contents, 8);
    const yOrigin = uintArrayReadInt16LE(contents, 10);
    const width = uintArrayReadInt16LE(contents, 12);
    const height = uintArrayReadInt16LE(contents, 14);
    const bitsPerPixel = contents[16];
    const imageDescriptor = contents[17];

    const isValid =
      [0, 1, 2, 3, 9, 10, 11].includes(colorMapType) &&
      [15, 16, 24, 32].includes(bitsPerPixel);

    return isValid
      ? {
          idLength,
          colorMapType,
          dataTypeCode,
          colorMapOrigin,
          colorMapLength,
          colorMapDepth,
          xOrigin,
          yOrigin,
          width,
          height,
          bitsPerPixel,
          imageDescriptor,
          headerSize: 18,
        }
      : null;
  }

  private parsePixels(
    header: TargaHeader,
    dataView: ArrayView<Uint8ClampedArray>
  ) {
    const rleEncoded = [
      TargaDataType.ColorMappedRLE,
      TargaDataType.RgbRLE,
    ].includes(header.dataTypeCode);

    // Data
    const pixelCnt = header.width * header.height;
    const pixels = new Uint8ClampedArray(new ArrayBuffer(pixelCnt * 4));

    const decode4BytePixel = (): TargaPixel => {
      const r = dataView.getByte();
      const g = dataView.getByte();
      const b = dataView.getByte();
      const attr = dataView.getByte();

      return { r, g, b };
    };
    const decode3BytePixel = (): TargaPixel => {
      const r = dataView.getByte();
      const g = dataView.getByte();
      const b = dataView.getByte();

      return { r, g, b };
    };
    const decode2BytePixel = (): TargaPixel => {
      const b1 = dataView.getByte();
      const b0 = dataView.getByte();

      // Must fix range
      const r = (b0 >> 2) & 0b00011111;
      const g = ((b0 << 3) | (b1 >> 5)) & 0b00011111;
      const b = b1 & 0b00011111;

      return { r, g, b };
    };

    const decode =
      header.bitsPerPixel === 32
        ? decode4BytePixel
        : header.bitsPerPixel === 24
        ? decode3BytePixel
        : decode2BytePixel;

    const rleState = {
      runLength: false,
      counter: 0,
      pixel: { r: 0, g: 0, b: 0 } as TargaPixel,
    };
    const nextPixel = () => {
      if (!rleEncoded) return decode();

      if (rleState.counter === 0) {
        const rleOp = dataView.getByte();
        rleState.runLength = !!(rleOp & 0x80);
        rleState.counter = (rleOp & 0x7f) + 1;

        if (rleState.runLength) rleState.pixel = decode();
      }

      if (rleState.counter > 0) {
        rleState.counter--;

        if (rleState.runLength) {
          return rleState.pixel;
        }
      }

      return decode();
    };

    const flipVertically = header.imageDescriptor & 0b1000;
    for (let j = 0; j < header.height; j++) {
      let idx = (flipVertically ? header.height - j - 1 : j) * header.width * 4;
      for (let i = 0; i < header.width; i++) {
        let pixel = nextPixel();
        pixels[idx++] = pixel.r;
        pixels[idx++] = pixel.g;
        pixels[idx++] = pixel.b;
        pixels[idx++] = 255;
      }
    }

    return pixels;
  }

  parse(buffer: Uint8ClampedArray): Bitmap | null {
    const header = this.parseHeader(buffer);
    if (!header || header.dataTypeCode === TargaDataType.NoImage) return null;

    console.log("header might include id field", header);

    // Parsing data
    const dataView = new ArrayView(buffer, header.headerSize);

    // Parse color map

    // Parse pixels
    const pixels = this.parsePixels(header, dataView);
    return new Bitmap(header.width, header.height, pixels);
  }
}
