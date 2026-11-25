const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const FINAL_DESIGN_EMAIL='archydave@yahoo.com';
export function quickResolutionRequest(method,note=''){
 if(!['not-an-issue','quick-comment'].includes(method))throw Error('Invalid resolution method');
 note=String(note).trim();
 if(method==='quick-comment'&&!note)throw Error('A brief reply is required');
 if(note.length>1500)throw Error('Reply must be 1500 characters or fewer');
 return {method,note:method==='not-an-issue'?'':note};
}
export function mayReviewIssue(member,issue,lead,contacts){
 if(!member||!['admin','editor','consultant','design_lead'].includes(member.role)||member.active===false)return false;
 const email=String(member.email||'').toLowerCase();
 return member.role==='admin'||email===FINAL_DESIGN_EMAIL||(contacts[lead(issue)]||[]).some(p=>p.email.toLowerCase()===email);
}
export function createNoIssueControl(api){
 const L=(zh,en)=>api.lang()==='en'?en:zh;
 function mount(issue){
  const root=document.getElementById('detail');
  const quick=issue.history?.slice().reverse().find(h=>['not-an-issue','quick-comment'].includes(h.resolutionMethod));
  const previous=issue.noActionReviews?.at(-1);
  if(quick||previous){
   const notice=document.createElement('div');notice.className='no-issue-notice';
   if(quick)notice.innerHTML=`<strong>${quick.resolutionMethod==='not-an-issue'?L('已解决：不构成问题，无需回复','Resolved: not an issue; no reply required'):L('已解决：简单回复','Resolved with a brief reply')}</strong><p>${esc(quick.by)} · ${esc(new Date(quick.date).toLocaleDateString(api.lang()==='en'?'en-CA':'zh-CN'))}${quick.note?`<br>${esc(quick.note)}`:''}</p>`;
   else notice.innerHTML=`<strong>${previous.final?L('设计负责人已确认：此项不构成问题','Design lead confirmed: not an issue'):L('此前审查意见：此项不构成问题，待确认','Earlier assessment: not an issue; confirmation pending')}</strong><p>${esc(previous.actor)}<br>${esc(api.lang()==='en'?previous.reasonEn:previous.reason)}${previous.note?`<br>${esc(previous.note)}`:''}</p>`;
   root.querySelector('.stage')?.after(notice);
  }
  if(!api.signedIn()||issue.status==='已关闭'||!mayReviewIssue(api.member(),issue,api.lead,api.contacts))return;
  const control=document.createElement('details');control.className='quick-resolve';
  control.innerHTML=`<summary class="not-an-issue-button">${L('快捷解决','Quick resolve')} <span aria-hidden="true">▾</span></summary><div class="quick-resolve-options"><button type="button" data-quick="not-an-issue">${L('不构成问题，直接解决','Not an issue — resolve now')}</button><button type="button" data-quick="quick-comment">${L('简单回复后解决','Reply briefly and resolve')}</button><p class="quick-resolve-feedback" role="status" aria-live="polite"></p></div>`;
  const header=document.createElement('div');header.className='issue-title-row';
  const title=root.querySelector('h2');title.before(header);header.append(title,control);
  let busy=false;
  async function resolve(method,note=''){
   if(busy)return false;
   if(!mayReviewIssue(api.member(),issue,api.lead,api.contacts))throw Error(L('当前账号无权解决此项。','Your account cannot resolve this item.'));
   const payload=quickResolutionRequest(method,note);busy=true;
   control.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{await api.resolve(issue.id,payload.method,payload.note);return true;}
   finally{busy=false;control.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  control.addEventListener('keydown',event=>{if(event.key==='Escape'){control.open=false;control.querySelector('summary').focus();}});
  control.querySelector('[data-quick="not-an-issue"]').onclick=async()=>{
   const feedback=control.querySelector('.quick-resolve-feedback');feedback.textContent=L('正在保存…','Saving…');
   try{if(await resolve('not-an-issue')){control.open=false;api.refresh();}}
   catch(error){feedback.textContent=error.message;}
  };
  control.querySelector('[data-quick="quick-comment"]').onclick=()=>{
   control.open=false;document.getElementById('noIssueDialog')?.remove();
   const dialog=document.createElement('dialog');dialog.id='noIssueDialog';dialog.className='no-issue-dialog';dialog.setAttribute('aria-labelledby','noIssueHeading');
   dialog.innerHTML=`<form><div class="no-issue-dialog-head"><h2 id="noIssueHeading">${L('简单回复后解决','Reply briefly and resolve')} · ${esc(issue.id)}</h2><button type="button" data-cancel aria-label="${L('关闭','Close')}">×</button></div><label class="no-issue-note">${L('简单回复','Brief reply')}<textarea name="note" required maxlength="1500" rows="3" placeholder="${L('写一句回复，提交后此项将标为已解决。','Write a brief reply. Submitting marks this item as resolved.')}"></textarea></label><p class="no-issue-feedback" role="status" aria-live="polite"></p><div class="no-issue-dialog-actions"><button type="button" data-cancel>${L('取消','Cancel')}</button><button type="submit" class="primary">${L('回复并解决','Reply and resolve')}</button></div></form>`;
   document.body.append(dialog);dialog.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{if(!busy)dialog.close();});
   dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
   dialog.addEventListener('close',()=>{dialog.remove();if(control.isConnected)control.querySelector('summary').focus();},{once:true});
   dialog.showModal();dialog.querySelector('textarea').focus();
   dialog.querySelector('form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    const feedback=dialog.querySelector('.no-issue-feedback'),submit=dialog.querySelector('[type="submit"]');
    const note=dialog.querySelector('textarea').value.trim();
    if(!note){feedback.textContent=L('请填写一句回复。','Please enter a brief reply.');return;}
    submit.disabled=true;feedback.textContent=L('正在保存…','Saving…');
    try{if(await resolve('quick-comment',note)){dialog.close();api.refresh();}}
    catch(error){feedback.textContent=error.message;}
    finally{submit.disabled=false;}
   };
  };
 }
 return {mount};
}

