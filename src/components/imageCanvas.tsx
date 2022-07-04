import { useEffect, useRef } from "react";
import { Bitmap } from "../lib/bitmap";
//import { Image } from "rs-wasm-encoders";
import initEncoder, {
  Image,
  encode_image,
  InitOutput,
  encode_qoi_simple,
} from "rs-wasm-encoders";
import { downloadBlob } from "../lib/utils";
//import { memory } from "rs-wasm-encoders/rs_wasm_encoders_bg";

interface ImageCanvasProps {
  bitmap?: Bitmap;
  image?: CanvasImageSource;
}

//type Unpromisify<T> = T extends Promise<infer U> ? U : T
//type InitOutput = Unpromisify<ReturnType<typeof initEncoder>>;

let initOutput: InitOutput;
initEncoder().then((output) => (initOutput = output));

let canvasCtx: CanvasRenderingContext2D;

export function ImageCanvas(props: ImageCanvasProps) {
  const canvasEl = useRef<HTMLCanvasElement>(null);

  const { image, bitmap } = props;
  const width =
    typeof image?.width === "number" ? image.width : bitmap?.width || 100;
  const height =
    typeof image?.height === "number" ? image.height : bitmap?.height || 100;

  useEffect(() => {
    const ctx = canvasCtx || canvasEl.current?.getContext("2d");
    if (!ctx) return;

    canvasCtx = ctx;

    if (image) ctx.drawImage(image, 0, 0);
    if (bitmap) {
      const imageData = new ImageData(
        bitmap.pixels,
        bitmap.width,
        bitmap.height
      );
      ctx.putImageData(imageData, 0, 0);
    }
  }, [image, bitmap]);

  const exportImage = () => {
    const canvas = canvasEl.current;
    //const ctx = canvas?.getContext("2d");
    const ctx = canvasCtx;
    if (!ctx) return;

    debugger;

    const width = canvas?.width as number;
    const height = canvas?.height as number;
    const imageData = ctx.getImageData(0, 0, width, height);
    // const imageRs = Image.new(width, height);

    // const rsBuffer = new Uint8ClampedArray(
    //   initOutput.memory.buffer,
    //   imageRs.buffer(),
    //   width * height * 4
    // );
    // rsBuffer.set(imageData.data);

    // const resultingImg = encode_image(imageRs);

    const resultingImg = encode_qoi_simple(
      width,
      height,
      imageData.data as any
    );

    console.log(resultingImg);

    downloadBlob(resultingImg, "image.qoi");
  };

  return (
    <div>
      <canvas
        ref={canvasEl}
        className="image-canvas"
        width={width}
        height={height}
      />
      <button onClick={exportImage}>Export</button>
    </div>
  );
}
