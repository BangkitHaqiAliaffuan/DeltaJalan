package com.jalankita.capacitor.exifgps;

import android.Manifest;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;
import java.io.InputStream;

@CapacitorPlugin(
    name = "PhotoExifGps",
    permissions = {
      @Permission(
          alias = "accessMediaLocation",
          strings = { Manifest.permission.ACCESS_MEDIA_LOCATION }),
      @Permission(
          alias = "readMediaImages",
          strings = { Manifest.permission.READ_MEDIA_IMAGES })
    })
public class PhotoExifGpsPlugin extends Plugin {

  @PluginMethod
  public void pickPhotos(PluginCall call) {
    android.util.Log.d("PhotoExifGps",
        "pickPhotos: accessMediaLocation=" + getPermissionState("accessMediaLocation")
        + " readMediaImages=" + getPermissionState("readMediaImages"));

    boolean locationGranted =
        getPermissionState("accessMediaLocation") == PermissionState.GRANTED;
    boolean imagesGranted =
        getPermissionState("readMediaImages") == PermissionState.GRANTED;

    if (locationGranted && imagesGranted) {
      doPickPhotos(call);
    } else {
      requestPermissionForAliases(
          new String[] { "accessMediaLocation", "readMediaImages" },
          call,
          "permissionCallback");
    }
  }

  @PermissionCallback
  public void permissionCallback(PluginCall call) {
    android.util.Log.d("PhotoExifGps",
        "permissionCallback fired:"
        + " accessMediaLocation=" + getPermissionState("accessMediaLocation")
        + " readMediaImages=" + getPermissionState("readMediaImages"));
    doPickPhotos(call);
  }

  private void doPickPhotos(PluginCall call) {
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("image/*");
    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
    intent.putExtra(
        Intent.EXTRA_MIME_TYPES,
        new String[] { "image/jpeg", "image/png", "image/webp" });
    startActivityForResult(call, intent, "pickPhotosResult");
  }

  @ActivityCallback
  private void pickPhotosResult(PluginCall call, ActivityResult result) {
    if (call == null) return;

    if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
      call.reject("Pemilihan foto dibatalkan atau gagal");
      return;
    }

    Intent data = result.getData();
    JSArray photos = new JSArray();
    int limit = call.getInt("limit", 20);

