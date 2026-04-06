import React, { useEffect, useState } from "react";
import {
  Image,
  NativeModules,
  Platform,
  StyleSheet,
  type StyleProp,
  type ImageStyle,
} from "react-native";
import { AppText } from "../../../components/AppText";

type Mod = { getAppIconBase64?: (pkg: string) => Promise<string | null> };

type Props = {
  packageName?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function DashboardAppIcon({ packageName, size = 40, style }: Props) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pkg = packageName?.trim();
    if (!pkg || Platform.OS !== "android") {
      setUri(null);
      return;
    }
    const mod = NativeModules.UsageStatsModule as Mod | undefined;
    if (!mod?.getAppIconBase64) {
      setUri(null);
      return;
    }
    void mod.getAppIconBase64(pkg).then((b64) => {
      if (cancelled || !b64) return;
      setUri(`data:image/png;base64,${b64}`);
    });
    return () => {
      cancelled = true;
    };
  }, [packageName]);

  const dim = { width: size, height: size, borderRadius: size * 0.2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.img, dim, style]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <AppText
      style={{
        fontSize: size * 0.55,
        lineHeight: size,
        width: size,
        textAlign: "center",
      }}
    >
      📱
    </AppText>
  );
}

const styles = StyleSheet.create({
  img: {
    backgroundColor: "#F0F0F0",
  },
});
