package com.jalankita.app.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Construction
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PendingActions
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarOutline
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Warning
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Peta ikon yang dipakai layar auth — meniru ICON_MAP di
 * Frontend-stable/src/components/jk/Icon.tsx (Lucide).
 * Catatan: 'badge' TIDAK ada di ICON_MAP frontend → tidak direplikasi di sini.
 */
object AppIcon {
    val ArrowBack: ImageVector = Icons.AutoMirrored.Filled.ArrowBack   // arrow_back → ArrowLeft
    val Error: ImageVector = Icons.Filled.Error                        // error → AlertCircle
    val Login: ImageVector = Icons.Filled.Login                        // login → LogIn
    val Visibility: ImageVector = Icons.Filled.Visibility              // visibility → Eye
    val VisibilityOff: ImageVector = Icons.Filled.VisibilityOff        // visibility_off → EyeOff
    val Person: ImageVector = Icons.Filled.Person                      // person → User
    val Mail: ImageVector = Icons.Filled.MailOutline                   // mail → Mail
    val Phone: ImageVector = Icons.Filled.Phone                        // phone → Phone
    val Info: ImageVector = Icons.Filled.Info                          // info → Info
    val PersonAdd: ImageVector = Icons.Filled.PersonAdd                // person_add → UserPlus
    val CheckCircle: ImageVector = Icons.Filled.CheckCircle            // check_circle → CheckCircle
    val ChevronDown: ImageVector = Icons.Filled.ExpandMore             // expand_more → ChevronDown
    val Camera: ImageVector = Icons.Filled.PhotoCamera                 // camera_alt → Camera
    val Gallery: ImageVector = Icons.Filled.PhotoLibrary               // gallery
    val AddPhoto: ImageVector = Icons.Filled.AddAPhoto                 // add_a_photo → Camera
    // ── Dashboard petugas (replikasi home.tsx + BottomNav) ────────────────
    val Home: ImageVector = Icons.Filled.Home                          // home
    val Assignment: ImageVector = Icons.Filled.Assignment              // assignment
    val Map: ImageVector = Icons.Filled.Map                            // map
    val Description: ImageVector = Icons.Filled.Description            // description
    val Warning: ImageVector = Icons.Filled.Warning                    // warning
    val PendingActions: ImageVector = Icons.Filled.PendingActions      // pending_actions
    val BarChart: ImageVector = Icons.Filled.BarChart                  // bar_chart
    val CalendarMonth: ImageVector = Icons.Filled.CalendarMonth        // calendar_month
    val Construction: ImageVector = Icons.Filled.Construction          // construction
    val UploadPhoto: ImageVector = Icons.Filled.AddPhotoAlternate      // add_photo_alternate
    val ChevronRight: ImageVector = Icons.Filled.ChevronRight          // chevron_right
    val ChevronLeft: ImageVector = Icons.Filled.ChevronLeft            // chevron_left
    val Inbox: ImageVector = Icons.Filled.Inbox                        // inbox
    val PlayArrow: ImageVector = Icons.Filled.PlayArrow                // play_arrow
    val Delete: ImageVector = Icons.Filled.Delete                      // delete
    val Edit: ImageVector = Icons.Filled.Edit                          // edit
    val Logout: ImageVector = Icons.Filled.Logout                      // logout
    val Notifications: ImageVector = Icons.Filled.Notifications        // notifications
    val SystemUpdate: ImageVector = Icons.Filled.SystemUpdate            // system_update
    val Search: ImageVector = Icons.Filled.Search                        // search
    val Share: ImageVector = Icons.Filled.Share                        // share (bagikan laporan)
    val Star: ImageVector = Icons.Filled.Star                          // star
    val StarOutline: ImageVector = Icons.Filled.StarOutline            // star_outline
    val Lock: ImageVector = Icons.Filled.Lock                          // lock (kecamatan terkunci dari sesi)
    val Add: ImageVector = Icons.Filled.Add                              // add (CTA plus FAB upload)
    val SwapHoriz: ImageVector = Icons.Filled.SwapHoriz                  // swap_horiz (slider sebelum/sesudah)
}
