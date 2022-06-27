import React, { ChangeEventHandler, useEffect, useState } from "react";
import logo from "./logo.svg";
import "./App.css";

import { ImageCanvas } from "./components/imageCanvas";

function App() {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);

  useEffect(() => {
    const img = new Image();
    img.src = "logo192.png";
    img.onload = () => {
      setImage(img);
    };
  }, []);

  const fileSelected: ChangeEventHandler<HTMLInputElement> = async (e) => {
    console.log(e);
    if (e.target.files?.length === 0) return;
    const file = e.target.files![0];
    const buffer = await file.arrayBuffer();
    const bufferView = new Uint8Array(buffer);

    console.log(buffer);
    debugger;
  };

  return (
    <div className="App">
      <header className="App-header">
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        {image && <ImageCanvas image={image} />}
        <input type="file" onChange={fileSelected} />
      </header>
    </div>
  );
}

export default App;
