package com.dolphinpod

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class UnlockReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    val prefs = context.getSharedPreferences("usage_prefs", Context.MODE_PRIVATE)

    when (action) {
      Intent.ACTION_USER_PRESENT -> {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val lastDate = prefs.getString(KEY_LAST_UNLOCK_DATE, null)
        val newCount =
            if (lastDate != today) {
              1
            } else {
              prefs.getInt("unlock_count", 0) + 1
            }
        prefs.edit()
          .putInt("unlock_count", newCount)
          .putString(KEY_LAST_UNLOCK_DATE, today)
          .apply()
        Log.d("UnlockReceiver", "잠금 해제 감지! date=$today last=$lastDate 횟수: $newCount")
      }

      Intent.ACTION_BOOT_COMPLETED -> {
        Log.d("UnlockReceiver", "재부팅 완료! 언락 감지 서비스 대기 중...")
      }
    }
  }

  companion object {
    private const val KEY_LAST_UNLOCK_DATE = "last_unlock_date"
  }
}
