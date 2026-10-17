import { readFile, writeFile } from 'node:fs/promises';
import { dashboardNavItem, leaderNavGroups, accountNavItems, redesignedNavigationGroups, leaderLegacyRedirects, leaderContextlessRoutes, RECORD_PARENT_ROUTES } from '../src/navigation/leaderNavigation.ts';

const redesigned = redesignedNavigationGroups(leaderNavGroups);
const cell = (value) => String(value ?? 'None').replaceAll('|', '\\|');
const sections = [{id:'dashboard', label:'Dashboard',items:[dashboardNavItem]}, ...leaderNavGroups, {id:'account-help',label:'Account & Help',items:accountNavItems}];
const lines = [
  '# Canonical Leader navigation contract — SW-182', '',
  'Generated from `src/navigation/leaderNavigation.ts`. Run `npm run document:leader-navigation` to update; `npm run check:leader-navigation-contract` rejects drift.', '',
  'The runtime menu, canonical permission filter, redesigned category ordering, legacy redirect and history-aware record Back bridge consume this contract. Route and data guards remain independent.', '',
  '## Category order', '',
  `Existing: Dashboard → ${leaderNavGroups.map(g=>g.label).join(' → ')} → Account & Help.`, '',
  `Redesigned: Dashboard → ${redesigned.map(g=>g.label).join(' → ')} → Account & Help.`, '',
  '## Destinations', '',
  'Permissions are ANY-of the listed canonical registry IDs, in addition to Leader portal access and any existing appointment/privileged constraints shown below. Stable page IDs identify navigation destinations; the identity column names the actual rendered marker or heading.', '',
  '| Existing category / redesigned category | Stable ID | Navigation page ID | Canonical route | Permissions (ANY) | Appointment / privilege constraints | Rendered identity | Parent | Explicit in-app Back on landing |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
];
for(const group of sections)for(const item of group.items){
 const newGroup=redesigned.find(g=>g.items.some(x=>x.id===item.id))?.label ?? group.label;
 const constraints=[...(item.appointments??[]),...['adminOnly','superAdminOnly','leaderAccessOnly','activityLogOnly','settingsOnly','joinManagementOnly'].filter(k=>item[k])];
 const identity='testId' in item.identity?item.identity.testId:`heading: ${item.identity.heading}${item.identity.level?` (h${item.identity.level})`:''}`;
 lines.push('| '+[`${group.label} / ${newGroup}`,item.id,item.pageId,item.path,item.permissions.join(', '),constraints.join(', ')||'None',identity,item.parentPath,item.inAppBack?`${item.inAppBack.label} → ${item.inAppBack.path}`:'None; Dashboard navigation remains available'].map(cell).join(' | ')+' |');
}
lines.push('', '## History, deep links and explicit controls', '',
 'For every destination: selecting a menu link replaces the transient menu entry. Browser Back (and browser-equivalent Android Back) first dismisses an open menu while staying on the same page; the next Back follows actual previous-route history. No fixed previous route is invented for a deep link or reload. Expanding a category adds no history entry. Active destination/category state is derived from the canonical pathname, query and fragment.', '',
 '`inAppBack` describes the landing-route control; inline member/detail views, form steps and modal Back controls retain their own workflow state. `parentPath` is the logical parent, not a new automatic redirect. Pages without an explicit Back control keep that behavior. QM Reports, Detailed Inventory and QM Issues retain their existing fixed in-app returns to the Quartermaster Equipment & Stores context. Parent Portal is a separate account boundary, not a Leader subpage.', '',
 'Family Billing keeps its supported Subs fragment URL and renders `page-subs`; no distinct family-billing page marker or automatic fragment scrolling is claimed.', '',
 'The existing record Back bridge consumes the following safe-parent map. With a previous route observed by the current app instance and valid in-app history, semantic Back/Return controls pop the observed history. Direct entry/reload retains the explicit parent link. Record edit/save confirmation guards remain authoritative; this map does not bypass them.', '',
 '| Record prefix | Safe explicit parent |', '| --- | --- |',
 ...RECORD_PARENT_ROUTES.map(x=>`| ${x.prefix} | ${x.parent} |`), '',
 'Representative workflow exceptions remain explicit: Event Edit “Back to Event” targets its event detail under the unsaved-change guard; Save Event returns to the event list. Equipment detail “Back” targets Dashboard when entered from the Dashboard attention card, otherwise the equipment list; store-move returns to its equipment record. These are existing page controls, not generic browser-Back redirects.', '',
 '## Supported saved links', '', '| Legacy redirect | Canonical target |', '| --- | --- |',
 ...Object.entries(leaderLegacyRedirects).map(([from,to])=>`| ${from} | ${to} |`), '',
 'Contextless workspace links remain valid independent routes without a redirect:', '',
 '| Supported route | Rendered identity |', '| --- | --- |',
 ...leaderContextlessRoutes.map(x=>`| ${x.path} | ${x.testId} |`), '',
 '## Assurance boundary', '',
 'Playwright clicks the real destinations in both modes and checks canonical URLs plus the rendered identities. Independent role-workspace expectations remain in unit and existing route-identity tests so an incorrect cross-role mapping cannot silently update its own expected result. Firebase TEST manual acceptance (SW-189), physical Android system Back and Production Manual Testing remain separate. This contract is not a Production pass.', '');
const output=lines.join('\n');const file='docs/navigation/leader-navigation-contract.md';
if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==output)throw Error(`Navigation contract documentation is stale; run npm run document:leader-navigation.`);console.log('Canonical Leader navigation documentation is current.');}
else {await writeFile(file,output);console.log(`Wrote ${file}`);}
