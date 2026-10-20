import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import app, { appEnvironment } from "../firebase";
const functions = getFunctions(app, "europe-west1");
if (appEnvironment === "local") connectFunctionsEmulator(functions, "127.0.0.1", 5001);
export async function checkMaintenanceMembership() {
  return (await httpsCallable<void, {member: boolean}>(functions, "maintenanceAccess")()).data.member;
}
