export function consultantUpdate(issue,baseline){
 const reviews=issue.noActionReviews||[],oldReviews=baseline?.noActionReviews||[];
 if(reviews.length>oldReviews.length){const r=reviews.at(-1);return {action:'not_issue',payload:{reasonCode:r.reasonCode,note:r.note||''}};}
 const changes=issue.responsibilityHistory||[],oldChanges=baseline?.responsibilityHistory||[];
 if(changes.length>oldChanges.length)return {action:'reassign',payload:{lead:issue.lead,owners:issue.owners,note:changes.at(-1).reason}};
 return {action:'response',payload:{status:issue.status,due:issue.due||'',evidence:issue.evidence||'',reviewed:!!issue.reviewed,note:issue.history?.at(-1)?.text||''}};
}

export function createEmailLogin(api){
 const L=(zh,en)=>api.lang()==='en'?en:zh;
 const root=document.getElementById('emailLogin');let email='',busy=false,cooldownUntil=0;
 function render(){
  if(!root)return;
  root.innerHTML=`<summary>${L('使用工作邮箱登录','Sign in with your work email')}</summary><p class="subtle">${L('无需 Google 账号。收到验证码后输入；若邮件提供登录链接，点击链接即可。','No Google account required. Enter the emailed code, or follow the sign-in link if provided.')}</p><form id="emailRequestForm"><label>${L('已授权的邮箱','Authorized email')}<input name="email" type="email" required autocomplete="email" placeholder="name@company.com"></label><button type="submit" class="primary">${L('发送登录邮件','Send sign-in email')}</button></form><form id="emailVerifyForm" hidden><label>${L('邮件验证码','Email verification code')}<input name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10"></label><button type="submit" class="primary">${L('验证并登录','Verify and sign in')}</button></form><p id="emailLoginMessage" class="message" role="status" aria-live="polite"></p>`;
  root.querySelector('#emailRequestForm').onsubmit=async e=>{
   e.preventDefault();if(busy)return;
   const msg=root.querySelector('#emailLoginMessage'),button=e.currentTarget.querySelector('button');
   if(Date.now()<cooldownUntil){msg.textContent=L('请稍等一分钟后再发送。','Wait one minute before requesting another email.');return;}
   email=e.currentTarget.elements.email.value.trim().toLowerCase();busy=true;button.disabled=true;msg.textContent=L('正在请求登录邮件…','Requesting sign-in email…');
   try{
    const allowed=await api.db.rpc('permit_is_invited_email',{p_email:email});
    if(allowed.error)throw allowed.error;
    if(allowed.data!==true)throw Error(L('此邮箱尚未获得项目权限。可先以游客身份进入。','This email has not been authorized. You can continue as a visitor.'));
    const {error}=await api.db.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+location.pathname}});
    if(error)throw error;
    cooldownUntil=Date.now()+60000;root.querySelector('#emailVerifyForm').hidden=false;
    msg.textContent=L('登录邮件请求已提交，请查看收件箱和垃圾邮件；输入验证码或点击邮件链接。','Sign-in email requested. Check your inbox and spam folder; enter the code or follow the email link.');
   }catch(err){msg.textContent=/email_address_not_authorized|not authorized|smtp|email rate/i.test(err.message||'')?L('邮件发送服务尚未就绪或达到发送限额，请联系 Gary 配置；也可以使用 Google 登录或游客入口。','Email delivery is not configured or has reached its limit. Contact Gary; Google sign-in and visitor access remain available.'):err.message;}
   finally{busy=false;button.disabled=false;}
  };
  root.querySelector('#emailVerifyForm').onsubmit=async e=>{
   e.preventDefault();if(busy)return;busy=true;const b=e.currentTarget.querySelector('button');b.disabled=true;
   try{const {error}=await api.db.auth.verifyOtp({email,token:e.currentTarget.elements.code.value.trim(),type:'email'});if(error)throw error;await api.boot();}
   catch(err){root.querySelector('#emailLoginMessage').textContent=L('验证未完成，请检查验证码或重新申请。','Verification failed. Check the code or request a new email.')+' '+err.message;}
   finally{busy=false;b.disabled=false;}
  };
 }
 return {render};
}

