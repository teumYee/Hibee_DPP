package com.dpp

import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * 앱이 처음 생성될 때 실행되는 지점
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null) // React Native의 안정성을 위해 null 전달

    //  언락 리시버 동적 등록
    try {
        val filter = IntentFilter(Intent.ACTION_USER_PRESENT)
        registerReceiver(UnlockReceiver(), filter)
    } catch (e: Exception) {
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript.
   */
  override fun getMainComponentName(): String = "DPP"

  /**
   * Returns the instance of the [ReactActivityDelegate].
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}