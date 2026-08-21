import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const password = process.env.E2E_TEST_USER_PASSWORD;
const action = process.argv[2] || "seed";

if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
if (!["seed", "cleanup"].includes(action)) throw new Error("Usage: node scripts/seed-e2e-auth-users.mjs seed|cleanup");
if (action === "seed" && (!password || password.length < 8)) {
  throw new Error("E2E_TEST_USER_PASSWORD must be configured and contain at least 8 characters.");
}

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const auth = getAuth();
const db = getFirestore();

const users = [
  {
    uid: "TEST_uid_parent_only_01",
    email: "test.parent.only@example.com",
    displayName: "Mark Byrne",
    kind: "parent-only"
  },
  {
    uid: "TEST_uid_leader_parent_01",
    email: "test.leader.parent@example.com",
    displayName: "Niamh Murphy",
    kind: "parent-leader",
    admin: { role: "leader", sections: ["Beavers"] }
  },
  {
    uid: "TEST_uid_leader_only_01",
    email: "test.leader.only@example.com",
    displayName: "Aisling Ryan",
    kind: "leader",
    admin: { role: "leader", sections: ["Scouts"] }
  },
  {
    uid: "TEST_uid_multi_section_leader_01",
    email: "test.leader.multisection@example.com",
    displayName: "Conor Walsh",
    kind: "multi-section-leader",
    admin: { role: "leader", sections: ["Beavers", "Cubs"] }
  },
  {
    uid: "TEST_uid_admin_01",
    email: "test.admin@example.com",
    displayName: "Orla Kelly",
    kind: "admin",
    admin: { role: "admin", sections: ["Group"] }
  },
  {
    uid: "TEST_uid_super_admin_01",
    email: "test.superadmin@example.com",
    displayName: "Test Super Admin",
    kind: "super-admin",
    admin: { role: "super-admin", sections: ["Group"] }
  }
];

async function upsertAuthUser(user) {
  try {
    const existing = await auth.getUser(user.uid);
    if (existing.email !== user.email) {
      throw new Error(`UID ${user.uid} already exists with unexpected email ${existing.email}.`);
    }
    await auth.updateUser(user.uid, {
      email: user.email,
      password,
      displayName: user.displayName,
      disabled: false,
      emailVerified: true
    });
    console.log(`  updated Auth user ${user.email}`);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password,
      displayName: user.displayName,
      disabled: false,
      emailVerified: true
    });
    console.log(`  created Auth user ${user.email}`);
  }
}

async function seedAdminProfile(user) {
  if (!user.admin) return;
  await db.collection("adminUsers").doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.admin.role,
      sections: user.admin.sections,
      section: user.admin.sections[0] || "",
      active: true,
      testData: true,
      testSeed: "stage8-role-demo",
      createdBySeed: "TEST_SEED",
      testRoleType: user.kind,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  console.log(`  ensured adminUsers/${user.uid} (${user.admin.role})`);
}

async function seed() {
  console.log("Creating/updating login-capable E2E Firebase Auth users...");
  for (const user of users) {
    await upsertAuthUser(user);
    await seedAdminProfile(user);
  }
  console.log("\nE2E Auth seed complete.");
  console.log("All six accounts use the password stored in E2E_TEST_USER_PASSWORD.");
  console.log("Multi-section leader sections: Beavers,Cubs");
}

async function cleanup() {
  console.log("Removing E2E Firebase Auth users and companion role records...");
  for (const user of users) {
    try {
      await auth.deleteUser(user.uid);
      console.log(`  deleted Auth user ${user.email}`);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }

    if (user.admin && ["multi-section-leader", "admin", "super-admin"].includes(user.kind)) {
      const ref = db.collection("adminUsers").doc(user.uid);
      const snapshot = await ref.get();
      if (snapshot.exists) {
        if (snapshot.data()?.testData !== true) {
          throw new Error(`Refusing to delete adminUsers/${user.uid}: testData marker is missing.`);
        }
        await ref.delete();
        console.log(`  deleted adminUsers/${user.uid}`);
      }
    }
  }
  console.log("\nE2E Auth cleanup complete.");
}

if (action === "seed") await seed();
else await cleanup();
