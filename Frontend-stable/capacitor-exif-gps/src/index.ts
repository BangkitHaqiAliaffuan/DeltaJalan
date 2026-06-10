import { registerPlugin } from '@capacitor/core';
import type { PhotoExifGpsPlugin } from './definitions';

const PhotoExifGps = registerPlugin<PhotoExifGpsPlugin>('PhotoExifGps', {
  web: () => import('./web').then((m) => new m.PhotoExifGpsWeb()),
});

export * from './definitions';
export { PhotoExifGps };
