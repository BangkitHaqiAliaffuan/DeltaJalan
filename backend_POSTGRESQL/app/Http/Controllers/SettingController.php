<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SettingController extends Controller
{
    /**
     * GET /api/settings
     * Ambil semua pengaturan sistem.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'supervisor') {
            return response()->json(['success' => false, 'message' => 'Hanya supervisor yang dapat melihat pengaturan sistem.'], 403);
        }

        $settings = Setting::all()->map(fn ($s) => [
            'key'         => $s->key,
            'value'       => Setting::getValue($s->key),
            'type'        => $s->type,
            'description' => $s->description,
            'updated_at'  => $s->updated_at?->toIso8601String(),
        ]);

        return response()->json([
            'success' => true,
            'data'    => $settings,
        ]);
    }

    /**
     * PUT /api/settings
     * Update satu atau lebih pengaturan sistem.
     *
     * Body: { "settings": { "deadline_review": "48", "deadline_resolusi": "168" } }
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'supervisor') {
            return response()->json(['success' => false, 'message' => 'Hanya supervisor yang dapat mengubah pengaturan sistem.'], 403);
        }

        try {
            $validated = $request->validate([
                'settings' => ['required', 'array', 'min:1'],
                'settings.*' => ['required'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors'  => $e->errors(),
            ], 422);
        }

        $updated = [];

        foreach ($validated['settings'] as $key => $value) {
            $setting = Setting::where('key', $key)->first();

            if (!$setting) {
                continue;
            }

            $setting->update(['value' => (string) $value]);
            $updated[] = $key;
        }

        return response()->json([
            'success' => true,
            'message' => count($updated) . ' pengaturan berhasil diperbarui.',
            'data'    => [
                'updated' => $updated,
                'settings' => Setting::all()->map(fn ($s) => [
                    'key'         => $s->key,
                    'value'       => Setting::getValue($s->key),
                    'type'        => $s->type,
                    'description' => $s->description,
                ])->values(),
            ],
        ]);
    }
}
