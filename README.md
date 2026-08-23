# Coolock Ardlea Scouts Website

This repository contains the Coolock Ardlea Scouts website and leader/parent administration tools.

## Development

Install dependencies and run the app locally with the standard npm scripts in `package.json`.

## Test data

The live test-data reset is deliberately deterministic and test-only. It purges records that are explicitly marked as test data or that contain stable `TEST_` references, then rebuilds a complete fixture set without touching unrelated real records.

The comprehensive population contains 150 unique youth members: exactly 30 each in Beavers, Cubs, Scouts, Ventures and Rovers. It also contains every public Group executive option, Section Leader, Assistant Section Leader, Programme Scouter and Scouter examples in every youth section, parent-only accounts, parent+leader accounts, leader-only accounts, plus private Admin and Super Admin fixtures that must never appear in public Who's Who.

The full-system flow seed adds examples for join lifecycle states, parent approval states, leader-registration review states, event lifecycle states, public events, youth/scouter consent, active/inactive consent links, matched/unmatched/ignored responses, group/leader meetings and every supported member-history lifecycle transition.

The reset workflow verifies the population, verifies flow coverage, rebuilds the curated `publicLeadership` projection from authoritative organisation/admin data, and finally runs the full Firestore compatibility audit.

## Safety

Seed and cleanup scripts use `testData`, `testSeed`, `createdBySeed`, and stable `TEST_` identifiers. Cleanup must never rely on display names, email fragments, or other broad matching that could remove real records.
