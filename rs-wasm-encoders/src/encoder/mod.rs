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

#[wasm_bindgen]
pub fn encode_qoi_simple(width: usize, height: usize, pixels: &[u8]) -> Vec<u8> {
    let img = image::Image::new_with_data(width, height, pixels);
    let qoi = qoi::Qoi::from_image(&img);
    let bytes = qoi.serialize().unwrap();
    bytes
}
