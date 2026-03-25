import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import {
  addFriend,
  cheerFriend,
  getFriends,
  searchUser,
  type Badge,
  type Friend,
  type SearchResult,
} from "../../../services/api/social.api";

const MAIN = "#2E7FC1";
const BG = "#F5F7FA";
const TITLE = "#1A1A2E";
const OCEAN = "#1B4F8A";
const CHEER_ORANGE = "#FFB347";
const GREEN_RING = "#1D9E75";

type Props = NativeStackScreenProps<MainStackParamList, "Social">;

type MainTab = "friends" | "group";

/** TODO: getFriends() 응답으로 교체 */
const MOCK_FRIENDS: Friend[] = [
  {
    id: "1",
    nickname: "바닷가기",
    avatar_color: "#2E7FC1",
    streak_days: 18,
    cheer_count: 94,
    friend_count: 10,
    is_checked_in_today: true,
    has_cheered_today: false,
    badges: [
      { id: "b1", name: "연속 체크인", icon: "🏆", is_earned: true },
      { id: "b2", name: "소셜 고래", icon: "🐋", is_earned: true },
      { id: "b3", name: "심야 탈출", icon: "🌙", is_earned: false },
    ],
    today_comment: "오늘도 잔잔하게 헤엄쳤어요",
  },
  {
    id: "2",
    nickname: "파도타기",
    avatar_color: "#FF6B9D",
    streak_days: 5,
    cheer_count: 23,
    friend_count: 4,
    is_checked_in_today: false,
    has_cheered_today: true,
    badges: [{ id: "b1", name: "연속 체크인", icon: "🏆", is_earned: false }],
    today_comment: undefined,
  },
];

type BurstPoint = { x: number; y: number; key: number };

function hashLayout(id: string): { leftPct: number; topPct: number; dur: number } {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  const leftPct = 6 + Math.abs(h % 70);
  const topPct = 10 + Math.abs((h >> 4) % 55);
  const dur = 2000 + Math.abs(h % 2000);
  return { leftPct, topPct, dur };
}

function useCountUp(target: number, active: boolean, durationMs = 500): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) {
      setV(0);
      return;
    }
    const steps = 24;
    const stepMs = Math.max(1, Math.floor(durationMs / steps));
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      const next = Math.round((target * step) / steps);
      setV(next >= target ? target : next);
      if (step >= steps) clearInterval(id);
    }, stepMs);
    return () => clearInterval(id);
  }, [target, active, durationMs]);
  return v;
}

