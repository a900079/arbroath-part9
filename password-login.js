export function createPasswordLogin(api){
 const L=(zh,en)=>api.lang()==='en'?en:zh;let busy=false,changePromise=null;
 function render(){
  const root=document.getElementById('passwordLogin');if(!root)return;
  root.innerHTML=`<h2>${L('账号密码登录','Sign in with a password')}</h2><form><label>${L('账号（工作邮箱）','Account (work email)')}<input name="email" type="email" required autocomplete="username" placeholder="name@company.com"></label><label>${L('项目密码','Project password')}<input name="password" type="password" required autocomplete="current-password"></label><button class="primary" type="submit">${L('登录','Sign in')}</button><p class="message" role="status" aria-live="polite"></p></form><small>${L('这是本项目的独立密码，不是您的邮箱密码。忘记项目密码请联系 Gary。','Use your project password, not your email password. Contact Gary if you need a project password reset.')}</small>`;
  root.querySelector('form').onsubmit=async e=>{
   e.preventDefault();if(busy)return;busy=true;const f=e.currentTarget,b=f.querySelector('button'),m=f.querySelector('.message');b.disabled=true;
   try{const {error}=await api.db.auth.signInWithPassword({email:f.elements.email.value.trim().toLowerCase(),password:f.elements.password.value});if(error)throw error;f.elements.password.value='';await api.boot();}
   catch{m.textContent=L('未能登录，请核对账号和项目密码；若尚未开通密码，请联系 Gary。','Unable to sign in. Check your account and project password, or contact Gary if password access is not yet enabled.');}
   finally{busy=false;b.disabled=false;}
  };
 }
 function requireChange(){
  if(changePromise)return changePromise;
  changePromise=new Promise(resolve=>{
   const d=document.createElement('dialog');d.className='no-issue-dialog password-change-dialog';d.setAttribute('aria-label',L('更改初始密码','Change temporary password'));
   d.innerHTML=`<h2>${L('首次登录：请设置自己的密码','First sign-in: choose your own password')}</h2><p>${L('新密码至少 12 位，且不能与初始密码相同。','Choose a new password of at least 12 characters, different from your temporary password.')}</p><form><label>${L('新密码','New password')}<input name="password" type="password" required minlength="12" autocomplete="new-password"></label><label>${L('再次输入新密码','Confirm new password')}<input name="confirmation" type="password" required minlength="12" autocomplete="new-password"></label><p class="message" role="status"></p><div class="actions"><button type="submit" class="primary">${L('保存新密码并进入','Save password and continue')}</button><button type="button" data-signout>${L('退出','Sign out')}</button></div></form>`;
   document.body.append(d);d.addEventListener('cancel',e=>e.preventDefault());d.showModal();
   d.querySelector('[data-signout]').onclick=async()=>{await api.db.auth.signOut();location.reload();};
   d.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type=submit]'),m=f.querySelector('.message');
    if(f.elements.password.value!==f.elements.confirmation.value){m.textContent=L('两次密码不一致。','The passwords do not match.');return;}b.disabled=true;
    try{const current=await api.db.auth.getSession();const email=current.data.session?.user.email;if(!email)throw Error('Sign-in required');const {data,error}=await api.db.functions.invoke('permit-set-password',{body:{password:f.elements.password.value}});if(error||!data?.ok)throw error||Error('Password update failed');const r=await api.db.auth.signInWithPassword({email,password:f.elements.password.value});if(r.error)throw r.error;f.reset();d.close();d.remove();resolve();}
    catch{m.textContent=L('密码未保存，请使用不同于初始密码的 12 位以上密码后重试。','Password not saved. Use at least 12 characters, different from the temporary password, and retry.');}
    finally{b.disabled=false;}
   };
  }).finally(()=>{changePromise=null;});return changePromise;
 }
 return {render,requireChange};
}

