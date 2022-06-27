import { useEffect, useRef } from "react";
import { Bitmap } from "../lib/bitmap";

interface ImageCanvasProps {
  bitmap?: Bitmap;
  image?: CanvasImageSource;
}

export function ImageCanvas(props: ImageCanvasProps) {
  const canvasEl = useRef<HTMLCanvasElement>(null);

  const { image, bitmap } = props;
  const width =
    typeof image?.width === "number" ? image.width : bitmap?.width || 100;
  const height =
    typeof image?.height === "number" ? image.height : bitmap?.height || 100;

  useEffect(() => {
    const ctx = canvasEl.current?.getContext("2d");
    if (!ctx) return;

    if (image) ctx.drawImage(image, 0, 0);
  }, []);

  return (
    <canvas
      ref={canvasEl}
      className="image-canvas"
      width={width}
      height={height}
    />
  );
}
