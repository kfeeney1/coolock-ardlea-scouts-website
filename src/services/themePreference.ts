import { ServiceFailure } from "./applicationErrors.ts";
import { doc, updateDoc } from "firebase/firestore";

import { auth, db } from "../firebase";
import type { ThemeName } from "../theme/themePreferences";

export async function saveThemePreference(theme: ThemeName): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("You must be signed in to change the look and feel.", "auth/unauthenticated");
  await updateDoc(doc(db, "adminUsers", user.uid), { uiTheme: theme });
}
