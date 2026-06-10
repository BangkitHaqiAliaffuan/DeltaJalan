package com.jalankita.capacitor.exifgps;

import android.Manifest;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import androidx.exifinterface.media.ExifInterface;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.io.InputStream;

@CapacitorPlugin(
    name = "PhotoExifGps",
    permissions = {
      @Permission(
          alias = "accessMediaLocation",
          strings = { Manifest.permission.ACCESS_MEDIA_LOCATION })
    })
public class PhotoExifGpsPlugin extends Plugin {

  @PluginMethod
  public void pickPhotos(PluginCall call) {
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
      if (singleUri != null) {
        photos.put(extractGps(singleUri));
      } else {
        ClipData clipData = data.getClipData();
        if (clipData != null) {
          int count = Math.min(clipData.getItemCount(), limit);
          for (int i = 0; i < count; i++) {
            Uri uri = clipData.getItemAt(i).getUri();
            photos.put(extractGps(uri));
          }
        }
      }

      JSObject ret = new JSObject();
      ret.put("photos", photos);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("Gagal memproses foto: " + e.getLocalizedMessage());
    }
  }

  private JSObject extractGps(Uri uri) {
    JSObject photo = new JSObject();
    photo.put("uri", uri.toString());
    photo.put("name", getFileName(uri));
    photo.put("lat", JSObject.NULL);
    photo.put("lng", JSObject.NULL);

    try {
      Uri originalUri = uri;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        originalUri = MediaStore.setRequireOriginal(uri);
      }

      InputStream stream =
          getContext().getContentResolver().openInputStream(originalUri);
      if (stream != null) {
        ExifInterface exif = new ExifInterface(stream);
        float[] latLong = new float[2];
        if (exif.getLatLong(latLong)) {
          photo.put("lat", (double) latLong[0]);
          photo.put("lng", (double) latLong[1]);
        }
        stream.close();
      }
    } catch (SecurityException e) {
      // ACCESS_MEDIA_LOCATION tidak diberikan — koordinat tetap null
    } catch (Exception e) {
      // File corrupt atau format tidak didukung — skip
    }

    return photo;
  }

  private String getFileName(Uri uri) {
    String name = "foto";
    try (android.database.Cursor cursor =
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
