// Format assembled system instructions without rewriting rules, reordering sections or touching inputs.
// Apply only before dispatch/new captures; historical prompt records remain immutable.
const digits=['零','一','二','三','四','五','六','七','八','九'];
function sectionNumber(value:number):string{
 if(value<10)return digits[value];
 if(value<20)return '十'+(value%10?digits[value%10]:'');
 if(value<100)return digits[Math.floor(value/10)]+'十'+(value%10?digits[value%10]:'');
 return String(value);
}
function ruleLines(body:string,bullets:boolean){
 return body.trim().split(/\n/).map(line=>{
  const text=line.trim();if(!text)return '';
  // Do not split before closing quotes or brackets, or disturb existing numbered lists.
  const sentences=text.split(/(?<=[。！？])(?=[^”’」』】）"])/u).filter(Boolean);
  if(sentences.length<2)return text;
  const numbered=/^(?:\d+[.)、]|[-*])\s/.test(text);
  return sentences.map((sentence,index)=>numbered?(index?'  ':'')+sentence:bullets?'- '+sentence:sentence).join('\n');
 }).join('\n');
}
export function formatSystemPrompt(prompt:string):string{
 // Plain instructions and previously formatted records require no further transformation.
 if(!/^## /m.test(prompt))return prompt;
 const sections=prompt.split(/^## /m),prefix=sections.shift()||'';
 let number=0;
 const formatted=sections.map(section=>{
  const newline=section.indexOf('\n'),heading=newline<0?section.trim():section.slice(0,newline).trim(),body=newline<0?'':section.slice(newline+1).trim();
  const task=/^任务(?:与|$)/.test(heading);
  const boundary=/^(?:输入|输出|本次输出|报告契约|结构输出|修订范围与输出|语言与输入)/.test(heading);
  const title=task||boundary||!body?heading+'：':sectionNumber(++number)+'、'+heading;
  return title+(body?'\n'+ruleLines(body,!task):'');
 });
 return [...(prefix.trim()?[ruleLines(prefix,false)]:[]),...formatted].join('\n\n');
}
