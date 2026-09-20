import assert from "node:assert/strict";
import test from "node:test";
import { ALL_AUTHORISED_SECTIONS,authorisedSubsSections,isMemberInSubsScope,normaliseSubsSection,selectableSubsSections } from "../../src/services/subsScope.ts";

test("Subs scope uses canonical section ordering and excludes Group",()=>{assert.deepEqual(authorisedSubsSections(["Scouts","Group","Beavers","Cubs"],false),["Beavers","Cubs","Scouts"]);});
test("Subs scope defaults a single-section user to that section",()=>{assert.equal(normaliseSubsSection("all",["Cubs"],false),"Cubs");});
test("Subs scope defaults a multi-section user to all authorised sections",()=>{assert.equal(normaliseSubsSection(undefined,["Cubs","Scouts"],false),ALL_AUTHORISED_SECTIONS);});
test("Subs scope normalises a stale or unauthorised section",()=>{assert.equal(normaliseSubsSection("Ventures",["Cubs","Scouts"],false),ALL_AUTHORISED_SECTIONS);});
test("Subs scope keeps a valid selected section",()=>{assert.equal(normaliseSubsSection("Scouts",["Cubs","Scouts"],false),"Scouts");});
test("Subs scope never expands member scope beyond authorised sections",()=>{assert.equal(isMemberInSubsScope("Ventures","all",["Cubs","Scouts"]),false);assert.equal(isMemberInSubsScope("Cubs","all",["Cubs","Scouts"]),true);assert.equal(isMemberInSubsScope("Cubs","Scouts",["Cubs","Scouts"]),false);});
test("group finance derives youth-section choices from the permitted member population",()=>{assert.deepEqual(selectableSubsSections([],true,["Scouts","Beavers","Cubs","Scouts","Group"]),["Beavers","Cubs","Scouts"]);});
test("group finance all scope includes youth members when the profile only contains Group",()=>{assert.equal(isMemberInSubsScope("Cubs","all",[],true),true);assert.equal(isMemberInSubsScope("Cubs","Scouts",[],true),false);});
test("section finance cannot expand choices from members outside its authority",()=>{assert.deepEqual(selectableSubsSections(["Cubs"],false,["Cubs","Scouts"]),["Cubs"]);});
