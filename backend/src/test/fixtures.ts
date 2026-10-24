// Tiny buffers that start with real magic bytes. The server only sniffs the signature, so they
// do not need to decode as full images.
export const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==",
  "base64",
);

export const jpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  Buffer.from("JFIF\0", "latin1"),
  Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
  Buffer.alloc(64, 0x11),
  Buffer.from([0xff, 0xd9]),
]);

export const webp = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.from([0x30, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 ", "latin1"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.alloc(36, 0x22),
]);

export const textFile = Buffer.from("this is not an image, whatever the header claims");

// Valid PNG signature followed by padding, to exceed the size limit while still looking like a PNG.
export const oversizePng = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024 + 1)]);
