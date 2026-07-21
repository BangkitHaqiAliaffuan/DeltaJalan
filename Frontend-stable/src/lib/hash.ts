export async function computeFileHash(file: File): Promise<string> {
  try {
    const sample = file.size > 102400 ? file.slice(0, 1024) : file;
    const buffer = await sample.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${file.name}|${file.size}|${file.lastModified}`;
  }
}
