import assert from "node:assert/strict";
import test from "node:test";

import { requireFirebaseMutationTarget } from "../../scripts/firebase-operation-guard.mjs";

function restore(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

function withTarget(environment: string, projectId: string, callback: () => void) {
  const previousEnvironment = process.env.DEPLOY_ENVIRONMENT;
  const previousProject = process.env.FIREBASE_PROJECT_ID;
  const previousAppEnvironment = process.env.APP_ENVIRONMENT;
  const previousViteEnvironment = process.env.VITE_APP_ENV;

  process.env.DEPLOY_ENVIRONMENT = environment;
  process.env.FIREBASE_PROJECT_ID = projectId;
  delete process.env.APP_ENVIRONMENT;
  delete process.env.VITE_APP_ENV;

  try {
    callback();
  } finally {
    restore("DEPLOY_ENVIRONMENT", previousEnvironment);
    restore("FIREBASE_PROJECT_ID", previousProject);
    restore("APP_ENVIRONMENT", previousAppEnvironment);
    restore("VITE_APP_ENV", previousViteEnvironment);
  }
}

test("TEST mutation accepts only the canonical TEST project and credential", () => {
  withTarget("test", "coolock-ardlea-scouts-test", () => {
    const result = requireFirebaseMutationTarget({
      operation: "unit-test-seed",
      credentialJson: JSON.stringify({ project_id: "coolock-ardlea-scouts-test" }),
    });

    assert.equal(result.environment, "test");
    assert.equal(result.projectId, "coolock-ardlea-scouts-test");
  });
});

test("TEST mutation rejects a production project target", () => {
  withTarget("test", "coolock-ardlea-scouts", () => {
    assert.throws(
      () => requireFirebaseMutationTarget({
        operation: "unit-test-seed",
        credentialJson: JSON.stringify({ project_id: "coolock-ardlea-scouts" }),
      }),
      /test must target coolock-ardlea-scouts-test/,
    );
  });
});

test("ordinary seed mutation cannot opt into production accidentally", () => {
  withTarget("production", "coolock-ardlea-scouts", () => {
    assert.throws(
      () => requireFirebaseMutationTarget({
        operation: "unit-test-seed",
        credentialJson: JSON.stringify({ project_id: "coolock-ardlea-scouts" }),
      }),
      /production mutation is not supported by this script/,
    );
  });
});

test("TEST mutation rejects a mismatched service-account project", () => {
  withTarget("test", "coolock-ardlea-scouts-test", () => {
    assert.throws(
      () => requireFirebaseMutationTarget({
        operation: "unit-test-seed",
        credentialJson: JSON.stringify({ project_id: "coolock-ardlea-scouts" }),
      }),
      /service-account project_id coolock-ardlea-scouts does not match test target coolock-ardlea-scouts-test/,
    );
  });
});