    try {
      Uri singleUri = data.getData();
      ClipData clipData = data.getClipData();

      if (singleUri != null) {
        photos.put(extractGps(singleUri));
      }

      if (clipData != null) {
        int count = Math.min(clipData.getItemCount(), limit);
        for (int i = 0; i < count; i++) {
          Uri uri = clipData.getItemAt(i).getUri();
          if (uri.equals(singleUri)) continue;
          photos.put(extractGps(uri));
        }
      }

      JSObject ret = new JSObject();
      ret.put("photos", photos);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("Gagal memproses foto: " + e.getLocalizedMessage());
    }
  }

  private long extractMediaId(Uri uri) {
    if (uri == null) return -1;
    if (!"com.android.providers.media.documents".equals(uri.getAuthority())) {
      return -1;
    }
    try {
      String docId = DocumentsContract.getDocumentId(uri);
      String[] parts = docId.split(":");
      if (parts.length < 2 || !"image".equals(parts[0])) return -1;
      return Long.parseLong(parts[1]);
    } catch (Exception e) {
      android.util.Log.w("PhotoExifGps", "extractMediaId gagal: " + e.getMessage());
      return -1;
    }
  }

  private double[] queryMediaStoreGps(long mediaId) {
    if (mediaId < 0 || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null;

    String[] projection = {
        MediaStore.Images.Media._ID,
        MediaStore.Images.Media.LATITUDE,
        MediaStore.Images.Media.LONGITUDE
    };
    String selection = MediaStore.Images.Media._ID + " = ?";
    String[] args = { String.valueOf(mediaId) };

    try (Cursor cursor = getContext().getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection, selection, args, null)) {
      if (cursor != null && cursor.moveToFirst()) {
        double lat = cursor.getDouble(
            cursor.getColumnIndexOrThrow(MediaStore.Images.Media.LATITUDE));
        double lng = cursor.getDouble(
            cursor.getColumnIndexOrThrow(MediaStore.Images.Media.LONGITUDE));
        if (lat != 0.0 || lng != 0.0) {
          return new double[] { lat, lng };
        }
      }
    } catch (SecurityException e) {
      android.util.Log.w("PhotoExifGps",
          "SecurityException query MediaStore: " + e.getMessage());
    } catch (Exception e) {
      android.util.Log.w("PhotoExifGps",
          "Error query MediaStore: " + e.getMessage());
    }
    return null;
  }

  private JSObject extractGps(Uri uri) {
    JSObject photo = new JSObject();
    photo.put("uri", uri.toString());
    photo.put("name", getFileName(uri));
    photo.put("lat", JSObject.NULL);
    photo.put("lng", JSObject.NULL);

    double[] coords = null;

    // Attempt D: query MediaStore LATITUDE/LONGITUDE columns directly
    // This bypasses file-stream EXIF redaction entirely because MediaStore
    // populates these columns at indexing time, before any redaction.
    long mediaId = extractMediaId(uri);
    if (mediaId >= 0) {
      coords = queryMediaStoreGps(mediaId);
      if (coords != null) {
        android.util.Log.d("PhotoExifGps",
            "attempt D (MediaStore column query) succeeded for id=" + mediaId);
        setLatLng(photo, coords);
        return logAndReturn(photo, uri);
      }
    }

    // Attempt A: setRequireOriginal langsung pada DocumentsProvider URI
    coords = tryReadGps(uri, true);
    if (coords != null) {
      android.util.Log.d("PhotoExifGps", "attempt A (setRequireOriginal) succeeded");
      setLatLng(photo, coords);
      return logAndReturn(photo, uri);
    }

    // Attempt B: konversi ke MediaStore URI + setRequireOriginal
    Uri mediaUri = convertToMediaStoreUri(uri);
    if (mediaUri != null) {
      coords = tryReadGps(mediaUri, true);
      if (coords != null) {
        android.util.Log.d("PhotoExifGps",
            "attempt B (convert + setRequireOriginal) succeeded");
        setLatLng(photo, coords);
        return logAndReturn(photo, uri);
      }
    }

    // Attempt C: raw stream dari URI asli (tanpa setRequireOriginal)
    coords = tryReadGps(uri, false);
    if (coords != null) {
      android.util.Log.d("PhotoExifGps", "attempt C (raw stream) succeeded");
      setLatLng(photo, coords);
      return logAndReturn(photo, uri);
    }

    android.util.Log.w("PhotoExifGps", "all attempts failed for " + uri);
    return logAndReturn(photo, uri);
  }

  private double[] tryReadGps(Uri uri, boolean requireOriginal) {
    try {
      Uri target = uri;
      if (requireOriginal && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        target = MediaStore.setRequireOriginal(uri);
      }

      InputStream stream =
          getContext().getContentResolver().openInputStream(target);
      if (stream == null) return null;

      ExifInterface exif = new ExifInterface(stream);

      float[] latLong = new float[2];
      if (exif.getLatLong(latLong)) {
        stream.close();
        return new double[] { latLong[0], latLong[1] };
      }

      String latStr = exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE);
      String latRef = exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE_REF);
      String lngStr = exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE);
      String lngRef = exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF);
      android.util.Log.d("PhotoExifGps",
          "getLatLong=false requireOriginal=" + requireOriginal
          + " lat=" + latStr + " latRef=" + latRef
          + " lng=" + lngStr + " lngRef=" + lngRef);

      if (latStr != null && latRef != null && lngStr != null && lngRef != null) {
        Double lat = parseRational(latStr, latRef);
        Double lng = parseRational(lngStr, lngRef);
        if (lat != null && lng != null) {
          stream.close();
          return new double[] { lat, lng };
        }
      }

      stream.close();
    } catch (SecurityException e) {
      android.util.Log.w("PhotoExifGps",
          "SecurityException untuk " + uri + ": " + e.getMessage());
    } catch (Exception e) {
      android.util.Log.w("PhotoExifGps",
          "Gagal baca EXIF " + uri + ": " + e.getMessage());
    }
    return null;
  }

  private Uri convertToMediaStoreUri(Uri docUri) {
    if (docUri == null) return null;
    if (!"com.android.providers.media.documents".equals(docUri.getAuthority())) {
      return null;
    }
    try {
      String docId = DocumentsContract.getDocumentId(docUri);
      String[] parts = docId.split(":");
      if (parts.length < 2 || !"image".equals(parts[0])) return null;
      return Uri.withAppendedPath(
          MediaStore.Images.Media.EXTERNAL_CONTENT_URI, parts[1]);
    } catch (Exception e) {
      android.util.Log.w("PhotoExifGps",
          "convertToMediaStoreUri gagal: " + e.getMessage());
      return null;
    }
  }

  private void setLatLng(JSObject photo, double[] coords) {
    photo.put("lat", coords[0]);
    photo.put("lng", coords[1]);
  }

  private JSObject logAndReturn(JSObject photo, Uri uri) {
    try {
      android.util.Log.d("PhotoExifGps",
          "extractGps: uri=" + uri + " lat=" + photo.get("lat") + " lng=" + photo.get("lng"));
    } catch (org.json.JSONException e) {
      android.util.Log.w("PhotoExifGps", "Log error: " + e.getMessage());
    }
    return photo;
  }

  private Double parseRational(String rationalStr, String ref) {
    try {
      String[] parts = rationalStr.split(",");
      double degrees = parseFraction(parts[0]);
      double minutes = parts.length > 1 ? parseFraction(parts[1]) : 0;
      double seconds = parts.length > 2 ? parseFraction(parts[2]) : 0;
      double result = degrees + minutes / 60.0 + seconds / 3600.0;
      if ("S".equals(ref) || "W".equals(ref)) result = -result;
      return result;
    } catch (Exception e) {
      android.util.Log.w("PhotoExifGps",
          "parseRational gagal: " + rationalStr + " ref=" + ref);
      return null;
    }
  }

  private double parseFraction(String fraction) {
    String[] parts = fraction.split("/");
    double numerator = Double.parseDouble(parts[0]);
    double denominator = parts.length > 1 ? Double.parseDouble(parts[1]) : 1;
    return numerator / denominator;
  }

  private String getFileName(Uri uri) {
    String name = "foto";
    try (Cursor cursor =
        getContext()
            .getContentResolver()
            .query(uri, null, null, null, null)) {
      if (cursor != null && cursor.moveToFirst()) {
        int nameIndex =
            cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
        if (nameIndex >= 0) {
          String displayName = cursor.getString(nameIndex);
          if (displayName != null) name = displayName;
        }
      }
    } catch (Exception ignored) {
    }
    return name;
  }
}
