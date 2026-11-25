import { belongsToDiscipline } from './discipline-visibility.js';
import { chineseDisplay, createChineseDisplay, normalizeLanguage, searchText } from './chinese-display.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { createDrawingMarkups } from './drawing-markups.js';
import { DRIVE_FILES } from './drive-files.js';
import { ISSUE_SORT_MODES, sortIssues } from './issue-sort.js';
import { translatePermitForms } from './permit-ui-language.js';
import { createNoIssueControl } from './not-an-issue.js';
import { consultantUpdate, createEmailLogin } from './consultant-access.js';
import { createPasswordLogin } from './password-login.js';
import { isExcludedDocument } from './document-cleanup.js';
import { createGuestComments } from './guest-comments.js';
import { OWNER_ENTRY_UPDATE, applyOwnerEntryUpdate } from './owner-entry-update.js';
import { disciplines, applyResponsibilityReview } from './responsibility-review.js';
import { createResponsibilityEditor } from './responsibility-editor.js';
import { renderMeeting } from './meetings.js';
import { createConstruction, TEAM } from './construction.js';
import { englishText } from './issue-translations.js';
import { applyReview, ISSUE_UPDATES, FACTS, DOCUMENT_UPDATES } from './reaudit.js';
import { DRAINAGE_REVIEW, applyDrainageRetentionReview } from './drainage-retention-review.js';

const reviewTranslations = new Map();

