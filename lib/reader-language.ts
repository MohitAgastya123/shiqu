// English display names shared by the reader and production exporters; saved theme IDs stay stable.
const themeLabels:Record<string,string>={
 '忠于原文':'Faithful to the source','意外之喜':'Unexpected joy','执念与得失':'Attachment, gain and loss',
 '原典故事':'Original story','其他':'Other','给我一个反转':'Give me a twist',
 '人情冷暖':'Human warmth and indifference','放下执念':'Letting go','聪明与糊涂':'Wisdom and folly',
 '善意与误解':'Kindness and misunderstanding','命运与选择':'Fate and choice','欲望与代价':'Desire and consequences',
 '勇气与成长':'Courage and growth','爱情与错过':'Love and missed chances','幽默与讽刺':'Humor and satire','因果与报应':'Cause and consequence',
};
export function themeLabel(value:string){return themeLabels[value]||value;}
