/** Model-visible design guidance shared by native tools and CLI. No model calls,
 * credentials, automatic approvals, or changes to saved user design choices. */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
export const installedPlugin=Object.freeze({name:pkg.name,version:pkg.version,guidanceRevision:'reference-composition-rc7'});
const refs=new URL('../skills/dsh-academic-ppt/references/',import.meta.url);
const catalog=JSON.parse(readFileSync(new URL('design-cases/catalog.json',refs),'utf8'));
export const DESIGN_CASE_IDS=Object.freeze(catalog.cases.map(c=>c.id));
export function designCases(){
  return catalog.cases.map(c=>({id:c.id,title:c.title,task:c.task,when:c.when,transfer:c.transfer,
    previewPath:fileURLToPath(new URL('design-cases/'+c.preview,refs)),
    explanationPath:fileURLToPath(new URL('design-cases/'+c.explanation,refs)),
    identity:catalog.identity}));
}
const instructions={
  academic_ppt_init:'默认协作。第一轮先说明范围/主线与参考方向，未明示事项问一次并等待；原话已明确则沿用。设计自主选择不等于免除样张确认。先核实当前模型实际read_image入口及本地渲染能力。沿用用户已给参考/选择与明确委托，未决项才问。先确定artDirection视觉语言和原图色义，查看实际参考正文；用compose-page的题签、共享比较和相邻图注完成画面；不把默认styleProfile或figure-focus当审美答案。',
  academic_ppt_context:'读取pageGeometry的实际contentBox和figureInventory的待决定文件；按这些尺寸和原图比例重排，不硬编码通用高度。沿用真实反馈；旧稀疏样张不是目标。',
  academic_ppt_prepare:'学习整页构图而非只选卡片；没有生图能力照常用真实原图、数据图、原生方法图与自由composition。案例与模板都不是本次科学证据。',
  academic_ppt_plan:'正文用compose-page，开场用compose-opening且不代替困难样张。flow按内容定高；comparison的显式scale保留原值与范围。相关实际PNG见authoring契约compositionLessons。不要只把段落装进split：group题签区分主次，comparison让同一指标直接对应，statement只承载必要命题。图内颜色不改；主要证据须成为可见重心。先盘点原图，后做困难样张。样张先经pilot-review再扩稿，短稿也须等待；不能补票。',
  academic_ppt_build:'生成文件不是设计通过。接着render当前PPTX，以实际图片检查整页构图、证据整合、微排版；不靠降低字号门槛、删条件或加装饰通过。',
  academic_ppt_render:'发布候选后有一个真实样张反馈节点：自查当前页、附可打开的预览链接，然后结束本轮等待。没收到真实回答不得自填confirmed/delegated。逐页read_image返回的PNG；联系表不抵扣。Host默认通过present发布预览，检查userPreview状态；在默认协作流程中附真实文件链接并结束本轮，等自然语言回复，不调用阻塞ask_user_question。先改构图/图文再改细节，不能只改审稿措辞。',
  academic_ppt_review:'只有实际看过当前图像才填写观察：contentCheck核科学及图证；legibilityCheck核字形/断行/图内标签；spaceCheck核视觉锚点、分组、对齐与组内外距；colorCheck核色块权重、数据色义与对比。具体问题记needs-fix，不能写泛泛表扬。',
  academic_ppt_check:'把当前页与用户认可的正文同尺寸并置：标题/色面/图证/数字是否形成整体。若仍像截图加段落，重排而不是加自评。自动检查只定位风险，不能给审美合格背书。science与art-direction两条线分别成立；仍需逐页实际看图。按当前阻断项修复，不删除证据约束或伪造用户同意。',
  academic_ppt_deliver:'只交付当前已核验版本；明确区分模型自查、用户方向反馈和科学真实性。新报告不会继承教学样张的批准；实测需保留首稿、修改稿及真实模型/工具记录。',
};
export function authoringGuidance(name){
  if(!Object.hasOwn(instructions,name))return undefined;
  return {revision:installedPlugin.guidanceRevision,instruction:instructions[name],
    guidePath:fileURLToPath(new URL(['academic_ppt_review','academic_ppt_render','academic_ppt_check','academic_ppt_deliver'].includes(name)?'page-polish.md':'visual-craft.md',refs)),
    authoringContract:'academic_ppt_contract(topic:authoring)',
    caseIndexPath:fileURLToPath(new URL('design-cases/README.md',refs))};
}
