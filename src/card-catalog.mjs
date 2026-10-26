/** Original, editable academic card recipes. These are content arrangements,
 * not slide layouts; use only the cards that the argument actually needs. */
const freeze = value => {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
};

export const CARD_FAMILIES = freeze([
  { id:'research', name:'问题与背景', purpose:'研究对象、动机、概念与问题边界' },
  { id:'method', name:'方法与流程', purpose:'输入输出、步骤、公式与实验协议' },
  { id:'evidence', name:'证据与解释', purpose:'结论依据、来源、比较和观察解释' },
  { id:'metric', name:'指标与读数', purpose:'带单位的指标、参照、成对读数和达标口径' },
  { id:'boundary', name:'条件与限制', purpose:'适用范围、假设、风险、约束和核对条件' },
  { id:'progress', name:'阶段与决策', purpose:'工作进度、里程碑、分支、交接和下一步' },
]);

const item = (label, detail, value, unit) => ({ label, ...(value === undefined ? {} : { value }), ...(unit ? { unit } : {}), ...(detail ? { detail } : {}) });
const make = (id, name, family, purpose, frame, header, content, example, { minimumWidth = 340, preferredWidth = 440, useWhen = purpose, avoid = '内容关系不匹配时改用其他预设；完整证据图表仍放在独立区域。', itemCount = [0, 6] } = {}) => ({
  id, name, family, purpose, useWhen, avoid,
  recipe: { frame, header, content },
  dimensions: { minimumWidth, preferredWidth, height:'按完整内容测量，不按固定小框裁切', units:'px on 1280×720 canvas' },
  contentContract: { required:['title','body'], optional:['items','metric','badge','note','icon'], itemCount, itemFields:['label','value','unit','detail'], note:'items 为作者提供的内容槽位；不推断数值、差值、达标或因果关系。示例仅演示结构。' },
  example: { id, kind:family === 'research' ? 'question' : family === 'boundary' ? 'boundary' : family === 'method' || family === 'progress' ? 'method' : 'result', preset:id, claimIds:[], ...example },
});

