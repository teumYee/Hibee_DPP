import { AppText } from "../components/AppText";
import React, {useCallback, useEffect, useMemo, useState,} from 'react';
import { Alert, NativeModules, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

type UsageRow = {
  packageName: string;
  appName: string;
  usageTime: number; // seconds
  firstTimeStamp: number; // ms
  lastTimeStamp: number; // ms
  category?: number;
  // 고도화된 지표들
  appLaunchCount: number;
  maxContinuousTime: number;
};
// 타입 추가 (상세 이벤트)
type DetailedEvent={
  packageName: string;
  timestamp: number;
  type: 'FOREGROUND'|'BACKGROUND'|'STANDBY_CHANGED';
  bucket?:number;
}
const {UsageStatsModule} = NativeModules as {
  UsageStatsModule?: {
    checkPermission: () => Promise<boolean>;
    showSettings: () => void;
    getTodayUsage: () => Promise<UsageRow[]>;
    getUnlockCount: () => Promise<number>;
    getDetailedEvents: ()=> Promise<DetailedEvent[]>;
  };
};


export default function UsageStatsTestScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [unlockCount, setUnlockCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const moduleAvailable = useMemo(() => !!UsageStatsModule, []);

  const refreshPermission = useCallback(async () => {
    if (!UsageStatsModule) return;
    const ok = await UsageStatsModule.checkPermission();
    setHasPermission(ok);
    return ok;
  }, []);

  const fetchUnlockCount = useCallback(async () => {
    if (!UsageStatsModule) return 0;
    const count = await UsageStatsModule.getUnlockCount();
    setUnlockCount(count);
    return count;
  }, []);

  const fetchUsage = useCallback(async (): Promise<UsageRow[]> => {
    if (!UsageStatsModule) return [];
    setError(null);
    const data = await UsageStatsModule.getTodayUsage();
    const normalized = Array.isArray(data) ? data : [];
    setRows(normalized);
    return normalized;
  }, []);

  const formatLocalDate = useCallback((): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const syncUsageData = useCallback(async (data: UsageRow[], count?: number) => {
    const logs = data.map(r => ({
      package_name: r.packageName,
      app_name: r.appName ||'Unknown', 
      usage_duration: Math.round(r.usageTime),

      date: new Date(r.firstTimeStamp).toISOString(),

      start_time: new Date(r.firstTimeStamp).toISOString(),
      end_time: new Date(r.lastTimeStamp).toISOString(),
      unlock_count: count ?? 0, // 개별 앱별 언락 횟수는 알기 어려우므로 0으로 기록
      category_id: r.category ?? -1,
      is_night_mode: false,
      // 추가
      app_launch_count: r.appLaunchCount,
      max_continuous_duration: Math.round(r.maxContinuousTime),
    }));

    const payload = {
      logs:logs,
      unlock_count: count ?? 0,
    };

    const BASE_URL = 'http://10.0.2.2:8000'; // Android 에뮬레이터용 localhost
    try {
        const response = await fetch(`${BASE_URL}/api/v1/logs`,{
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const result = await response.json();
        console.log('[UsageStats] 서버 응답:', result);

        await fetchUsage();
        await fetchUnlockCount();
        
        Alert.alert('성공');

      } else {
        console.error('[UsageStats] 서버 오류:', response.status, response.statusText);
    }
    } catch (e) {
      console.error('[UsageStats] 네트워크 에러', e);
    }
    console.log('[UsageStats] payload\n', JSON.stringify(payload, null, 2));
  }, [formatLocalDate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!moduleAvailable) {
          setError(
            'Native module not linked. Android에서 UsageStatsPackage 등록 및 rebuild가 필요합니다.',
          );
          return;
        }
        const ok = await refreshPermission();
        if (!alive) return;
        if (ok) {
          const data = await fetchUsage();
          if (data.length > 0) {
            syncUsageData(data);
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchUsage, moduleAvailable, refreshPermission]);

  const onOpenSettings = useCallback(() => {
    UsageStatsModule?.showSettings();
  }, []);

  const onReload = useCallback(async () => {
    try {
      const ok = await refreshPermission();
      if (ok) {
        const data = await fetchUsage();
        const count = await fetchUnlockCount();
        if (data.length > 0) {
          syncUsageData(data, count);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchUsage, fetchUnlockCount, refreshPermission, syncUsageData]);

  return (
    <View style={styles.container}>
      <AppText style={styles.title}>UsageStats 테스트</AppText>

      <View style={styles.unlockCard}>
      <AppText style={styles.label}>오늘의 총 언락 횟수</AppText>
      <AppText style={styles.unlockValue}>{unlockCount}회</AppText>
    </View>

      {!moduleAvailable && (
        <AppText style={styles.error}>
          UsageStatsModule이 없습니다. (패키지 등록/빌드 필요)
        </AppText>
      )}

      {error && <AppText style={styles.error}>{error}</AppText>}

      <View style={styles.row}>
        <AppText style={styles.label}>권한:</AppText>
        <AppText style={styles.value}>
          {hasPermission === null ? '확인 중...' : hasPermission ? '허용' : '거부'}
        </AppText>
      </View>

      {!hasPermission && (
        <TouchableOpacity style={styles.button} onPress={onOpenSettings}>
          <AppText style={styles.buttonText}>설정으로 이동</AppText>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.buttonSecondary} onPress={onReload}>
        <AppText style={styles.buttonText}>새로고침</AppText>
      </TouchableOpacity>

      <ScrollView style={styles.list}>
        {rows.map(r => {
          const minutes = r.usageTime / 60;
          return (
            <View key={r.packageName} style={styles.item}>
              <View style={styles.itemHeader}>
                <AppText style={styles.pkg}>{r.appName || r.packageName}</AppText>
                <AppText style={styles.launchTag}>{r.appLaunchCount}회 방문</AppText>
            </View>
            <AppText style={styles.time}>
              총 {minutes.toFixed(1)}분 사용 (최장 {Math.round(r.maxContinuousTime / 60)}분 연속)
             </AppText>
           </View>
    );
  })}
        {hasPermission && rows.length === 0 && (
          <AppText style={styles.muted}>
            데이터가 없습니다. (0초 앱은 필터링되어 제외됩니다)
          </AppText>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16, backgroundColor: '#0b0c10'},
  title: {color: '#ffffff', fontSize: 18, marginBottom: 12},
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  label: {color: '#9aa0a6', marginRight: 8},
  value: {color: '#ffffff'},
  button: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  buttonSecondary: {
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  buttonText: {color: '#ffffff', textAlign: 'center'},
  list: {flex: 1},
  item: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2b2f36',
  },
  pkg: {color: '#ffffff', marginBottom: 4},
  time: {color: '#9aa0a6'},
  muted: {color: '#9aa0a6', marginTop: 16},
  error: {color: '#f87171', marginBottom: 8},

  unlockCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  unlockValue: {
    color: '#4f46e5',
    fontSize: 32,
    marginTop: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  launchTag: {
    backgroundColor: '#4f46e533',
    color: '#4f46e5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 12,
  },
});

