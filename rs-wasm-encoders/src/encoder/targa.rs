use super::image::{Image, ImageCodec, ImageFormat, Result};
use bytes::{BufMut, BytesMut};

pub struct Targa<'a> {
    image: &'a Image,
}
impl<'a> Targa<'a> {
    pub fn from_image(image: &'a Image) -> Targa<'a> {
        Targa { image }
    }

    fn targa_header(&self, contents: &mut BytesMut) {
        // 1	1 byte	ID length	Length of the image ID field
        contents.put_u8(0);
        // 2	1 byte	Color map type	Whether a color map is included
        contents.put_u8(0);
        // 3	1 byte	Image type	Compression and color types
        contents.put_u8(2);
        // 4	5 bytes	Color map specification	Describes the color map
        contents.put_bytes(0, 5);
        // 5	10 bytes	Image specification	Image dimensions and format
        contents.put_bytes(0, 2); // x coord
        contents.put_bytes(0, 2); // y coord
        contents.put_u16_le(self.image.width() as u16);
        contents.put_u16_le(self.image.height() as u16);
        contents.put_u8(24); // bit per pixel
        contents.put_u8(32); // image desc
    }
}

impl<'a> ImageFormat<'a> for Targa<'a> {
    fn format_name() -> &'static str {
        "Targa"
    }

    fn get_raw_image(&self) -> &'a Image {
        self.image
    }
}

/*
impl<'a> ImageCodec<'a> for Targa<'a> {
    fn serialize(&self) -> Result<Vec<u8>> {
        let mut contents = BytesMut::with_capacity(1024);
        self.targa_header(&mut contents);
        contents.put(*self.image.pixels());

        let c: Vec<u8> = Vec::from(contents.as_ref());
        Ok(c)
    }
}
*/
