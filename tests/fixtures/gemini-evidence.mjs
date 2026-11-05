// Encode controlled canonical review receipts as Gemini's source-reference wire responses.
export function geminiEvidenceAnswer(value,payload,schema){
 if(!payload.reviewQuoteSources)return value;
 const output=structuredClone(value);
 for(const field of ['coverage','requirements']){
  if(!schema.properties[field]?.items?.properties?.quoteId||!Array.isArray(output[field]))continue;
  output[field]=output[field].map(({quote,...item})=>{
   if(quote===undefined)return item;
   const source=payload.reviewQuoteSources.find(source=>source.quote.includes(quote)||quote.includes(source.quote));
   return {...item,quoteId:source?.id||0};
  });
 }
 return output;
}
