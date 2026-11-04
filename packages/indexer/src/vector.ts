export function encodeFloat32(values: ArrayLike<number>): Uint8Array {
  const floats = new Float32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`embedding[${index}] must be a finite number`);
    }
    floats[index] = value;
  }
  return new Uint8Array(floats.buffer.slice(0));
}

export function decodeFloat32(blob: Uint8Array): number[] {
  const copy = Uint8Array.from(blob);
  const length = Math.floor(copy.byteLength / 4);
  const floats = new Float32Array(copy.buffer, copy.byteOffset, length);
  return Array.from(floats);
}
