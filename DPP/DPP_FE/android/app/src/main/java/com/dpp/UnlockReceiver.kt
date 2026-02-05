package com.dpp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class UnlockReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val prefs = context.getSharedPreferences("usage_prefs", Context.MODE_PRIVATE)

        when (action) {
            // 1. 사용자가 잠금을 해제했을 때
            Intent.ACTION_USER_PRESENT -> {
                val currentCount = prefs.getInt("unlock_count", 0)
                prefs.edit().putInt("unlock_count", currentCount + 1).apply()
                
                // 디버깅을 위해 로그 추가 (Logcat에서 확인 가능)
                Log.d("UnlockReceiver", "잠금 해제 감지! 현재 횟수: ${currentCount + 1}")
            }

            // 2. 기기가 재부팅되었을 때 (매니페스트에 등록한 BOOT_COMPLETED 대응)
            Intent.ACTION_BOOT_COMPLETED -> {
                Log.d("UnlockReceiver", "재부팅 완료! 언락 감지 서비스 대기 중...")
            }
        }
    }
}