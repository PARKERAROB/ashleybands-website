import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function fixture(mode = '', extraEnv = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'release-test-'));
  const scripts = path.join(root, 'scripts');
  const bin = path.join(root, 'bin');
  mkdirSync(scripts); mkdirSync(bin);
  copyFileSync(new URL('./release-checked.sh', import.meta.url), path.join(scripts, 'release-checked.sh'));
  const stub = `#!${process.execPath}
import fs from 'node:fs';
import path from 'node:path';
const command=path.basename(process.argv[1]);
const args=process.argv.slice(2).join(' ');
fs.appendFileSync(process.env.TRACE,command+' '+args+'\\n');
if(command==='git') console.log('a'.repeat(40));
if(command==='node' && args.includes('release-ready')) {
 const trace=fs.readFileSync(process.env.TRACE,'utf8');
 const count=trace.split('node scripts/release-ready.mjs').length-1;
 if(process.env.MODE==='early' || (process.env.MODE==='remote' && count===2)) process.exit(1);
}
if(command==='npm' && args.includes('verify:release') && process.env.MODE==='suite'){console.log('PASS  calendar projections');console.log('FAIL  hosted portal mirror — private detail');console.log('raw private diagnostic');process.exit(1);}
`;
  for (const command of ['node', 'git', 'npm', 'npx']) writeFileSync(path.join(bin, command), stub, {mode:0o755});
  writeFileSync(path.join(bin,'package.json'),'{"type":"module"}');
  const state=path.join(root,'state');
  if(mode==='locked') mkdirSync(path.join(state,'ashleybands-release','production.lock'),{recursive:true});
  const result=spawnSync('bash',[path.join(scripts,'release-checked.sh')],{env:{...process.env,...extraEnv,PATH:`${bin}:${process.env.PATH}`,XDG_STATE_HOME:state,TRACE:path.join(root,'trace'),MODE:mode},encoding:'utf8',timeout:10000});
  const trace=existsSync(path.join(root,'trace'))?readFileSync(path.join(root,'trace'),'utf8'):'';
  const locked=existsSync(path.join(state,'ashleybands-release','production.lock'));
  rmSync(root,{recursive:true,force:true});
  return {result,trace,locked};
}
test('public runner output keeps check labels and withholds raw log text',()=>{
 const {result}=fixture('suite',{RELEASE_PUBLIC_OUTPUT:'1'});assert.equal(result.status,1);assert.match(result.stderr,/FAIL  hosted portal mirror\n/);assert.match(result.stderr,/PASS  calendar projections/);assert.doesNotMatch(result.stderr,/private detail|raw private diagnostic/);
 const local=fixture('suite');assert.match(local.result.stderr,/raw private diagnostic/);
});
test('readiness failure skips the expensive suite and deployment, and releases lock',()=>{
 const {result,trace,locked}=fixture('early');assert.equal(result.status,1);assert.doesNotMatch(trace,/verify:release|npx/);assert.equal(locked,false);
});
test('failed verification or final readiness never deploys',()=>{
 for(const mode of ['suite','remote']) {const {result,trace,locked}=fixture(mode);assert.equal(result.status,1);assert.doesNotMatch(trace,/npx/);assert.equal(locked,false);}
});
test('existing project lock prevents all release commands without stealing lock',()=>{
 const {result,trace,locked}=fixture('locked');assert.equal(result.status,1);assert.equal(trace,'');assert.equal(locked,true);
});
test('successful release verifies twice and proves the published commit',()=>{
 const {result,trace,locked}=fixture();assert.equal(result.status,0,result.stderr);assert.equal(locked,false);assert.equal(trace.match(/release-ready/g).length,2);assert.match(trace,/npx .*--meta validationCommit=a{40}/);assert.match(trace,/npm run verify:live -- --expected-commit a{40}/);
});

