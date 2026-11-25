const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createResponsibilityEditor(api){
 const L=(zh,en)=>api.lang()==='en'?en:zh;
 const label=d=>api.categories.find(c=>c[0]===d)?.[1]?.split(' / ')[api.lang()==='en'?0:1]||d;
 const englishLabel=d=>api.categories.find(c=>c[0]===d)?.[1]?.split(' / ')[0]||d;
 function mount(issue){
  const root=document.createElement('details');root.className='responsibility-panel';root.id='responsibilityPanel';
  const editable=api.signedIn()&&['admin','editor','consultant','design_lead'].includes(api.member()?.role),guest=!api.signedIn()&&api.visitor();
  const owners=api.disciplines(issue),oldLead=api.lead(issue);
  const orderedCategories=[...api.categories].sort((a,b)=>Number(b[0]===oldLead)-Number(a[0]===oldLead)||Number(owners.includes(b[0]))-Number(owners.includes(a[0])));
  const support=owners.filter(o=>o!==oldLead).map(label).join(' / ')||L('无','None');
  root.innerHTML=`<summary><span class="responsibility-summary-title">${L('责任分配与调整','Responsibility allocation & changes')}</span><span class="responsibility-summary-meta"><b>${L('主责','Lead')}</b> ${esc(label(oldLead))} <i>·</i> <b>${L('协作','Support')}</b> ${esc(support)}</span></summary><div class="responsibility-content"><p class="subtle">${L('这是项目协调分工，不替代顾问合同或专业责任。相关专业组显示同一编号；修改原因必须填写。','These are coordination allocations, not contractual or professional scope determinations. Relevant discipline groups share one issue ID; a reason is required for changes.')}</p>${editable||guest?`<form><label>${L('主责专业','Lead discipline')}<select name="lead">${api.categories.map(c=>`<option value="${esc(c[0])}" ${c[0]===oldLead?'selected':''}>${esc(label(c[0]))}</option>`).join('')}</select></label><label>${L('参与专业（主责必须包含）','Participating disciplines (lead required)')}</label><div class="responsibility-choices">${orderedCategories.map(c=>`<label class="${c[0]===oldLead?'lead-choice':owners.includes(c[0])?'support-choice':''}" style="--role-color:${c[2]};--role-bg:${c[3]}"><input type="checkbox" name="owners" value="${esc(c[0])}" ${owners.includes(c[0])?'checked':''}><span>${c[0]===oldLead?L('主责 · ','Lead · '):owners.includes(c[0])?L('协作 · ','Support · '):''}${esc(label(c[0]))}</span></label>`).join('')}</div><label class="responsibility-reason">${L('调整原因／设计师说明 *','Reason / consultant explanation *')}<textarea name="reason" required maxlength="1500" placeholder="${L('例如：此项为场外标高及排水接口，应由Civil牵头；建筑配合确认门槛。','e.g. Civil should lead external grades and drainage; Architectural will confirm the threshold.')}"></textarea></label><button type="submit" class="primary">${editable?L('保存责任调整','Save responsibility change'):L('提交责任调整建议','Submit reassignment request')}</button><p class="subtle">${editable?L('保存后记录原分配、新分配、操作者、时间及原因；问题编号与状态不变。','The old/new allocation, actor, time and reason are recorded; the issue ID and stage stay unchanged.'):L('游客只能提出建议，不能直接改责任；建议将保存到本问题留言，待授权成员确认后调整。','Visitors may request changes but cannot reassign responsibility directly. Requests are saved as comments for authorized members to review.')}</p></form>`:''}<p class="responsibility-message" role="status"></p><div class="responsibility-history"></div></div>`;
  const anchor=document.querySelector('#detail .edit-section')||document.querySelector('#detail #guestComments');if(anchor)anchor.before(root);else document.getElementById('detail').append(root);
  if(api.signedIn())root.querySelector('.responsibility-history').innerHTML=(issue.responsibilityHistory||[]).slice().reverse().map(h=>`<article><strong>${esc(h.actor||'Project review')} · ${esc(new Date(h.at).toLocaleString(api.lang()==='en'?'en-CA':'zh-CN',{timeZone:'America/Vancouver'}))}</strong><p>${L('原分配','Before')}: ${esc(label(h.from.lead))} / ${esc(h.from.owners.map(label).join(', '))}<br>${L('新分配','After')}: ${esc(label(h.to.lead))} / ${esc(h.to.owners.map(label).join(', '))}</p><p>${esc(api.lang()==='en'?(h.reasonEn||h.reason):h.reason)}</p></article>`).join('')||`<p class="subtle">${L('尚无责任调整记录。','No responsibility changes recorded.')}</p>`;
  const form=root.querySelector('form');if(!form)return;
  function enforceLead(){for(const c of form.querySelectorAll('[name=owners]')){c.disabled=c.value===form.elements.lead.value;if(c.disabled)c.checked=true;}}
  form.elements.lead.onchange=enforceLead;enforceLead();
  form.onsubmit=async e=>{
   e.preventDefault();const main=form.elements.lead.value,selected=[main,...[...form.querySelectorAll('[name=owners]:checked')].map(c=>c.value).filter(d=>d!==main)],reason=form.elements.reason.value.trim();
   const message=root.querySelector('.responsibility-message'),button=form.querySelector('button');root.open=true;if(!reason){message.textContent=L('请填写调整原因。','Enter a reason.');return;}
   if(!api.categories.some(c=>c[0]===main)||selected.some(d=>!api.categories.some(c=>c[0]===d)))return;
   if(main===oldLead&&JSON.stringify([...selected].sort())===JSON.stringify([...owners].sort())){message.textContent=L('分配未改变，无需保存。','Allocation is unchanged.');return;}
   button.disabled=true;message.textContent='';
   try{
    if(!editable){const text=`${L('责任调整建议','Responsibility change request')} · ${issue.id}\n${L('原主责','Current lead')}: ${label(oldLead)}\n${L('原参与专业','Current participants')}: ${owners.map(label).join(' / ')}\n${L('建议主责','Proposed lead')}: ${label(main)}\n${L('建议参与专业','Proposed participants')}: ${selected.map(label).join(' / ')}\n${L('原因','Reason')}: ${reason}`;await api.suggest(issue,text);message.textContent=L('建议已保存到本问题留言，实际分配未改变。','Request saved as an issue comment; responsibility has not changed.');return;}
    const before=structuredClone(issue),at=new Date().toISOString(),actor=`${api.member().display_name} (${api.member().email})`,from={lead:oldLead,owners},to={lead:main,owners:selected};
    issue.lead=main;issue.owners=selected;issue.responsibilityHistory ||= [];issue.responsibilityHistory.push({kind:'manual',at,actor,from,to,reason});
    const summary=`${issue.id} responsibility: lead ${englishLabel(oldLead)} → ${englishLabel(main)}; participants ${owners.map(englishLabel).join('/')} → ${selected.map(englishLabel).join('/')}; reason: ${reason}`;
    issue.history ||= [];issue.history.push({date:at,by:actor,status:issue.status,text:summary});
    try{if(await api.save(summary,issue.id)){api.refresh();return;}throw Error(L('保存失败；草稿保留。若版本冲突，请刷新后重试。','Save failed; your draft is preserved. Refresh if the shared version changed.'));}catch(err){for(const key of Object.keys(issue))delete issue[key];Object.assign(issue,before);throw err;}
   }catch(err){message.textContent=err.message||L('操作失败，请重试。','Action failed; please retry.');}finally{button.disabled=false;}
  };
 }
 return {mount};
}

