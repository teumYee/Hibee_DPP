package com.dolphinpod

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class UnlockReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    val prefs = context.getSharedPreferences("usage_prefs", Context.MODE_PRIVATE)

    when (action) {
      Intent.ACTION_USER_PRESENT -> {
        val currentCount = prefs.getInt("unlock_count", 0)
        prefs.edit().putInt("unlock_count", currentCount + 1).apply()
        Log.d("UnlockReceiver", "잠금 해제 감지! 현재 횟수: ${currentCount + 1}")
      }

      Intent.ACTION_BOOT_COMPLETED -> {
        Log.d("UnlockReceiver", "재부팅 완료! 언락 감지 서비스 대기 중...")
      }
    }
  }
}
