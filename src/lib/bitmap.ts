export class Bitmap {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;

  public constructor(width: number, height: number, pixels: Uint8ClampedArray) {
    this.width = width;
    this.height = height;
    this.pixels = pixels;
  }
}
