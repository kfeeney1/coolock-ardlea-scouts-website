import assert from 'node:assert/strict';
import test from 'node:test';
import { accountNavItems, dashboardNavItem, leaderNavGroups, leaderNavigationDestinations, navigationPermissions, redesignedNavigationGroups, leaderLegacyRedirects, leaderContextlessRoutes, RECORD_PARENT_ROUTES } from '../../src/navigation/leaderNavigation.ts';
import { PERMISSION_REGISTRY } from '../../src/security/permissionRegistry.ts';

const byId = new Map(leaderNavigationDestinations.map(item => [item.id,item]));

test('all canonical destinations have complete identity, permission and return metadata', () => {
  assert.equal(byId.size, leaderNavigationDestinations.length);
  assert.equal(new Set(leaderNavigationDestinations.map(item=>item.path)).size, byId.size);
  assert.equal(new Set(leaderNavigationDestinations.map(item=>item.pageId)).size, byId.size);
  assert.equal(new Set(leaderNavigationDestinations.map(item=>JSON.stringify(item.identity))).size, byId.size);
  const permissions = new Set(PERMISSION_REGISTRY.map(item=>item.id));
  for(const item of leaderNavigationDestinations){
    assert.deepEqual(navigationPermissions[item.id],item.permissions);
    assert.ok(item.permissions.length>0,item.id);
    for(const id of item.permissions)assert.ok(permissions.has(id),id);
    const url = new URL(item.path,'https://example.invalid');
    assert.ok(url.pathname.startsWith('/leader') || url.pathname==='/parent');
    assert.ok('testId' in item.identity ? item.identity.testId : item.identity.heading,item.id);
    assert.equal(item.historyBack,'previous-route-after-menu-dismissal');
    if(item.parentPath)assert.ok(leaderNavigationDestinations.some(destination=>destination.path===item.parentPath));
    if(item.inAppBack)assert.ok(leaderNavigationDestinations.some(destination=>destination.path===item.inAppBack!.path));
  }
});

test('redesigned order is canonical and preserves every destination exactly once', () => {
  const groups=redesignedNavigationGroups(leaderNavGroups);
  assert.deepEqual(groups.map(group=>group.id),['programme','people-parents','secretary','quartermaster','group-operations','treasurer','insights-records','administration','super-admin']);
  assert.deepEqual(groups.flatMap(group=>group.items.map(item=>item.id)).sort(),leaderNavGroups.flatMap(group=>group.items.map(item=>item.id)).sort());
  assert.deepEqual(groups.find(group=>group.id==='super-admin')?.items.map(item=>item.id),['system-information']);
  const visible=leaderNavGroups.map(group=>({...group,items:group.items.filter(item=>item.id==='qm-reports')})).filter(group=>group.items.length);
  assert.deepEqual(redesignedNavigationGroups(visible).map(group=>group.id),['quartermaster']);
});

test('role contexts retain independent URL and actual page-identity expectations', () => {
  for(const [id,path,testId] of [
    ['treasurer-settings','/leader/settings?view=treasurer','page-treasurer-settings'],
    ['qm-settings','/leader/settings?view=quartermaster','page-qm-settings'],
    ['qm-equipment-stores','/leader/equipment?view=quartermaster','page-qm-equipment-stores'],
    ['group-equipment-stores','/leader/equipment?view=group-operations','page-group-equipment-stores'],
    ['secretary-meeting-records','/leader/meetings?view=secretary','page-secretary-meeting-records'],
    ['group-meeting-records','/leader/meetings?view=group-operations','page-group-meeting-records'],
    ['family-billing','/leader/subs#family-billing','page-subs']
  ]){
    const item=byId.get(id)!;
    assert.equal(item.path,path,id);
    assert.deepEqual(item.identity,{testId},id);
  }
  for(const id of ['qm-reports','qm-detailed-inventory','qm-equipment-issues'])assert.deepEqual(byId.get(id)?.inAppBack,{label:'Back to Equipment & Stores',path:'/leader/equipment?view=quartermaster'});
  assert.equal(dashboardNavItem.parentPath,null);
  assert.equal(accountNavItems.find(item=>item.id==='parent-portal')?.parentPath,null);
});

test('saved links distinguish actual redirects from supported contextless routes', () => {
  assert.deepEqual(leaderLegacyRedirects,{'/leader/member-history':'/leader/members'});
  assert.equal(new Set(leaderContextlessRoutes.map(item=>item.path)).size,leaderContextlessRoutes.length);
  assert.ok(leaderContextlessRoutes.every(item=>item.testId.startsWith('page-')));
  assert.deepEqual(RECORD_PARENT_ROUTES.map(item=>item.parent),['/leader/members','/leader/events','/leader/join','/leader/consents']);
});
