import test from "node:test";
import assert from "node:assert/strict";
import { validateMemberLeaderTransition } from "../../src/services/memberLeaderTransitionLogic.ts";

const base = {
  request: {
    transitionInvitationId: "invite-1234567890123456",
    transitionEndMemberMembership: true,
    email: "casey@example.com",
    fullName: "Casey Cub",
    mobileNumber: "0871111111",
    requestedSection: "Cubs",
  },
  invitation: {
    id: "invite-1234567890123456",
    memberId: "member-cub",
    firstName: "Casey",
    lastName: "Cub",
    emailAddress: "Casey@Example.com",
    mobileNumber: "0871111111",
    section: "Cubs",
    endMemberMembership: true,
  },
  member: { firstName: "Casey", lastName: "Cub", emailAddress: "casey@example.com", status: "active" },
};

test("approved transition ends youth membership only after validating existing identity", () => {
  assert.equal(validateMemberLeaderTransition(base.request, base.invitation, base.member, "new-leader-uid"), "left");
});

test("approved transition can retain a legitimate concurrent member status", () => {
  const request = { ...base.request, transitionEndMemberMembership: false };
  const invitation = { ...base.invitation, endMemberMembership: false };
  assert.equal(validateMemberLeaderTransition(request, invitation, { ...base.member, status: "active" }, "leader-uid"), "active");
});

test("transition rejects changed identity, membership choice, and duplicate account links", () => {
  assert.throws(() => validateMemberLeaderTransition({ ...base.request, email: "different@example.com" }, base.invitation, base.member, "uid"), /identity does not match/);
  assert.throws(() => validateMemberLeaderTransition({ ...base.request, transitionEndMemberMembership: false }, base.invitation, base.member, "uid"), /identity does not match/);
  assert.throws(() => validateMemberLeaderTransition(base.request, base.invitation, { ...base.member, accountUid: "another-uid" }, "uid"), /already linked/);
  assert.throws(() => validateMemberLeaderTransition(base.request, base.invitation, { ...base.member, firstName: "Changed" }, "uid"), /identity changed/);
});

test("existing linked account is reused without replacing its identity", () => {
  assert.equal(validateMemberLeaderTransition(base.request, base.invitation, { ...base.member, accountUid: "existing-parent" }, "existing-parent"), "left");
});

test("concurrent multi-section member retains inactive and historical membership state", () => {
  assert.equal(validateMemberLeaderTransition({ ...base.request, transitionEndMemberMembership: false }, { ...base.invitation, endMemberMembership: false }, { ...base.member, status: "inactive" }, "uid"), "inactive");
});
