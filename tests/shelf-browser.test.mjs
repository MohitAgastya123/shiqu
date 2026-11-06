// English product expectations; historical source fixtures remain explicit test data.
// Both shelves must search all visible metadata and group by source book without losing reading order.
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesShelfSearch,groupShelfByBook,groupShelfItems,shelfGroupings} from '../lib/shelf-browser.ts';
const stories=[
 {id:'recent',title:'The Price of a Pear',book:'Strange Tales',theme:'Human kindness and indifference',artStyleLabel:'Watercolor'},
 {id:'other',title:'Bitter Plums by the Road',book:'A New Account',theme:'Wisdom and folly',artStyleLabel:'Gongbi'},
 {id:'older',title:'Painted Skin',book:'Strange Tales',theme:'Kindness and misunderstanding',artStyleLabel:'Cinematic'},
];
test('search matches title, source book, theme and art style, including combined keywords',()=>{
 for(const query of ['Price of a Pear','Strange','kindness','Watercolor','Strange Watercolor','  kindness  Watercolor  '])assert.equal(matchesShelfSearch(stories[0],query),true,query);
 assert.equal(matchesShelfSearch(stories[0],'Strange Gongbi'),false);
 assert.equal(matchesShelfSearch(stories[0],'   '),true);
 assert.equal(matchesShelfSearch({...stories[0],artStyleLabel:'3D 动画'},'３ｄ'),true);
 assert.deepEqual(stories.filter(story=>matchesShelfSearch(story,'Strange')).map(story=>story.id),['recent','older']);
});
test('book groups collect matching stories in original reading order and omit empty search groups',()=>{
 const groups=groupShelfByBook(stories);
 assert.deepEqual(groups.map(group=>[group.book,group.items.map(story=>story.id)]),[['Strange Tales',['recent','older']],['A New Account',['other']]]);
 assert.deepEqual(groupShelfByBook(stories.filter(story=>matchesShelfSearch(story,'Gongbi'))).map(group=>group.book),['A New Account']);
 assert.deepEqual(groupShelfByBook([]),[]);
 assert.equal(groupShelfByBook([{...stories[0],book:''}])[0].book,'Other sources');
});
test('theme, art style and processing groups preserve each story and its reading order',()=>{
 const rows=stories.map((story,i)=>({...story,processingStatus:i===0?'Generating':'Complete'}));
 assert.deepEqual(shelfGroupings.map(option=>option.value),['book','theme','artStyle','status','none']);
 for(const [mode,labels] of [['book',['Strange Tales','A New Account']],['theme',['Human kindness and indifference','Wisdom and folly','Kindness and misunderstanding']],['artStyle',['Watercolor','Gongbi','Cinematic']],['status',['Generating','Complete']]]){
  const groups=groupShelfItems(rows,mode);
  assert.deepEqual(groups.map(group=>group.label),labels);
  assert.deepEqual(groups.flatMap(group=>group.items.map(item=>item.id)).sort(),rows.map(row=>row.id).sort());
 }
 const status=groupShelfItems(rows,'status');assert.deepEqual(status[1].items.map(item=>item.id),['other','older']);
 const updated=rows.map(row=>({...row,processingStatus:'Complete'}));
 assert.deepEqual(groupShelfItems(updated,'status').map(group=>group.label),['Complete']);
 assert.deepEqual(groupShelfItems(rows.filter(row=>matchesShelfSearch(row,'Gongbi')),'artStyle').map(group=>group.label),['Gongbi']);
 assert.deepEqual(groupShelfItems([],'status'),[]);
});
