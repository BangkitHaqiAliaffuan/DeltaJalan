export interface PhotoExifResult {
  uri: string;
  name: string;
  lat: number | null;
  lng: number | null;
}

export interface PickPhotosOptions {
  limit?: number;
}

export interface PermissionState {
  accessMediaLocation: 'granted' | 'denied' | 'prompt';
}

export interface PhotoExifGpsPlugin {
  pickPhotos(options?: PickPhotosOptions): Promise<{ photos: PhotoExifResult[] }>;
  requestPermissions(): Promise<PermissionState>;
  checkPermissions(): Promise<PermissionState>;
}
