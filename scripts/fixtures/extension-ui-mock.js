// Local visual preview only. No real credentials, account records or API requests.
(() => {
  const stored={selectedResumeId:'1',fillMode:'overwrite'}, demo={id:1,resumeName:'默认模板简历',isDefault:true,profile:{chineseName:'测试同学',email:'demo@example.test'}};
  const listeners=[];
  window.chrome={
    runtime:{lastError:null,getManifest:()=>({version:'0.1.8'}),onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:(message,cb)=>{
      if(message.type==='xiaomai-page-command')return cb({ok:true,data:{visible:message.command==='show',busy:false}});
      const replies={session:{loggedIn:true,phone:'13800000000'},'/api/user/info':{code:200,data:{nickname:'小麦同学',isVip:true,vipExpire:'2027-10-12'}},'/api/resumes':{code:200,data:[demo,{id:2,resumeName:'银行求职简历'}]},'/api/resumes/1':{code:200,data:demo},'/api/job-status/list':{code:200,data:[{companyName:'中国光大银行',positions:'总行管理培训生 · 金融科技岗',mainStatus:'APPLIED',applyUrl:'https://example.test/apply'},{companyName:'中国电信',positions:'软件研发工程师',mainStatus:'FOLLOWED'}]}};
      cb({ok:true,data:replies[message.path]||{code:404,message:'本地预览'}});
    }},
    storage:{local:{get:async()=>stored,set:async value=>Object.assign(stored,value),remove:async()=>{}}},
    tabs:{query:async()=>[{id:1}],create:()=>{}}
  };
  window.showFloatingPreview=()=>listeners.forEach(fn=>fn({type:'xiaomai-panel-command',command:'show'},{},()=>{}));
})();
