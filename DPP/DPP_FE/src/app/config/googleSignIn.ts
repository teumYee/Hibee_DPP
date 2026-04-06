import { GoogleSignin } from "@react-native-google-signin/google-signin";

/**
 * Google Cloud Console → OAuth 2.0 클라이언트 ID 중 **웹 애플리케이션** 유형 ID
 * (idToken·백엔드 검증용 webClientId)
 */
export const GOOGLE_WEB_CLIENT_ID =
  "46727891240-lvl9m32kma1fn5tr09ad1dbmiu9v75ip.apps.googleusercontent.com";

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
}
