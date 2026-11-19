import { Timestamp, type DocumentData } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import app, { appEnvironment } from "../firebase";

const functions = getFunctions(app, "europe-west1");
if (appEnvironment === "local") connectFunctionsEmulator(functions, "127.0.0.1", 5001);

type ConsentDocument = { id: string; section: string; data: DocumentData };
const read = httpsCallable<{ consentId?: string }, ConsentDocument[]>(functions, "leaderConsentRead");

export async function readLeaderConsent(consentId?: string) {
    const response = await read(consentId === undefined ? {} : { consentId });
    return response.data.map(({ id, section, data }) => {
        for (const key of ["submittedAt", "updatedAt", "parentUpdatedAt", "linkedAt", "reconciledAt"]) {
            const time = data[key];
            if (time && Number.isInteger(time.seconds) && Number.isInteger(time.nanoseconds)) {
                data[key] = new Timestamp(time.seconds, time.nanoseconds);
            }
        }
        return { id, section, data };
    });
}
