import React, { ChangeEventHandler, useEffect, useState } from "react";
import logo from "./logo.svg";
import "./App.css";

import { ImageCanvas } from "./components/imageCanvas";
import { QoiParser } from "./lib/qoi";
import { Bitmap } from "./lib/bitmap";

function App() {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  const [bitmap, setBitmap] = useState<Bitmap | undefined>(undefined);

  // useEffect(() => {
  //   const img = new Image();
  //   img.src = "logo192.png";
  //   img.onload = () => {
  //     setImage(img);
  //   };
  // }, []);

  const fileSelected: ChangeEventHandler<HTMLInputElement> = async (e) => {
    if (e.target.files?.length === 0) return;
    const file = e.target.files![0];

    if (/\.qoi$/i.test(file.name)) {
      setImage(undefined);
      const buffer = await file.arrayBuffer();
      const bufferView = new Uint8Array(buffer);

      const qoi = new QoiParser();
      let bitmap = qoi.parse(Uint8ClampedArray.from(bufferView));
      if (bitmap) setBitmap(bitmap);
    } else {
      setBitmap(undefined);
      const blob = new Blob([file]);
      const reader = new FileReader();
      reader.onload = (e) => {
        const image = new Image();
        image.onload = () => setImage(image);
        if (e.target?.result) image.src = e.target?.result as string;
      };
      reader.readAsDataURL(blob);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        {image && <ImageCanvas image={image} />}
        {bitmap && <ImageCanvas bitmap={bitmap} />}
        <input type="file" onChange={fileSelected} />
      </header>
    </div>
  );
}

export default App;
