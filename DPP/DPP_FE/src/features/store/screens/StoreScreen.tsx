import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../../navigation/types";
import { getUserSummary } from "../../../services/api/main.api";
import {
  purchaseItem,
  type ItemCategory,
  type StoreItem,
} from "../../../services/api/store.api";

const MAIN = "#2E7FC1";
const GOLD = "#FFD700";
const PREVIEW_BG = "#1B4F8A";
const BUBBLE = "#87CEEB";
const BG_PAGE = "#F5F7FA";
const TITLE = "#1A1A2E";

type Props = NativeStackScreenProps<MainStackParamList, "Store">;

/** 목 데이터 — TODO: getStoreItems() + getInventory() 연동 후 제거·병합 */
const MOCK_ITEMS: StoreItem[] = [
  {
    id: "1",
    name: "기본 돌고래",
    category: "character",
    price: 0,
    is_owned: true,
  },
  {
    id: "2",
    name: "참게",
    category: "character",
    price: 390,
    is_owned: false,
  },
  {
    id: "3",
    name: "고래",
    category: "character",
    price: 200,
    is_owned: false,
  },
  {
    id: "4",
    name: "거북이",
    category: "character",
    price: 280,
    is_owned: false,
  },
  {
    id: "5",
    name: "반짝 왕관",
    category: "accessory",
    price: 0,
    is_owned: true,
  },
  {
    id: "6",
    name: "산호 왕관",
    category: "accessory",
    price: 120,
    is_owned: false,
  },
  {
    id: "7",
    name: "조개 장식",
    category: "accessory",
    price: 0,
    is_owned: false,
  },
  {
    id: "8",
    name: "별빛 안경",
    category: "accessory",
    price: 80,
    is_owned: false,
  },
];

const TABS: { key: ItemCategory; label: string }[] = [
  { key: "character", label: "캐릭터" },
  { key: "accessory", label: "액세서리" },
  { key: "background", label: "배경" },
  { key: "effect", label: "이펙트" },
];

function categoryEmoji(c: ItemCategory): string {
  switch (c) {
    case "character":
      return "🐬";
    case "accessory":
      return "👑";
    case "background":
      return "🌊";
    case "effect":
      return "✨";
  }
}

function runCoinShake(anim: Animated.Value): void {
  anim.setValue(0);
  Animated.sequence([
    Animated.timing(anim, {
      toValue: -10,
      duration: 45,
      useNativeDriver: true,
    }),
    Animated.timing(anim, {
      toValue: 10,
      duration: 45,
      useNativeDriver: true,
    }),
    Animated.timing(anim, {
      toValue: -8,
      duration: 45,
      useNativeDriver: true,
    }),
    Animated.timing(anim, {
      toValue: 8,
      duration: 45,
      useNativeDriver: true,
    }),
    Animated.timing(anim, {
      toValue: 0,
      duration: 45,
      useNativeDriver: true,
    }),
  ]).start();
}

