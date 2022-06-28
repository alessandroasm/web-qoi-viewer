import { useState } from "react";
import "./App.css";

import { ImageCanvas } from "./components/imageCanvas";
import { Bitmap } from "./lib/bitmap";
import { ImageSelector } from "./components/imageSelector";

function App() {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  const [bitmap, setBitmap] = useState<Bitmap | undefined>(undefined);

  return (
    <div className="App">
      <header className="App-header">
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <ImageCanvas image={image} bitmap={bitmap} />

        <ImageSelector
          onImageSelected={(img) => {
            setBitmap(undefined);
            setImage(img);
          }}
          onBitmapSelected={(bmp) => {
            setImage(undefined);
            setBitmap(bmp);
          }}
        />
      </header>
    </div>
  );
}

export default App;
