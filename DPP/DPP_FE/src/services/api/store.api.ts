// 상점 — 아이템 목록, 인벤토리, 구매
import { get, post } from "./client";
import { ENDPOINTS } from "./endpoints";

export type ItemCategory = "character" | "accessory" | "background" | "effect";

export type StoreItem = {
  id: string;
  name: string;
  category: ItemCategory;
  price: number;
  image_url?: string;
  is_owned: boolean;
};

export type PurchaseRequest = {
  item_id: string;
};

export type PurchaseResponse = {
  success: boolean;
  remaining_coins: number;
};

export async function getStoreItems(): Promise<StoreItem[]> {
  return get<StoreItem[]>(ENDPOINTS.storeItems);
}

export async function getInventory(): Promise<StoreItem[]> {
  return get<StoreItem[]>(ENDPOINTS.storeInventory);
}

export async function purchaseItem(
  req: PurchaseRequest,
): Promise<PurchaseResponse> {
  return post<PurchaseResponse>(ENDPOINTS.storePurchase, req);
}
