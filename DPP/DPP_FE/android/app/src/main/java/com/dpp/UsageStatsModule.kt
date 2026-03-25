package com.dolphinpod

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.Calendar

class UsageStatsModule(private val reactCtx: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactCtx) {

    override fun getName(): String = "UsageStatsModule"

    @ReactMethod
    fun checkPermission(promise: Promise) {
        promise.resolve(hasUsageAccessPermission(reactCtx))
    }

    @ReactMethod
    fun showSettings() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactCtx.startActivity(intent)
    }

    /**
     * 런처에 등록된 설치 앱 목록 (패키지명 + 표시 이름)
     */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactCtx.packageManager
            val launchIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val apps: List<ResolveInfo> = pm.queryIntentActivities(launchIntent, 0)
            val result: WritableArray = Arguments.createArray()
            val seen = mutableSetOf<String>()
            for (ri in apps) {
                val pkg = ri.activityInfo?.packageName ?: continue
                if (!seen.add(pkg)) continue
                val label = try {
                    pm.getApplicationLabel(ri.activityInfo.applicationInfo).toString()
                } catch (_: Exception) {
                    pkg
                }
                val map: WritableMap = Arguments.createMap().apply {
                    putString("packageName", pkg)
                    putString("appName", label)
                }
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INSTALLED_APPS", e.message, e)
        }
    }

    /**
     * 오늘 0시부터 현재까지의 앱 사용 기록 조회
     */
    @ReactMethod
    fun getTodayUsage(promise: Promise) {
        if (!hasUsageAccessPermission(reactCtx)) {
            promise.reject("NO_PERMISSION", "Usage access not granted")
            return
        }

        val now = System.currentTimeMillis()
        val startOfDay = Calendar.getInstance().apply {
            timeInMillis = now
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

        val usm = reactCtx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val events = usm.queryEvents(startOfDay, now) ?: return promise.resolve(Arguments.createArray())
        val pm = reactCtx.packageManager
        val packageUsageMap = mutableMapOf<String, PackageUsage>()

        
        while (events.hasNextEvent()) {
            val event = UsageEvents.Event()
            if (!events.getNextEvent(event)) break
            
            val packageName = event.packageName ?: continue
            if (!shouldInclude(packageName, 1L)) continue 
            
            when (event.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                    val usage = packageUsageMap.getOrPut(packageName) {
                        PackageUsage(packageName, 0L, event.timeStamp, event.timeStamp)
                    }
                    usage.foregroundStartTime = event.timeStamp
                    // 포그라운드로 올 때마다 카운트 업
                    usage.launchCount++
                    if (usage.firstTimeStamp == 0L || event.timeStamp < usage.firstTimeStamp) {
                        usage.firstTimeStamp = event.timeStamp
                    }
                }
                UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    val usage = packageUsageMap[packageName] ?: continue
                    if (usage.foregroundStartTime > 0L) {
                        val duration = event.timeStamp - usage.foregroundStartTime
                        usage.totalTime += duration

                        // 최장 연속 사용 시간 계산
                        if (duration>usage.maxContinuousTime){
                            usage.maxContinuousTime = duration
                        }


                        usage.foregroundStartTime = -1L
                    }
                    if (event.timeStamp > usage.lastTimeStamp) {
                        usage.lastTimeStamp = event.timeStamp
                    }
                }
            }
        }
        


        packageUsageMap.values.forEach { usage ->
            if (usage.foregroundStartTime > 0L) {
                val duration = now - usage.foregroundStartTime
                usage.totalTime += duration
                usage.lastTimeStamp = now
            }
        }
        
        val result: WritableArray = Arguments.createArray()
        packageUsageMap.values.forEach { usage ->
            if (usage.totalTime > 0L) {
                val map: WritableMap = Arguments.createMap().apply {
                    putString("packageName", usage.packageName)
                    putDouble("usageTime", usage.totalTime.toDouble() / 1000.0)
                    putDouble("firstTimeStamp", usage.firstTimeStamp.toDouble())
                    putDouble("lastTimeStamp", usage.lastTimeStamp.toDouble())
                    // 새로 계산한 필드들 브릿지로 전달
                    putInt("appLaunchCount",usage.launchCount)
                    putDouble("maxContinuousTime",usage.maxContinuousTime.toDouble()/1000.0)

                    // 카테고리 정보 추가 로직
                    try {
                        val appInfo = pm.getApplicationInfo(usage.packageName, 0)
                        val name = pm.getApplicationLabel(appInfo).toString()
                        putString("appName", if (name.isNotEmpty()) name else usage.packageName) // 이름 없으면 패키지명이라도!
    
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            putInt("category", appInfo.category)
                        }
                    } catch (e: Exception) {
                        putString("appName", usage.packageName) // 에러 나면 패키지명이라도 노출
                        putInt("category", -1)
                    }
                
                }
                result.pushMap(map)
            }
        }
        promise.resolve(result)
    }

    /**
     * SharedPreferences에서 오늘 저장된 총 언락 횟수 가져오기
     */
    @ReactMethod
    fun getUnlockCount(promise: Promise) {
        val prefs = reactCtx.getSharedPreferences("usage_prefs", Context.MODE_PRIVATE)
        val count = prefs.getInt("unlock_count", 0)
        promise.resolve(count)
    }

    /**
     * 언락 횟수 리셋
     */
    @ReactMethod
    fun resetUnlockCount() {
        val prefs = reactCtx.getSharedPreferences("usage_prefs", Context.MODE_PRIVATE)
        prefs.edit().putInt("unlock_count", 0).apply()
    }

    private data class PackageUsage(
        val packageName: String,
        var totalTime: Long,
        var firstTimeStamp: Long,
        var lastTimeStamp: Long,
        var foregroundStartTime: Long = -1L,
        // 방문 횟수
        var launchCount: Int = 0,
        // 최장 연속 사용
        var maxContinuousTime: Long = 0L
    )

    private fun shouldInclude(packageName: String?, totalTimeInForegroundMs: Long): Boolean {
        if (packageName.isNullOrBlank()) return false
        if (totalTimeInForegroundMs <= 0L) return false
        if (packageName == "com.android.settings" || packageName == "com.android.vending") return true

        val lower = packageName.lowercase()
        val blacklist = listOf("systemui", "launcher", "keyboard", "bluetooth", "provider")
        return !blacklist.any { lower.contains(it) }
    }

    private fun hasUsageAccessPermission(ctx: Context): Boolean {
        val appOps = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), ctx.packageName)
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), ctx.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }
    // UsageEvents 정밀 추출 모듈

    private fun getstartOfDay(): Long {
    return Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}

    @ReactMethod
    fun getDetailedEvents(promise: Promise){
        val now = System.currentTimeMillis()
        val startOfDay = getstartOfDay()

        val usm = reactCtx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val events = usm.queryEvents(startOfDay, now)
        val result: WritableArray = Arguments.createArray()

        while (events.hasNextEvent()){
            val event = UsageEvents.Event()
            if (!events.getNextEvent(event)) break

            val map: WritableMap = Arguments.createMap().apply{
                putString("packageName", event.packageName)
                putDouble("timestamp", event.timeStamp.toDouble())

                // 이벤트 타입별 매핑
                when (event.eventType){
                    UsageEvents.Event.MOVE_TO_FOREGROUND -> putString("type","FOREGROUND")
                    UsageEvents.Event.MOVE_TO_BACKGROUND -> putString("type","BACKGROUND")
                    UsageEvents.Event.STANDBY_BUCKET_CHANGED -> {
                        putString("type","STANDBY_CHANGED")
                        // API 28 이상에서 제공하는 대기 버킷 정보 (자주 안 쓰는 앱 판별용)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            putInt("bucket", event.appStandbyBucket)
                        }
                    }
                    else -> return@apply // 다른 이벤트는 무시
                }
            }
            if (map.hasKey("type")) result.pushMap(map)
        }
        promise.resolve(result)
    }
}