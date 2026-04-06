/** @type {import('@react-native-community/cli-types').Config} */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  /** TTF 등 — 넣은 뒤 프로젝트 루트에서 `npx react-native-asset` 실행 */
  assets: ["./src/assets/fonts/"],
};
