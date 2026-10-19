package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Model notifikasi — kontrak: backend_POSTGRESQL
 * NotificationController::index/unreadCount/markRead/markAllRead/destroyAll.
 * Replikasi Frontend-stable/src/routes/notifications.tsx + types/laporan.ts.
 *
 * Endpoint per-user (`$request->user()->notifications()`), aman dipakai semua
 * role — tidak ada isolasi role yang perlu dijaga di client.
 */

/** Payload `data` notifikasi database Laravel. */
@JsonClass(generateAdapter = true)
data class NotifDataDto(
    val type: String? = null,
    val message: String? = null,
    @Json(name = "report_id") val reportId: String? = null,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "actor_name") val actorName: String? = null,
    @Json(name = "actor_role") val actorRole: String? = null,
)

/** Satu baris GET /api/notifications (DatabaseNotification ter-serialize). */
@JsonClass(generateAdapter = true)
data class NotifItemDto(
    val id: String,
    val type: String? = null,
    val data: NotifDataDto? = null,
    @Json(name = "read_at") val readAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
) {
    val isUnread: Boolean get() = readAt == null
}

/**
 * GET /api/notifications — envelope `{success, data[], meta{...}}`
 * (bentuk sama dengan WargaListResponse).
 */
@JsonClass(generateAdapter = true)
data class NotifListResponse(
    val success: Boolean,
    val message: String? = null,
    val data: List<NotifItemDto>? = null,
    val meta: WargaMeta? = null,
)

/** GET /api/notifications/unread-count — `{success, data:{unread}}`. */
@JsonClass(generateAdapter = true)
data class UnreadDto(
    val unread: Int = 0,
)
