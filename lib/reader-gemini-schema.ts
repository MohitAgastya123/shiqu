// Keep Gemini's decoding grammar small at every text stage; production validators enforce bounds.
// Counts and numeric ranges remain visible guidance without duplicating nested grammar states.
export function geminiOutputSchema(value:unknown):unknown{
 if(Array.isArray(value))return value.map(geminiOutputSchema);
 if(!value||typeof value!=='object')return value;
 const rule=value as Record<string,unknown>,guidance:string[]=[],bounds=new Set<string>();
 const limits=rule.type==='array'?
  [['minItems','At least','items'],['maxItems','At most','items']]:
  rule.type==='integer'||rule.type==='number'?[['minimum','Minimum value:',''],['maximum','Maximum value:','']]:[];
 for(const [name,label,unit] of limits)if(typeof rule[name]==='number'){
  bounds.add(name);guidance.push(`${label} ${rule[name]}${unit?' '+unit:''}.`);
 }
 const output=Object.fromEntries(Object.entries(rule).filter(([name])=>!bounds.has(name)).map(([name,child])=>[name,geminiOutputSchema(child)]));
 if(guidance.length)output.description=[rule.description,...guidance].filter(Boolean).join(' ');
 return output;
}
