// Usage: node scripts/build_autofill_release.cjs 1.0.0 [output-directory]
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const version=process.argv[2];
if(!/^\d+\.\d+\.\d+$/.test(version||''))throw Error('请提供版本号，例如 1.0.0');
const source=path.resolve(__dirname,'../campus-job-desktop/src-tauri/autofill.js');
const script=fs.readFileSync(source,'utf8');new vm.Script(script);
if(!script.includes("const VERSION='"+version+"'"))throw Error('脚本 VERSION 与发布版本号不一致');
const hash=crypto.createHash('sha256').update(script).digest('hex');
const root=path.resolve(process.argv[3]||path.join(__dirname,'../output/autofill-release'));
const dir=path.join(root,'autofill/releases');fs.mkdirSync(dir,{recursive:true});
const file=`${version}-${hash.slice(0,12)}.js`;
fs.writeFileSync(path.join(dir,file),script);
const manifest={protocol:1,version,sha256:hash,path:'/autofill/releases/'+file,disabled:false};
fs.writeFileSync(path.join(root,'autofill/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('发布文件已生成：'+root);console.log('先上传 releases 文件，再原子替换 manifest.json。');
