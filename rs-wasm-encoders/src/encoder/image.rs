use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Image {
    width: usize,
    height: usize,
    pixels: Vec<u8>,
}

impl Image {
    pub fn pixels(&self) -> &Vec<u8> {
        &self.pixels
    }
}

#[wasm_bindgen]
impl Image {
    pub fn new(width: usize, height: usize) -> Image {
        Image {
            width,
            height,
            pixels: Vec::with_capacity(width * height * 4),
        }
    }

    pub fn width(&self) -> usize {
        self.width
    }

    pub fn height(&self) -> usize {
        self.height
    }

    pub fn buffer(&self) -> *const u8 {
        self.pixels.as_ptr()
    }
}

pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

pub trait ImageFormat<'a> {
    fn format_name() -> &'static str;
    fn get_raw_image(&self) -> &'a Image;
}

pub trait ImageCodec<'a>: ImageFormat<'a> {
    fn serialize(&self) -> Result<Vec<u8>>;

    /*
    fn save(&self, path: &std::path::Path) -> Result<()> {
        let contents = self.serialize()?;
        std::fs::write(path, contents)?;
        Ok(())
    }
    */
}
