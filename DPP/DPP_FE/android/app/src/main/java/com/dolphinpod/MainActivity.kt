package com.dolphinpod

import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    try {
      val filter = IntentFilter(Intent.ACTION_USER_PRESENT)
      registerReceiver(UnlockReceiver(), filter)
    } catch (_: Exception) {
    }
  }

  override fun getMainComponentName(): String = "DPP"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
