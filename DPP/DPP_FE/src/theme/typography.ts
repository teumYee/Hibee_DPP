import type { TextStyle } from "react-native";
import { APP_FONT_FAMILY } from "./appFont";

export { APP_FONT_FAMILY } from "./appFont";

/** `AppText`·`AppTextInput`에서 사용. SVG(`react-native-svg`)·서드파티 등은 `APP_FONT_FAMILY` 또는 이 객체를 직접 적용 */
export const appFontFamily: TextStyle = { fontFamily: APP_FONT_FAMILY };
