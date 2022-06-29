import { ChangeEventHandler, DragEventHandler, useRef } from "react";
import { Bitmap } from "../lib/bitmap";
import { QoiParser } from "../lib/qoi";
import { TargaParser } from "../lib/targa";

interface ImageSelectorOptions {
  onImageSelected?: (image: HTMLImageElement) => void;
  onBitmapSelected?: (bitmap: Bitmap) => void;
}

export function ImageSelector(options: ImageSelectorOptions) {
  const inputRef = useRef<HTMLInputElement>(null);

  const processFileList = async (fileList: FileList) => {
    if (fileList.length === 0) return;

    const file = fileList[0];
    if (/\.qoi$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      const bufferView = new Uint8Array(buffer);

      if (options.onBitmapSelected) {
        const qoi = new QoiParser();
        let bitmap = qoi.parse(Uint8ClampedArray.from(bufferView));
        if (bitmap) options.onBitmapSelected(bitmap);
      }
    } else if (/\.(tga|vda|icb|vst)$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      const bufferView = new Uint8Array(buffer);

      if (options.onBitmapSelected) {
        const targa = new TargaParser();
        let bitmap = targa.parse(Uint8ClampedArray.from(bufferView));
        if (bitmap) options.onBitmapSelected(bitmap);
      }
    } else {
      if (!options.onImageSelected) return;

      const blob = new Blob([file]);
      const reader = new FileReader();
      reader.onload = (e) => {
        const image = new Image();
        image.onload = () => options.onImageSelected!(image);
        if (e.target?.result) image.src = e.target?.result as string;
      };
      reader.readAsDataURL(blob);
    }
  };

  const fileSelected: ChangeEventHandler<HTMLInputElement> = async (e) => {
    if (e.target.files) {
      processFileList(e.target.files);
    }
  };

  const openFileSelect = () => {
    inputRef.current?.click();
  };

  const fileDrop: DragEventHandler<HTMLDivElement> = async (e) => {
    processFileList(e.dataTransfer.files);
    e.preventDefault();
    e.stopPropagation();
  };

  const dragOverHighlight: DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const dragOutHighlight: DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="image-selector">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.qoi,.tga,.vda,.icb,.vst"
        onChange={fileSelected}
      />
      <div
        className="image-selector-droparea"
        onClick={openFileSelect}
        onDrop={fileDrop}
        onDragEnter={dragOverHighlight}
        onDragLeave={dragOutHighlight}
        onDragOver={dragOverHighlight}
      >
        <div>Click here to open a file</div>
      </div>
    </div>
  );
}
