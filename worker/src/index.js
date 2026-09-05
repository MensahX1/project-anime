const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
const enc=new TextEncoder();
const dec=new TextDecoder();
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromB64url=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
const b64text=text=>{
  const bytes=enc.encode(text);let out='';
  for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(out);
};
const unb64text=text=>dec.decode(Uint8Array.from(atob(text.replace(/\n/g,'')),c=>c.charCodeAt(0)));

async function hmac(secret,value){
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value)));
}
async function sign(secret,payload){
  const body=b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(await hmac(secret,body))}`;
}
async function verify(secret,token){
  const [body,sig]=String(token||'').split('.');if(!body||!sig)return null;
  const expected=await hmac(secret,body),actual=fromB64url(sig);
  if(expected.length!==actual.length)return null;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected[i]^actual[i];if(diff)return null;
  const payload=JSON.parse(dec.decode(fromB64url(body)));
  if(!payload.exp||Date.now()>payload.exp)return null;
  return payload;
}

function cors(env,request){
  const origin=request.headers.get('Origin');
  return origin===env.APP_ORIGIN?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Vary':'Origin'}:{};
}
function safeReturnTo(env,value){return value&&value.startsWith(env.APP_ORIGIN)?value:env.APP_ORIGIN;}
function validateAnime(a){
  if(!a||typeof a!=='object')throw new Error('Invalid anime payload');
  if(typeof a.id!=='string'||!a.id||a.id.length>120)throw new Error('Invalid anime id');
  if(typeof a.title!=='string'||!a.title.trim()||a.title.length>250)throw new Error('Title is required');
  const n=x=>x==null?null:Number(x);
  const score=n(a.score),episodes=n(a.episodes),year=n(a.year);
  if(score!=null&&(!Number.isInteger(score)||score<1||score>5))throw new Error('Score must be 1–5');
  if(episodes!=null&&(!Number.isInteger(episodes)||episodes<0||episodes>10000))throw new Error('Invalid episode count');
  if(year!=null&&(!Number.isInteger(year)||year<1900||year>2100))throw new Error('Invalid year');
  return {id:a.id,title:a.title.trim(),status:String(a.status||''),episodes,score,genre:String(a.genre||''),studio:String(a.studio||''),year,synopsis:String(a.synopsis||''),image:''};
}

async function adminFromRequest(env,request){
  const auth=request.headers.get('Authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  const session=await verify(env.SESSION_SECRET,token);
  if(!session||String(session.uid)!==String(env.ADMIN_GITHUB_USER_ID))return null;
  return session;
}

async function githubFile(env){
  const [owner,repo]=env.GITHUB_REPO.split('/');
  const r=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/src/anime.json?ref=main`,{headers:{Authorization:`Bearer ${env.GITHUB_REPO_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'le-anime-admin'}});
  if(!r.ok)throw new Error(`GitHub read failed (${r.status})`);
  const file=await r.json();
  return {sha:file.sha,anime:JSON.parse(unb64text(file.content))};
}
async function writeAnime(env,anime,sha,message){
  const [owner,repo]=env.GITHUB_REPO.split('/');
  const r=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/src/anime.json`,{method:'PUT',headers:{Authorization:`Bearer ${env.GITHUB_REPO_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'le-anime-admin'},body:JSON.stringify({message,content:b64text(JSON.stringify(anime,null,2)+'\n'),sha,branch:'main'})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.message||`GitHub write failed (${r.status})`);
  return data;
}

export default {async fetch(request,env){
  const url=new URL(request.url),headers=cors(env,request);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  try{
    if(url.pathname==='/auth/github'&&request.method==='GET'){
      const returnTo=safeReturnTo(env,url.searchParams.get('return_to'));
      const state=await sign(env.SESSION_SECRET,{returnTo,exp:Date.now()+10*60*1000,nonce:crypto.randomUUID()});
      const callback=`${url.origin}/auth/callback`;
      const target=new URL('https://github.com/login/oauth/authorize');
      target.searchParams.set('client_id',env.GITHUB_OAUTH_CLIENT_ID);
      target.searchParams.set('redirect_uri',callback);
      target.searchParams.set('scope','read:user');
      target.searchParams.set('state',state);
      return Response.redirect(target.toString(),302);
    }
    if(url.pathname==='/auth/callback'&&request.method==='GET'){
      const state=await verify(env.SESSION_SECRET,url.searchParams.get('state'));
      if(!state)return json({error:'Invalid or expired OAuth state'},401);
      const callback=`${url.origin}/auth/callback`;
      const tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'le-anime-admin'},body:JSON.stringify({client_id:env.GITHUB_OAUTH_CLIENT_ID,client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:callback})});
      const tokenData=await tokenResponse.json();
      if(!tokenData.access_token)return json({error:tokenData.error_description||'GitHub login failed'},401);
      const userResponse=await fetch('https://api.github.com/user',{headers:{Authorization:`Bearer ${tokenData.access_token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'le-anime-admin'}});
      const user=await userResponse.json();
      if(String(user.id)!==String(env.ADMIN_GITHUB_USER_ID))return json({error:'This GitHub account is not an admin for Lè Anime.'},403);
      const session=await sign(env.SESSION_SECRET,{uid:user.id,login:user.login,exp:Date.now()+8*60*60*1000});
      const back=new URL(safeReturnTo(env,state.returnTo));
      back.hash=`admin_token=${encodeURIComponent(session)}`;
      return Response.redirect(back.toString(),302);
    }
    if(url.pathname==='/session'&&request.method==='GET'){
      const admin=await adminFromRequest(env,request);if(!admin)return json({error:'Unauthorized'},401,headers);
      return json({user:{id:admin.uid,login:admin.login}},200,headers);
    }
    if(url.pathname==='/anime/upsert'&&request.method==='POST'){
      const admin=await adminFromRequest(env,request);if(!admin)return json({error:'Unauthorized'},401,headers);
      const body=await request.json(),entry=validateAnime(body.anime);
      const current=await githubFile(env);
      const duplicate=current.anime.find(x=>x.title.toLowerCase()===entry.title.toLowerCase()&&x.id!==entry.id);
      if(duplicate)return json({error:`${entry.title} already exists`},409,headers);
      const index=current.anime.findIndex(x=>x.id===entry.id);
      const next=index<0?[...current.anime,entry]:current.anime.map(x=>x.id===entry.id?entry:x);
      const action=index<0?'Add':'Update';
      const result=await writeAnime(env,next,current.sha,`${action} ${entry.title}`);
      return json({ok:true,commit:result.commit?.sha||null,anime:entry},200,headers);
    }
    if(url.pathname.startsWith('/anime/')&&request.method==='DELETE'){
      const admin=await adminFromRequest(env,request);if(!admin)return json({error:'Unauthorized'},401,headers);
      const id=decodeURIComponent(url.pathname.slice('/anime/'.length));
      const current=await githubFile(env),existing=current.anime.find(x=>x.id===id);
      if(!existing)return json({error:'Anime not found'},404,headers);
      const next=current.anime.filter(x=>x.id!==id);
      const result=await writeAnime(env,next,current.sha,`Delete ${existing.title}`);
      return json({ok:true,commit:result.commit?.sha||null},200,headers);
    }
    return json({error:'Not found'},404,headers);
  }catch(e){return json({error:e?.message||String(e)},500,headers)}
}};