function WaterBurst({ point }: { point: BurstPoint | null }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!point) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [point, progress]);

  if (!point) return null;

  const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  const r = 56;

  return (
    <View style={styles.burstLayer} pointerEvents="none">
      {angles.map((ang, i) => {
        const dx = Math.cos(ang) * r;
        const dy = Math.sin(ang) * r;
        return (
          <Animated.View
            key={`${point.key}-${i}`}
            style={[
              styles.burstDot,
              {
                left: point.x - 6,
                top: point.y - 6,
                opacity: progress.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0, 1, 0],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, dx],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, dy],
                    }),
                  },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

type ProfileModalProps = {
  visible: boolean;
  friend: Friend | null;
  sheetY: Animated.Value;
  onClose: () => void;
  onCheer: (friend: Friend, ax: number, ay: number) => void;
  tipBadgeId: string | null;
  setTipBadgeId: (id: string | null) => void;
};

function ProfileModal({
  visible,
  friend,
  sheetY,
  onClose,
  onCheer,
  tipBadgeId,
  setTipBadgeId,
}: ProfileModalProps) {
  const wave = useRef(new Animated.Value(0)).current;
  const cheerBtnRef = useRef<View>(null);

  const streakTarget = friend?.streak_days ?? 0;
  const cheerTarget = friend?.cheer_count ?? 0;
  const friendTarget = friend?.friend_count ?? 0;

  useEffect(() => {
    if (!visible || !friend) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(wave, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, friend, wave]);

  const streakV = useCountUp(streakTarget, visible && !!friend);
  const cheerV = useCountUp(cheerTarget, visible && !!friend);
  const friendV = useCountUp(friendTarget, visible && !!friend);

  const waveTranslate = wave.interpolate({
    inputRange: [0, 1],
    outputRange: [-3, 3],
  });

  if (!visible || !friend) {
    return null;
  }

  const subtitle = friend.today_comment?.trim()
    ? friend.today_comment
    : "나의 프로필";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <Animated.View style={[styles.profileSheet, { transform: [{ translateY: sheetY }] }]}>
          <Pressable style={styles.profileClose} onPress={onClose} hitSlop={10}>
            <Text style={styles.profileCloseText}>✕</Text>
          </Pressable>
          <View style={styles.profileHero}>
            <Animated.View
              style={[
                styles.profileAvatarWrap,
                { backgroundColor: friend.avatar_color },
                { transform: [{ translateY: waveTranslate }] },
              ]}
            >
              <Text style={styles.profileDolphin}>🐬</Text>
            </Animated.View>
          </View>
          <Text style={styles.profileName}>{friend.nickname}</Text>
          <Text style={styles.profileSub}>{subtitle}</Text>
          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{streakV}</Text>
              <Text style={styles.statLabel}>연속일</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{cheerV}</Text>
              <Text style={styles.statLabel}>응원수</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{friendV}</Text>
              <Text style={styles.statLabel}>친구</Text>
            </View>
          </View>
          <Text style={styles.badgeSectionTitle}>뱃지</Text>
          <View style={styles.badgeRow}>
            {friend.badges.map((b: Badge) => (
              <Pressable
                key={b.id}
                onPress={() => {
                  if (!b.is_earned) {
                    setTipBadgeId(tipBadgeId === b.id ? null : b.id);
                  }
                }}
                style={styles.badgeItem}
              >
                <View
                  style={[
                    styles.badgeCircle,
                    b.is_earned ? { backgroundColor: friend.avatar_color } : styles.badgeMuted,
                  ]}
                >
                  <Text style={styles.badgeIcon}>{b.icon}</Text>
                </View>
                {tipBadgeId === b.id && !b.is_earned ? (
                  <Text style={styles.badgeTip}>아직 획득하지 못했어요</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
          <View ref={cheerBtnRef} collapsable={false}>
            <Pressable
              style={[
                styles.profileCheerBtn,
                friend.has_cheered_today && styles.profileCheerBtnOff,
              ]}
              disabled={friend.has_cheered_today}
              onPress={() => {
                cheerBtnRef.current?.measureInWindow((x, y, w, h) => {
                  onCheer(friend, x + w / 2, y + h / 2);
                });
              }}
            >
              <Text
                style={[
                  styles.profileCheerText,
                  friend.has_cheered_today && styles.profileCheerTextOff,
                ]}
              >
                {friend.has_cheered_today ? "오늘 응원 완료 ✓" : "응원하기"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function OceanAvatar({
  friend,
  onOpen,
}: {
  friend: Friend;
  onOpen: () => void;
}) {
  const bob = useRef(new Animated.Value(0)).current;
  const { leftPct, topPct, dur } = useMemo(() => hashLayout(friend.id), [friend.id]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: dur,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, dur]);

  const ty = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [-5, 5],
  });

  return (
    <Pressable
      style={[styles.oceanAvatar, { left: `${leftPct}%`, top: `${topPct}%` }]}
      onPress={onOpen}
    >
      <Animated.View
        style={[
          styles.oceanAvatarInner,
          {
            backgroundColor: friend.avatar_color,
            borderColor: friend.is_checked_in_today ? GREEN_RING : "transparent",
            borderWidth: friend.is_checked_in_today ? 3 : 0,
            transform: [{ translateY: ty }],
          },
        ]}
      >
        <Text style={styles.oceanEmoji}>🐬</Text>
      </Animated.View>
      <Text style={styles.oceanNick} numberOfLines={1}>
        {friend.nickname}
      </Text>
    </Pressable>
  );
}

export function SocialScreen({ navigation }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [profileFriend, setProfileFriend] = useState<Friend | null>(null);
  const [burst, setBurst] = useState<BurstPoint | null>(null);
  const [tipBadgeId, setTipBadgeId] = useState<string | null>(null);
  /** TODO: 오늘 받은 응원 수 API 연동 */
  const [todayCheerNotif] = useState(3);

  const sheetY = useRef(new Animated.Value(520)).current;
  const searchSeq = useRef(0);

  const refreshFriends = useCallback(async () => {
    setListLoading(true);
    try {
      // TODO: getFriends() 단독 사용 시 MOCK 제거
      const list = await getFriends();
      setFriends(list);
    } catch {
      setFriends(MOCK_FRIENDS);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshFriends();
  }, [refreshFriends]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 750);
    return () => clearTimeout(t);
  }, [burst]);

  useEffect(() => {
    const q = searchText.trim();
    if (!q) {
      setSearchResults([]);
      setSearchBusy(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearchBusy(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await searchUser(q);
          if (searchSeq.current === seq) setSearchResults(res);
        } catch {
          if (searchSeq.current === seq) setSearchResults([]);
        } finally {
          if (searchSeq.current === seq) setSearchBusy(false);
        }
      })();
    }, 500);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    if (!profileFriend) return;
    sheetY.setValue(520);
    Animated.spring(sheetY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [profileFriend, sheetY]);

  const closeProfile = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: 520,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setProfileFriend(null);
      setTipBadgeId(null);
    });
  }, [sheetY]);

  const applyCheer = useCallback(
    async (friend: Friend, ax: number, ay: number) => {
      if (friend.has_cheered_today) return;
      try {
        await cheerFriend(friend.id);
        setBurst({ x: ax, y: ay, key: Date.now() });
        setFriends((prev) =>
          prev.map((f) =>
            f.id === friend.id
              ? {
                  ...f,
                  has_cheered_today: true,
                  cheer_count: f.cheer_count + 1,
                }
              : f,
          ),
        );
        setProfileFriend((p) =>
          p?.id === friend.id
            ? {
                ...p,
                has_cheered_today: true,
                cheer_count: p.cheer_count + 1,
              }
            : p,
        );
      } catch {
        /* 네트워크 실패 시 무시 */
      }
    },
    [],
  );

  const onAddFriend = useCallback(
    async (id: string) => {
      setAddingId(id);
      try {
        await addFriend(id);
        setSearchText("");
        setSearchResults([]);
        await refreshFriends();
      } catch {
        /* TODO: 토스트 등 UX */
      } finally {
        setAddingId(null);
      }
    },
    [refreshFriends],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerSide}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>같이 헤엄치는 바다</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.mainTabs}>
        <Pressable
          style={[styles.mainTab, mainTab === "friends" ? styles.mainTabOn : styles.mainTabOff]}
          onPress={() => setMainTab("friends")}
        >
          <Text style={[styles.mainTabText, mainTab === "friends" ? styles.mainTabTextOn : styles.mainTabTextOff]}>
            친구
          </Text>
        </Pressable>
        <Pressable
          style={[styles.mainTab, mainTab === "group" ? styles.mainTabOn : styles.mainTabOff]}
          onPress={() => setMainTab("group")}
        >
          <Text style={[styles.mainTabText, mainTab === "group" ? styles.mainTabTextOn : styles.mainTabTextOff]}>
            그룹
          </Text>
        </Pressable>
      </View>

      {mainTab === "friends" ? (
        <ScrollView
          style={styles.friendScroll}
          contentContainerStyle={styles.friendScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder="닉네임으로 친구 찾기"
              placeholderTextColor="#999999"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.trim().length > 0 ? (
              <View style={styles.searchDrop}>
                {searchBusy ? (
                  <ActivityIndicator style={styles.searchSpinner} color={MAIN} />
                ) : searchResults.length === 0 ? (
                  <Text style={styles.searchEmpty}>검색 결과가 없어요</Text>
                ) : (
                  searchResults.map((r) => (
                    <View key={r.id} style={styles.searchRow}>
                      <View style={styles.searchMeta}>
                        <View style={[styles.miniAv, { backgroundColor: r.avatar_color }]}>
                          <Text style={styles.miniDol}>🐬</Text>
                        </View>
                        <Text style={styles.searchNick}>{r.nickname}</Text>
                      </View>
                      <Pressable
                        style={styles.addBtn}
                        onPress={() => void onAddFriend(r.id)}
                        disabled={addingId === r.id}
                      >
                        {addingId === r.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.addBtnText}>친구 추가</Text>
                        )}
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>

          <Text style={styles.listHeader}>함께 헤엄치는 친구들</Text>
          {listLoading ? (
            <ActivityIndicator style={styles.listSpinner} color={MAIN} />
          ) : (
            friends.map((f) => (
              <FriendListRow
                key={f.id}
                friend={f}
                onOpenProfile={() => setProfileFriend(f)}
                onCheer={applyCheer}
              />
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.groupScroll} contentContainerStyle={styles.groupScrollContent}>
          <Text style={styles.groupTitle}>그룹 바다 뷰</Text>
          <View style={styles.oceanBox}>
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{todayCheerNotif}</Text>
            </View>
            {friends.map((f) => (
              <OceanAvatar key={f.id} friend={f} onOpen={() => setProfileFriend(f)} />
            ))}
          </View>
          <Text style={styles.groupListTitle}>친구들</Text>
          {friends.map((f) => (
            <Pressable
              key={`g-${f.id}`}
              style={styles.groupListRow}
              onPress={() => setProfileFriend(f)}
            >
              <View style={[styles.miniAv, { backgroundColor: f.avatar_color }]}>
                <Text style={styles.miniDol}>🐬</Text>
              </View>
              <Text style={styles.groupListNick}>{f.nickname}</Text>
              <Text style={styles.groupListEmoji}>
                {f.is_checked_in_today ? "✅" : "💤"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <WaterBurst point={burst} />

      <ProfileModal
        visible={profileFriend !== null}
        friend={profileFriend}
        sheetY={sheetY}
        onClose={closeProfile}
        onCheer={applyCheer}
        tipBadgeId={tipBadgeId}
        setTipBadgeId={setTipBadgeId}
      />
    </SafeAreaView>
  );
}

function FriendListRow({
  friend,
  onOpenProfile,
  onCheer,
}: {
  friend: Friend;
  onOpenProfile: () => void;
  onCheer: (f: Friend, x: number, y: number) => void;
}) {
  const cheerRef = useRef<View>(null);

  return (
    <Pressable style={styles.friendRow} onPress={onOpenProfile}>
      <View style={[styles.friendAv, { backgroundColor: friend.avatar_color }]}>
        <Text style={styles.friendDol}>🐬</Text>
      </View>
      <View style={styles.friendMid}>
        <Text style={styles.friendNick}>{friend.nickname}</Text>
        <Text style={styles.friendStatus}>
          {friend.is_checked_in_today
            ? "오늘 체크인 완료 ✅"
            : "아직 기록 없음 💤"}
        </Text>
      </View>
      <View ref={cheerRef} collapsable={false}>
        <Pressable
          style={[
            styles.cheerBtn,
            friend.has_cheered_today ? styles.cheerBtnDone : styles.cheerBtnActive,
          ]}
          disabled={friend.has_cheered_today}
          onPress={(e) => {
            e.stopPropagation();
            cheerRef.current?.measureInWindow((x, y, w, h) => {
              void onCheer(friend, x + w / 2, y + h / 2);
            });
          }}
        >
          <Text
            style={[
              styles.cheerBtnText,
              friend.has_cheered_today && styles.cheerBtnTextDone,
            ]}
          >
            {friend.has_cheered_today ? "응원완료 ✓" : "응원 💙"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  headerSide: { width: 44 },
  back: { fontSize: 24, color: TITLE },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: TITLE,
  },
  mainTabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E8E8",
  },
  mainTab: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  mainTabOn: { backgroundColor: MAIN },
  mainTabOff: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  mainTabText: { fontSize: 15, fontWeight: "600" },
  mainTabTextOn: { color: "#FFFFFF" },
  mainTabTextOff: { color: "#888888" },
  friendScroll: { flex: 1 },
  friendScrollContent: { paddingBottom: 24 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 2,
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TITLE,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  searchDrop: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  searchSpinner: { padding: 16 },
  searchEmpty: {
    padding: 16,
    textAlign: "center",
    color: "#888888",
    fontSize: 14,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  searchMeta: { flexDirection: "row", alignItems: "center", flex: 1 },
  miniAv: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  miniDol: { fontSize: 18 },
  searchNick: { fontSize: 15, fontWeight: "600", color: TITLE, flex: 1 },
  addBtn: {
    backgroundColor: MAIN,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 88,
    alignItems: "center",
  },
  addBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  listHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: TITLE,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  listSpinner: { marginVertical: 24 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  friendAv: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  friendDol: { fontSize: 22 },
  friendMid: { flex: 1, marginLeft: 12 },
  friendNick: { fontSize: 16, fontWeight: "700", color: TITLE },
  friendStatus: { fontSize: 13, color: "#666666", marginTop: 4 },
  cheerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cheerBtnActive: { backgroundColor: MAIN },
  cheerBtnDone: { backgroundColor: "#DDDDDD" },
  cheerBtnText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  cheerBtnTextDone: { color: "#666666" },
  groupScroll: { flex: 1 },
  groupScrollContent: { paddingBottom: 24 },
  groupTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TITLE,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  oceanBox: {
    height: 300,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: OCEAN,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 5,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  notifBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  oceanAvatar: {
    position: "absolute",
    alignItems: "center",
    width: 72,
    marginLeft: -36,
  },
  oceanAvatarInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  oceanEmoji: { fontSize: 22 },
  oceanNick: {
    marginTop: 4,
    fontSize: 10,
    color: "rgba(255,255,255,0.95)",
    maxWidth: 72,
    textAlign: "center",
  },
  groupListTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    color: TITLE,
  },
  groupListRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 12,
  },
  groupListNick: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontWeight: "600",
    color: TITLE,
  },
  groupListEmoji: { fontSize: 18 },
  burstLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  burstDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#87CEEB",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  profileSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 28,
    maxHeight: "92%",
  },
  profileClose: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  profileCloseText: { fontSize: 22, color: "#666666" },
  profileHero: {
    height: 180,
    backgroundColor: MAIN,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  profileAvatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  profileDolphin: { fontSize: 40 },
  profileName: {
    fontSize: 24,
    fontWeight: "700",
    color: TITLE,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 20,
  },
  profileSub: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 20,
  },
  statRow: {
    flexDirection: "row",
    marginTop: 20,
    paddingHorizontal: 16,
  },
  statCell: { flex: 1, alignItems: "center" },
  statNum: {
    fontSize: 22,
    fontWeight: "700",
    color: MAIN,
  },
  statLabel: { fontSize: 12, color: "#888888", marginTop: 4 },
  badgeSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TITLE,
    marginTop: 20,
    marginLeft: 16,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    marginTop: 10,
  },
  badgeItem: {
    width: "25%",
    alignItems: "center",
    marginBottom: 12,
  },
  badgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeMuted: {
    backgroundColor: "#CCCCCC",
    opacity: 0.4,
  },
  badgeIcon: { fontSize: 24 },
  badgeTip: {
    fontSize: 10,
    color: "#666666",
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  profileCheerBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: CHEER_ORANGE,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  profileCheerBtnOff: {
    backgroundColor: "#DDDDDD",
  },
  profileCheerText: {
    fontSize: 16,
    fontWeight: "700",
    color: TITLE,
  },
  profileCheerTextOff: {
    color: "#666666",
  },
});
