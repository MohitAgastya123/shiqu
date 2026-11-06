// English product text and generation contracts; canonical source evidence remains unchanged.
// Share the selectable book directory across discovery and generation.
// All 24 verified local books are ordered by ascending o200k_base input-text tokens.
// Counts include chapter headings and citation IDs; keep this order in sync with source editions.
export type ReaderBook={id:string;title:string;sourceTitle:string;author:string;era:string;genre:string;note:string};
export const readerBooks:ReaderBook[]=[
 {id:"博物志",title:"Records of Diverse Matters",sourceTitle:"博物志",author:"Zhang Hua",era:"Western Jin",genre:"Marvels",note:"Wonders of nature and the world"},
 {id:"浮生六记",title:"Six Records of a Floating Life",sourceTitle:"浮生六记",author:"Shen Fu",era:"Qing",genre:"Memoir",note:"Love in everyday life"},
 {id:"列子",title:"Liezi",sourceTitle:"列子",author:"Attributed to Lie Yukou",era:"Classical China",genre:"Fables",note:"Fresh turns in familiar lives"},
 {id:"山海经",title:"Classic of Mountains and Seas",sourceTitle:"山海经",author:"Unknown",era:"Pre-Qin to Han",genre:"Mythology",note:"Myths across mountains and seas"},
 {id:"搜神记",title:"In Search of the Supernatural",sourceTitle:"搜神记",author:"Gan Bao",era:"Eastern Jin",genre:"Supernatural",note:"Strange tales and human nature"},
 {id:"shishuo",title:"A New Account of Tales of the World",sourceTitle:"世说新语",author:"Compiled by Liu Yiqing",era:"Liu Song dynasty",genre:"Portraits",note:"Wit and character in early China"},
 {id:"zhuangzi",title:"Zhuangzi",sourceTitle:"庄子",author:"Zhuang Zhou and others",era:"Pre-Qin",genre:"Fables",note:"See the world from another angle"},
 {id:"酉阳杂俎",title:"Miscellaneous Morsels from Youyang",sourceTitle:"酉阳杂俎",author:"Duan Chengshi",era:"Tang",genre:"Marvels",note:"Tang tales and curious observations"},
 {id:"战国策",title:"Strategies of the Warring States",sourceTitle:"战国策",author:"Compiled by Liu Xiang",era:"Western Han",genre:"Strategy",note:"Persuasion, choices and strategy"},
 {id:"子不语",title:"What the Master Would Not Discuss",sourceTitle:"子不语",author:"Yuan Mei",era:"Qing",genre:"Supernatural",note:"Unexpected encounters and strange tales"},
 {id:"儒林外史",title:"The Scholars",sourceTitle:"儒林外史",author:"Wu Jingzi",era:"Ming",genre:"Satire",note:"Ambition behind scholarly fame"},
 {id:"喻世明言",title:"Stories to Enlighten the World",sourceTitle:"喻世明言",author:"Compiled by Feng Menglong",era:"Ming",genre:"Society",note:"Human feeling and changing fortunes"},
 {id:"阅微草堂笔记",title:"Notes from the Thatched Abode",sourceTitle:"阅微草堂笔记",author:"Ji Yun",era:"Qing",genre:"Supernatural",note:"Worldly wisdom in strange encounters"},
 {id:"初刻拍案惊奇",title:"Slapping the Table in Amazement, First Collection",sourceTitle:"初刻拍案惊奇",author:"Ling Mengchu",era:"Ming",genre:"Tales",note:"Chance encounters and reversals"},
 {id:"警世通言",title:"Stories to Caution the World",sourceTitle:"警世通言",author:"Compiled by Feng Menglong",era:"Ming",genre:"Society",note:"One thought changes a life"},
 {id:"二刻拍案惊奇",title:"Slapping the Table in Amazement, Second Collection",sourceTitle:"二刻拍案惊奇",author:"Ling Mengchu",era:"Ming",genre:"Tales",note:"Unexpected paths through tangled lives"},
 {id:"liaozhai",title:"Strange Tales from a Chinese Studio",sourceTitle:"聊斋志异",author:"Pu Songling",era:"Qing",genre:"Supernatural",note:"Ghosts, fox spirits and human hearts"},
 {id:"醒世恒言",title:"Stories to Awaken the World",sourceTitle:"醒世恒言",author:"Compiled by Feng Menglong",era:"Ming",genre:"Society",note:"Joy, sorrow and changing fortunes"},
 {id:"三国演义",title:"Romance of the Three Kingdoms",sourceTitle:"三国演义",author:"Luo Guanzhong",era:"Ming",genre:"History",note:"Strategy and choices in a divided realm"},
 {id:"西游记",title:"Journey to the West",sourceTitle:"西游记",author:"Wu Cheng'en",era:"Ming",genre:"Fantasy",note:"A pilgrimage through human nature"},
 {id:"红楼梦",title:"Dream of the Red Chamber",sourceTitle:"红楼梦",author:"Cao Xueqin",era:"Qing",genre:"Society",note:"Human lives beneath fading splendor"},
 {id:"水浒传",title:"Water Margin",sourceTitle:"水浒传",author:"Shi Nai'an",era:"Ming",genre:"Adventure",note:"Loyalty and choices beyond the law"},
 {id:"史记",title:"Records of the Grand Historian",sourceTitle:"史记",author:"Sima Qian",era:"Western Han",genre:"History",note:"People behind triumph and failure"},
 {id:"太平广记",title:"Extensive Records of the Taiping Era",sourceTitle:"太平广记",author:"Compiled by Li Fang and others",era:"Northern Song",genre:"Tales",note:"Extraordinary stories across the ages"},
];
