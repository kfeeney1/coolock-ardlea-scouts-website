import { describe,expect,it } from "vitest";
import { ALL_AUTHORISED_SECTIONS,authorisedSubsSections,isMemberInSubsScope,normaliseSubsSection } from "../../src/services/subsScope.ts";

describe("Subs authorised section scope",()=>{
 it("uses canonical section ordering and excludes Group",()=>{expect(authorisedSubsSections(["Scouts","Group","Beavers","Cubs"],false)).toEqual(["Beavers","Cubs","Scouts"]);});
 it("defaults a single-section user to that section",()=>{expect(normaliseSubsSection("all",["Cubs"],false)).toBe("Cubs");});
 it("defaults a multi-section user to all authorised sections",()=>{expect(normaliseSubsSection(undefined,["Cubs","Scouts"],false)).toBe(ALL_AUTHORISED_SECTIONS);});
 it("normalises a stale or unauthorised section",()=>{expect(normaliseSubsSection("Ventures",["Cubs","Scouts"],false)).toBe(ALL_AUTHORISED_SECTIONS);});
 it("keeps a valid selected section",()=>{expect(normaliseSubsSection("Scouts",["Cubs","Scouts"],false)).toBe("Scouts");});
 it("never expands member scope beyond authorised sections",()=>{expect(isMemberInSubsScope("Ventures","all",["Cubs","Scouts"])).toBe(false);expect(isMemberInSubsScope("Cubs","all",["Cubs","Scouts"])).toBe(true);expect(isMemberInSubsScope("Cubs","Scouts",["Cubs","Scouts"])).toBe(false);});
});
