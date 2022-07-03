pub mod image;
mod qoi;
mod targa;

use self::image::ImageCodec;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn encode_image(img: &image::Image) -> Vec<u8> {
    let qoi = qoi::Qoi::from_image(img);
    let bytes = qoi.serialize().unwrap();
    bytes
}