export function StoreScreen({ navigation }: Props) {
  const [coins, setCoins] = useState(0);
  const [items, setItems] = useState<StoreItem[]>(MOCK_ITEMS);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ItemCategory>("character");
  const [purchaseTarget, setPurchaseTarget] = useState<StoreItem | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const coinShake = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(320)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslate = useRef(new Animated.Value(24)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const screenW = Dimensions.get("window").width;
  const gridGap = 12;
  const gridPad = 16;
  const itemWidth = (screenW - gridPad * 2 - gridGap) / 2;

  useEffect(() => {
    let alive = true;
    (async () => {
      setSummaryLoading(true);
      try {
        const s = await getUserSummary();
        if (alive) setCoins(s.coins);
      } catch {
        if (alive) setCoins(0);
      } finally {
        if (alive) setSummaryLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!purchaseTarget) return;
    sheetY.setValue(320);
    Animated.spring(sheetY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  }, [purchaseTarget, sheetY]);

  const closeModal = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: 320,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setPurchaseTarget(null));
  }, [sheetY]);

  const showToast = useCallback(
    (msg: string) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastMsg(msg);
      toastOpacity.setValue(0);
      toastTranslate.setValue(24);
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslate, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
      toastTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(toastTranslate, {
            toValue: 24,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setToastMsg(null));
      }, 2000);
    },
    [toastOpacity, toastTranslate],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const filtered = useMemo(
    () => items.filter((i) => i.category === activeCategory),
    [items, activeCategory],
  );

  const onPressItem = useCallback(
    (item: StoreItem) => {
      if (item.is_owned) return;
      if (coins < item.price) {
        runCoinShake(coinShake);
        showToast("코인이 부족해요 🪙");
        return;
      }
      setPurchaseTarget(item);
    },
    [coins, coinShake, showToast],
  );

  const onConfirmPurchase = useCallback(async () => {
    if (!purchaseTarget) return;
    setPurchaseLoading(true);
    try {
      const res = await purchaseItem({ item_id: purchaseTarget.id });
      if (res.success) {
        setCoins(res.remaining_coins);
        setItems((prev) =>
          prev.map((x) =>
            x.id === purchaseTarget.id ? { ...x, is_owned: true } : x,
          ),
        );
        closeModal();
        showToast("구매 완료!");
      } else {
        showToast("구매에 실패했어요");
      }
    } catch {
      showToast("구매에 실패했어요");
    } finally {
      setPurchaseLoading(false);
    }
  }, [purchaseTarget, closeModal, showToast]);

  const renderItem = useCallback(
    ({ item }: { item: StoreItem }) => {
      const owned = item.is_owned;
      const affordable = coins >= item.price;
      return (
        <Pressable
          style={[styles.itemCard, { width: itemWidth }]}
          onPress={() => onPressItem(item)}
          disabled={owned}
        >
          <View style={styles.itemImageBox}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.itemImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.itemEmoji}>{categoryEmoji(item.category)}</Text>
            )}
          </View>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>
          {owned ? (
            <View style={[styles.pricePill, styles.pillOwned]}>
              <Text style={styles.pillOwnedText}>보유중</Text>
            </View>
          ) : (
            <View
              style={[
                styles.pricePill,
                styles.pillBuy,
                !affordable && styles.pillDisabled,
              ]}
            >
              <Text
                style={[
                  styles.pillBuyText,
                  !affordable && styles.pillBuyTextMuted,
                ]}
              >
                💰 {item.price}
              </Text>
            </View>
          )}
        </Pressable>
      );
    },
    [coins, itemWidth, onPressItem],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.headerSide}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>꾸미기 상점</Text>
        <Animated.View
          style={[styles.coinPillWrap, { transform: [{ translateX: coinShake }] }]}
        >
          <View style={styles.coinPill}>
            {summaryLoading ? (
              <ActivityIndicator size="small" color={TITLE} />
            ) : (
              <Text style={styles.coinPillText}>💰 {coins}</Text>
            )}
          </View>
        </Animated.View>
      </View>

      <View style={styles.preview}>
        {/* TODO: 실제 캐릭터 이미지로 교체 */}
        <View style={styles.previewBubble}>
          <Text style={styles.previewEmoji}>🐬</Text>
        </View>
        <Text style={styles.previewCaption}>내 드롭핀 꾸미기</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const on = t.key === activeCategory;
          return (
            <Pressable
              key={t.key}
              style={[styles.tab, on ? styles.tabOn : styles.tabOff]}
              onPress={() => setActiveCategory(t.key)}
            >
              <Text style={[styles.tabText, on ? styles.tabTextOn : styles.tabTextOff]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>이 카테고리에는 아직 상품이 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={purchaseTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
            {purchaseTarget ? (
              <>
                <Text style={styles.sheetTitle}>{purchaseTarget.name}</Text>
                <Text style={styles.sheetQuestion}>
                  💰 {purchaseTarget.price}코인을 사용할까요?
                </Text>
                <Text style={styles.sheetCoins}>현재 {coins}코인 보유중</Text>
                <View style={styles.sheetActions}>
                  <Pressable
                    style={[styles.sheetBtn, styles.sheetBtnGray]}
                    onPress={closeModal}
                    disabled={purchaseLoading}
                  >
                    <Text style={styles.sheetBtnGrayText}>취소</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.sheetBtn, styles.sheetBtnBlue]}
                    onPress={() => void onConfirmPurchase()}
                    disabled={purchaseLoading}
                  >
                    {purchaseLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.sheetBtnBlueText}>구매하기</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </Animated.View>
        </View>
      </Modal>

      {toastMsg ? (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslate }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG_PAGE,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  headerSide: {
    width: 44,
  },
  back: {
    fontSize: 24,
    color: TITLE,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: TITLE,
  },
  coinPillWrap: {
    minWidth: 72,
    alignItems: "flex-end",
  },
  coinPill: {
    backgroundColor: GOLD,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  coinPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: TITLE,
  },
  preview: {
    height: 180,
    backgroundColor: PREVIEW_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BUBBLE,
    alignItems: "center",
    justifyContent: "center",
  },
  previewEmoji: {
    fontSize: 32,
  },
  previewCaption: {
    marginTop: 10,
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E8E8",
  },
  tab: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabOn: {
    backgroundColor: MAIN,
  },
  tabOff: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextOn: {
    color: "#FFFFFF",
  },
  tabTextOff: {
    color: "#888888",
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    padding: 10,
    alignItems: "center",
  },
  itemImageBox: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  itemImage: {
    width: "80%",
    height: "80%",
  },
  itemEmoji: {
    fontSize: 44,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "600",
    color: TITLE,
    textAlign: "center",
    minHeight: 36,
    marginBottom: 8,
  },
  pricePill: {
    alignSelf: "stretch",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  pillOwned: {
    backgroundColor: MAIN,
  },
  pillOwnedText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  pillBuy: {
    backgroundColor: GOLD,
  },
  pillBuyText: {
    fontSize: 12,
    fontWeight: "700",
    color: TITLE,
  },
  pillDisabled: {
    backgroundColor: "#CCCCCC",
    opacity: 0.5,
  },
  pillBuyTextMuted: {
    color: "#555555",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 15,
    color: "#888888",
    textAlign: "center",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TITLE,
    marginBottom: 12,
  },
  sheetQuestion: {
    fontSize: 16,
    color: "#444444",
    marginBottom: 8,
  },
  sheetCoins: {
    fontSize: 14,
    color: "#888888",
    marginBottom: 20,
  },
  sheetActions: {
    flexDirection: "row",
  },
  sheetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  sheetBtnGray: {
    backgroundColor: "#E8E8E8",
    marginRight: 6,
  },
  sheetBtnGrayText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#555555",
  },
  sheetBtnBlue: {
    backgroundColor: MAIN,
    marginLeft: 6,
  },
  sheetBtnBlueText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 32,
    backgroundColor: "rgba(30,30,40,0.92)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