const SUPABASE_URL='https://jnxvuvbfunnfcueddvfd.supabase.co';
const SUPABASE_KEY='sb_publishable_ce487UpCRdtPnBHoukkVlg_PSVEQHyw';
const PROJECT_ID='Arbroath-Combined-Lot-Part9';
const ATTACHMENT_BUCKET='permit-attachments';
const STAGES=['待沟通','等待回复','已确认方案','待改图','已收回件','待复核','已关闭'];
const DOCSTATES=['待确认','待修订','已收到','可提交','排除重复/错放'];
const ENGINEERS=[['建筑','Architect / 建筑','#246391','#e9f1fa'],['Civil','Civil / 土木','#187568','#e6f3ef'],['机械','Mechanical & Plumbing / 机械给排水','#a96622','#fbf0e2'],['结构','Structural / 结构','#705695','#f0ebf8'],['电气','Electrical / 电气','#996b19','#faf2da'],['岩土','Geotechnical / 岩土','#895e4a','#f5ece7'],['测量','Survey / 测量','#497d82','#e9f3f4'],['能源','Energy / 能源','#597b30','#eef4e5'],['消防','Fire / 消防','#a44545','#f8e9e9'],['业主','Owner / 业主','#6f5a3d','#f3eee7'],['申请人','Applicant / 申请与文件','#627084','#eef1f5']];
const LEADS={};
// Verified project-contact directory. These buttons only open a draft in the visitor's mail client; they never send email.
const CONSULTANTS={
  '建筑':[{name:'David Mah',email:'archydave@yahoo.com',zh:'建筑工程师 David Mah',en:'Architect David Mah'},{name:'Jackie · David Mah Office',email:'archcom23@yahoo.com',zh:'建筑事务所 Jackie',en:'Architectural Office Jackie'}],
  'Civil':[{name:'Connor Moss, P.Eng. · CREUS',email:'cmoss@creus.ca',zh:'Civil 工程师 Connor Moss, P.Eng.',en:'Civil Engineer Connor Moss, P.Eng.'}],
  '机械':[{name:'Peter Kuo, P.Eng.',email:'peter@pkengineering.ca',zh:'机械工程师 Peter Kuo, P.Eng.',en:'Mechanical Engineer Peter Kuo, P.Eng.'}],
  '结构':[{name:'Tim Lam, P.Eng.',email:'tim@ennova.ca',zh:'结构工程师 Tim Lam, P.Eng.',en:'Structural Engineer Tim Lam, P.Eng.'}],
  '电气':[{name:'Wei G. Wang, P.Eng.',email:'wei@wgweng.com',zh:'电气工程师 王国维, P.Eng.',en:'Electrical Engineer Wei G. Wang, P.Eng.'},{name:'Koston Zhong · WGW Engineering',email:'koston.z@wgweng.com',zh:'电气设计师 Koston Zhong',en:'Electrical Designer Koston Zhong'}]
};
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});
document.head.insertAdjacentHTML('beforeend','<style>.contact-consultants{margin:18px 0;padding:14px 15px;border:1px solid #b9d8e2;border-left:4px solid var(--blue);border-radius:9px;background:#f4fafc}.contact-consultants h3{margin:0 0 4px}.contact-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.contact-button{display:inline-flex;align-items:center;padding:7px 10px;border:1px solid #7caeba;border-radius:7px;background:#fff;color:#14576c;text-decoration:none;font-size:13px;font-weight:650}.contact-button:hover{background:#e5f3f7}.contact-button.contact-lead{background:#176b82;border-color:#176b82;color:#fff}.contact-button.contact-lead:hover{background:#0f556a}</style>');
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session=null,member=null,project=null,version=0,selected=new URLSearchParams(location.search).get('issue')||'A01',view='issues',saving=false;
let projectLoadPromise=null;
let consultantBaseline=null;
let internalMeeting=null;
let showSupporting=false;
const visibleForDiscipline=(issue,discipline)=>belongsToDiscipline(issue,discipline,showSupporting,lead,involved);
const groupOpen=new Set(['机械']);
let newIssueOwners=[],newPriority='P2',newDiscovery='自己发现',editingIssueId=null,issueSubmitting=false;
let currentLang=normalizeLanguage(localStorage.getItem('permitLang'));
const languageDisplay=createChineseDisplay(()=>currentLang);
const construction=createConstruction({
  project:()=>project, member:()=>member, signedIn:()=>!!session,
  lang:()=>currentLang, db, pdfUrl:drivePdfUrl, save:saveProject, openAttachment,
  async uploadAttachments(files,id){
    const uploaded=[];
    for(const f of files){
      const path=`${PROJECT_ID}/${id}/${crypto.randomUUID()}-${safeName(f.name)}`;
      const {error}=await db.storage.from(ATTACHMENT_BUCKET).upload(path,f,{contentType:f.type,upsert:false});
      if(error){if(uploaded.length)await db.storage.from(ATTACHMENT_BUCKET).remove(uploaded.map(a=>a.path));throw Error(ui('附件上传失败：','Attachment upload failed: ')+error.message);}
      uploaded.push({name:f.name,path,type:f.type,size:f.size});
    }
    return uploaded;
  },
  removeAttachments:paths=>db.storage.from(ATTACHMENT_BUCKET).remove(paths)
});
const UI_TEXT={
  zh:{issues:'问题与定位',professionals:'设计师任务',documents:'文件版本',facts:'已知信息',history:'修改记录',members:'成员权限',backup:'导出备份',openExport:'导出沟通清单',print:'打印',refresh:'刷新',logout:'退出',newIssue:'＋ 上传问题',shared:'共享项目',readLatest:'读取最新协调资料。',search:'搜索问题 / 图号 / 文件',discipline:'责任专业',status:'当前状态',type:'问题性质',all:'全部',open:'开放问题',critical:'提交前必须解决',waiting:'等待回复',closed:'已关闭',english:'English',chinese:'中文',google:'使用 Google 登录',loginCopy:'无需登录即可只读查看；项目成员可使用已登记的 Google 邮箱登录编辑。',save:'保存文件状态'},
  en:{issues:'Issues & Drawing References',professionals:'Consultant Action Items',documents:'Permit Document Register',facts:'Confirmed Project Basis',history:'Change Log',members:'Members & Permissions',backup:'Export Backup',openExport:'Export Open Items',print:'Print',refresh:'Refresh',logout:'Sign out',newIssue:'＋ Report Issue',shared:'Shared Project',readLatest:'Loading the latest coordination data.',search:'Search issue / sheet / file',discipline:'Responsible discipline',status:'Current status',type:'Issue type',all:'All',open:'Open issues',critical:'Required before resubmission',waiting:'Awaiting response',closed:'Closed',english:'English',chinese:'中文',google:'Continue with Google',loginCopy:'Read-only access is available without signing in. Registered project members may sign in with Google to edit.',save:'Save document status'}
};
const STAGE_EN={'待沟通':'Open — discussion required','等待回复':'Awaiting response','已确认方案':'Design approach confirmed','待改图':'Drawing revision required','已收回件':'Revised documents received','待复核':'Pending review','已关闭':'Closed'};
function t(key){return chineseDisplay(UI_TEXT[currentLang]?.[key]||UI_TEXT.zh[key]||key,currentLang)}
function stageText(value){return currentLang==='en'?(STAGE_EN[value]||value):chineseDisplay(value,currentLang)}
function applyLanguage(){
  document.documentElement.lang=currentLang==='en'?'en':currentLang==='zh-Hant'?'zh-Hant':'zh-CN';
  document.title=ui('工程设计图纸协调台','Engineering Drawing Coordination');
  document.querySelectorAll('[data-lang],[data-entry-lang]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.lang||b.dataset.entryLang)===currentLang)));
  const labels={issues:t('issues'),professionals:t('professionals'),documents:t('documents'),facts:t('facts'),meetings:ui('会议讨论记录','Meeting Records'),history:t('history'),members:t('members')};
  document.querySelectorAll('#nav [data-view], #settingsMenu [data-view]').forEach(b=>{if(labels[b.dataset.view])b.textContent=labels[b.dataset.view]});
  $('settingsLabel').textContent=ui('设置 ▾','Settings ▾');
  $('showExcludedLabel').textContent=ui('显示排除的重复／错放副本（仅供追溯）','Show excluded duplicate / misfiled copies (reference only)');
  $('exportBackup').textContent=t('backup');$('exportOpen').textContent=t('openExport');$('print').textContent=t('print');$('refresh').textContent=t('refresh');$('logout').textContent=t('logout');$('openNewIssue').textContent=t('newIssue');
  $('loginCopy').textContent=t('loginCopy');$('googleLogin').innerHTML=`<span class="google-g">G</span>${t('google')}`;
  $('guestLogin').textContent=currentLang==='en'?'Sign in to edit':'登录后编辑';
  $('loginCopy').textContent=ui('选择 Google 登录，或填写姓名以游客身份进入。','Sign in with Google, or enter your name to continue as a visitor.');
  $('guestEntryTitle').textContent=ui('游客进入','Continue as a visitor');
  $('guestNameLabel').textContent=ui('姓名 *','Name *');
  $('guestCompanyLabel').textContent=ui('公司／专业（可选）','Company / discipline (optional)');
  $('enterGuest').textContent=ui('以游客身份进入','Enter as a visitor');
  $('guestName').placeholder=ui('例如：Jackie','e.g. Jackie');
  $('guestEntryCopy').textContent=ui('可查看问题与图纸、提交留言；不能修改项目资料。姓名未经身份验证。','View issues and drawing links and submit comments; no project-editing access. Visitor names are not verified.');
  if(!session&&guestComments.guest)$('whoami').textContent=`${guestComments.guest.name} · ${ui('游客 · 可留言','Visitor · Comments only')}`;
  $('settingsHistory').hidden=!session||isExternal();
  const meetingNav=$('nav')?.querySelector('[data-view="meetings"]');if(meetingNav)meetingNav.hidden=!session||isExternal();
  $('exportBackup').hidden=!session||isExternal();
  document.querySelectorAll('[data-workspace="construction"],[data-workspace="gcMemo"]').forEach(b=>b.hidden=isExternal());
  if(isExternal())construction.setWorkspace('permit');
  $('contextTitle').textContent=project?`${t('shared')} · v${version}`:t('shared');
  $('contextText').textContent=project?(currentLang==='en'?`Last updated: ${project.updatedAt?new Date(project.updatedAt).toLocaleString('en-CA',{timeZone:'America/Vancouver'}):'not recorded'}`:`最后更新：${project.updatedAt?new Date(project.updatedAt).toLocaleString('zh-CN',{timeZone:'America/Vancouver'}):'未记录'}`):t('readLatest');
  $('projectTitle').textContent=ui('6360 + 6380 · 新项目图纸协调台','6360 + 6380 · New Project Coordination');
  $('projectBasisTitle').textContent=ui('项目法规与审批依据','Project regulatory and approval basis');
  projectBasisText.textContent=ui('讨论后的新申请基准：6360 与 6380 已合并为一个 lot，拟按一个建筑重新申请。Owner 提供的方向为 BCBC Part 9、单一 600V/600A 电力系统，并按新方案考虑完整 sprinkler 系统。适用性、喷淋及服务参数仍须由 Architect、相关工程师和 City of Burnaby 书面确认；新图纸尚待设计师重画。','New application basis discussed: 6360 and 6380 are consolidated into one lot and are proposed to be reapplied as one building. Owner direction is BCBC Part 9, one 600V/600A electrical system, and a complete sprinkler system for the new design. Applicability, sprinkler scope and service parameters require written confirmation by the Architect, engineers and City of Burnaby; new drawings are pending.')
  const headings={issues:['问题协调与图纸定位','Issue coordination and drawing references','按责任专业查看问题、确认事项、所需动作及对应图纸位置。','Review issues, required confirmations, actions and drawing locations by responsible discipline.'],professionals:['设计师责任与跟进任务','Consultant responsibilities and action items','汇总各专业尚未关闭的问题及需要回复或修改的事项。','Outstanding responses, revisions and coordination tasks organized by consultant discipline.'],documents:['Permit 材料总表与版本状态','Permit document register and revision status','逐份核对文件、专业、版本、状态和修订依据。“收到”仅表示文件存在；“可提交”只能由管理员确认。','Track each document, discipline, revision, status and supporting revision record. “Received” confirms presence only; “Ready for submission” requires Admin confirmation.'],facts:['已确认的项目依据','Confirmed project basis','仅记录已确认的项目事实、审批基础和重新提交条件。','Confirmed project facts, approval assumptions and resubmission prerequisites.'],history:['项目修改记录','Project change log','记录问题状态、文件版本和成员权限的变更。','Audit trail for issue status, document revisions and member permissions.'],members:['项目成员与编辑权限','Project members and editing permissions','管理可登录编辑本项目的人员和角色。','Manage the people and roles authorized to edit this project.']};
  Object.entries(headings).forEach(([key,v])=>{const h=$(key+'Heading'),p=$(key+'Intro');if(h)h.textContent=currentLang==='en'?v[1]:v[0];if(p)p.textContent=currentLang==='en'?v[3]:v[2]});
  updateIssueDialogLabels();
  for(const id of ['showSupportingLabel','showSupportingProsLabel'])$(id).textContent=ui('显示协作事项（Supporting items）','Show supporting items');
  const labelMap=[['search',t('search')],['discipline',t('discipline')],['statusFilter',t('status')],['typeFilter',t('type')],['sortFilter',ui('排序','Sort by')]];
  labelMap.forEach(([id,text])=>{const parent=$(id)?.parentElement;if(parent&&parent.firstChild?.nodeType===3)parent.firstChild.nodeValue=text});
  translatePermitForms(currentLang);
  emailLogin.render();
  passwordLogin.render();
  $('loginCopy').textContent=ui('使用 Google 或工作邮箱登录，也可填写姓名以游客身份进入。','Sign in with Google or your work email, or enter your name to continue as a visitor.');
  if(project)setCloudState(`云端已同步 · v${version}`);
  if(project){prepareFilters();renderAll()}
  construction.refresh();
  languageDisplay.refresh();
}

function showMessage(text,error=false){$('message').textContent=contentText(text);$('message').classList.toggle('error',error)}
function loginMessage(text,error=false){$('loginMessage').textContent=text;$('loginMessage').classList.toggle('error',error)}
const guestComments=createGuestComments({db,lang:()=>currentLang,signedIn:()=>!!session,admin:isAdmin});
const involved=x=>disciplines(x,lead);
const responsibilityEditor=createResponsibilityEditor({lang:()=>currentLang,categories:ENGINEERS,signedIn:()=>!!session,member:()=>member,visitor:()=>guestComments.guest,disciplines:involved,lead,save:saveProject,suggest:(issue,text)=>guestComments.suggest(issue,text),refresh:()=>{prepareFilters();renderAll()}});
const noIssueControl=createNoIssueControl({lang:()=>currentLang,member:()=>member,signedIn:()=>!!session,lead,contacts:CONSULTANTS,resolve:quickResolveIssue,refresh:()=>{prepareFilters();renderAll()}});
const drawingMarkups=createDrawingMarkups({db,lang:()=>currentLang,member:()=>member,canAdd:canRespond,currentIssue:()=>selected,documents:()=>project?.documents||[],excluded:isExcludedDocument,pdfUrl:drivePdfUrl});
const emailLogin=createEmailLogin({db,lang:()=>currentLang,boot});
const passwordLogin=createPasswordLogin({db,lang:()=>currentLang,boot});
function showEntry(){session=null;member=null;$('app').hidden=true;$('loginScreen').hidden=false;const previous=guestComments.prefill();$('guestName').value=previous.name||'';$('guestCompany').value=previous.company||'';}
function enterGuestMode(){session=null;member={email:'',display_name:guestComments.guest?.name||'Guest',role:'viewer',active:true};$('loginScreen').hidden=true;$('app').hidden=false;$('guestLogin').hidden=false;$('whoami').textContent=`${member.display_name} · ${ui('游客 · 可留言','Visitor · Comments only')}`;$('membersNav').hidden=true;$('openNewIssue').hidden=true;loadProject()}
function setCloudState(text,kind=''){const labels={'正在读取…':'Loading…','读取失败':'Unable to load','等待初始化':'Awaiting setup','正在保存…':'Saving…','保存失败':'Unable to save'};$('saveState').textContent=currentLang==='en'?(labels[text]||text.replace('云端已同步','Synced')):text;$('saveState').className='save-state '+kind}
function validProject(p){return p&&p.schemaVersion===1&&p.project===PROJECT_ID&&Array.isArray(p.issues)&&Array.isArray(p.documents)&&Array.isArray(p.facts)}
function isAdmin(){return member?.role==='admin'}
function isExternal(){return ['consultant','design_lead'].includes(member?.role)}
function canCloseIssue(){return member?.role==='design_lead'}
function internalAccess(){return !!session&&!isExternal()}
function canRespond(issue){return !!session&&['admin','editor','consultant','design_lead'].includes(member?.role)&&(!isExternal()||member.role==='design_lead'||involved(issue).some(d=>(CONSULTANTS[d==='消防'?'电气':d]||[]).some(p=>p.email.toLowerCase()===member.email.toLowerCase())))}
async function quickResolveIssue(id,method,note){
 if(saving)throw Error(ui('正在保存其他修改，请稍后再试。','Another update is being saved. Try again shortly.'));
 saving=true;setCloudState('正在保存…','saving');
 try{
  const {data,error}=await db.rpc('permit_quick_resolve_issue',{p_issue_id:id,p_method:method,p_note:note,p_expected_version:version});
  if(error)throw error;
  project=data.state;version=Number(data.version);if(isExternal())consultantBaseline=structuredClone(project);
  setCloudState(`云端已同步 · v${version}`);showMessage(ui('已解决，并已记录处理方式。','Resolved; the resolution has been recorded.'));
 }catch(error){setCloudState('保存失败','error');throw Error(/VERSION_CONFLICT/.test(error.message)?ui('项目已有更新，请刷新后重试。','The project has changed. Refresh and try again.'):error.message);}
 finally{saving=false;}
}
async function saveConsultantIssue(id){
  if(saving||!id)return false;
  const issue=project.issues.find(i=>i.id===id),baseline=consultantBaseline?.issues.find(i=>i.id===id);
  if(!issue||!baseline||!canRespond(issue))return false;
  const update=consultantUpdate(issue,baseline);saving=true;setCloudState('正在保存…','saving');
  try{
    const {data,error}=await db.rpc('permit_update_consultant_issue',{p_issue_id:id,p_action:update.action,p_payload:update.payload,p_expected_version:version});
    if(error)throw error;
    project=data.state;version=Number(data.version);consultantBaseline=structuredClone(project);
    setCloudState(`云端已同步 · v${version}`);showMessage(ui('专业回复已保存，并记入修改记录。','Your response has been saved and recorded in the change log.'));return true;
  }catch(err){setCloudState('保存失败','error');showMessage(/VERSION_CONFLICT/.test(err.message)?ui('项目已有新更新，请刷新后重试。','The project has newer updates. Refresh and retry.'):err.message,true);return false;}
  finally{saving=false;}
}
function lead(x){return x.lead||LEADS[x.id]||x.owners?.[0]||'申请人'}
function engineerStyle(owner){const e=ENGINEERS.find(v=>v[0]===owner)||ENGINEERS.at(-1);return `--engineer-color:${e[2]};--engineer-bg:${e[3]}`}
function options(values,label){return `<option value="">${label}</option>`+values.map(v=>`<option>${esc(v)}</option>`).join('')}
function drivePdfUrl(file,page){
  const raw=String(file||'');
  const norm=v=>String(v||'').toLowerCase().replace(/\\/g,'/').split('/').pop().replace(/\s+/g,'').replace(/\.pdf$/i,'');
  const id=DRIVE_FILES[raw]||Object.entries(DRIVE_FILES).find(([name])=>norm(name)===norm(raw))?.[1];
  return id?`https://drive.google.com/file/d/${encodeURIComponent(id)}/view?usp=sharing${page?`#page=${encodeURIComponent(page)}`:''}`:''
}
function ui(zh,en){return currentLang==='en'?en:chineseDisplay(zh,currentLang)}
function contentText(value){return currentLang==='en'?(reviewTranslations.get(value)||englishText(value)):chineseDisplay(value,currentLang)}
function displayIssue(issue){return {...issue,...Object.fromEntries(['title','description','question','action','closure','type','evidence','followUp','designerContact','discoverySource'].map(key=>[key,contentText(issue[key])])),owners:(issue.owners||[]).map(contentText),sources:(issue.sources||[]).map(source=>({...source,note:contentText(source.note),sheet:contentText(source.sheet)})),history:(issue.history||[]).map(entry=>({...entry,by:contentText(entry.by),text:contentText(entry.text),status:stageText(entry.status)}))}}
function localDate(value=new Date()){return new Intl.DateTimeFormat('zh-CN',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(value)}
function humanSize(bytes){if(bytes<1024)return `${bytes} B`;if(bytes<1024**2)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1024**2).toFixed(1)} MB`}
function safeName(name){return String(name).normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-120)||'attachment'}
function makeIssueId(){const d=new Date(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver'}).format(d).replaceAll('-','').slice(2);return `U${date}-${crypto.randomUUID().slice(0,4).toUpperCase()}`}
function selectedChoice(name){return document.querySelector(`[data-choice="${name}"] .selected`)?.dataset.value||''}
function setNewIssueMessage(text,error=false){$('newIssueMessage').textContent=contentText(text);$('newIssueMessage').classList.toggle('error',error)}
function installScrollRouting(){
  window.addEventListener('wheel',event=>{
    // The Permit workspace remains mounted when Construction is displayed.
    // A hidden ancestor must not capture Construction's native wheel scrolling.
    if(event.ctrlKey||!project||document.querySelector('main.shell').hidden||!$('constructionRoot').hidden||$('workspace').hidden||document.querySelector('dialog[open]')||window.innerWidth<=1050)return;
    const layout=document.querySelector('#issuesView:not([hidden]) .layout');
    if(!layout)return;
    const inner=event.target.closest?.('.list,.detail');
    const maxPageScroll=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
    const dockY=Math.max(0,Math.min(maxPageScroll,window.scrollY+layout.getBoundingClientRect().top-10));
    if(event.deltaY>0&&window.scrollY<dockY-2){
      event.preventDefault();window.scrollTo({top:Math.min(dockY,window.scrollY+Math.max(24,event.deltaY)),behavior:'auto'});return;
    }
    if(event.deltaY<0&&inner&&inner.scrollTop>0){
      const next=inner.scrollTop+event.deltaY;
      if(next>=0)return;
      event.preventDefault();inner.scrollTop=0;window.scrollBy({top:next,behavior:'auto'});return;
    }
    if(event.deltaY>0&&window.scrollY>=dockY-2){
      if(!inner||inner.scrollTop+inner.clientHeight>=inner.scrollHeight-1)event.preventDefault();
    }
  },{passive:false,capture:true});
}

function renderDisciplineChoices(){
  $('newDisciplineGrid').innerHTML=ENGINEERS.map(e=>`<button type="button" class="discipline-choice ${newIssueOwners.includes(e[0])?'selected':''}" data-owner="${esc(e[0])}" style="${engineerStyle(e[0])}" aria-pressed="${newIssueOwners.includes(e[0])}"><span>${esc(currentLang==='en'?e[1].split(' / ')[0]:e[1])}</span><span class="order">${newIssueOwners.indexOf(e[0])+1}</span></button>`).join('');
}
function populateDrawingChoices(){
  const drawings=(project?.documents||[]).filter(d=>!isExcludedDocument(d));
  $('newSourceFile').innerHTML=`<option value="">${ui('选择现有图纸','Select a drawing')}</option>`+drawings.map(d=>`<option value="${esc(d.file)}">${esc(d.file)} · ${esc(contentText(d.discipline))}</option>`).join('')+`<option value="__other__">${ui('其他文件（手动输入）','Other file (enter filename)')}</option>`;
}
function resetNewIssueForm(){
  $('newIssueForm').reset();newIssueOwners=[];newPriority='P2';newDiscovery='自己发现';editingIssueId=null;
  $('newIssueExtra').open=false;$('newType').value='其他';$('existingIssueAttachments').hidden=true;
  document.querySelectorAll('[data-choice] button').forEach(b=>b.classList.toggle('selected',(b.closest('[data-choice]').dataset.choice==='priority'&&b.dataset.value==='P2')||(b.closest('[data-choice]').dataset.choice==='discovery'&&b.dataset.value==='自己发现')));
  $('designerContactWrap').hidden=true;$('newSourceOtherWrap').hidden=true;$('attachmentPreview').innerHTML='';setNewIssueMessage('');renderDisciplineChoices();populateDrawingChoices();
  $('newReporter').textContent=`${member.display_name} · ${member.email}`;$('newReportedAt').textContent=localDate();
}
function canEditIssueContent(){return !!session&&['admin','editor'].includes(member?.role)}
function updateIssueDialogLabels(){
  $('newIssueTitle').textContent=editingIssueId?ui('编辑问题','Edit issue')+' · '+editingIssueId:ui('上传新问题','Report a new issue');
  $('cancelNewIssue').textContent=ui('取消','Cancel');$('submitNewIssue').textContent=editingIssueId?ui('保存修改','Save changes'):ui('保存问题','Save issue');
}
function openNewIssue(){if(!canEditIssueContent())return;resetNewIssueForm();translatePermitForms(currentLang);updateIssueDialogLabels();$('newIssueDialog').showModal();setTimeout(()=>$('newTitle').focus(),50)}
function openEditIssue(id){
  if(!canEditIssueContent())return;
  const issue=project.issues.find(x=>x.id===id);if(!issue)return;
  resetNewIssueForm();editingIssueId=id;newIssueOwners=[...(issue.owners||[])];newPriority=issue.priority||'P2';newDiscovery=issue.discoverySource||'自己发现';
  for(const [field,key] of [['newTitle','title'],['newDescription','description'],['newQuestion','question'],['newAction','action'],['newClosure','closure'],['newFollowUp','followUp'],['newDesignerContact','designerContact'],['newDue','due']])$(field).value=issue[key]||'';
  $('newType').value=issue.type||'其他';if(!$('newType').value){const option=document.createElement('option');option.value=issue.type;option.textContent=contentText(issue.type);$('newType').append(option);$('newType').value=issue.type;}
  const source=issue.sources?.[0];if(source){
    if(![...$('newSourceFile').options].some(o=>o.value===source.file)){const option=document.createElement('option');option.value=source.file;option.textContent=source.file;$('newSourceFile').append(option);}
    $('newSourceFile').value=source.file;$('newSourcePage').value=source.page||'';$('newSourceSheet').value=source.sheet||'';$('newSourceNote').value=source.note||'';
  }
  document.querySelectorAll('[data-choice] button').forEach(b=>{const choice=b.closest('[data-choice]').dataset.choice;b.classList.toggle('selected',b.dataset.value===(choice==='priority'?newPriority:newDiscovery))});
  $('designerContactWrap').hidden=newDiscovery!=='与设计师沟通后发现';renderDisciplineChoices();
  if(issue.reporter)$('newReporter').textContent=issue.reporter.name||issue.reporter.email;
  if(issue.reportedAt)$('newReportedAt').textContent=localDate(new Date(issue.reportedAt));
  if(issue.attachments?.length){$('existingIssueAttachments').hidden=false;$('existingIssueAttachments').textContent=ui('已保存的附件会保留：','Existing attachments will be retained: ')+issue.attachments.map(a=>a.name).join(' · ');}
  translatePermitForms(currentLang);updateIssueDialogLabels();$('newIssueDialog').showModal();setTimeout(()=>$('newTitle').focus(),50);
}
function closeNewIssue(){if(!issueSubmitting)$('newIssueDialog').close()}
async function openAttachment(path){
  const {data,error}=await db.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path,300);
  if(error){showMessage('附件无法打开：'+error.message,true);return}
  window.open(data.signedUrl,'_blank','noopener,noreferrer');
}
async function uploadIssueFiles(issueId){
  const files=[...$('newAttachments').files];
  if(files.length>5)throw Error('最多只能上传 5 个附件。');
  if(files.some(f=>f.size>15*1024*1024))throw Error('每个附件不能超过 15 MB。');
  if(files.some(f=>!(f.type==='application/pdf'||f.type.startsWith('image/'))))throw Error('只允许上传图片或 PDF。');
  const uploaded=[];
  for(let i=0;i<files.length;i++){
    const f=files[i],path=`${PROJECT_ID}/${issueId}/${crypto.randomUUID()}-${safeName(f.name)}`;
    setNewIssueMessage(`正在上传附件 ${i+1} / ${files.length}…`);
    const {error}=await db.storage.from(ATTACHMENT_BUCKET).upload(path,f,{contentType:f.type||'application/octet-stream',upsert:false});
    if(error){if(uploaded.length)await db.storage.from(ATTACHMENT_BUCKET).remove(uploaded.map(a=>a.path));throw Error(`附件“${f.name}”上传失败：${error.message}`)}
    uploaded.push({name:f.name,path,type:f.type,size:f.size});
  }
  return uploaded;
}
async function submitNewIssue(event){
  event.preventDefault();
  if(saving||issueSubmitting||!canEditIssueContent())return;
  const title=$('newTitle').value.trim(),description=$('newDescription').value.trim(),question=$('newQuestion').value.trim(),action=$('newAction').value.trim(),followUp=$('newFollowUp').value.trim();
  if(!title||!description){setNewIssueMessage(ui('只需填写问题标题和问题与当前判断。','Enter the issue title and current assessment.'),true);return}
  const existing=editingIssueId?project.issues.find(x=>x.id===editingIssueId):null;
  if(editingIssueId&&!existing){setNewIssueMessage(ui('未找到原问题，请刷新后重试。','Issue not found. Refresh and retry.'),true);return;}
  const id=existing?.id||makeIssueId(),before=existing?structuredClone(existing):null;
  const controls=[...$('newIssueForm').querySelectorAll('input,textarea,select,button')];issueSubmitting=true;controls.forEach(el=>el.disabled=true);
  let attachments=[],changed=false,persisted=false;
  try{
    attachments=await uploadIssueFiles(id);
    const selectedFile=$('newSourceFile').value,sourceFile=(selectedFile==='__other__'?$('newSourceOther').value:selectedFile).trim();
    const source=sourceFile?{file:sourceFile,page:$('newSourcePage').value?Number($('newSourcePage').value):'',sheet:$('newSourceSheet').value.trim(),note:$('newSourceNote').value.trim()}:null;
    if(source&&before?.sources?.[0]&&JSON.stringify(source)===JSON.stringify(Object.fromEntries(['file','page','sheet','note'].map(k=>[k,before.sources[0][k]||'']))))Object.assign(source,before.sources[0]);
    const fields={title,description,question,action,followUp,owners:newIssueOwners.length?[...newIssueOwners]:['申请人'],priority:newPriority,type:$('newType').value,closure:$('newClosure').value.trim(),sources:[...(source?[source]:[]),...(before?.sources?.slice(1)||[])],due:$('newDue').value,discoverySource:newDiscovery,designerContact:$('newDesignerContact').value.trim()};
    const at=new Date().toISOString(),by=`${member.display_name} (${member.email})`;
    let issue=existing;
    if(existing){
      const edits=Object.fromEntries(Object.entries(fields).filter(([key,value])=>JSON.stringify(before[key]??'')!==JSON.stringify(value)).map(([key,value])=>[key,{from:before[key]??'',to:value}]));
      if(!Object.keys(edits).length&&!attachments.length){setNewIssueMessage(ui('内容没有变化。','No changes to save.'));return;}
      Object.assign(issue,fields);issue.attachments=[...(before.attachments||[]),...attachments];
      if(JSON.stringify(before.owners)!==JSON.stringify(fields.owners)){
        const from={lead:lead(before),owners:before.owners||[]};issue.lead=fields.owners[0];issue.responsibilityHistory||=[];issue.responsibilityHistory.push({kind:'manual',at,actor:by,from,to:{lead:issue.lead,owners:fields.owners},reason:'编辑问题时调整责任专业 / Responsibility updated while editing issue'});
      }
      const changes=Object.entries(edits).map(([key,value])=>`${key}: ${typeof value.from==='object'?JSON.stringify(value.from):value.from} → ${typeof value.to==='object'?JSON.stringify(value.to):value.to}`).join('\n');
      issue.history||=[];issue.history.push({date:at,by,status:issue.status,text:`编辑问题 / Issue edited\n${changes}${attachments.length?`\n新增附件 / Added attachments: ${attachments.map(a=>a.name).join(', ')}`:''}`,changes:edits});
    }else{
      issue={id,...fields,dependencies:[],status:'待沟通',evidence:'',reviewed:false,reporter:{name:member.display_name,email:member.email},reportedAt:at,attachments,history:[{date:at,by,text:'提出新问题 / New issue reported',status:'待沟通'}]};project.issues.push(issue);
    }
    changed=true;
    if(!(await saveProject(`${existing?'编辑问题 / Edit issue':'新增问题 / New issue'} ${id}: ${title}`,id)))throw Error(ui('共享项目没有保存，输入内容仍保留，请刷新核对后重试。','The shared project was not saved. Your input is preserved; refresh and retry.'));
    persisted=true;selected=id;groupOpen.add(lead(issue));$('search').value='';prepareFilters();for(const field of ['discipline','statusFilter','typeFilter'])$(field).value='';switchView('issues');renderAll();$('detail').scrollTop=0;$('newIssueDialog').close();showMessage(ui(existing?'问题已修改，变更已记录。':'问题已保存，可点击标题旁的“编辑问题”继续修改。',existing?'Issue updated and changes recorded.':'Issue saved. Use Edit issue beside its title to make changes.'));
  }catch(error){
    if(changed&&!persisted){if(existing){for(const key of Object.keys(existing))delete existing[key];Object.assign(existing,before);}else project.issues=project.issues.filter(x=>x.id!==id);}
    if(attachments.length&&!persisted)await db.storage.from(ATTACHMENT_BUCKET).remove(attachments.map(a=>a.path));setNewIssueMessage(error.message||String(error),true);
  }finally{issueSubmitting=false;controls.forEach(el=>el.disabled=false);}
}

async function signIn(){
  loginMessage('正在打开 Google 登录…');
  const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});
  if(error)loginMessage('无法打开 Google 登录：'+error.message,true);
}

async function signOut(){await db.auth.signOut();location.replace(location.origin+location.pathname)}

async function boot(){
  const {data}=await db.auth.getSession();session=data.session;
  if(!session){showEntry();return}
  if(session.user.app_metadata?.must_change_password){
    await passwordLogin.requireChange();
    const current=await db.auth.getSession();session=current.data.session;
    if(!session){showEntry();return;}
  }
  const email=String(session.user.email||'').toLowerCase();
  const {data:row,error}=await db.from('permit_members').select('email,display_name,role,active').eq('email',email).maybeSingle();
  if(error||!row?.active){await db.auth.signOut();showEntry();loginMessage(ui('该 Google 邮箱没有项目权限，请填写姓名以游客身份进入。','This Google account is not authorized. Enter your name to continue as a visitor.'),true);return}
  member=row;$('loginScreen').hidden=true;$('app').hidden=false;
  $('guestLogin').hidden=true;
  $('whoami').textContent=`${member.display_name} · ${{admin:'Admin',editor:'Editor',viewer:'Viewer',consultant:'Consultant',design_lead:'Design Lead'}[member.role]||member.role}`;
  $('membersNav').hidden=!isAdmin();
  $('openNewIssue').hidden=!['admin','editor'].includes(member.role);
  await loadProject();
}

function loadProject(){
  if(projectLoadPromise)return projectLoadPromise;
  projectLoadPromise=loadProjectOnce().finally(()=>{projectLoadPromise=null});
  return projectLoadPromise;
}
async function loadProjectOnce(){
  setCloudState('正在读取…','saving');showMessage('');
  const {data,error}=session
    ? isExternal()?await db.rpc('permit_get_consultant_project'):await db.from('permit_projects').select('state,version,updated_at').eq('id',PROJECT_ID).single()
    : await db.rpc('permit_get_public_project');
  if(error){setCloudState('读取失败','error');showMessage('无法读取项目：'+error.message,true);return}
  version=Number(data.version||0);
  if(!validProject(data.state)){
    project=null;$('workspace').hidden=true;$('initialization').hidden=!isAdmin();
    if(!isAdmin())loginMessage('项目资料尚未由管理员初始化。',true);
    setCloudState('等待初始化','error');return;
  }
  project=structuredClone(data.state);$('initialization').hidden=true;$('workspace').hidden=false;setCloudState(`云端已同步 · v${version}`);
  if(isAdmin()) {
    const reviewed=applyReview(project);
    if(reviewed.changed) {
      const beforeReview=project;project=reviewed.state;
      if(!await saveProject('2026-10-08 项目协调重审：更新业主确认、图纸依据、专业任务及中英文表述','project-review')) {
        project=beforeReview;
        showMessage('重审更新尚未保存。请点击刷新重试；现有共享资料未覆盖。',true);
        prepareFilters();renderAll();return;
      }
    }
  }
  $('projectTitle').textContent=currentLang==='en'?'6360 + 6380 · New Project Coordination':'6360 + 6380 · 新项目图纸协调台';
  const entryReview=applyOwnerEntryUpdate(project);
  if(entryReview.changed){
    const beforeEntry=project;project=entryReview.state;
    if(isAdmin()&&!await saveProject('C07：加入业主David入口坡道及排水构想，待三专业书面确认','issue:C07')){project=beforeEntry;showMessage(ui('C07新说明尚未同步，请Admin刷新重试。','The C07 update has not synchronized; Admin should refresh and retry.'),true);}
  }
  if(isAdmin()){
    const responsibilityReview=applyResponsibilityReview(project,lead);
    if(responsibilityReview.changed){
      const previous=project;project=responsibilityReview.state;
      if(!await saveProject(`Coordination responsibility review: ${responsibilityReview.count} allocations updated; manual reassignments preserved; no issue IDs or stages changed`,'responsibility-review')){project=previous;showMessage(ui('责任分工重审尚未同步，请Admin刷新重试。','The responsibility review has not synchronized; Admin should refresh and retry.'),true);}
    }
  }
  const drainageReview=applyDrainageRetentionReview(project);
  if(drainageReview.changed){
    project=drainageReview.state;
    if(isAdmin()&&!await saveProject('New property project coordination update','new-property-review')){
      showMessage(ui('协调内容已展示；云端保存尚未成功，请管理员刷新重试。','The coordination update is displayed; cloud persistence failed. Admin should refresh and retry.'),true);
    }
  }
  $('contextTitle').textContent=`${t('shared')} · v${version}`;
  $('contextText').textContent=currentLang==='en'?`Last updated: ${project.updatedAt?new Date(project.updatedAt).toLocaleString('en-CA',{timeZone:'America/Vancouver'}):'not recorded'}`:`最后更新：${project.updatedAt?new Date(project.updatedAt).toLocaleString('zh-CN',{timeZone:'America/Vancouver'}):'未记录'}`;
  if(isExternal())consultantBaseline=structuredClone(project);
  prepareFilters();renderAll();applyLanguage();
}

async function showInternalMeeting(){
  if(!session)return;
  const target=$('meetingsView');
  if(!internalMeeting){
    target.textContent=ui('正在读取会议记录…','Loading meeting records…');
    const {data,error}=await db.rpc('permit_get_internal_meeting');
    if(error){target.textContent=ui('会议记录读取失败：','Could not load meeting records: ')+error.message;return;}
    internalMeeting=data;
  }
  if(view==='meetings'&&session)renderMeeting(target,currentLang,internalMeeting);
}

async function saveProject(summary,entityId){
  if(isExternal())return saveConsultantIssue(entityId);
  if(saving)return false;saving=true;setCloudState('正在保存…','saving');showMessage('');
  project.updatedAt=new Date().toISOString();
  const {data,error}=await db.rpc('permit_save_state',{p_project_id:PROJECT_ID,p_state:project,p_expected_version:version,p_summary:summary,p_entity_id:entityId||null});
  saving=false;
  if(error){
    setCloudState('保存失败','error');
    if(/VERSION_CONFLICT/i.test(error.message)){showMessage('另一位成员刚刚保存了新版本。请点右上角“刷新”后重新填写本次修改。',true)}
    else showMessage('保存失败：'+error.message,true);
    return false;
  }
  version=Number(data?.[0]?.new_version??version+1);setCloudState(`云端已同步 · v${version}`);showMessage('已保存到共享项目，并写入修改记录。');renderMetrics();return true;
}

function prepareFilters(){
  const savedSort=localStorage.getItem('permitIssueSortV2');
  const sortMode=$('sortFilter').value||(ISSUE_SORT_MODES.includes(savedSort)?savedSort:'lead');
  $('sortFilter').innerHTML=[['newest',ui('最新添加优先','Newest added first')],['oldest',ui('最早添加优先','Oldest added first')],['lead',ui('本组主责优先','Discipline lead first')]].map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  $('sortFilter').value=sortMode;
  const values=['discipline','statusFilter','typeFilter'].map(id=>$(id).value);
  const owners=ENGINEERS.map(e=>e[0]).filter(o=>project.issues.some(x=>involved(x).includes(o)));
  $('discipline').innerHTML=`<option value="">${ui('全部专业','All disciplines')}</option>`+owners.map(o=>`<option value="${esc(o)}">${esc(contentText(o))}</option>`).join('');
  $('statusFilter').innerHTML=options(STAGES.map(x=>currentLang==='en'?stageText(x):x),currentLang==='en'?'All statuses':'全部状态');
  $('statusFilter').querySelectorAll('option').forEach((o,i)=>{if(i>0)o.value=STAGES[i-1]});
  $('typeFilter').innerHTML=`<option value="">${ui('全部性质','All issue types')}</option>`+[...new Set(project.issues.map(x=>x.type))].map(type=>`<option value="${esc(type)}">${esc(contentText(type))}</option>`).join('');
  ['discipline','statusFilter','typeFilter'].forEach((id,i)=>{if([...$(id).options].some(o=>o.value===values[i]))$(id).value=values[i]});
}
function filtered(){const q=searchText($('search').value);return project.issues.filter(x=>(!$('discipline').value||visibleForDiscipline(x,$('discipline').value))&&(!$('statusFilter').value||x.status===$('statusFilter').value)&&(!$('typeFilter').value||x.type===$('typeFilter').value)&&(!q||searchText(JSON.stringify(x)+' '+JSON.stringify(displayIssue(x))).includes(q)))}
function renderMetrics(){const open=project.issues.filter(x=>x.status!=='已关闭');const values=[[t('open'),open.length],[t('critical'),open.filter(x=>x.priority==='P1').length],[t('waiting'),open.filter(x=>x.status==='等待回复').length],[t('closed'),project.issues.length-open.length]];$('metrics').innerHTML=values.map(v=>`<div class="metric"><span class="label">${v[0]}</span><span class="value">${v[1]}</span></div>`).join('')}
function issueCard(x,group){const isLead=group===lead(x);return `<button class="issue ${x.id===selected?'active':''}" data-id="${esc(x.id)}" aria-pressed="${x.id===selected}"><div class="tags"><span class="tag ${x.priority.toLowerCase()}">${esc(x.priority)}</span><span class="tag">${esc(x.id)}</span><span class="tag issue-role ${isLead?'role-lead':'role-support'}">${isLead?ui('本组主责','Lead item'):ui('本组协作','Supporting item')}</span><span class="tag ${x.status==='已关闭'?'closed':''}">${esc(stageText(x.status))}</span></div><h3>${esc(contentText(x.title))}</h3><div class="tags responsibility-tags"><span class="owner-chip lead-chip" style="${engineerStyle(lead(x))}">${ui('主责','Lead')} · ${esc(contentText(lead(x)))}</span>${involved(x).filter(o=>o!==lead(x)).map(o=>`<span class="owner-chip support-chip" style="${engineerStyle(o)}">${ui('协作','Supporting')} · ${esc(contentText(o))}</span>`).join('')}</div><p>${(x.sources||[]).map(s=>`${esc(contentText(s.sheet)||ui('文件','File'))} · ${ui('第','p. ')}${esc(s.page||'—')}${ui('页','')}`).join(' / ')}</p>${x.due?`<p>${ui('回复日期','Response due')} ${esc(x.due)}</p>`:''}</button>`}
function renderList(){
  const xs=filtered(),scroll=$('list').scrollTop;
  document.querySelectorAll('#list details').forEach(d=>d.open?groupOpen.add(d.dataset.group):groupOpen.delete(d.dataset.group));
  $('resultCount').textContent=ui(`显示 ${xs.length} / ${project.issues.length} 个独立问题 · ${showSupporting?'含协作事项；同编号不重复计数':'仅显示各专业主责事项'}`,`Showing ${xs.length} of ${project.issues.length} unique issues · ${showSupporting?'including supporting items; repeated IDs are the same issue':'lead items only'}`);
  if(!xs.some(x=>x.id===selected))selected=xs[0]?.id;
  const chosen=xs.find(x=>x.id===selected);if(chosen)groupOpen.add(lead(chosen));
  $('list').innerHTML=xs.length?ENGINEERS.map(e=>{if($('discipline').value&&$('discipline').value!==e[0])return'';const items=sortIssues(xs.filter(x=>visibleForDiscipline(x,e[0])),project.issues,$('sortFilter').value,e[0],lead);if(!items.length)return'';const main=items.filter(x=>lead(x)===e[0]).length;return `<details class="engineer-group" data-group="${esc(e[0])}" style="${engineerStyle(e[0])}" ${groupOpen.has(e[0])?'open':''}><summary><span class="group-label">${esc(currentLang==='en'?e[1].split(' / ')[0]:e[1])}</span><span class="group-count">${main} ${ui('主责','lead')} · ${items.length-main} ${ui('协作','support')}</span></summary><div class="group-items">${items.map(x=>issueCard(x,e[0])).join('')}</div></details>`}).join(''):`<div class="detail">${ui('没有符合筛选条件的问题。','No issues match the selected filters.')}</div>`;
  $('list').scrollTop=scroll;renderDetail();
  $('list').querySelectorAll('[data-id]').forEach(card=>{
    if(project.issues.find(issue=>issue.id===card.dataset.id)?.status!=='已关闭')return;
    card.classList.add('issue-closed');
    const mark=document.createElement('span');mark.className='closed-check';
    mark.setAttribute('aria-label',ui('已关闭','Closed'));
    mark.innerHTML=`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 33 26 47 53 17"/></svg><small>${ui('已关闭','Closed')}</small>`;
    card.append(mark);
  });
  $('detail').classList.toggle('detail-closed',chosen?.status==='已关闭');
  if(chosen?.status==='已关闭')$('detail').insertAdjacentHTML('afterbegin',`<div class="closed-banner"><span aria-hidden="true">✓</span> ${ui('已关闭 · 可查看确认依据及历史记录','Closed · Review the supporting evidence and history below')}</div>`);
}
function sourceHTML(s){const url=(s.url&&/^(https:\/\/drive\.google\.com\/|\.\/review-phasing\.png$)/.test(s.url)?s.url:'')||drivePdfUrl(s.file,s.page);return `<div class="source">${url?`<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${ui('在新窗口打开图纸','Open drawing in a new tab')}"><strong>${esc(s.file)} ↗</strong></a>`:`<strong>${esc(s.file)}</strong>`}<span class="loc">${s.page?`${ui('PDF第','PDF p.')} ${esc(s.page)} ${ui('页','')} · `:''}${esc(contentText(s.sheet)||ui('文件','File'))}</span><small>${esc(currentLang==='en'?(s.noteEn||contentText(s.note)):(s.note||''))||ui('请按文件名、页码和图号定位。','Locate by filename, PDF page and sheet number.')}</small></div>`}
function statusOptions(current){return STAGES.map(s=>`<option value="${esc(s)}" ${s===current?'selected':''} ${!canCloseIssue()&&s==='已关闭'?'disabled':''}>${esc(stageText(s))}</option>`).join('')}
function issueText(raw){const x=displayIssue(raw);return `${x.id} ${x.title}\n${ui('责任','Responsible disciplines')}: ${x.owners.join(' / ')}\n${ui('状态','Status')}: ${stageText(x.status)}\n${ui('问题','Issue')}: ${x.description}\n${ui('确认','Confirmation required')}: ${x.question}\n${ui('动作','Required action')}: ${x.action}\n${ui('关闭条件','Closure criteria')}: ${x.closure}\n${ui('定位','Drawing references')}:\n${x.sources.map(s=>`${s.file} | PDF ${ui('第','p. ')}${s.page||'—'}${ui('页','')} · ${s.sheet||ui('文件','File')} | ${s.note||''}`).join('\n')}\n${ui('回复日','Response due')}: ${x.due||ui('待约定','To be agreed')}\n${ui('依据','Evidence')}: ${x.evidence||ui('待提供','To be provided')}`}
function issueDeepLink(issue){const link=new URL(location.href);link.search='';link.hash='';link.searchParams.set('issue',issue.id);return link.toString()}
function consultantTargets(issue){const ordered=[lead(issue),...involved(issue).filter(o=>o!==lead(issue))];const seen=new Set();return ordered.flatMap(owner=>(CONSULTANTS[owner]||[]).map(person=>({...person,owner}))).filter(person=>!seen.has(person.email)&&(seen.add(person.email),true))}
function emailDraftUrl(issue,person,provider='gmail'){
  const title=englishText(issue.title),question=englishText(issue.question),action=englishText(issue.action),references=(issue.sources||[]).map(s=>`${s.file}${s.page?` — PDF p. ${s.page}`:''}${s.sheet?` (${englishText(s.sheet)})`:''}`).join('; ')||'See project coordination record';
  const subject=`[6360 + 6380 | ${issue.id}] Confirmation required — ${title}`;
  const body=`Dear ${person.name.split('·')[0].trim()},\n\nCould you please review and confirm the following coordination item?\n\nIssue ID: ${issue.id}\nSubject: ${title}\n\nConfirmation requested:\n${question}\n\nRequested action:\n${action}\n\nDrawing reference(s):\n${references}\n\nOpen this item directly:\n${issueDeepLink(issue)}\n\nPlease reply to this email or record your response in the project coordination platform.\n\nThank you,\n6360 + 6380 Project Coordination`;
  if(provider==='system')return `mailto:${encodeURIComponent(person.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const link=new URL(provider==='outlook'?'https://outlook.office.com/mail/deeplink/compose':'https://mail.google.com/mail/');
  const fields=provider==='outlook'?{to:person.email,subject,body}:{view:'cm',fs:'1',to:person.email,su:subject,body};
  for(const [key,value] of Object.entries(fields))link.searchParams.set(key,value);
  return link.toString();
}
function consultantContactHTML(issue){const people=consultantTargets(issue);if(!people.length)return '';
  return `<section class="contact-consultants"><h3>${ui('联系相关设计师','Contact relevant consultants')}</h3><p class="subtle">${ui('点击下方按钮，在新标签页打开 Gmail 并预填英文邮件；不会自动发送。邮件含问题直达链接。发送前请核对发件账号及内容。','Opens Gmail in a new tab with a prefilled English email and a direct issue link. Nothing is sent automatically. Check the sending account and content before sending.')}</p><div class="contact-actions">${people.map((person,index)=>`<a class="contact-button ${index===0?'contact-lead':''}" data-contact="${esc(person.email)}" href="${esc(emailDraftUrl(issue,person))}" target="_blank" rel="noopener noreferrer">${ui('联系','Contact ')}${esc(currentLang==='en'?person.en:person.zh)}</a>`).join('')}</div><details class="contact-other" style="margin-top:12px"><summary>${ui('不使用 Gmail？其他邮件方式','Not using Gmail? Other email options')}</summary><p class="subtle">${ui('Outlook 网页版不依赖电脑默认邮件设置；系统邮件需要先配置邮件程序。若新标签页未出现，请检查浏览器的弹出窗口限制。','Outlook web does not require a default desktop mail app. System email requires a configured mail handler. If no new tab appears, check your browser’s popup settings.')}</p>${people.map(person=>`<div style="margin-top:10px"><strong>${esc(person.name)}</strong><div class="contact-actions"><a class="contact-button" data-provider="outlook" href="${esc(emailDraftUrl(issue,person,'outlook'))}" target="_blank" rel="noopener noreferrer">${ui('Outlook 网页版','Outlook web')}</a><a class="contact-button" data-provider="system" href="${esc(emailDraftUrl(issue,person,'system'))}">${ui('系统邮件程序','System email app')}</a></div></div>`).join('')}</details></section>`;
}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function renderDetail(){
  const x=project.issues.find(i=>i.id===selected);if(!x){$('detail').innerHTML=`<p>${ui('选择一个问题查看详情。','Select an issue to view its details.')}</p>`;return}
  $('detail').innerHTML=`<div class="tags"><span class="tag ${x.priority.toLowerCase()}">${esc(x.priority)}</span><span class="tag">${esc(x.id)}</span><span class="tag">${esc(contentText(x.type))}</span></div><h2>${esc(contentText(x.title))}</h2><p class="subtle">${ui('责任专业：','Responsible discipline: ')}${esc(x.owners.map(contentText).join(' / '))}</p><div class="stage">${STAGES.map(s=>`<span class="${s===x.status?'on':''}">${stageText(s)}</span>`).join('')}</div>${consultantContactHTML(x)}<h3>${ui('问题与当前判断','Issue and current assessment')}</h3><p>${esc(contentText(x.description))}</p><h3>${ui('图纸定位 · 文件 / PDF页码 / 图号','Drawing reference · file / PDF page / sheet')}</h3>${(x.sources||[]).map(sourceHTML).join('')}<h3>${ui('要向设计师确认','Confirmation required from designer')}</h3><p>${esc(contentText(x.question))}</p><h3>${ui('需要他们完成的动作','Required action')}</h3><p>${esc(contentText(x.action))}</p><h3>${ui('关闭条件','Closure criteria')}</h3><p>${esc(contentText(x.closure))}</p>${x.dependencies?.length?`<h3>${ui('关联前置任务','Related prerequisite items')}</h3><div class="tags">${x.dependencies.map(id=>`<button data-jump="${esc(id)}">${esc(id)} · ${esc(stageText(project.issues.find(i=>i.id===id)?.status||''))}</button>`).join('')}</div>`:''}<div class="edit-section"><h3>${ui('沟通后更新','Post-discussion update')}</h3><div class="grid2"><label>${ui('当前状态','Current status')}<select id="editStatus">${statusOptions(x.status)}</select></label><label>${ui('约定回复日期','Agreed response date')}<input id="editDue" type="date" value="${esc(x.due)}"></label></div><label>${ui('专业确认 / 修订文件依据','Professional confirmation / revised drawing evidence')}<input id="editEvidence" placeholder="${ui('例如：Peter邮件2026-10-09；M1.0 Rev2','e.g. Peter email 2026-10-09; M1.0 Rev2')}" value="${esc(x.evidence)}"></label><label>${ui('本次回复、决定或备注','Response, decision or note')}<textarea id="editNote" placeholder="${ui('记录工程师原话、确认内容及下一步','Record the designer response, decision and next step')}"></textarea></label><label class="checkrow"><input id="editReviewed" type="checkbox" ${x.reviewed?'checked':''}>${ui('所需专业确认、改图和跨专业复核已完成','Required professional confirmation, drawing revision and interdisciplinary review are complete')}</label><div class="actions"><button id="saveIssue" class="primary">${ui('保存更新','Save update')}</button><button id="copyIssue">${ui('复制沟通清单','Copy coordination checklist')}</button></div><p class="subtle">${ui('只有 Admin 可以关闭问题；关闭前必须填写依据和备注并完成复核。','Only Admin may close an issue. Evidence, a note and review confirmation are required before closure.')}</p></div><h3>${ui('沟通与变更记录','Communication and change history')}</h3>${x.history?.length?x.history.slice().reverse().map(h=>`<div class="history"><strong>${esc(h.date)} · ${esc(contentText(h.by))} · ${esc(stageText(h.status))}</strong><p>${esc(contentText(h.text))}</p></div>`).join(''):`<p class="subtle">${ui('尚无沟通记录。','No communication records yet.')}</p>`}`;
  $('detail').querySelectorAll('.stage span').forEach((el,index)=>{el.textContent=stageText(STAGES[index])});
  if(x.regulatoryReferences?.length){
    const refs=document.createElement('section');
    refs.innerHTML=`<h3>${ui('规范与监管依据 · 2026-10-09核查','Code and regulatory references · reviewed October 9, 2026')}</h3><p class="subtle">${ui('供核对设计依据；是否适用本项目及具体接受条件，须由责任工程师和主管机关确认。','For review of the design basis; the responsible consultant and authority must confirm project applicability and acceptance conditions.')}</p><ul>${x.regulatoryReferences.map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a></li>`).join('')}</ul>`;
    $('detail').querySelector('.edit-section').before(refs);
  }
  if(x.id==='C07'){
    const concept=document.createElement('section');concept.className='owner-concept';concept.innerHTML=`<h3>${ui('业主 David 的入口排水构想 · 2026-10-08','Owner David’s entrance drainage concept · October 8, 2026')}</h3><p>${ui('Gary转述并提供示意；为待专业确认的业主方案，不是已批准施工图。左侧管道方向已有Mechanical初步口头沟通，书面确认及计算待收。','Sketch and Owner direction relayed by Gary. This proposal requires professional confirmation and is not an approved construction drawing. Mechanical has provided preliminary verbal advice concerning the left-side pipe; written confirmation and calculations remain outstanding.')}</p><a href="./owner-entry-drainage-20261008.png" target="_blank" rel="noopener"><img src="./owner-entry-drainage-20261008.png" alt="${ui('业主拟议入口坡道、蓝色加高边、黑色排水槽及黄色排水管道示意','Owner-proposed entrance ramp, blue raised edges, black trench drain and yellow drainage pipe')}" style="width:100%;height:auto"></a><p class="subtle">${ui('点击图示放大。黄色箭头仅表示排向6360停车场的构想；具体受纳接点、左右系统是否连通，均待设计师确认。','Click to enlarge. The yellow arrow indicates a proposed route toward the 6360 parking area; the receiving connection and linkage between left/right systems remain to be confirmed.')}</p>`;
    $('detail').querySelector('.edit-section').before(concept);
  }
  $('detail').querySelector('h2').insertAdjacentHTML('afterend',`<div class="detail-responsibility"><span class="owner-chip lead-chip" style="${engineerStyle(lead(x))}">${ui('主责','Lead')} · ${esc(contentText(lead(x)))}</span>${involved(x).filter(o=>o!==lead(x)).map(o=>`<span class="owner-chip support-chip" style="${engineerStyle(o)}">${ui('协作','Supporting')} · ${esc(contentText(o))}</span>`).join('')}</div><p class="subtle">${ui('问题编号：','Issue ID: ')}${esc(x.id)}<br>${ui('编号为固定历史引用，不随责任专业调整而改变。','Issue IDs are permanent references and do not change when lead responsibility is reassigned.')}</p>`);
  if(x.reporter||x.followUp||x.designerContact){
    const meta=`${x.reporter?`<div class="report-meta"><span>${ui('提出人：','Reported by: ')}${esc(x.reporter.name)} · ${esc(x.reporter.email)}</span><span>${ui('提出日期：','Reported on: ')}${esc(localDate(new Date(x.reportedAt)))}</span><span>${ui('来源：','Source: ')}${esc(contentText(x.discoverySource||'未记录'))}</span></div>`:''}${x.followUp?`<p><strong>${ui('确认 / 跟进：','Confirmation / follow-up: ')}</strong>${esc(contentText(x.followUp))}</p>`:''}${x.designerContact?`<p><strong>${ui('设计师沟通记录：','Consultant discussion: ')}</strong>${esc(contentText(x.designerContact))}</p>`:''}`;
    $('detail').querySelector('h2').insertAdjacentHTML('afterend',meta);
  }
  if(x.attachments?.length){
    const html=`<section class="private-attachments"><h3>${ui('问题附件','Issue attachments')}</h3><div class="attachment-list">${x.attachments.map((a,i)=>`<button class="attachment-link" data-attachment="${i}"><span>${a.type==='application/pdf'?'PDF':ui('图片','Image')} · ${esc(a.name)}</span><small>${humanSize(a.size||0)}</small></button>`).join('')}</div></section>`;
    $('detail').querySelector('.edit-section').insertAdjacentHTML('beforebegin',html);
    if(!session)$('detail').querySelector('.private-attachments')?.remove();
  }
  if(!canRespond(x)||x.status==='已关闭'&&isExternal())$('detail').querySelector('.edit-section')?.remove();
  guestComments.mount(x).catch(()=>{});
  responsibilityEditor.mount(x);
  if(isExternal()&&!canRespond(x))document.getElementById('responsibilityPanel')?.remove();
  noIssueControl.mount(x);
  if(canEditIssueContent()){
    const title=$('detail').querySelector('h2'),button=document.createElement('button');button.type='button';button.id='editIssueContent';button.className='edit-issue-content';button.textContent='✎ '+ui('编辑问题','Edit issue');button.onclick=()=>openEditIssue(x.id);
    let row=title.closest('.issue-title-row');if(!row){row=document.createElement('div');row.className='issue-title-row';title.before(row);row.append(title);}row.append(button);
  }
  drawingMarkups.mount(x).catch(err=>console.error('Drawing markup load failed',err));
  const closeHelp=$('detail').querySelector('.edit-section > p.subtle');
  if(closeHelp)closeHelp.textContent=ui('David Mah 负责最终设计确认及问题关闭；关闭前需填写依据、回复并完成复核。','David Mah provides final design confirmation and closes issues. Evidence, a response and completed review are required.');
  if(!session)$('detail').querySelectorAll('[data-attachment]').forEach(b=>b.remove());
  if($('saveIssue'))$('saveIssue').onclick=async()=>{
    const old=structuredClone(x),status=$('editStatus').value,note=$('editNote').value.trim(),evidence=$('editEvidence').value.trim(),reviewed=$('editReviewed').checked;
    if(status==='已关闭'&&!canCloseIssue()){showMessage(ui('只有 David Mah 可以作最终设计确认并关闭问题。','Only David Mah may give final design confirmation and close an issue.'),true);return}
    if(status==='已关闭'&&(!note||!evidence||!reviewed)){showMessage('关闭需要填写本次记录、确认依据，并勾选完成复核。',true);return}
    if(status==='已关闭'&&x.dependencies?.some(id=>project.issues.find(i=>i.id===id)?.status!=='已关闭')){showMessage('请先关闭关联前置任务。',true);return}
    x.history=x.history||[];x.history.push({date:new Date().toLocaleString('zh-CN',{timeZone:'America/Vancouver'}),by:`${member.display_name} (${member.email})`,text:note||`状态由${x.status}更新为${status}；回复日期${$('editDue').value||'未设置'}`,status});x.status=status;x.due=$('editDue').value;x.evidence=evidence;x.reviewed=reviewed;
    if(await saveProject(`${x.id} ${x.title}: ${old.status} → ${status}`,x.id))renderList();else Object.assign(x,old);
  };
  if($('copyIssue'))$('copyIssue').onclick=()=>navigator.clipboard.writeText(issueText(x)).then(()=>showMessage('已复制沟通清单。')).catch(()=>showMessage('浏览器不允许复制，请手动选择文本。',true));
}
function renderPros(){const owners=ENGINEERS.map(e=>e[0]).filter(o=>project.issues.some(x=>involved(x).includes(o)));$('professionals').innerHTML=owners.map(o=>{const xs=project.issues.filter(x=>visibleForDiscipline(x,o)&&x.status!=='已关闭');return `<article class="pro"><h2>${esc(contentText(o))}</h2><p class="subtle">${xs.length} ${ui('项待关闭','open items')} · ${xs.filter(x=>x.priority==='P1').length} P1</p><ul>${xs.map(x=>`<li><button data-proissue="${esc(x.id)}">${esc(x.id)} · ${esc(contentText(x.title))}</button><div class="subtle">${lead(x)===o?ui('主责','Lead'):ui('协作','Supporting')} · ${esc(stageText(x.status))} ${x.due?' / '+esc(x.due):''}</div></li>`).join('')||`<li>${ui('无开放事项','No open items')}</li>`}</ul><button data-copyowner="${esc(o)}">${ui('复制该专业清单','Copy discipline checklist')}</button></article>`}).join('')}
function renderDocs(){
  const excluded=project.documents.filter(isExcludedDocument).length;
  documentCleanupNote.textContent=ui('新项目的正式图纸版本登记将在收到新图后建立。','The new drawing register will be established when the new drawing set is received.');
  const states=['Pending confirmation','Revision required','Received','Ready for submission','Excluded: duplicate / misfiled'];
  const headers=[ui('文件 / 专业','File / discipline'),ui('页数与版本','Pages / revision'),ui('角色 / 关联','Role / relationship'),ui('状态','Status'),ui('修订文件或备注','Revision evidence / notes')];
  document.querySelectorAll('#documentsView th').forEach((el,i)=>el.textContent=headers[i]);
  $('saveDocs').textContent=t('save');
  $('documents').innerHTML=project.documents.filter(d=>$('showExcludedDocs').checked||!isExcludedDocument(d)).map(d=>{const url=drivePdfUrl(d.file,1);return `<tr class="${isExcludedDocument(d)?'excluded-document':''}"><td class="filename">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(d.file)} ↗</strong></a>`:`<strong>${esc(d.file)}</strong>`}<div class="subtle">${esc(contentText(d.discipline))}</div></td><td>${esc(d.pages)} ${ui('页','pages')}<br>${esc(contentText(d.version))}</td><td>${esc(contentText(d.role))}</td><td><select data-docstatus="${esc(d.id)}">${DOCSTATES.map((s,i)=>`<option value="${esc(s)}" ${d.status===s?'selected':''} ${!isAdmin()&&s==='可提交'?'disabled':''}>${currentLang==='en'?states[i]:s}</option>`).join('')}</select></td><td>${currentLang==='en'?`<p>${esc(contentText(d.note||''))}</p>`:''}<textarea data-docnote="${esc(d.id)}" placeholder="${ui('记录新文件名、日期及确认依据','Record revised filename, date and confirmation evidence')}">${esc(d.note||'')}</textarea></td></tr>`}).join('')
}
function renderFacts(){$('facts').innerHTML=project.facts.map(f=>`<article class="fact"><span class="tag">${esc(contentText(f.kind))}</span><h3>${esc(contentText(f.title))}</h3><p>${esc(contentText(f.text))}</p>${f.id==='basis-phasing'?`<a href="./review-phasing.png" target="_blank" rel="noopener"><img src="./review-phasing.png" style="width:100%;height:auto;border-radius:8px" alt="${ui('业主标注的施工分期：红色一期、绿色二期、蓝色生产保留区','Owner-marked phases: red Phase 1, green Phase 2, blue retained production area')}"></a>`:''}<span class="subtle">${esc(f.date)}</span></article>`).join('');const count=project.issues.filter(x=>x.priority==='P1'&&x.status!=='已关闭').length;$('gate').textContent=count?ui(`目前仍有 ${count} 项提交前必须解决的问题。看板状态不代表 City 批准或可提交。`,`${count} required-before-resubmission items remain open. Dashboard status is not City approval or submission clearance.`):ui('关键事项已关闭；仍需核对最终文件及 CRP 确认。','Critical items are closed; verify final documents and obtain CRP confirmation.');}
async function renderAudit(){
  $('audit').innerHTML=`<p class="subtle">${ui('正在读取修改记录…','Loading change history…')}</p>`;
  const {data,error}=await db.from('permit_audit_log').select('id,actor_email,action,entity_id,summary,created_at').eq('project_id',PROJECT_ID).order('created_at',{ascending:false}).limit(150);
  if(error){$('audit').innerHTML=`<p class="message error">${esc(error.message)}</p>`;return}
  $('audit').innerHTML=data.length?data.map(a=>{
    const issue=project.issues.find(x=>x.id===a.entity_id);
    const body=`<time>${new Date(a.created_at).toLocaleString(currentLang==='en'?'en-CA':'zh-CN',{timeZone:'America/Vancouver'})}</time><div><strong>${esc(a.summary)}</strong><small>${esc(a.entity_id||ui('项目','Project'))}${issue?` · ${ui('打开问题','Open issue')} ↗`:''}</small></div><small>${esc(a.actor_email)}</small>`;
    return issue?`<a class="audit-item audit-issue-link" href="${esc(issueDeepLink(issue))}" data-audit-issue="${esc(issue.id)}" aria-label="${esc(ui('打开问题','Open issue')+' '+issue.id+': '+a.summary)}">${body}</a>`:`<div class="audit-item">${body}</div>`;
  }).join(''):`<p class="subtle">${ui('暂无修改记录。','No change history yet.')}</p>`;
}
async function renderMembers(){
  if(!isAdmin())return;
  const {data,error}=await db.from('permit_members').select('email,display_name,role,active,updated_at').order('display_name');
  if(error){$('memberList').innerHTML=`<p class="message error">${esc(error.message)}</p>`;return}
  $('memberList').innerHTML=`<table><thead><tr><th>姓名</th><th>邮箱</th><th>角色</th><th>访问</th><th></th></tr></thead><tbody>${data.map(m=>`<tr><td>${esc(m.display_name)}</td><td>${esc(m.email)}</td><td>${esc(m.role)}</td><td>${m.active?'启用':'停用'}</td><td><button data-editmember="${esc(m.email)}" data-name="${esc(m.display_name)}" data-role="${esc(m.role)}" data-active="${m.active}">编辑</button></td></tr>`).join('')}</tbody></table>`;
  $('memberList').insertAdjacentHTML('afterbegin',`<div class="cm-card"><h3>${ui('岗位职责与系统权限','Project responsibilities and system permissions')}</h3><div class="cm-people">${TEAM.map(p=>`<div class="cm-person"><strong>${p.name}</strong><span>${p.role[currentLang==='en'?1:0]}</span><span>${p.focus[currentLang==='en'?1:0]}</span></div>`).join('')}</div><p class="cm-muted">${ui('岗位说明与登录权限分开管理；David 的业主 / 总包岗位不自动改变现有账号权限。','Job responsibilities are managed separately from sign-in permissions. David’s Owner / General Contractor role does not automatically change his existing account permissions.')}</p></div>`);
}
function switchView(next){if((!session||isExternal())&&['history','members','meetings'].includes(next))next='issues';view=next;for(const id of ['issues','professionals','documents','facts','meetings','history','members'])$(id+'View').hidden=id!==next;document.querySelectorAll('#nav [data-view]').forEach(b=>b.setAttribute('aria-selected',b.dataset.view===next));if(next==='meetings')showInternalMeeting();if(next==='professionals')renderPros();if(next==='documents'){renderDocs();if(!session||isExternal()){document.querySelectorAll('#documents select, #documents textarea').forEach(e=>e.disabled=true);$('saveDocs').hidden=true}}if(next==='facts')renderFacts();if(next==='history')renderAudit();if(next==='members')renderMembers()}
function renderAll(){renderMetrics();renderList();if(view!=='issues')switchView(view);construction.refresh()}

$('googleLogin').onclick=signIn;$('guestLogin').onclick=signIn;$('logout').onclick=signOut;$('refresh').onclick=loadProject;
$('loginLanguages').onclick=e=>{const b=e.target.closest('[data-entry-lang]');if(b){currentLang=normalizeLanguage(b.dataset.entryLang);localStorage.setItem('permitLang',currentLang);applyLanguage();}};
$('guestEntryForm').onsubmit=async e=>{e.preventDefault();const name=$('guestName').value.trim(),company=$('guestCompany').value.trim();if(!name){loginMessage(ui('请填写姓名。','Please enter your name.'),true);return;}$('enterGuest').disabled=true;try{await guestComments.identify(name,company);loginMessage('');enterGuestMode();}catch(err){loginMessage(err.message,true);}finally{$('enterGuest').disabled=false;}};
$('exportBackup').onclick=()=>project&&download(JSON.stringify(project,null,2),`permit-backup-${new Date().toISOString().slice(0,10)}.json`,'application/json');
$('exportOpen').onclick=()=>project&&download(project.issues.filter(x=>x.status!=='已关闭').map(issueText).join('\n\n----------------\n\n'),'permit-open-actions.txt','text/plain');
$('print').onclick=()=>window.print();
for(const id of ['showSupportingIssues','showSupportingPros'])$(id).addEventListener('change',e=>{showSupporting=e.target.checked;for(const other of ['showSupportingIssues','showSupportingPros'])$(other).checked=showSupporting;if(project){renderList();renderPros()}});
$('nav').onclick=e=>{const b=e.target.closest('[data-view]');if(b)switchView(b.dataset.view)};
$('showExcludedDocs').onchange=renderDocs;
$('settingsMenu').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.view){construction.setWorkspace('permit');switchView(b.dataset.view)}$('settingsMenu').open=false;});
document.addEventListener('click',e=>{if(!$('settingsMenu').contains(e.target))$('settingsMenu').open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('settingsMenu').open){$('settingsMenu').open=false;$('settingsLabel').focus();}});
for(const id of ['search','discipline','statusFilter','typeFilter'])$(id).addEventListener(id==='search'?'input':'change',renderList);
$('sortFilter').addEventListener('change',()=>{localStorage.setItem('permitIssueSortV2',$('sortFilter').value);$('list').scrollTop=0;renderList()});
$('audit').addEventListener('click',e=>{
  const link=e.target.closest('[data-audit-issue]');
  if(!link||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;
  e.preventDefault();
  const issue=project.issues.find(x=>x.id===link.dataset.auditIssue);
  if(!issue){showMessage(ui('该问题已不在当前项目中。','This issue is no longer in the current project.'),true);return}
  selected=issue.id;
  $('search').value='';
  for(const id of ['discipline','statusFilter','typeFilter'])$(id).value='';
  construction.setWorkspace('permit');
  groupOpen.add(lead(issue));
  switchView('issues');renderList();
  $('detail').scrollTop=0;
  const group=[...$('list').querySelectorAll('[data-group]')].find(el=>el.dataset.group===lead(issue));
  const card=group&&[...group.querySelectorAll('[data-id]')].find(el=>el.dataset.id===issue.id);
  card?.scrollIntoView({block:'nearest'});
  $('detail').scrollIntoView({block:'start'});
  card?.focus({preventScroll:true});
  window.history.replaceState(null,'',issueDeepLink(issue));
});
$('list').onclick=e=>{const b=e.target.closest('[data-id]');if(b){selected=b.dataset.id;renderList();$('detail').scrollTop=0}};
$('detail').onclick=e=>{const b=e.target.closest('[data-jump]'),a=e.target.closest('[data-attachment]');if(b){selected=b.dataset.jump;switchView('issues');renderList()}if(a){const issue=project.issues.find(i=>i.id===selected),file=issue?.attachments?.[Number(a.dataset.attachment)];if(file)openAttachment(file.path)}};
$('professionals').onclick=e=>{const i=e.target.closest('[data-proissue]'),c=e.target.closest('[data-copyowner]');if(i){selected=i.dataset.proissue;$('discipline').value='';switchView('issues');renderList()}if(c){const text=project.issues.filter(x=>visibleForDiscipline(x,c.dataset.copyowner)&&x.status!=='已关闭').map(x=>`${lead(x)===c.dataset.copyowner?ui('本专业主责','Discipline lead'):ui('本专业协作','Supporting discipline')} · ${ui('主责','Lead')}: ${contentText(lead(x))}\n${issueText(x)}`).join('\n\n----------------\n\n');navigator.clipboard.writeText(text).then(()=>showMessage(ui('已复制该专业沟通清单。','Discipline checklist copied.')))}};
$('saveDocs').onclick=async()=>{const before=structuredClone(project.documents);for(const d of project.documents){const field=document.querySelector(`[data-docstatus="${CSS.escape(d.id)}"]`);if(!field||isExcludedDocument(d))continue;const status=field.value;if(status==='可提交'&&!isAdmin()){showMessage('只有 Admin 可以把文件标记为“可提交”。',true);project.documents=before;renderDocs();return}d.status=status;d.note=document.querySelector(`[data-docnote="${CSS.escape(d.id)}"]`).value}if(!(await saveProject('更新文件版本与状态','documents'))){project.documents=before;renderDocs()}};
$('seedProject').onclick=async()=>{const f=$('seedFile').files[0];if(!f){showMessage('请选择 project-data.json。',true);return}try{if(f.size>2_000_000)throw Error('文件大于 2MB');const p=JSON.parse(await f.text());if(!validProject(p))throw Error('文件不是本项目的有效数据');project=p;version=0;if(await saveProject('管理员初始化 Permit Audit 数据','project-init'))await loadProject()}catch(e){showMessage('初始化失败：'+e.message,true)}};
$('memberList').onclick=e=>{const b=e.target.closest('[data-editmember]');if(!b)return;$('memberEmail').value=b.dataset.editmember;$('memberName').value=b.dataset.name;$('memberRole').value=b.dataset.role;$('memberActive').checked=b.dataset.active==='true'};
$('saveMember').onclick=async()=>{if(!isAdmin())return;const email=$('memberEmail').value.trim().toLowerCase(),display_name=$('memberName').value.trim(),role=$('memberRole').value,active=$('memberActive').checked;if(!email||!display_name){showMessage('请填写成员邮箱和姓名。',true);return}if(email===member.email&&(!active||role!=='admin')){showMessage('不能停用自己或移除自己的 Admin 角色。',true);return}const {error}=await db.from('permit_members').upsert({email,display_name,role,active,updated_at:new Date().toISOString()},{onConflict:'email'});if(error){showMessage('成员保存失败：'+error.message,true);return}await saveProject(`成员权限更新：${display_name} · ${email} · ${role} · ${active?'启用':'停用'}`,`member:${email}`);$('memberEmail').value='';$('memberName').value='';$('memberRole').value='editor';$('memberActive').checked=true;renderMembers()};
$('openNewIssue').onclick=openNewIssue;$('closeNewIssue').onclick=closeNewIssue;$('cancelNewIssue').onclick=closeNewIssue;
$('newIssueDialog').onclick=e=>{if(e.target===$('newIssueDialog'))closeNewIssue()};
$('newDisciplineGrid').onclick=e=>{const b=e.target.closest('[data-owner]');if(!b)return;const owner=b.dataset.owner,index=newIssueOwners.indexOf(owner);if(index>=0)newIssueOwners.splice(index,1);else newIssueOwners.push(owner);renderDisciplineChoices()};
document.querySelectorAll('[data-choice]').forEach(row=>row.addEventListener('click',e=>{const b=e.target.closest('[data-value]');if(!b)return;row.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));if(row.dataset.choice==='priority')newPriority=b.dataset.value;if(row.dataset.choice==='discovery'){newDiscovery=b.dataset.value;$('designerContactWrap').hidden=newDiscovery!=='与设计师沟通后发现'}}));
$('newAttachments').onchange=()=>{const files=[...$('newAttachments').files];$('attachmentPreview').innerHTML=files.map(f=>`<span>${esc(f.name)} · ${humanSize(f.size)}</span>`).join('');setNewIssueMessage(files.length>5?'最多只能上传 5 个附件。':files.some(f=>f.size>15*1024*1024)?'有附件超过 15 MB。':'',true)};
$('newSourceFile').onchange=()=>{$('newSourceOtherWrap').hidden=$('newSourceFile').value!=='__other__';if(!$('newSourceOtherWrap').hidden)$('newSourceOther').focus()};
$('newIssueForm').onsubmit=submitNewIssue;
$('newIssueDialog').addEventListener('cancel',e=>{if(issueSubmitting)e.preventDefault()});
$('languageSwitcher').onclick=e=>{const b=e.target.closest('[data-lang]');if(!b||b.dataset.lang===currentLang)return;currentLang=normalizeLanguage(b.dataset.lang);localStorage.setItem('permitLang',currentLang);applyLanguage()};
applyLanguage();
emailLogin.render();
construction.restore();
installScrollRouting();

db.auth.onAuthStateChange((event,newSession)=>{if(event==='SIGNED_IN'&&!session){session=newSession;boot()}if(event==='SIGNED_OUT'){session=null}});
boot();






