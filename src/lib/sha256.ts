/** Lowercase hex SHA-256 of bytes (WebCrypto). */
export async function sha256Hex(data: ArrayBuffer | Uint8Array | Blob): Promise<string> {
  const buf =
    data instanceof Blob ? await data.arrayBuffer() : data instanceof Uint8Array ? data : new Uint8Array(data)
  const digest = await crypto.subtle.digest('SHA-256', buf as BufferSource)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