export const CARD_PRESETS = freeze([
  make('research-tab','悬签问题卡','research','一个研究问题与简短语境','double','tab','stack',{
    title:'研究问题',body:'空间分辨率改变后，\n如何区分观测误差与过程误差？',note:'先区分误差来源，再确定验证对象。'
  }),
  make('research-bracket','开放括线卡','research','概念解释与适用语境','bracket','plain','stack',{
    title:'尺度一致性',body:'观测尺度与模型网格需要明确映射。',items:[item('空间支持','说明点、样方或像元。'),item('时间支持','说明瞬时值或时段平均。')]
  }),
  make('research-label-rail','侧签语境卡','research','短主题标签与较长背景解释','rail','rail','stack',{
    title:'研究语境',body:'同一变量在不同观测平台上可能代表不同的空间与时间支持。',note:'比较前记录测量定义。'
  },{minimumWidth:400,preferredWidth:500}),
  make('research-rule','双线定义卡','research','定义、符号含义或工作口径','ruled','rule','ledger',{
    title:'变量口径',body:'输入、状态与输出采用一致命名。',items:[item('输入','外部驱动与观测。'),item('状态','模型内部演化量。'),item('输出','模型计算的观测对应量。')]
  }),
  make('research-fold','折角背景札记','research','背景事实与需要保留的限定','fold','fold','stack',{
    title:'背景观察',body:'高频观测补充时间变化信息，覆盖范围仍受采样条件限制。',note:'观测频率不等于独立样本数。'
  }),
  make('research-index','编号议题卡','research','一组研究议题中的有序节点','outline','number','stack',{
    title:'误差归因',badge:'02',body:'比较同一验证集上不同误差来源的贡献。',items:[item('分析对象','保持样本与评价窗口一致。')]
  }),

  make('method-band','标题带方法卡','method','方法名称、核心操作和条件','outline','band','stack',{
    title:'状态更新',body:'先进行过程预测，再依据观测可信度修正状态。',note:'记录更新前后的同一状态变量。'
  }),
  make('method-ladder','步骤阶梯卡','method','严格有序的局部处理步骤','plain','rule','steps',{
    title:'数据对齐',body:'每一步保留原始记录标识。',items:[item('校验时间','统一时区与时间窗。'),item('匹配位置','记录空间匹配方式。'),item('输出样本','保留缺测标记。')]
  },{itemCount:[2,6]}),
  make('method-io','输入输出对照卡','method','输入与输出的成对说明','outline','plain','io',{
    title:'接口约定',body:'输入输出以同一批次标识关联。',items:[item('输入','驱动序列\n初始状态'),item('输出','预测状态\n不确定性')]
  },{minimumWidth:420,preferredWidth:520,itemCount:[2,2]}),
  make('method-equation','公式释义卡','method','作者给定的公式及符号解释','ruled','plain','formula',{
    title:'残差定义',body:'e = y − ŷ',items:[item('y','观测值。'),item('ŷ','同一时间点的预测值。')],note:'符号由作者提供，不自动生成模型。'
  },{itemCount:[1,6]}),
  make('method-protocol','实验协议卡','method','名称与取值对齐的操作协议','outline','band','ledger',{
    title:'验证协议',body:'划分规则先于模型评价确定。',items:[item('划分单位','按地块留出。'),item('拟合范围','仅使用训练集。'),item('评价窗口','保留完整目标时段。')]
  },{minimumWidth:380,itemCount:[2,6]}),
  make('method-ribbon','侧带算法卡','method','算法主题与分组操作','ribbon','plain','numbered',{
    title:'迭代校准',body:'每轮采用相同停止规则。',items:[item('候选生成','在可行参数域内搜索。'),item('误差评估','按预先约定的损失比较。')]
  },{itemCount:[2,6]}),

  make('evidence-claim-proof','结论依据卡','evidence','明确区分判断与支持证据','outline','band','claim-proof',{
    title:'结论与依据',body:'结果需要与评价条件一起解释。',items:[item('观察','同一验证集中的残差结构。'),item('支持范围','仅覆盖已测条件。')]
  },{itemCount:[2,4]}),
  make('evidence-source-footer','来源脚注卡','evidence','一条观察与紧邻的来源限定','double-bottom','plain','stack',{
    title:'观测记录',body:'多个时点的测量应保留样本身份与时间顺序。',note:'来源字段填写真实数据版本与定位信息。'
  }),
  make('evidence-trace','证据追踪卡','evidence','来源、处理与结论之间的可追踪链','plain','tab','trace',{
    title:'证据追踪',body:'每一段说明对应的资料。',items:[item('原始记录','观测值与质量标记。'),item('处理结果','对齐后的样本集合。'),item('解释','仅基于保留的样本。')]
  },{itemCount:[2,6]}),
  make('evidence-compare','配对比较卡','evidence','同一口径下的两组证据描述','outline','rule','comparison',{
    title:'口径比较',body:'采用相同样本定义后再比较。',items:[item('参考方法','固定评价窗口。'),item('候选方法','复用同一评价窗口。')],note:'卡片不自动宣告方法优劣。'
  },{minimumWidth:420,preferredWidth:520,itemCount:[2,2]}),
  make('evidence-interpretation','观察解释分层卡','evidence','将测量观察与解释分开','ruled','plain','layered',{
    title:'现象与解释',body:'解释仍需独立检验。',items:[item('观察','残差随环境条件变化。'),item('可能解释','当前模型缺少对应响应项。')]
  },{itemCount:[2,4]}),
  make('evidence-notes','证据注释叠页卡','evidence','多个相关证据注释并保留共同限定','stacked','plain','annotations',{
    title:'证据注释',body:'各条注释对应不同分析层级。',items:[item('样本','记录覆盖与缺失。'),item('指标','保留计算口径。')],note:'共同限定：同一数据版本。'
  },{itemCount:[2,6]}),

  make('metric-aside','读数旁注卡','metric','一个数值与同栏解释','outline','plain','metric-aside',{
    title:'验证读数',body:'该读数用于演示卡片结构。',items:[item('RMSE','应注明变量与验证集。','0.32','m²/m²')],note:'演示数值，非研究结果。'
  },{minimumWidth:420,itemCount:[1,1]}),
  make('metric-dual','双指标纵列卡','metric','两个单独统计的指标及各自含义','outline','rule','metric-rows',{
    title:'两项评价',body:'指标分别计算，保留各自口径。',items:[item('样本数量','独立验证样本。','24','个'),item('观测时点','评价窗口内测量。','6','次')],note:'演示数值，非研究结果。'
  },{minimumWidth:400,itemCount:[2,2]}),
  make('metric-pair','双指标并列卡','metric','并排读数及独立的名称单位','plain','band','metric-columns',{
    title:'成对读数',body:'只展示作者给出的数值。',items:[item('参考误差','同一验证集。','0.42','m²/m²'),item('候选误差','同一验证集。','0.35','m²/m²')],note:'演示数值，非研究结果。'
  },{minimumWidth:460,preferredWidth:560,itemCount:[2,2]}),
  make('metric-baseline','读数参照卡','metric','主读数与明确的参照条目','outline','tab','baseline',{
    title:'读数与参照',body:'参照来源必须与当前读数一起保留。',items:[item('当前值','当前验证口径。','0.35','m²/m²'),item('参照值','相同评价窗口。','0.42','m²/m²')],note:'演示数值，非研究结果。'
  },{minimumWidth:400,itemCount:[2,2]}),
  make('metric-target','目标实测对读卡','metric','目标与观测并列且不代算差值','cut','plain','target',{
    title:'目标与观测',body:'达标条件需由作者明确给出。',items:[item('预定上限','判断条件。','0.50','m²/m²'),item('观测结果','对应测量。','0.35','m²/m²')],note:'演示数值，非研究结果。'
  },{minimumWidth:420,itemCount:[2,2]}),
  make('metric-ledger','指标台账卡','metric','多个指标以名称数值解释对齐','ruled','plain','value-ledger',{
    title:'指标台账',body:'所有数值均保留名称与单位。',items:[item('RMSE','验证误差。','0.35','m²/m²'),item('样本量','独立样本。','24','个')],note:'演示数值，非研究结果。'
  },{minimumWidth:430,itemCount:[2,6]}),

  make('boundary-cut','切角边界卡','boundary','一项明确限制及其适用范围','cut','rule','stack',{
    title:'适用边界',body:'当前验证仅覆盖已观测环境。\n跨地点结论仍需外部检验。',note:'边界与主结论同时出现。'
  }),
  make('boundary-notch','引出警示卡','boundary','需要紧接正文阅读的风险提示','outline','notch','stack',{
    title:'数据泄漏风险',body:'若用验证集拟合预处理参数，评价可能失真。',note:'只在训练集上估计预处理参数。'
  }),
  make('boundary-assumptions','假设登记卡','boundary','多个前提及其核验方法','ruled','tab','register',{
    title:'工作假设',body:'假设不是已验证的事实。',items:[item('测量一致','核验设备与标定记录。'),item('样本独立','核验采样与重复关系。')]
  },{itemCount:[2,6]}),
  make('boundary-scope','覆盖范围对照卡','boundary','明确写出覆盖和未覆盖的对象','outline','plain','scope',{
    title:'评价覆盖',body:'两侧均为作者界定的范围。',items:[item('已覆盖','本季已采样地块。'),item('未覆盖','跨年与未采样土壤。')]
  },{minimumWidth:420,preferredWidth:520,itemCount:[2,2]}),
  make('boundary-response','风险应对卡','boundary','风险与对应动作形成局部配对','ribbon','plain','response',{
    title:'风险与应对',body:'应对方案仍需执行验证。',items:[item('风险','空间外推误差增大。'),item('应对','增加独立地点验证。')]
  },{minimumWidth:420,preferredWidth:520,itemCount:[2,2]}),
  make('boundary-checks','条件核对卡','boundary','逐项列出约束及检查依据','outline','rule','checks',{
    title:'条件核对',body:'列表只描述条件，不自动标记通过。',items:[item('时间窗','比较时段一致。'),item('单位','换算方式已记录。'),item('缺失值','处理规则可追踪。')]
  },{itemCount:[2,6]}),

  make('progress-rail','编号阶段卡','progress','当前阶段与产物的组合','rail','number','stack',{
    title:'验证准备',badge:'03',body:'冻结数据划分与评价指标，形成可复现协议。',note:'阶段完成后再开展模型比较。'
  }),
  make('progress-route','阶段路线卡','progress','横向呈现少量有序阶段','plain','plain','route',{
    title:'工作路线',body:'阶段衔接保留明确产物。',items:[item('准备','固定数据。'),item('检验','比较结果。'),item('复核','记录边界。')]
  },{minimumWidth:480,preferredWidth:600,itemCount:[2,3]}),
  make('progress-milestones','里程碑清单卡','progress','阶段时间与产物逐行对应','outline','band','milestones',{
    title:'阶段产物',body:'节点以实际产物定义。',items:[item('第一阶段','数据清单与质控记录。'),item('第二阶段','独立验证与误差分析。')]
  },{itemCount:[2,6]}),
  make('progress-decision','条件分支卡','progress','共同前提下的两种决策条件','plain','rule','decision',{
    title:'后续选择',body:'按预先约定的检验规则决定。',items:[item('条件满足','进入外部验证。'),item('条件未满足','检查数据与结构误差。')]
  },{minimumWidth:420,itemCount:[2,2]}),
  make('progress-status','完成待办分栏卡','progress','已完成与待完成任务明确分区','outline','tab','status',{
    title:'当前进展',body:'完成状态由作者确认。',items:[item('已完成','数据整理与质控。'),item('待完成','跨地点独立检验。')]
  },{minimumWidth:420,itemCount:[2,2]}),
  make('progress-action','下一步行动卡','progress','具体行动、交付物与触发条件','double-bottom','number','action',{
    title:'下一步验证',badge:'04',body:'在保留地块上复核误差结构。',items:[item('产物','误差分布与异常记录。'),item('前提','冻结模型和评价协议。')]
  },{itemCount:[1,6]}),
]);

export const CARD_PRESET_IDS = freeze(CARD_PRESETS.map(preset => preset.id));
const presetsById = new Map(CARD_PRESETS.map(preset => [preset.id, preset]));
export function getCardPreset(id) { return presetsById.get(id) || null; }

/** Filter by task rather than by accent color. Summaries stay small enough for tools. */
export function listCardPresets({ family, purpose, query, includeExamples = true, limit = 36 } = {}) {
  const terms = String(purpose || query || '').toLowerCase().trim().split(/\s+/u).filter(Boolean);
  const matches = CARD_PRESETS.filter(preset => (!family || preset.family === family) && (!terms.length || terms.some(term => [preset.id,preset.name,preset.family,preset.purpose,preset.useWhen].join(' ').toLowerCase().includes(term))));
  return matches.slice(0, Math.min(36, Math.max(1, Number(limit) || 36))).map(preset => {
    const copy = structuredClone(preset); if (!includeExamples) delete copy.example; return copy;
  });
}
