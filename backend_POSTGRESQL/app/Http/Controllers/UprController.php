<?php

namespace App\Http\Controllers;

use App\Models\Upr;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UprController extends Controller
{
    /**
     * GET /api/uprs
     * Daftar UPR dengan search, filter, dan pagination untuk admin.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role, ['supervisor', 'petugas_eksekusi', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        $query = Upr::query();

        if ($request->filled('q')) {
            $q = $request->input('q');
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'ilike', "%{$q}%")
                     ->orWhere('wilayah', 'ilike', "%{$q}%")
                     ->orWhere('leader_name', 'ilike', "%{$q}%");
            });
        }

        // Default: hanya aktif — backward compat dengan dropdown report form
        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        } else {
            $query->where('is_active', true);
        }

        $limit = min((int) $request->input('limit', 50), 100);
        $page  = max(1, (int) $request->input('page', 1));

        $total = (clone $query)->count();

        $uprs = $query->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get()
            ->map(fn ($u) => [
                'id'          => $u->id,
                'name'        => $u->name,
                'wilayah'     => $u->wilayah,
                'leader_name' => $u->leader_name,
                'phone'       => $u->phone,
                'is_active'   => $u->is_active,
                'anggota'     => $u->anggota_count ?? 0,
                'created_at'  => $u->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'success'   => true,
            'data'      => $uprs,
            'total'     => $total,
            'page'      => $page,
            'last_page' => max(1, (int) ceil($total / $limit)),
        ]);
    }

    /**
     * POST /api/uprs
     * Tambah UPR baru.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Hanya supervisor yang dapat menambah UPR.'], 403);
        }

        try {
            $validated = $request->validate([
                'name'        => ['required', 'string', 'max:100'],
                'wilayah'     => ['nullable', 'string', 'max:100'],
                'leader_name' => ['nullable', 'string', 'max:100'],
                'phone'       => ['nullable', 'string', 'max:20'],
                'is_active'   => ['nullable', 'boolean'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors'  => $e->errors(),
            ], 422);
        }

        $upr = Upr::create([
            'name'        => $validated['name'],
            'wilayah'     => $validated['wilayah'] ?? null,
            'leader_name' => $validated['leader_name'] ?? null,
            'phone'       => $validated['phone'] ?? null,
            'is_active'   => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'UPR berhasil ditambahkan.',
            'data'    => [
                'id'          => $upr->id,
                'name'        => $upr->name,
                'wilayah'     => $upr->wilayah,
                'leader_name' => $upr->leader_name,
                'phone'       => $upr->phone,
                'is_active'   => $upr->is_active,
            ],
        ], 201);
    }

    /**
     * GET /api/uprs/{id}
     * Detail satu UPR.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role, ['supervisor', 'petugas_eksekusi', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        $upr = Upr::find($id);

        if (!$upr) {
            return response()->json(['success' => false, 'message' => 'UPR tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'id'          => $upr->id,
                'name'        => $upr->name,
                'wilayah'     => $upr->wilayah,
                'leader_name' => $upr->leader_name,
                'phone'       => $upr->phone,
                'is_active'   => $upr->is_active,
                'created_at'  => $upr->created_at?->toIso8601String(),
                'updated_at'  => $upr->updated_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * PUT /api/uprs/{id}
     * Update data UPR.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Hanya supervisor yang dapat mengubah UPR.'], 403);
        }

        $upr = Upr::find($id);

        if (!$upr) {
            return response()->json(['success' => false, 'message' => 'UPR tidak ditemukan.'], 404);
        }

        try {
            $validated = $request->validate([
                'name'        => ['sometimes', 'required', 'string', 'max:100'],
                'wilayah'     => ['nullable', 'string', 'max:100'],
                'leader_name' => ['nullable', 'string', 'max:100'],
                'phone'       => ['nullable', 'string', 'max:20'],
                'is_active'   => ['nullable', 'boolean'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors'  => $e->errors(),
            ], 422);
        }

        $upr->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'UPR berhasil diperbarui.',
            'data'    => [
                'id'          => $upr->id,
                'name'        => $upr->name,
                'wilayah'     => $upr->wilayah,
                'leader_name' => $upr->leader_name,
                'phone'       => $upr->phone,
                'is_active'   => $upr->is_active,
            ],
        ]);
    }

    /**
     * DELETE /api/uprs/{id}
     * Hapus UPR — toggle is_active ke false atau hard delete jika tidak memiliki relasi.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Hanya supervisor yang dapat menghapus UPR.'], 403);
        }

        $upr = Upr::find($id);

        if (!$upr) {
            return response()->json(['success' => false, 'message' => 'UPR tidak ditemukan.'], 404);
        }

        $upr->update(['is_active' => false]);

        return response()->json([
            'success' => true,
            'message' => 'UPR berhasil dinonaktifkan.',
        ]);
    }
}
