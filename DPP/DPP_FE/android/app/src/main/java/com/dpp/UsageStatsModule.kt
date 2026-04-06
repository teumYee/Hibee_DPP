package com.dolphinpod

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.Base64
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.Calendar
import java.io.ByteArrayOutputStream

class UsageStatsModule(private val reactCtx: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactCtx) {

    override fun getName(): String = "UsageStatsModule"

    /** 짧은 BG→FG(권한창·PiP·멀티윈도우 등)마다 방문으로 잡히는 것 완화 */
    private val launchCountMinGapMs = 25_000L

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

    private fun isSystemApp(ai: ApplicationInfo): Boolean {
        val flags = ai.flags
        val isSystem = (flags and ApplicationInfo.FLAG_SYSTEM) != 0
        val isUpdatedSystem = (flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
        return isSystem || isUpdatedSystem
    }

    private fun mapCategory(category: Int): Pair<Int, String> {
        // 요구 스펙: 0~7만 매핑, 나머지는 -1(미분류)
        return when (category) {
            ApplicationInfo.CATEGORY_GAME -> 0 to "게임"
            ApplicationInfo.CATEGORY_AUDIO -> 1 to "오디오"
            ApplicationInfo.CATEGORY_VIDEO -> 2 to "비디오"
            ApplicationInfo.CATEGORY_IMAGE -> 3 to "이미지"
            ApplicationInfo.CATEGORY_SOCIAL -> 4 to "소셜"
            ApplicationInfo.CATEGORY_NEWS -> 5 to "뉴스"
            ApplicationInfo.CATEGORY_MAPS -> 6 to "지도"
            ApplicationInfo.CATEGORY_PRODUCTIVITY -> 7 to "생산성"
            else -> -1 to "미분류"
        }
    }

    private fun drawableToBase64Png(drawable: Drawable, sizePx: Int): String? {
        return try {
            val bitmap = when (drawable) {
                is BitmapDrawable -> {
                    val b = drawable.bitmap
                    if (b != null) Bitmap.createScaledBitmap(b, sizePx, sizePx, true)
                    else null
                }
                else -> null
            }

            val targetBitmap = bitmap ?: Bitmap.createBitmap(
                sizePx,
                sizePx,
                Bitmap.Config.ARGB_8888,
            )
            if (bitmap == null) {
                val canvas = Canvas(targetBitmap)
                drawable.setBounds(0, 0, sizePx, sizePx)
                drawable.draw(canvas)
            }

            val baos = ByteArrayOutputStream()
            targetBitmap.compress(Bitmap.CompressFormat.PNG, 100, baos)
            Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * 설치된(런처) 앱 목록 + Android category 기반 분류
     * 반환: [{ packageName, appName, categoryId, categoryName }]
     */
    @ReactMethod
    fun getInstalledAppsWithCategory(promise: Promise) {
        try {
            val pm: PackageManager = reactCtx.packageManager
            val launchIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val apps: List<ResolveInfo> = pm.queryIntentActivities(launchIntent, 0)
            val result: WritableArray = Arguments.createArray()
            val seen = mutableSetOf<String>()

            for (ri in apps) {
                val pkg = ri.activityInfo?.packageName ?: continue
                if (!seen.add(pkg)) continue

                val appInfo = try {
                    pm.getApplicationInfo(pkg, 0)
                } catch (_: Exception) {
                    null
                } ?: continue

                if (isSystemApp(appInfo)) continue

                val label = try {
                    pm.getApplicationLabel(appInfo).toString().ifEmpty { pkg }
                } catch (_: Exception) {
                    pkg
                }

                val rawCat = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    appInfo.category
                } else {
                    -1
                }
                val mapped = mapCategory(rawCat)

                val iconBase64: String? = try {
                    val iconDrawable = appInfo.loadIcon(pm)
                    if (iconDrawable != null) drawableToBase64Png(iconDrawable, 48) else null
                } catch (_: Exception) {
                    null
                }

                val map: WritableMap = Arguments.createMap().apply {
                    putString("packageName", pkg)
                    putString("appName", label)
                    putInt("categoryId", mapped.first)
                    putString("categoryName", mapped.second)
                    if (iconBase64 != null) putString("iconBase64", iconBase64)
                }
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INSTALLED_APPS_WITH_CATEGORY", e.message, e)
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
                    // 백그라운드에서 들어올 때 포그라운드 구간 시작. 방문 횟수는 일정 간격 이내 재진입은 1회로 묶음
                    val wasInBackground = usage.foregroundStartTime <= 0L
                    if (wasInBackground) {
                        val gapOk =
                            usage.lastVisitCountAtMs == 0L ||
                                event.timeStamp - usage.lastVisitCountAtMs >= launchCountMinGapMs
                        if (gapOk) {
                            usage.launchCount++
                            usage.lastVisitCountAtMs = event.timeStamp
                        }
                        usage.foregroundStartTime = event.timeStamp
                    }
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

        // queryEvents 는 OS가 보관하는 이벤트 개수에 한계가 있어, 하루가 길면 이른 사용 기록이 잘려
        // 수 분만 집계되는 현상이 난다. 총 foreground 시간은 queryUsageStats 집계로 덮어쓴다.
        val statsList: List<UsageStats> =
            usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, startOfDay, now) ?: emptyList()
        for (s in statsList) {
            val pkg = s.packageName ?: continue
            val fg = s.totalTimeInForeground
            if (fg <= 0L) continue
            if (!shouldInclude(pkg, fg)) continue

            val existing = packageUsageMap[pkg]
            if (existing != null) {
                existing.totalTime = fg
            } else {
                val lastUsed = s.lastTimeUsed
                val (approxFirst, lastTs) =
                    if (lastUsed > 0L) {
                        val a = (lastUsed - fg).coerceAtLeast(startOfDay)
                        a to lastUsed.coerceAtLeast(a)
                    } else {
                        startOfDay to now
                    }
                packageUsageMap[pkg] = PackageUsage(
                    packageName = pkg,
                    totalTime = fg,
                    firstTimeStamp = approxFirst,
                    lastTimeStamp = lastTs,
                    launchCount = 0,
                    maxContinuousTime = 0L,
                )
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

    /** 패키지명으로 런처 아이콘 PNG base64 (대시보드 등) */
    @ReactMethod
    fun getAppIconBase64(packageName: String, promise: Promise) {
        try {
            val pm = reactCtx.packageManager
            val ai = pm.getApplicationInfo(packageName, 0)
            val drawable = ai.loadIcon(pm)
            val b64 = drawableToBase64Png(drawable, 96)
            promise.resolve(b64)
        } catch (_: Exception) {
            promise.resolve(null)
        }
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
        /** launchCount 를 마지막으로 올린 이벤트 시각(ms) — 디바운스용 */
        var lastVisitCountAtMs: Long = 0L,
        // 최장 연속 사용
        var maxContinuousTime: Long = 0L
    )

    private fun shouldInclude(packageName: String?, totalTimeInForegroundMs: Long): Boolean {
        if (packageName.isNullOrBlank()) return false
        val selfPkg = reactCtx.packageName
        // 우리 앱 본 패키지 + com.dolphinpod:provider 같은 서브프로세스는 블랙리스트에 절대 걸리지 않게
        if (packageName == selfPkg || packageName.startsWith("$selfPkg:")) {
            return totalTimeInForegroundMs > 0L
        }
        if (totalTimeInForegroundMs <= 0L) return false
        if (packageName == "com.android.settings" || packageName == "com.android.vending") return true

        val lower = packageName.lowercase()
        // "provider" 단독 매칭은 com.dolphinpod:provider 오탐 → 시스템 content provider 패턴만 제외
        val blacklist = listOf("systemui", "launcher", "keyboard", "bluetooth")
        if (blacklist.any { lower.contains(it) }) return false
        if (lower.contains(".providers.")) return false
        return true
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