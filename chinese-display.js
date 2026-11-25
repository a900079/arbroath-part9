import { Converter } from './vendor/opencc-cn2t-1.3.1.js';

const traditional=Converter({from:'cn',to:'tw'});
export const LANGUAGES=['zh','zh-Hant','en'];
export function normalizeLanguage(value){return ['zh-TW','zh-HK','zh-Hant'].includes(value)?'zh-Hant':LANGUAGES.includes(value)?value:'zh';}
export function chineseDisplay(value,language){const text=String(value??'');return language==='zh-Hant'?traditional(text):text;}
export function searchText(value){return traditional(String(value??'')).toLowerCase();}

// Only displayed text changes. Form values, file references, IDs and persisted data stay intact.
export function createChineseDisplay(language){
 const originals=new WeakMap(),attributes=new WeakMap();let queued=false;
 const excluded='script,style,textarea,[contenteditable="true"],[data-no-script-convert],[data-lang],[data-entry-lang],#newReporter,#whoami';
 const attrs=['placeholder','title','aria-label','alt'];
 const options={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs};
 function refresh(){
  queued=false;observer.disconnect();
  try{
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
   while((node=walker.nextNode())){
    const parent=node.parentElement;if(!parent||parent.closest(excluded)||!node.nodeValue.trim())continue;
    // Option text without an explicit value otherwise changes the selected data value.
    if(parent.tagName==='OPTION'&&!parent.hasAttribute('value'))parent.value=parent.value;
    if(/^[^\n]{1,300}\.(pdf|docx?|xlsx?|json|png|jpe?g)(?:\s*[·↗].*)?$/i.test(node.nodeValue.trim()))continue;
    let saved=originals.get(node);if(!saved||node.nodeValue!==saved.rendered)saved={original:node.nodeValue,rendered:node.nodeValue};
    const next=chineseDisplay(saved.original,language());if(node.nodeValue!==next)node.nodeValue=next;saved.rendered=next;originals.set(node,saved);
   }
   for(const el of document.body.querySelectorAll('[placeholder],[title],[aria-label],[alt]')){
    if(el.closest('[data-no-script-convert],[data-lang],[data-entry-lang]'))continue;
    const saved=attributes.get(el)||{};
    for(const name of attrs){if(!el.hasAttribute(name))continue;const value=el.getAttribute(name);let item=saved[name];if(!item||value!==item.rendered)item={original:value,rendered:value};const next=chineseDisplay(item.original,language());if(value!==next)el.setAttribute(name,next);item.rendered=next;saved[name]=item;}
    attributes.set(el,saved);
   }
  }finally{observer.observe(document.body,options);}
 }
 const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(refresh);}});
 observer.observe(document.body,options);
 return {refresh};
}

