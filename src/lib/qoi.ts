import { readFile } from "fs/promises";

async function parseHeader() {
  const contents = await readFile(
    "/Users/alessandroasm/Downloads/qoi_test_images/testcard.qoi"
  );

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
  return { width, height, channels, colorspace };
}

parseHeader();
