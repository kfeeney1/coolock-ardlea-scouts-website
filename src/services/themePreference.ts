import { doc, updateDoc } from "firebase/firestore";

import { auth, db } from "../firebase";
import type { ThemeName } from "../theme/themePreferences";

export async function saveThemePreference(theme: ThemeName): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to change the look and feel.");
  await updateDoc(doc(db, "adminUsers", user.uid), { uiTheme: theme });
}
