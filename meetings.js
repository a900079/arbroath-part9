const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function table(rows, research = false, en = false) {
  return `<div class="tablewrap meeting-table"><table><thead><tr><th scope="col">${en ? 'No.' : '编号'}</th><th scope="col">${en ? 'Item' : '事项'}</th><th scope="col">${en ? (research ? 'Details and follow-up' : 'Details and meeting outcome') : ('具体说明' + (research ? '及待落实内容' : '与会议结果'))}</th></tr></thead><tbody>${rows.map(([title, description, status], i) => `<tr><td>${research ? 'R' : ''}${i + 1}</td><th scope="row">${escapeHtml(title)}</th><td>${escapeHtml(description)}${status ? `<p class="meeting-item-status">${escapeHtml(status)}</p>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function meetingBody(lang, record, index) {
  const en = lang === 'en', meeting = en ? record.en : record.zh;
  const text = (zh, english) => en ? english : zh;
  const date = formatDate(meeting.date,lang);
  return `<article class="meeting-record" aria-labelledby="meetingRecordTitle-${index}" lang="${en?'en':'zh-CN'}">
    <div class="meeting-meta"><time datetime="${escapeHtml(meeting.date)}">${escapeHtml(date)}</time><span>${escapeHtml(meeting.revision || text('会后澄清更新', 'Updated with post-meeting clarifications'))}</span></div>
    <h2 id="meetingRecordTitle-${index}">${escapeHtml(meeting.title)}</h2>
    <p class="meeting-participants">${text('参会人员：', 'Participants: ')}${escapeHtml(meeting.participants)}</p>
    <p class="meeting-note">${escapeHtml(meeting.note || text('本记录反映当日讨论及会后澄清。后续会议对方案的更新以较新记录为准；其中200 mm外移方案已在10月14日业主校准记录中取消。内部决定与专业人员正式设计确认分开记录。', 'This record reflects the discussion and subsequent clarifications for this meeting. Later decisions take precedence; the 200 mm outward wall offset was cancelled in the October 14 Owner-calibrated record. Internal decisions are distinguished from formal professional design confirmation.'))}</p>
    <h3>${text('会议事项与具体说明', 'Meeting items and details')}</h3>${table(meeting.items, false, en)}
    ${(meeting.research||[]).length ? `<h3>${text('待研究及落实事项', 'Research and follow-up items')}</h3><p>${escapeHtml(meeting.researchIntro || text('内部先核实／research，形成具体方案，再与相关专业人员协调。尚未取得的确认继续保留为待办。', 'Verify conditions and research internally, develop a specific proposal, then coordinate with the relevant professionals. Outstanding confirmations remain open.'))}</p>${table(meeting.research, true, en)}` : ''}
    ${meeting.priority ? `<p class="meeting-priority"><strong>${text('跟进重点：', 'Follow-up priorities: ')}</strong>${escapeHtml(meeting.priority)}</p>` : ''}
  </article>`;
}

function formatDate(value,lang){
  const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if(!parts)return String(value||'');
  const date=new Date(Date.UTC(Number(parts[1]),Number(parts[2])-1,Number(parts[3])));
  return new Intl.DateTimeFormat(lang==='en'?'en-US':'zh-CN',{year:'numeric',month:lang==='en'?'long':'long',day:'numeric',timeZone:'UTC'}).format(date);
}

export function renderMeeting(target,lang='zh',record){
  const en=lang==='en';
  const opened=new Set(Array.from(target.querySelectorAll?.('details[data-meeting-id][open]')||[],el=>el.dataset.meetingId));
  const records=(Array.isArray(record?.meetings)?record.meetings:record?.zh&&record?.en?[record]:[])
    .filter(r=>r?.zh&&r?.en).slice().sort((a,b)=>String(b.zh.date).localeCompare(String(a.zh.date)));
  if(!records.length){target.innerHTML=`<p class="meeting-empty">${en?'No meeting records yet.':'暂无会议记录。'}</p>`;return;}
  target.innerHTML=`<div class="view-heading"><h2>${en?'Meeting Records':'会议讨论记录'}</h2><p>${en?'Select a dated meeting to read its details.':'点击日期对应的会议，展开查看具体内容。'}</p></div><div class="meeting-list">${records.map((r,i)=>{
    const m=en?r.en:r.zh,id=String(r.id||r.zh.date);
    return `<details class="meeting-entry" data-meeting-id="${escapeHtml(id)}"${opened.has(id)?' open':''}><summary><time datetime="${escapeHtml(m.date)}">${escapeHtml(formatDate(m.date,lang))}</time><span class="meeting-summary-title">${escapeHtml(m.title)}</span><span class="meeting-summary-action"><span class="meeting-show">${en?'View details':'查看详情'}</span><span class="meeting-hide">${en?'Collapse':'收起'}</span></span></summary>${meetingBody(lang,r,i)}</details>`;
  }).join('')}</div>`;
}

