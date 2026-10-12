/* Inspect and download the repository's desktop builds without printing credentials. */
const fs=require('fs'),path=require('path'),cp=require('child_process');
const repo='chen603937785/XiaozhaoProject';
const remote=new URL(cp.execFileSync('git',['remote','get-url','origin'],{encoding:'utf8'}).trim());
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||decodeURIComponent(remote.password||remote.username);
if(!token)throw Error('GitHub authentication is required');
let proxy='';try{proxy=cp.execFileSync('git',['config','--get','http.proxy'],{encoding:'utf8'}).trim();}catch{}
function request(endpoint,destination){
  const config=['url = '+JSON.stringify('https://api.github.com/repos/'+repo+endpoint),
    'header = '+JSON.stringify('Authorization: Bearer '+token),
    'header = "Accept: application/vnd.github+json"',
    'header = "X-GitHub-Api-Version: 2022-11-28"'];
  if(proxy)config.push('proxy = '+JSON.stringify(proxy));
  const args=['--config','-','--fail','--silent','--show-error','--location','--retry','2','--connect-timeout','15','--max-time','180'];
  if(destination)args.push('--output',destination);
  const r=cp.spawnSync('curl',args,{input:config.join('\n'),encoding:'utf8',maxBuffer:10*1024*1024});
  if(r.status!==0)throw Error('GitHub request failed: '+String(r.stderr||r.error).split(token).join('[redacted]'));
  return destination?null:JSON.parse(r.stdout);
}
const [command,reference,output]=process.argv.slice(2);
if(command==='status'){
  const runs=request('/actions/workflows/build-desktop.yml/runs?per_page=30').workflow_runs;
  const run=runs.find(x=>x.head_branch===reference||x.head_sha===reference);
  if(!run){console.log(JSON.stringify({pending:true,reference}));process.exit(0);}
  const jobs=request('/actions/runs/'+run.id+'/jobs').jobs.map(x=>({name:x.name,status:x.status,conclusion:x.conclusion,steps:x.steps.filter(s=>s.status!=='completed'||s.conclusion==='failure').map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))}));
  console.log(JSON.stringify({id:run.id,url:run.html_url,status:run.status,conclusion:run.conclusion,sha:run.head_sha,jobs},null,2));
}else if(command==='download'){
  if(!/^\d+$/.test(reference)||!output)throw Error('Usage: download <run-id> <output-directory>');
  const run=request('/actions/runs/'+reference);
  if(run.status!=='completed'||run.conclusion!=='success')throw Error('Build is not successful yet');
  const dir=path.resolve(output);fs.mkdirSync(dir,{recursive:true});
  const artifacts=request('/actions/runs/'+reference+'/artifacts').artifacts.filter(x=>['desktop-macos','desktop-windows'].includes(x.name)&&!x.expired);
  if(artifacts.length!==2)throw Error('Expected both macOS and Windows build artifacts');
  for(const item of artifacts){
    const destination=path.join(dir,item.name+'.zip');request('/actions/artifacts/'+item.id+'/zip',destination);
    cp.execFileSync('unzip',['-t',destination],{stdio:'pipe'});
    console.log(item.name+' downloaded: '+destination+' ('+fs.statSync(destination).size+' bytes)');
  }
}else throw Error('Usage: status <tag-or-sha> | download <run-id> <output-directory>');
