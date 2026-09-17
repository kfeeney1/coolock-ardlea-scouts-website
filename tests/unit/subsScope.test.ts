import assert from "node:assert/strict";
import test from "node:test";
import { ALL_AUTHORISED_SECTIONS,authorisedSubsSections,isMemberInSubsScope,normaliseSubsSection } from "../../src/services/subsScope.ts";

test("Subs scope uses canonical section ordering and excludes Group",()=>{assert.deepEqual(authorisedSubsSections(["Scouts","Group","Beavers","Cubs"],false),["Beavers","Cubs","Scouts"]);});
test("Subs scope defaults a single-section user to that section",()=>{assert.equal(normaliseSubsSection("all",["Cubs"],false),"Cubs");});
test("Subs scope defaults a multi-section user to all authorised sections",()=>{assert.equal(normaliseSubsSection(undefined,["Cubs","Scouts"],false),ALL_AUTHORISED_SECTIONS);});
test("Subs scope normalises a stale or unauthorised section",()=>{assert.equal(normaliseSubsSection("Ventures",["Cubs","Scouts"],false),ALL_AUTHORISED_SECTIONS);});
test("Subs scope keeps a valid selected section",()=>{assert.equal(normaliseSubsSection("Scouts",["Cubs","Scouts"],false),"Scouts");});
test("Subs scope never expands member scope beyond authorised sections",()=>{assert.equal(isMemberInSubsScope("Ventures","all",["Cubs","Scouts"]),false);assert.equal(isMemberInSubsScope("Cubs","all",["Cubs","Scouts"]),true);assert.equal(isMemberInSubsScope("Cubs","Scouts",["Cubs","Scouts"]),false);});
