const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createGuestComments(api){
 const L=(zh,en)=>api.lang()==='en'?en:zh;
 let guest=null;const drafts=new Map();
 async function identify(name,company){
  let saved;try{saved=JSON.parse(localStorage.getItem('permitGuestIdentity')||'null')}catch{}
  const token=saved?.name===name&&saved?.company===company&&/^[a-f0-9]{64}$/.test(saved.token)?saved.token:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  guest={name,company,token};localStorage.setItem('permitGuestIdentity',JSON.stringify(guest));
  const {data,error}=await api.db.rpc('permit_register_guest',{p_token:token,p_name:name,p_company:company});
  if(error){if(error.message?.includes('BLOCKED'))throw Error(L('该游客 ID 已被封禁。','This visitor ID is blocked.'));guest.error=true;return guest;}
  guest={...guest,...data};return guest;
 }
 function prefill(){try{return JSON.parse(localStorage.getItem('permitGuestIdentity')||'{}')}catch{return {}}}
 async function mount(issue){
  const old=document.getElementById('guestComments');if(old)old.remove();
  const root=document.createElement('section');root.id='guestComments';root.className='guest-comments';
  const history=Array.from(document.querySelectorAll('#detail>h3')).find(h=>h.textContent.includes('变更记录')||h.textContent.includes('change history'));
  if(history)history.before(root);else document.getElementById('detail').append(root);
  const draft=drafts.get(issue.id)||{title:'',body:''};
  root.innerHTML=`<h3>${L('设计师／游客留言','Consultant / visitor comments')}</h3><p class="subtle">${L('留言是独立意见，不会修改问题或确认设计；重要结论仍需正式邮件或图纸。留言对能访问项目的人可见，请勿填写私人信息。','Comments do not change an issue or confirm a design. Formal correspondence or drawings remain necessary. Comments are visible to project visitors; do not include private information.')}</p>${!api.signedIn()&&guest?`<form class="guest-comment-form"><p>${esc(guest.name)}${guest.company?' · '+esc(guest.company):''} · ${L('游客，身份未验证','Visitor, identity not verified')}</p><label>${L('标题 *','Title *')}<input name="title" required maxlength="120" value="${esc(draft.title)}"></label><label>${L('留言内容 *','Comment *')}<textarea name="body" required maxlength="3000">${esc(draft.body)}</textarea></label><button class="primary" type="submit">${L('提交留言','Submit comment')}</button><small>${L('同一游客每分钟最多 1 条，每 24 小时最多 20 条。','Limit: one comment per minute and 20 per 24 hours, per visitor ID.')}</small></form>`:''}<p class="comment-message" role="status"></p><div class="guest-comment-list">${L('正在读取留言…','Loading comments…')}</div>`;
  const message=(text,error=false)=>{const el=root.querySelector('.comment-message');el.textContent=text;el.classList.toggle('error',error)};
  const unavailable=()=>message(L('留言服务尚未启用或暂时不可用，请管理员完成 Supabase 配置后重试。','Comments are not configured or are temporarily unavailable. Ask the Admin to complete the Supabase setup, then retry.'),true);
  const form=root.querySelector('form');
  if(form){form.oninput=()=>drafts.set(issue.id,{title:form.elements.title.value,body:form.elements.body.value});form.onsubmit=async e=>{
   e.preventDefault();const button=form.querySelector('button');button.disabled=true;
   try{
    if(guest.error){await identify(guest.name,guest.company);if(guest.error){unavailable();return;}}
    const {error}=await api.db.rpc('permit_add_guest_comment',{p_token:guest.token,p_issue:issue.id,p_title:form.elements.title.value.trim(),p_body:form.elements.body.value.trim()});
    if(error){message(error.message?.includes('RATE_LIMIT')?L('提交过于频繁，请稍后重试；每天最多 20 条。','Submission limit reached. Wait before retrying; maximum 20 comments per day.'):error.message?.includes('BLOCKED')?L('该游客 ID 无法提交留言，请联系管理员。','This visitor ID cannot submit comments. Contact the Admin.'):L('提交失败，内容已保留，请稍后重试。','Submission failed. Your draft is preserved; please retry.'),true);return;}
    drafts.delete(issue.id);form.reset();message(L('留言已保存；不代表设计已确认。','Comment saved; this does not confirm the design.'));await load();
   }catch{message(L('提交失败，内容已保留。','Submission failed; your draft is preserved.'),true)}finally{button.disabled=false}
  };}
  async function load(){
   const {data,error}=await api.db.rpc('permit_list_guest_comments',{p_issue:issue.id});if(!root.isConnected)return;
   if(error){root.querySelector('.guest-comment-list').textContent='';unavailable();return;}
   root.querySelector('.guest-comment-list').innerHTML=Array.isArray(data)&&data.length?data.map(c=>`<article class="guest-comment"><strong>${esc(c.title)}</strong><p class="subtle">${esc(c.name)}${c.company?' · '+esc(c.company):''} · ${L('身份未验证','Identity not verified')} · ${esc(new Date(c.created_at).toLocaleString(api.lang()==='en'?'en-CA':'zh-CN',{timeZone:'America/Vancouver'}))}<br>${L('游客 ID','Visitor ID')}: ${esc(c.guest_id)}</p><p class="comment-body">${esc(c.body)}</p>${api.admin()?`<div class="actions"><button data-action="delete" data-comment="${esc(c.id)}">${L('删除此条','Delete comment')}</button><button data-action="delete_all" data-guest="${esc(c.guest_id)}">${L('清除该游客全部留言','Delete all visitor comments')}</button><button data-action="block" data-guest="${esc(c.guest_id)}">${L('封禁并清除留言','Block visitor & delete comments')}</button></div>`:''}</article>`).join(''):`<p class="subtle">${L('尚无游客留言。','No visitor comments yet.')}</p>`;
  }
  root.onclick=async e=>{const b=e.target.closest('[data-action]');if(!b||!api.admin())return;
   if(!confirm(b.textContent+L('？删除后无法在网页恢复。','? This cannot be undone in the app.')))return;b.disabled=true;
   try{const {error}=await api.db.rpc('permit_moderate_guest_comment',{p_action:b.dataset.action,p_comment:b.dataset.comment||null,p_guest:b.dataset.guest||null});if(error){message(L('操作失败，请确认 Admin 权限或稍后重试。','Action failed. Verify Admin access or retry later.'),true);return;}message(L('管理操作已完成。','Moderation completed.'));await load();}finally{b.disabled=false}
  };
  await load();
 }
 async function suggest(issue,text){
  if(api.signedIn()||!guest)throw Error(L('请先填写姓名，以游客身份进入。','Enter your name to continue as a visitor first.'));
  if(guest.error){await identify(guest.name,guest.company);if(guest.error)throw Error(L('留言服务暂时不可用，请稍后重试。','The comments service is temporarily unavailable; please retry.'));}
  const {error}=await api.db.rpc('permit_add_guest_comment',{p_token:guest.token,p_issue:issue.id,p_title:'责任调整建议 / Responsibility change request',p_body:text});
  if(error)throw Error(error.message?.includes('RATE_LIMIT')?L('提交过于频繁，请稍后重试；留言及调整建议共用每分钟1条、每天20条的限额。','Submission limit reached. Comments and reassignment requests share a limit of one per minute and 20 per day.'):error.message?.includes('BLOCKED')?L('该游客ID已封禁，请联系管理员。','This visitor ID is blocked. Contact the Admin.'):L('建议提交失败，内容已保留，请重试。','Request could not be saved; your draft is preserved. Please retry.'));
  await mount(issue);
 }
 return {identify,prefill,mount,suggest,get guest(){return guest}};
}

