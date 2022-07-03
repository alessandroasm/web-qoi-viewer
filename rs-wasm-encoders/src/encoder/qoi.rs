use super::image::{Image, ImageCodec, ImageFormat, Result};
use bytes::{BufMut, BytesMut};

#[derive(Copy, Clone, Debug, PartialEq)]
struct QoiPixel {
    r: u8,
    g: u8,
    b: u8,
    a: u8,
}

const QOI_OP_RGB: u8 = 0b11111110;
//const QOI_OP_RGBA: u8 = 0b11111111;
const QOI_OP_INDEX: u8 = 0b00000000;
const QOI_OP_DIFF: u8 = 0b01000000;
const QOI_OP_LUMA: u8 = 0b10000000;
const QOI_OP_RUN: u8 = 0b11000000;

enum QoiOp {
    Rgb,
    //Rgba,
    Index,
    Diff,
    Luma,
    Run,
}

pub struct Qoi<'a> {
    image: &'a Image,
}
impl<'a> Qoi<'a> {
    pub fn from_image(image: &'a Image) -> Qoi<'a> {
        Qoi { image }
    }

    fn qoi_header(&self, contents: &mut BytesMut) {
        //  char magic[4]; // magic bytes "qoif"
        contents.put(&b"qoif"[..]);
        //  uint32_t width; // image width in pixels (BE)
        contents.put_u32(self.image.width() as u32);
        //  uint32_t height; // image height in pixels (BE)
        contents.put_u32(self.image.height() as u32);
        //  uint8_t channels; // 3 = RGB, 4 = RGBA
        contents.put_u8(3);
        //  uint8_t colorspace; // 0 = sRGB with linear alpha
        //  // 1 = all channels linear
        contents.put_u8(1);
    }

    fn encode_op_index(
        contents: &mut BytesMut,
        pixel: &QoiPixel,
        prev_array: &[QoiPixel; 64],
        pixel_idx: usize,
    ) -> bool {
        if pixel == &prev_array[pixel_idx] {
            contents.put_u8(QOI_OP_INDEX | pixel_idx as u8);
            true
        } else {
            false
        }
    }

    fn encode_op_diff(contents: &mut BytesMut, pixel: &QoiPixel, prev_pixel: &QoiPixel) -> bool {
        use std::num::Wrapping;

        let cdiff = |cur: u8, prev: u8| {
            let d = Wrapping(cur as i8) - Wrapping(prev as i8) + Wrapping(2);

            match d.0 {
                0..=3 => Some(d.0 as u8),
                _ => None,
            }
        };

        let rd = cdiff(pixel.r, prev_pixel.r);
        let rg = cdiff(pixel.g, prev_pixel.g);
        let rb = cdiff(pixel.b, prev_pixel.b);

        if let (Some(rd), Some(gd), Some(bd)) = (rd, rg, rb) {
            contents.put_u8(QOI_OP_DIFF | (rd << 4) | (gd << 2) | bd);
            return true;
        }

        false
    }

    fn encode_op_luma(contents: &mut BytesMut, pixel: &QoiPixel, prev_pixel: &QoiPixel) -> bool {
        use std::num::Wrapping;

        let green_diff = Wrapping(pixel.g as i8) - Wrapping(prev_pixel.g as i8);
        if (-32..=31).contains(&green_diff.0) {
            let rdiff =
                Wrapping(pixel.r as i8) - Wrapping(prev_pixel.r as i8) - green_diff + Wrapping(8i8);
            let bdiff =
                Wrapping(pixel.b as i8) - Wrapping(prev_pixel.b as i8) - green_diff + Wrapping(8i8);
            let range = 0..16;

            if range.contains(&rdiff.0) && range.contains(&bdiff.0) {
                contents.put_u8(QOI_OP_LUMA | (green_diff.0 + 32) as u8);
                contents.put_u8((rdiff.0 as u8) << 4 | bdiff.0 as u8);
                return true;
            }
        }

        false
    }

    fn encode_op_run(
        contents: &mut BytesMut,
        pixel: &QoiPixel,
        prev_pixel: &QoiPixel,
        prev_pixel_run_cnt: &mut u8,
    ) -> bool {
        if (pixel != prev_pixel || *prev_pixel_run_cnt >= 62) && *prev_pixel_run_cnt > 0 {
            contents.put_u8(QOI_OP_RUN | (*prev_pixel_run_cnt - 1));
            *prev_pixel_run_cnt = 0;
        }

        if pixel == prev_pixel {
            *prev_pixel_run_cnt += 1;
            return true;
        }

        false
    }

    fn encode_op_run_final(contents: &mut BytesMut, prev_pixel_run_cnt: &mut u8) {
        if *prev_pixel_run_cnt > 0 {
            contents.put_u8(QOI_OP_RUN | *prev_pixel_run_cnt);
            *prev_pixel_run_cnt = 0;
        }
    }

    fn encode_op_rgb(contents: &mut BytesMut, pixel: &QoiPixel) -> bool {
        contents.put_u8(QOI_OP_RGB);
        contents.put_u8(pixel.r);
        contents.put_u8(pixel.g);
        contents.put_u8(pixel.b);

        true
    }

    fn qoi_encode(&self, contents: &mut BytesMut) {
        let mut prev_array = [QoiPixel {
            r: 0,
            g: 0,
            b: 0,
            a: 0,
        }; 64];

        let index_position = |pixel: &QoiPixel| {
            ((pixel.r as u32 * 3 + pixel.g as u32 * 5 + pixel.b as u32 * 7 + pixel.a as u32 * 11)
                % 64) as usize
        };

        let mut i = 0;
        let pixel_buffer = &self.image.pixels();
        let mut prev_pixel_ref: Option<QoiPixel> = None;
        let ops = [
            QoiOp::Run,
            QoiOp::Index,
            QoiOp::Diff,
            QoiOp::Luma,
            QoiOp::Rgb,
        ];
        let mut prev_pixel_run_cnt = 0u8;

        while i < pixel_buffer.len() {
            let r = pixel_buffer[i];
            let g = pixel_buffer[i + 1];
            let b = pixel_buffer[i + 2];

            let pixel = QoiPixel { r, g, b, a: 255 };
            let pixel_idx = index_position(&pixel);

            for op in ops.iter() {
                match *op {
                    QoiOp::Run => {
                        if let Some(prev_pixel) = prev_pixel_ref {
                            if Qoi::encode_op_run(
                                contents,
                                &pixel,
                                &prev_pixel,
                                &mut prev_pixel_run_cnt,
                            ) {
                                break;
                            }
                        }
                    }
                    QoiOp::Index => {
                        if Qoi::encode_op_index(contents, &pixel, &prev_array, pixel_idx) {
                            break;
                        }
                    }
                    QoiOp::Diff => {
                        if let Some(prev_pixel) = prev_pixel_ref {
                            if Qoi::encode_op_diff(contents, &pixel, &prev_pixel) {
                                break;
                            }
                        }
                    }
                    QoiOp::Luma => {
                        if let Some(prev_pixel) = prev_pixel_ref {
                            if Qoi::encode_op_luma(contents, &pixel, &prev_pixel) {
                                break;
                            }
                        }
                    }
                    QoiOp::Rgb => {
                        if Qoi::encode_op_rgb(contents, &pixel) {
                            break;
                        }
                    } // _ => {
                      //     panic!("QOI operation not implemented!");
                      // }
                }
            }

            prev_array[pixel_idx] = pixel;
            prev_pixel_ref = Some(pixel);
            i += 3;
        }

        Qoi::encode_op_run_final(contents, &mut prev_pixel_run_cnt);

        // QOI_OP_STREAM_END
        for _i in 0..7 {
            contents.put_u8(0);
        }
        contents.put_u8(1);
    }
}

impl<'a> ImageFormat<'a> for Qoi<'a> {
    fn format_name() -> &'static str {
        "Qoi"
    }

    fn get_raw_image(&self) -> &'a Image {
        self.image
    }
}

impl<'a> ImageCodec<'a> for Qoi<'a> {
    fn serialize(&self) -> Result<Vec<u8>> {
        let mut contents = BytesMut::with_capacity(1024);
        self.qoi_header(&mut contents);
        self.qoi_encode(&mut contents);

        let c: Vec<u8> = Vec::from(contents.as_ref());
        Ok(c)
    }
}
