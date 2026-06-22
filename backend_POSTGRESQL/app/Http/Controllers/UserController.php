<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    /**
     * GET /api/users
     * Daftar semua pengguna dengan pagination, filter role, dan search.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Hanya supervisor yang dapat melihat daftar pengguna.'], 403);
        }

        $query = User::query();

        if ($request->filled('role')) {
            $query->where('role', $request->input('role'));
        }

        if ($request->filled('q')) {
            $q = $request->input('q');
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'ilike', "%{$q}%")
                    ->orWhere('email', 'ilike', "%{$q}%")
                    ->orWhere('nip', 'ilike', "%{$q}%");
            });
        }

        if ($request->filled('upr_id')) {
            $query->where('upr_id', (int) $request->input('upr_id'));
        }

        if ($request->filled('team_id')) {
            if ($request->team_id === 'null') {
                $query->whereNull('team_id');
            } else {
                $query->where('team_id', $request->team_id);
            }
        }

        $limit = min((int) $request->input('limit', 50), 100);
        $page = max(1, (int) $request->input('page', 1));

        $total = (clone $query)->count();

        $users = $query->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->with(['upr', 'team'])
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'role_label' => $u->role_label,
                'wilayah' => $u->wilayah,
                'nip' => $u->nip,
                'upr_id' => $u->upr_id,
                'upr_name' => $u->upr?->name,
                'team_id' => $u->team_id,
                'team_name' => $u->team?->name,
                'initials' => $u->initials,
                'created_at' => $u->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'success' => true,
            'data' => $users,
            'total' => $total,
            'page' => $page,
            'last_page' => max(1, (int) ceil($total / $limit)),
        ]);
    }

    /**
     * POST /api/users
     * Tambah pengguna baru.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Hanya supervisor yang dapat menambah pengguna.'], 403);
        }

        try {
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255', Rule::unique('users')],
                'password' => ['required', 'string', 'min:8'],
                'role' => ['required', Rule::in(['petugas', 'supervisor', 'petugas_eksekusi', 'admin'])],
                'wilayah' => ['nullable', 'string', 'max:100'],
                'nip' => ['nullable', 'string', 'max:20'],
                'upr_id' => ['nullable', 'integer', 'exists:uprs,id'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'wilayah' => $validated['wilayah'] ?? null,
            'nip' => $validated['nip'] ?? null,
            'upr_id' => $validated['upr_id'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil ditambahkan.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'role_label' => $user->role_label,
                'wilayah' => $user->wilayah,
                'nip' => $user->nip,
                'upr_id' => $user->upr_id,
                'initials' => $user->initials,
            ],
        ], 201);
    }

    /**
     * GET /api/users/{id}
     * Detail satu pengguna.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->role, ['supervisor', 'admin'], true) && $user->id !== $id) {
            return response()->json(['success' => false, 'message' => 'Anda hanya dapat melihat detail akun Anda sendiri.'], 403);
        }

        $target = User::with('upr')->find($id);

        if (! $target) {
            return response()->json(['success' => false, 'message' => 'Pengguna tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $target->id,
                'name' => $target->name,
                'email' => $target->email,
                'role' => $target->role,
                'role_label' => $target->role_label,
                'wilayah' => $target->wilayah,
                'nip' => $target->nip,
                'upr_id' => $target->upr_id,
                'upr_name' => $target->upr?->name,
                'initials' => $target->initials,
                'created_at' => $target->created_at?->toIso8601String(),
                'updated_at' => $target->updated_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * PUT /api/users/{id}
     * Update data pengguna.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $authUser = $request->user();

        if (! in_array($authUser->role, ['supervisor', 'admin'], true) && $authUser->id !== $id) {
            return response()->json(['success' => false, 'message' => 'Anda hanya dapat mengupdate akun Anda sendiri.'], 403);
        }

        $target = User::find($id);

        if (! $target) {
            return response()->json(['success' => false, 'message' => 'Pengguna tidak ditemukan.'], 404);
        }

        try {
            $rules = [
                'name' => ['sometimes', 'required', 'string', 'max:255'],
                'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users')->ignore($id)],
                'role' => ['sometimes', 'required', Rule::in(['petugas', 'supervisor', 'petugas_eksekusi', 'admin'])],
                'wilayah' => ['nullable', 'string', 'max:100'],
                'nip' => ['nullable', 'string', 'max:20'],
                'upr_id' => ['nullable', 'integer', 'exists:uprs,id'],
                'team_id' => ['nullable', 'string', 'exists:teams,id'],
            ];

            // Only supervisor/admin can change role
            if (! in_array($authUser->role, ['supervisor', 'admin'], true)) {
                unset($rules['role']);
            }

            // Only supervisor can change upr_id for other users
            if ($authUser->id === $id && $request->has('upr_id')) {
                unset($rules['upr_id']);
            }

            $validated = $request->validate($rules);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        // Hanya supervisor yang bisa mengganti upr_id ke nilai berbeda
        if (isset($validated['upr_id'])) {
            $validated['upr_id'] = $validated['upr_id'] ? (int) $validated['upr_id'] : null;
        }

        $target->update($validated);

        $target->load('upr');

        return response()->json([
            'success' => true,
            'message' => 'Data pengguna berhasil diperbarui.',
            'data' => [
                'id' => $target->id,
                'name' => $target->name,
                'email' => $target->email,
                'role' => $target->role,
                'role_label' => $target->role_label,
                'wilayah' => $target->wilayah,
                'nip' => $target->nip,
                'upr_id' => $target->upr_id,
                'upr_name' => $target->upr?->name,
                'initials' => $target->initials,
            ],
        ]);
    }

    /**
     * DELETE /api/users/{id}
     * Hapus pengguna.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Hanya supervisor yang dapat menghapus pengguna.'], 403);
        }

        if ($user->id === (int) $id) {
            return response()->json(['success' => false, 'message' => 'Anda tidak dapat menghapus akun Anda sendiri.'], 422);
        }

        $target = User::find($id);

        if (! $target) {
            return response()->json(['success' => false, 'message' => 'Pengguna tidak ditemukan.'], 404);
        }

        $target->tokens()->delete();
        $target->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil dihapus.',
        ]);
    }
}
