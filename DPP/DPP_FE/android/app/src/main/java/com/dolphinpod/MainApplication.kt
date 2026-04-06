package com.dolphinpod

import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  /** 프로세스가 살아 있는 동안만 유지. Activity 쪽 동적 등록보다 누락이 적음 (Oreo+ 에서 USER_PRESENT 는 매니페스트로는 거의 안 옴) */
  private val unlockReceiver = UnlockReceiver()

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(UsageStatsPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    registerUnlockReceiver()
  }

  private fun registerUnlockReceiver() {
    try {
      val filter = IntentFilter(Intent.ACTION_USER_PRESENT)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        registerReceiver(unlockReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        @Suppress("DEPRECATION")
        registerReceiver(unlockReceiver, filter)
      }
    } catch (_: Exception) {
    }
  }
}
