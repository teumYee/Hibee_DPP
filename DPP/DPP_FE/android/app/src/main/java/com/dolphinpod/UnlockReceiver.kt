package com.dolphinpod

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import java.util.Calendar
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class UnlockReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    val prefs = context.getSharedPreferences("usage_prefs", Context.MODE_PRIVATE)

    when (action) {
      Intent.ACTION_USER_PRESENT -> {
        val today = logicalDateString(
          System.currentTimeMillis(),
          prefs.getString(KEY_DAY_ROLLOVER_TIME, DEFAULT_DAY_ROLLOVER_TIME) ?: DEFAULT_DAY_ROLLOVER_TIME,
        )
        val lastDate = prefs.getString(KEY_LAST_UNLOCK_DATE, null)
        if (lastDate != null && lastDate != today) {
          prefs.edit()
            .putInt(KEY_LAST_COMPLETED_UNLOCK_COUNT, prefs.getInt("unlock_count", 0))
            .putString(KEY_LAST_COMPLETED_LOGICAL_DATE, lastDate)
            .apply()
        }
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
    private const val KEY_LAST_COMPLETED_UNLOCK_COUNT = "last_completed_unlock_count"
    private const val KEY_LAST_COMPLETED_LOGICAL_DATE = "last_completed_logical_date"
    private const val KEY_DAY_ROLLOVER_TIME = "day_rollover_time"
    private const val DEFAULT_DAY_ROLLOVER_TIME = "21:00"

    private fun logicalDateString(nowMs: Long, rolloverTime: String): String {
      val boundary = startOfLogicalDay(nowMs, rolloverTime)
      return SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(boundary))
    }

    private fun startOfLogicalDay(nowMs: Long, rolloverTime: String): Long {
      val (rolloverHour, rolloverMinute) = parseHhMm(rolloverTime)
      val now = Calendar.getInstance().apply { timeInMillis = nowMs }
      val boundary = Calendar.getInstance().apply {
        timeInMillis = nowMs
        set(Calendar.HOUR_OF_DAY, rolloverHour)
        set(Calendar.MINUTE, rolloverMinute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      if (now.before(boundary)) {
        boundary.add(Calendar.DATE, -1)
      }
      return boundary.timeInMillis
    }

    private fun parseHhMm(value: String): Pair<Int, Int> {
      val parts = value.trim().split(":")
      val hour = parts.getOrNull(0)?.toIntOrNull()?.coerceIn(0, 23) ?: 21
      val minute = parts.getOrNull(1)?.toIntOrNull()?.coerceIn(0, 59) ?: 0
      return hour to minute
    }
  }
}
