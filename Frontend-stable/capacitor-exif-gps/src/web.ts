import type { PhotoExifGpsPlugin, PhotoExifResult, PermissionState } from "./definitions";

export class PhotoExifGpsWeb implements PhotoExifGpsPlugin {
  async pickPhotos(_options?: { limit?: number }): Promise<{ photos: PhotoExifResult[] }> {
    const photos: PhotoExifResult[] = [];
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/jpg,text/plain";
    input.multiple = true;

    const files = await new Promise<FileList | null>((resolve) => {
      input.onchange = () => resolve(input.files);
      input.click();
    });

    if (!files) return { photos };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uri = URL.createObjectURL(file);
      photos.push({ uri, name: file.name, lat: null, lng: null });
    }

    return { photos };
  }

  async requestPermissions(): Promise<PermissionState> {
    return { accessMediaLocation: "prompt" };
  }

  async checkPermissions(): Promise<PermissionState> {
    return { accessMediaLocation: "prompt" };
  }
}
