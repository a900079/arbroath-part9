// Translate static form labels without changing stored values or user input.
const TEXT = {
  '只需填写标题和问题说明，其他信息可稍后补充。提出人和时间会自动记录。':'Only the title and issue description are required. Other details can be added later. The reporter and date are recorded automatically.',
  '更多信息（选填）':'More details (optional)',
  '责任专业（选填）':'Responsible disciplines (optional)',
  '紧急程度（选填）':'Priority (optional)',
  '问题来源（选填）':'Issue source (optional)',
  '图纸定位（选填）':'Drawing reference (optional)',
  '图片 / PDF（选填）':'Images / PDF (optional)',
  '提出人':'Reported by', '提出日期':'Date reported',
  '提出人和时间会自动记录；带':'The reporter and date are recorded automatically. Fields marked',
  '的内容必须填写。':'are required.',
  '1. 选择责任专业':'1. Select responsible disciplines',
  '可多选；第一个选中的专业为主责，其他为协作。':'Select one or more disciplines. The first selection is the lead; the others provide support.',
  '2. 紧急程度':'2. Priority', '3. 问题来源':'3. Issue source',
  'P1 · 提交前必须解决':'P1 · Required before resubmission', 'P2 · 需协调':'P2 · Coordination required', 'P3 · 一般':'P3 · Routine',
  '自己发现':'Identified internally', '与设计师沟通后发现':'Identified through consultant discussion',
  '问题标题':'Issue title', '问题与当前判断':'Issue and current assessment', '问题性质':'Issue type',
  '期望回复日期':'Requested response date', '需要向谁确认 / 谁负责跟进':'Consultant to confirm / person responsible for follow-up',
  '已沟通的设计师 / 日期 / 结论':'Consultant contacted / date / outcome', '要确认的问题':'Confirmation required',
  '需要完成的动作':'Required action', '关闭条件':'Closure criteria', '4. 图纸定位（如适用）':'4. Drawing reference (if applicable)',
  '图纸文件':'Drawing file', '其他文件名':'Other filename', 'PDF 页码':'PDF page', '图号':'Sheet number', '定位说明':'Location / reference note',
  '5. 上传说明附件':'5. Attach supporting files', '选择图片或 PDF':'Select images or PDFs',
  '可上传图片或 PDF，最多 5 个文件，每个不超过 15 MB。附件仅登录成员可查看。':'Attach up to five images or PDFs, 15 MB per file. Attachments are available to signed-in members only.',
  '成员权限':'Member permissions', '邮箱':'Email', '姓名':'Name', '角色':'Role', '允许访问':'Allow access', '保存成员':'Save member',
  '仅管理员可新增、停用或调整角色。停用后该邮箱无法读取项目。':'Only administrators may add members, deactivate accounts or change roles. Deactivated accounts lose member access; public visitor access remains available.',
  '重新提交的完成条件':'Resubmission checklist', '关键问题已取得专业回复并完成改图。':'Obtain consultant responses and complete the required drawing revisions for critical items.',
  '跨专业接口已书面确认。':'Obtain written confirmation of interdisciplinary interfaces.', '地址、版本、图号与签章核对完成。':'Verify addresses, revisions, sheet numbers, signatures and seals.',
  '错误副本不进入上传包。':'Exclude incorrect and superseded copies from the submission package.', '能源顾问及 CRP 确认最终设计。':'Obtain final-design confirmation from the energy consultant and coordinating registered professional (CRP).',
  '跨专业冲突':'Interdisciplinary coordination issue', '图纸审查':'Drawing review', '设计师沟通后发现':'Identified through consultant discussion',
  '缺少资料':'Missing information', '版本/文件问题':'Revision or document issue', '现场条件':'Site condition', '业主决定与图纸冲突':'Owner direction conflicts with drawings', '其他':'Other'
};
const original = new WeakMap();
export function translatePermitForms(language) {
  for (const root of document.querySelectorAll('#newIssueDialog, #membersView .member-editor, .gate-card')) {
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while ((node=walker.nextNode())) {
      if(node.parentElement.closest('textarea, option, #newReporter, #newReportedAt, #gate, #newIssueMessage, #newDisciplineGrid, #attachmentPreview'))continue;
      if(!original.has(node))original.set(node,node.nodeValue);
      const source=original.get(node), key=source.trim();
      if(TEXT[key])node.nodeValue=language==='en'?source.replace(key,TEXT[key]):source;
    }
  }
  const placeholders={newTitle:'e.g. Retain the existing grease interceptor',newDescription:'Describe the observation, potential impact and known project conditions.',newFollowUp:'e.g. Peter Kuo to confirm; Gary to follow up',newDesignerContact:'e.g. Phone discussion with Peter on October 7, 2026',newQuestion:'What does the consultant or project team need to confirm?',newAction:'e.g. Revise M1.0 and M2.0 and coordinate the connections with Civil.',newClosure:'What evidence is required to close this issue?',newSourceOther:'Enter the filename',newSourceNote:'e.g. Demolition note at the bottom right',memberName:'e.g. David'};
  for(const [id,en] of Object.entries(placeholders)){
    const el=document.getElementById(id);if(!el)continue;
    if(!original.has(el))original.set(el,el.placeholder);
    el.placeholder=language==='en'?en:original.get(el);
  }
  for(const option of document.querySelectorAll('#newType option')){
    if(!option.hasAttribute('value'))option.value=option.textContent;
    option.textContent=language==='en'?(TEXT[option.value]||option.value):option.value;
  }
}

