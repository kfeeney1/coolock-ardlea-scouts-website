import { expect, test, type Page } from '@playwright/test';
import { accountNavItems, dashboardNavItem, leaderNavGroups, redesignedNavigationGroups, leaderLegacyRedirects, leaderContextlessRoutes, type LeaderNavItem } from '../src/navigation/leaderNavigation';
import { loginAsLeader } from './support/authentication-helpers';

const password=process.env.E2E_TEST_USER_PASSWORD;
const email=process.env.E2E_SUPER_ADMIN_EMAIL || 'superadmin@example.com';
async function selectMode(page: Page, redesigned: boolean){
  await page.goto('/leader/settings');
  const button=page.getByRole('button',{name:`${redesigned?'Redesigned':'Existing'} navigation`,exact:true});
  await expect(button).toBeEnabled();
  if(await button.getAttribute('aria-pressed')!=='true')await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
}
async function identity(page: Page,item: LeaderNavItem){
  if('testId' in item.identity)await expect(page.getByTestId(item.identity.testId)).toBeVisible();
  else await expect(page.getByRole('heading',{name:item.identity.heading,exact:true,...(item.identity.level?{level:item.identity.level}:{})})).toBeVisible();
}
async function menu(page: Page){
  const button=page.locator('button[aria-controls="leader-navigation"]');
  if(await button.getAttribute('aria-expanded')!=='true')await button.click();
  await expect(page.getByRole('navigation',{name:'Leader navigation',exact:true})).toBeVisible();
}
async function target(page: Page,group: {id:string;label:string}|null,item: LeaderNavItem,redesigned: boolean,mobile: boolean){
  await menu(page);
  const root=group ? page.getByTestId(redesigned?'leader-navigation-redesigned':mobile?'leader-navigation-mobile':'leader-navigation-desktop') : page.getByRole('navigation',{name:'Leader navigation',exact:true});
  await expect(root).toBeVisible();
  if(group && (redesigned||mobile)){
    const toggle=redesigned
      ? root.locator(`button[aria-controls="redesigned-${group.id}-panel"]`)
      : root.getByRole('button',{name:group.label,exact:true});
    await expect(toggle).toContainText(group.label);
    if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  }
  return root.getByTestId(`leader-nav-${item.id}`);
}

for(const redesigned of [false,true]){
  const groups=redesigned?redesignedNavigationGroups(leaderNavGroups):leaderNavGroups;
  const cases=[{label:'Dashboard',group:null,items:[dashboardNavItem]},...groups.map(group=>({label:group.label,group:{id:group.id,label:group.label},items:group.items})),{label:'Account & Help',group:null,items:accountNavItems}];
  for(const entry of cases)test(`${redesigned?'Redesigned':'Existing'} contract: ${entry.label}`,async({page},testInfo)=>{
    test.skip(!password,'Configure canonical E2E credentials.');
    await loginAsLeader(page,{email,password:password!});
    const mobile=testInfo.project.name==='mobile-chromium';
    try{
      await selectMode(page,redesigned);
      for(const item of entry.items)await test.step(item.id,async()=>{
        await page.goto('/leader');
        await expect(page.getByTestId('admin-overview')).toBeVisible();
        const link=await target(page,entry.group,item,redesigned,mobile);
        await expect(link).toHaveAttribute('href',item.path);
        await link.click();
        await expect(page).toHaveURL(new URL(item.path,process.env.E2E_BASE_URL||'http://127.0.0.1:4173').href);
        await identity(page,item);
        await expect(await target(page,entry.group,item,redesigned,mobile)).toHaveAttribute('aria-current','page');
        await page.goBack();
        await expect(page.getByRole('navigation',{name:'Leader navigation',exact:true})).toBeHidden();
        await identity(page,item);
        if(item.id!=='dashboard'){
          await page.goBack();
          await expect(page).toHaveURL(/\/leader$/);
          await expect(page.getByTestId('admin-overview')).toBeVisible();
        }
        if(item.inAppBack){
          await page.goto(item.path);
          await identity(page,item);
          await page.getByRole('link',{name:item.inAppBack.label,exact:true}).click();
          await expect(page).toHaveURL(new URL(item.inAppBack.path,process.env.E2E_BASE_URL||'http://127.0.0.1:4173').href);
        }
      });
    }finally{await selectMode(page,false);}
  });
}

test('supported saved links retain their redirect or contextless identity',async({page})=>{
  test.skip(!password,'Configure canonical E2E credentials.');
  await loginAsLeader(page,{email,password:password!});
  for(const [from,to] of Object.entries(leaderLegacyRedirects)){
    await page.goto(from);
    await expect(page).toHaveURL(new URL(to,process.env.E2E_BASE_URL||'http://127.0.0.1:4173').href);
    await expect(page.getByTestId('page-member-management')).toBeVisible();
  }
  for(const entry of leaderContextlessRoutes){
    await page.goto(entry.path);
    await expect(page).toHaveURL(new URL(entry.path,process.env.E2E_BASE_URL||'http://127.0.0.1:4173').href);
    await expect(page.getByTestId(entry.testId)).toBeVisible();
  }
});
