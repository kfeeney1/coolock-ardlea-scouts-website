import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + 1) >= 0) {
    throw new Error(`${path}: expected exactly one cutover target`);
  }
  await writeFile(path, source.slice(0, first) + after + source.slice(first + before.length), "utf8");
}

await replaceOnce(
  "firestore.rules",
`        allow create, update: if isActiveLeader()
          && exists(/databases/$(database)/documents/members/$(memberId))
          && (hasSection(get(/databases/$(database)/documents/members/$(memberId)).data.section) || isGroupLeader())
          && request.resource.data.awardId == awardId
          && request.resource.data.memberId == memberId
          && isCanonicalAdventureSkillStage(request.resource.data.skillId, request.resource.data.stage)
          && isCanonicalAdventureSkillAwardId(awardId, request.resource.data.skillId, request.resource.data.stage)
          && request.resource.data.awardedAt == request.time
          && request.resource.data.awardedBy == request.auth.uid
          && request.resource.data.keys().hasOnly(["awardId", "memberId", "skillId", "stage", "awardedAt", "awardedBy"]);
        allow delete: if isActiveLeader()
          && exists(/databases/$(database)/documents/members/$(memberId))
          && (hasSection(get(/databases/$(database)/documents/members/$(memberId)).data.section) || isGroupLeader());`,
`        // Award mutations are server-authoritative. The callable function validates
        // RBAC, canonical catalogue identity and competency completeness before its
        // Admin SDK transaction writes or removes an award. Historical reads remain
        // governed above; direct clients can never mutate award history.
        allow create, update, delete: if false;`
);

await replaceOnce(
  ".github/workflows/firebase-hosting-test.yml",
  "      - name: Install dependencies\n        run: npm ci",
  "      - name: Install dependencies\n        run: |\n          npm ci\n          npm --prefix functions install --no-audit --package-lock=false"
);
await replaceOnce(
  ".github/workflows/firebase-hosting-test.yml",
  "firestore:rules,firestore:indexes,storage:test-default,hosting",
  "firestore:rules,firestore:indexes,functions:adventure-skills,storage:test-default,hosting"
);

await replaceOnce(
  ".github/workflows/firebase-hosting-merge.yml",
  "          npm ci\n          npm install --no-save --package-lock=false @firebase/rules-unit-testing@5.0.2 firebase-tools@15.28.1",
  "          npm ci\n          npm --prefix functions install --no-audit --package-lock=false\n          npm install --no-save --package-lock=false @firebase/rules-unit-testing@5.0.2 firebase-tools@15.28.1"
);
await replaceOnce(
  ".github/workflows/firebase-hosting-merge.yml",
  "firestore:rules,firestore:indexes,storage:production-default,hosting",
  "firestore:rules,firestore:indexes,functions:adventure-skills,storage:production-default,hosting"
);

await replaceOnce(
  ".github/workflows/playwright-e2e.yml",
  "      VITE_FIREBASE_AUTH_EMULATOR_HOST: 127.0.0.1:9099\n      FIREBASE_AUTH_EMULATOR_HOST: 127.0.0.1:9099",
  "      VITE_FIREBASE_AUTH_EMULATOR_HOST: 127.0.0.1:9099\n      FIREBASE_AUTH_EMULATOR_HOST: 127.0.0.1:9099\n      VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST: 127.0.0.1:5001"
);
await replaceOnce(
  ".github/workflows/playwright-e2e.yml",
  "        run: npm install --no-save --package-lock=false --include=optional --no-audit firebase-admin@14.3.0 firebase-tools@15.28.1",
  "        run: |\n          npm install --no-save --package-lock=false --include=optional --no-audit firebase-admin@14.3.0 firebase-tools@15.28.1\n          npm --prefix functions install --no-audit --package-lock=false\n          node --experimental-strip-types functions/scripts/generate-adventure-catalogue.mjs"
);
await replaceOnce(
  ".github/workflows/playwright-e2e.yml",
  "npx firebase emulators:start --only firestore,auth,storage --project \"$FIREBASE_PROJECT_ID\"",
  "npx firebase emulators:start --only firestore,auth,functions,storage --project \"$FIREBASE_PROJECT_ID\""
);
await replaceOnce(
  ".github/workflows/playwright-e2e.yml",
  "if (echo > /dev/tcp/127.0.0.1/8080) 2>/dev/null && (echo > /dev/tcp/127.0.0.1/9099) 2>/dev/null && (echo > /dev/tcp/127.0.0.1/9199) 2>/dev/null; then",
  "if (echo > /dev/tcp/127.0.0.1/8080) 2>/dev/null && (echo > /dev/tcp/127.0.0.1/9099) 2>/dev/null && (echo > /dev/tcp/127.0.0.1/5001) 2>/dev/null && (echo > /dev/tcp/127.0.0.1/9199) 2>/dev/null; then"
);

await replaceOnce(
  "scripts/check-firebase-deployment-config.mjs",
  'requireContract(firebase?.storage?.rules === "storage.rules", "firebase.json declares Storage rules.");',
  'requireContract(firebase?.storage?.rules === "storage.rules", "firebase.json declares Storage rules.");\nrequireContract(Array.isArray(firebase?.functions) && firebase.functions.some((item) => item?.codebase === "adventure-skills" && item?.source === "functions"), "firebase.json declares the authoritative Adventure Skills functions codebase.");'
);
await replaceOnce(
  "scripts/check-firebase-deployment-config.mjs",
  'requireContract(testWorkflow.includes("firestore:rules,firestore:indexes,storage:test-default,hosting"), "TEST deploys reviewed Rules, indexes, explicit TEST Storage rules and Hosting together.");',
  'requireContract(testWorkflow.includes("firestore:rules,firestore:indexes,functions:adventure-skills,storage:test-default,hosting"), "TEST deploys reviewed Rules, indexes, authoritative functions, explicit TEST Storage rules and Hosting together.");'
);
await replaceOnce(
  "scripts/check-firebase-deployment-config.mjs",
  'requireContract(productionWorkflow.includes("tests/storage/*.test.mjs"), "Production reruns Storage Rules tests on emulators before deployment.");',
  'requireContract(productionWorkflow.includes("tests/storage/*.test.mjs"), "Production reruns Storage Rules tests on emulators before deployment.");\nrequireContract(productionWorkflow.includes("functions:adventure-skills"), "Production deploy includes the authoritative Adventure Skills functions codebase.");'
);

console.log("Applied SW-24 authoritative award security cutover.");
