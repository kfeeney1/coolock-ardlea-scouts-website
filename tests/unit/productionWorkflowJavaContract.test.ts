import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/firebase-hosting-merge.yml', 'utf8');

describe('production deployment Java contract', () => {
  it('provisions Java 21 before Firebase emulator release checks', () => {
    const setupJava = workflow.indexOf('- name: Setup Java for Firebase emulators');
    const firestoreTests = workflow.indexOf('- name: Re-run Firestore Rules tests on emulators');

    expect(setupJava).toBeGreaterThan(-1);
    expect(workflow).toContain('uses: actions/setup-java@dd06d9cba3e5552c54d9f8ea23572deb30010f7c # v6.0.0');
    expect(workflow).toContain("java-version: '21'");
    expect(setupJava).toBeLessThan(firestoreTests);
  });
});
