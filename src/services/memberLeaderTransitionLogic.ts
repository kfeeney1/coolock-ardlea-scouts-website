import { UserFacingError } from "./applicationErrors.ts";
type TransitionRequest = {
  transitionInvitationId?: string;
  transitionEndMemberMembership?: boolean;
  email: string;
  fullName: string;
  mobileNumber: string;
  requestedSection: string;
};

type TransitionInvitation = {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  mobileNumber: string;
  section: string;
  endMemberMembership: boolean;
};

type TransitionMember = {
  accountUid?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  emailAddress?: unknown;
  status?: unknown;
};

const email = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function validateMemberLeaderTransition(
  request: TransitionRequest,
  invitation: TransitionInvitation,
  member: TransitionMember,
  accountUid: string,
): "active" | "inactive" | "left" {
  const expectedName = `${invitation.firstName} ${invitation.lastName}`.trim().toLocaleLowerCase();
  const submittedName = text(request.fullName).toLocaleLowerCase();
  if (request.transitionInvitationId !== invitation.id
    || request.transitionEndMemberMembership !== invitation.endMemberMembership
    || email(request.email) !== email(invitation.emailAddress)
    || submittedName !== expectedName
    || text(request.mobileNumber) !== text(invitation.mobileNumber)) {
    throw new UserFacingError("The request identity does not match the member transition.");
  }
  const memberName = `${text(member.firstName)} ${text(member.lastName)}`.trim().toLocaleLowerCase();
  if (email(member.emailAddress) !== email(request.email) || memberName !== submittedName) {
    throw new UserFacingError("Member identity changed after the transition link was prepared.");
  }
  if (member.accountUid && member.accountUid !== accountUid) {
    throw new UserFacingError("This member is already linked to another account.");
  }
  if (member.status !== "active" && member.status !== "inactive" && member.status !== "left") {
    throw new UserFacingError("The member record has an unsupported status.");
  }
  return invitation.endMemberMembership ? "left" : member.status;
}
