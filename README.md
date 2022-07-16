# Simple QOI image viewer

This project implements decoding and encoding of [QOI images](https://qoiformat.org/).

## Implementation details

The decoder is written in Typescript, while the encoder is written in Rust (WASM).

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

### `yarn build-wasm`

This operation builds and upgrades the Rust encoder.