test('readiness fetches real remote advancement instead of trusting cached origin/main', () => {
 const root=mkdtempSync(path.join(tmpdir(),'readiness-git-'));
 const repo=path.join(root,'repo');const remote=path.join(root,'remote.git');const peer=path.join(root,'peer');
 const git=(cwd,...args)=>{const result=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
 try {
  git(root,'init','--bare',remote);git(root,'clone',remote,repo);
  mkdirSync(path.join(repo,'scripts/lib'),{recursive:true});
  copyFileSync(new URL('./release-ready.mjs',import.meta.url),path.join(repo,'scripts/release-ready.mjs'));
  copyFileSync(new URL('./lib/workspace-paths.mjs',import.meta.url),path.join(repo,'scripts/lib/workspace-paths.mjs'));
  writeFileSync(path.join(repo,'scripts/build-regiment-os-review.mjs'),'process.exit(0);');
  writeFileSync(path.join(repo,'.nvmrc'),process.version.slice(1));
  writeFileSync(path.join(repo,'.gitignore'),'node_modules\n.env.local\n.vercel\n');
  mkdirSync(path.join(repo,'node_modules'));writeFileSync(path.join(repo,'.env.local'),'');
  mkdirSync(path.join(repo,'.vercel'));writeFileSync(path.join(repo,'.vercel/project.json'),JSON.stringify({projectId:'prj_zt07T3fHc75OimXD3SnBoP4JcQzr',orgId:'team_iJ1ikB48QN8eYHbQunrskJuf'}));
  mkdirSync(path.join(root,'BandsofAHS/data'),{recursive:true});writeFileSync(path.join(root,'BandsofAHS/data/calendar-events.jsonl'),'');
  git(repo,'checkout','-b','main');git(repo,'add','scripts','.nvmrc','.gitignore');
  const commit=(cwd,message)=>git(cwd,'-c','user.name=Test','-c','user.email=robert.parker@nhcs.net','commit','--allow-empty','-m',message);
  commit(repo,'Authorize initial release (#0)\n\nChecked: fixture readback');git(repo,'push','-u','origin','main');
  git(root,'clone','--branch','main',remote,peer);commit(peer,'advance');git(peer,'push');
  const result=spawnSync(process.execPath,[path.join(repo,'scripts/release-ready.mjs')],{cwd:repo,encoding:'utf8',env:{...process.env,BANDSOFAHS_DIR:path.join(root,'BandsofAHS'),BAND_WEBSITE_ENV:path.join(repo,'.env.local')}});
  assert.equal(result.status,1);assert.match(result.stderr,/freshly fetched origin\/main/);
  assert.equal(git(repo,'rev-parse','origin/main'),git(peer,'rev-parse','HEAD'));
 } finally {rmSync(root,{recursive:true,force:true});}
});

test('readiness refuses an authorization commit without a Checked: trailer', () => {
 const root=mkdtempSync(path.join(tmpdir(),'readiness-checked-'));
 const repo=path.join(root,'repo');const remote=path.join(root,'remote.git');
 const git=(cwd,...args)=>{const result=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
 try {
  git(root,'init','--bare',remote);git(root,'clone',remote,repo);
  mkdirSync(path.join(repo,'scripts/lib'),{recursive:true});
  copyFileSync(new URL('./release-ready.mjs',import.meta.url),path.join(repo,'scripts/release-ready.mjs'));
  copyFileSync(new URL('./lib/workspace-paths.mjs',import.meta.url),path.join(repo,'scripts/lib/workspace-paths.mjs'));
  writeFileSync(path.join(repo,'scripts/build-regiment-os-review.mjs'),'process.exit(0);');
  writeFileSync(path.join(repo,'.nvmrc'),process.version.slice(1));
  writeFileSync(path.join(repo,'.gitignore'),'node_modules\n.env.local\n.vercel\n');
  mkdirSync(path.join(repo,'node_modules'));writeFileSync(path.join(repo,'.env.local'),'');
  mkdirSync(path.join(repo,'.vercel'));writeFileSync(path.join(repo,'.vercel/project.json'),JSON.stringify({projectId:'prj_zt07T3fHc75OimXD3SnBoP4JcQzr',orgId:'team_iJ1ikB48QN8eYHbQunrskJuf'}));
  mkdirSync(path.join(root,'BandsofAHS/data'),{recursive:true});writeFileSync(path.join(root,'BandsofAHS/data/calendar-events.jsonl'),'');
  git(repo,'checkout','-b','main');git(repo,'add','scripts','.nvmrc','.gitignore');
  const env={...process.env,BANDSOFAHS_DIR:path.join(root,'BandsofAHS'),BAND_WEBSITE_ENV:path.join(repo,'.env.local')};
  const run=()=>spawnSync(process.execPath,[path.join(repo,'scripts/release-ready.mjs')],{cwd:repo,encoding:'utf8',env});
  git(repo,'-c','user.name=Test','-c','user.email=robert.parker@nhcs.net','commit','--allow-empty','-m','Authorize production release (#0)');
  git(repo,'push','-u','origin','main');
  let result=run();assert.equal(result.status,1);assert.match(result.stderr,/Checked:/);
  git(repo,'-c','user.name=Test','-c','user.email=robert.parker@nhcs.net','commit','--allow-empty','-m','Authorize production release (#0)','-m','Checked: route readback and projection diff');
  git(repo,'push');
  result=run();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PASS  checkout readiness/);
 } finally {rmSync(root,{recursive:true,force:true});}
});

test('runtime wrapper selects the pinned Node even when invoked through npm run (#94)', { skip: !existsSync(path.join(process.env.NVM_DIR || path.join(process.env.HOME, '.nvm'), 'nvm.sh')) }, () => {
  const required = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim();
  const result = spawnSync('bash', [new URL('./runtime.sh', import.meta.url).pathname, 'node', '--version'], {
    env: { ...process.env, npm_config_prefix: path.join(process.env.HOME, '.local') }, encoding: 'utf8', timeout: 20000
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), `v${required}`);
});
