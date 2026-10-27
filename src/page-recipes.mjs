/**
 * Original, content-led academic page grammars.
 *
 * A recipe allocates relationships and space. It supplies no research claims,
 * numerical observations, source figures, commercial-template artwork or proof
 * that a page is readable. Authors may change the geometry or author a custom
 * composition whenever the actual evidence requires it.
 */

const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const copy = value => structuredClone(value);
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const evidence = ['figure', 'drawing', 'chart', 'plot', 'table'];
const method = ['drawing', 'diagram', 'figure'];
const explanation = ['card', 'drawing'];
const exact = ['table', 'drawing', 'figure'];
const slot = (id, label, role, box, accepts, guidance = '') => ({
  id, label, role, box: { x:box[0], y:box[1], w:box[2], h:box[3] },
  accepts, capacity: { maxPrimaryItems:1, maxCards:2, guidance },
});
const row = (weight, ...members) => ({ weight, slots:members.map(value => typeof value === 'string' ? { id:value, weight:1 } : { id:value[0], weight:value[1] }) });
const entry = (id, name, purposes, relationship, choose, avoid, evidenceNeed, grammar, capacity, alternatives, slots, rows) => ({
  id, name, purposes, relationship, choose, avoid, evidenceNeed, grammar,
  capacity, alternatives, slots, ...(rows ? { rows } : {}),
});
const capacity = (min, max, chars, shape = [0.6, 3.2], note = '') => ({
  evidenceItems:[min,max], textChars:chars, figureAspect:shape, note,
});

export const PAGE_RECIPES = freeze([
  entry('question-evidence', '现象、证据与可检验问题', ['question','background','proposal'], 'evidence-explanation',
    '开场需要把实际现象收束为一个能被研究回答的问题。', '已经进入结果精读，或现象图只起装饰作用。',
    '可定位的现象或需求证据；明确尚未回答的关系。', '现象建立入口，证据解释为何重要，问题连接下一页的检验。',
    capacity(1,2,180), ['research-gap','hero-evidence'], [
      slot('observation','实际现象','evidence',[0,0,.61,.70],evidence),
      slot('context','现象发生的条件','conditions',[.64,0,.36,.70],explanation),
      slot('question','需要回答的问题','synthesis',[0,.75,1,.25],explanation,'一个具体问题；不追加新研究结论。'),
    ], [row(2.8,['observation',1.7],'context'),row(1,'question')]),
  entry('hero-evidence', '单一证据精读', ['evidence','results','paper-reading'], 'evidence-explanation',
    '一幅复杂图需要完整画幅读清轴、图例与关系。', '没有单一共同问题，却把无关拼图塞满整页。',
    '原图、定位、完整轴和单位；解释在图中邻接或进入讲稿。', '阅读入口由证据本身决定，内部多面板仍需实际阅读顺序。',
    capacity(1,1,80,[1.2,3.5],'优先保住原图标签。原图过密时拆面板，不能仅放大截图。'), ['evidence-margin','small-multiples'], [
      slot('evidence','本页主证据','evidence',[0,0,1,1],evidence,'允许一个带完整标注的组合证据；不机械增加旁注。'),
    ], [row(1,'evidence')]),
  entry('evidence-margin', '主证据与开放旁注', ['evidence','results','paper-reading'], 'evidence-explanation',
    '一幅可读主图只需要短的解释与适用边界。', '旁注很长，或窄栏使主图的关键标签不可读。',
    '主图来源；旁注须区分观察、推断和边界。', '证据占主要画幅，侧栏就近解释局部，不复述整页标题。',
    capacity(1,1,150,[0.9,2.1]), ['hero-evidence','evidence-ledger'], [
      slot('evidence','主证据','evidence',[0,0,.69,1],evidence),
      slot('interpretation','解释与适用边界','explanation',[.73,.08,.27,.84],explanation,'两条短解释优先；超过容量时换版式。'),
    ]),
  entry('evidence-ledger', '主图、解释与边界分层', ['evidence','results','limitation'], 'evidence-explanation',
    '同一证据需要明确分开结果解释与适用边界。', '两个辅助区都只写同义结论。',
    '一幅证据，得到该解释的依据，至少一个真实限制条件。', '大证据跨两层；上部解释，下部条件，避免相同大小三卡。',
    capacity(1,1,210,[.7,1.8]), ['evidence-margin','mechanism-proof'], [
      slot('evidence','观察或结果','evidence',[0,0,.64,1],evidence),
      slot('interpretation','结果意味着什么','explanation',[.68,0,.32,.48],explanation),
      slot('boundary','何时不应外推','conditions',[.68,.54,.32,.46],explanation),
    ]),
  entry('paired-comparison', '共尺度对照', ['comparison','evidence','results'], 'comparison',
    '两个处理、方法或状态在同一评价口径下直接比较。', '两组研究的样本、指标或尺度不可比且未披露。',
    'A/B 的同一尺度、基准、分母、评价窗口和独立样本定义。', '两个证据在相同高度与尺度对齐，共享比较条件只写一次。',
    capacity(2,2,120,[.7,1.7]), ['before-after-delta','literature-matrix'], [
      slot('a','对照 A','evidence',[0,0,.485,.76],evidence),
      slot('b','对照 B','evidence',[.515,0,.485,.76],evidence),
      slot('conditions','使比较成立的共同条件','conditions',[0,.81,1,.19],explanation,'只放比较必要条件。'),
    ], [row(3.7,'a','b'),row(1,'conditions')]),
  entry('before-after-delta', '前后状态与差异解释', ['comparison','results','mechanism'], 'comparison',
    '同一对象的两个时间点或干预前后需要同时呈现差异。', '不同对象被误写成前后变化，或未排除时间混杂。',
    '对象配对规则、前后时间、变化的计量方式与混杂限制。', '上部保留前后证据；下部以差异或变化机制连接，不重复两个描述。',
    capacity(2,3,150,[1.1,2.4]), ['paired-comparison','contradiction-explainer'], [
      slot('before','基线或干预前','evidence',[0,0,.485,.58],evidence),
      slot('after','随访或干预后','evidence',[.515,0,.485,.58],evidence),
      slot('delta','配对差异与解释','synthesis',[0,.64,1,.36],['drawing','chart','plot','table','card']),
    ], [row(1.65,'before','after'),row(1,'delta')]),
  entry('small-multiples', '可比较的多面板', ['comparison','results','robustness'], 'matrix',
    '同一变量在不超过四个明确条件下比较，且能共用尺度。', '原论文四个过密面板仍看不清，或各图坐标不相容。',
    '各面板的条件、共享或明确不同的尺度、完整图例和来源。', '行列有明确语义；位置代表条件，不能为凑四格而添结果。',
    capacity(4,4,90,[1.1,2.5],'四面板只是本配方形态；材料只有两组时改选双图。'), ['paired-comparison','hero-evidence'], [
      slot('a','条件 A','evidence',[0,0,.485,.47],evidence),
      slot('b','条件 B','evidence',[.515,0,.485,.47],evidence),
      slot('c','条件 C','evidence',[0,.53,.485,.47],evidence),
      slot('d','条件 D','evidence',[.515,.53,.485,.47],evidence),
    ], [row(1,'a','b'),row(1,'c','d')]),
  entry('result-statistics', '总体结果与精确统计', ['results','evidence','comparison'], 'evidence-explanation',
    '趋势/分布与少量精确统计值需要同时供观众核对。', '数字表仅复述图中全部数值，或不确定性来源未知。',
    '结果图、同一分析的统计量、单位、n 和不确定性定义。', '上部读模式，下部核对数值；统计表不应挤成小角落。',
    capacity(1,2,100,[1.6,3.5]), ['distribution-uncertainty','evidence-ledger'], [
      slot('result','结果模式','evidence',[0,0,1,.62],evidence),
      slot('statistics','精确统计与样本条件','conditions',[0,.68,1,.32],exact,'少量列/行；更多数值移至附录。'),
    ], [row(1.9,'result'),row(1,'statistics')]),
  entry('distribution-uncertainty', '分布与估计不确定性', ['results','statistics','comparison'], 'comparison',
    '需要区分个体观测分布和总体估计区间。', '只有均值却编造离散点、箱线图或置信区间。',
    '原始观测或已报告分布；已报告或可复算区间；区间的定义。', '分布与估计分开表达，并共享样本及单位说明。',
    capacity(2,2,120,[.8,1.6]), ['result-statistics','paired-comparison'], [
      slot('distribution','个体观测分布','evidence',[0,0,.57,.78],evidence),
      slot('uncertainty','估计与区间','evidence',[.60,0,.40,.78],evidence),
      slot('sample','样本与区间定义','conditions',[0,.84,1,.16],explanation),
    ], [row(4.6,['distribution',1.4],'uncertainty'),row(1,'sample')]),
  entry('map-and-detail', '总体定位与局部证据', ['evidence','spatial','mechanism'], 'hierarchy',
    '需要把局部现象放回总体对象、空间或系统。', '局部图与总体没有可追踪对应，或裁剪丢掉决定性边界。',
    '总体与局部的定位关系、比例尺/坐标、裁剪与放大说明。', '总览跨两层，两个局部与总览中明确标记的位置对应。',
    capacity(2,3,140,[.6,1.6]), ['hero-evidence','evidence-ledger'], [
      slot('overview','总体与定位标记','evidence',[0,0,.62,1],evidence),
      slot('detail-a','局部 A','evidence',[.66,0,.34,.47],evidence),
      slot('detail-b','局部 B','evidence',[.66,.53,.34,.47],evidence),
    ]),
  entry('scale-ladder', '跨尺度关系', ['mechanism','spatial','review'], 'hierarchy',
    '研究把不同尺度的观测、过程或外推联系起来。', '仅有三个平行对象却画成上下游或尺度递进。',
    '每层的空间/时间支持、测量对象和跨尺度映射假设。', '一个连续关系图表达尺度转换；辅助栏列出不能直接外推的条件。',
    capacity(1,3,200,[1.2,2.8]), ['method-pipeline','source-evidence-map'], [
      slot('scales','尺度与映射关系','method',[0,0,1,.72],method),
      slot('assumptions','跨尺度映射条件','conditions',[0,.78,1,.22],explanation),
    ], [row(3.2,'scales'),row(1,'assumptions')]),
  entry('source-evidence-map', '来源到论证的映射', ['review','synthesis','paper-reading'], 'synthesis',
    '多篇研究为同一个问题提供不同证据角色。', '只是将论文封面并排，缺少共同问题或支持关系。',
    '每个来源的具体结论、定位和支持/冲突/补充身份。', '来源列对接论证图；连接线必须能解释支持的具体命题。',
    capacity(2,4,230,[1.0,2.5]), ['literature-matrix','cross-study-synthesis'], [
      slot('sources','来源与研究条件','conditions',[0,0,.30,1],['card','drawing','references']),
      slot('argument-map','共同问题与证据关系','synthesis',[.34,0,.66,1],['drawing','diagram']),
    ], [row(1,['sources',.46],'argument-map')]),
  entry('literature-matrix', '文献证据矩阵', ['review','comparison','synthesis'], 'matrix',
    '跨研究按少数相同维度进行可审查比较。', '表中塞下每篇论文的所有摘要，或指标定义不同却直接排名。',
    '来源、研究条件、比较维度与不可比项，逐行可追溯。', '列是比较维度，行是研究或方法；边界与缺测必须显式保留。',
    capacity(2,8,350,[1.8,3.5],'典型 3–6 行、3–5 列是可读起点，不是硬性研究数量要求。'), ['source-evidence-map','cross-study-synthesis'], [
      slot('matrix','可审查的研究比较','evidence',[0,0,1,.82],exact),
      slot('scope','可比性与缺测说明','conditions',[0,.87,1,.13],explanation),
    ], [row(5,'matrix'),row(.8,'scope')]),
  entry('research-gap', '已有能力、失效条件与缺口', ['question','proposal','review'], 'synthesis',
    '需要从已有研究推导一个具体缺口。', '用“研究很少”代替证据，或未检索就宣布首次。',
    '已有能力的真实证据、失效/未覆盖条件及可检验问题。', '上部对照能力与边界，下部把缺口写成可操作的关系。',
    capacity(1,2,240), ['question-evidence','proposal-decision'], [
      slot('known','已有研究已经做到什么','evidence',[0,0,.54,.65],['figure','drawing','card','table']),
      slot('boundary','在哪些条件下仍不足','conditions',[.58,0,.42,.65],['card','drawing','figure']),
      slot('gap','由证据推出的研究问题','synthesis',[0,.72,1,.28],explanation),
    ], [row(2.3,['known',1.3],'boundary'),row(1,'gap')]),
  entry('method-pipeline', '方法管线与输入输出约束', ['method','mechanism','proposal'], 'sequence',
    '方法有清晰的输入、变换、输出以及相应条件。', '步骤本身是反馈或并行依赖，却被线性箭头掩盖。',
    '真实操作和数据流；每一步的输入输出对象；训练/评估边界。', '主流程横贯画幅，下方解释输入条件与输出验证，箭头端点真实。',
    capacity(1,1,200,[2,4]), ['method-swimlane','feedback-cycle'], [
      slot('pipeline','输入、变换与输出','method',[0,0,1,.65],method),
      slot('inputs','输入与约束','conditions',[0,.72,.485,.28],explanation),
      slot('validation','输出与验证','conditions',[.515,.72,.485,.28],explanation),
    ], [row(2.3,'pipeline'),row(1,'inputs','validation')]),
  entry('method-swimlane', '并行方法泳道', ['method','mechanism','comparison'], 'sequence',
    '两个主体、数据源或阶段并行执行后汇合。', '实际仅是三个相邻标签，或流程顺序/同步关系未知。',
    '各泳道主体、共享阶段、交互/汇合点及传递对象。', '行代表主体、列代表阶段；跨行连线表达数据交换，不做装饰。',
    capacity(1,1,220,[1.6,3.5]), ['method-pipeline','factorial-design'], [
      slot('swimlanes','并行阶段及交互','method',[0,0,1,1],['drawing','diagram','figure']),
    ], [row(1,'swimlanes')]),
  entry('feedback-cycle', '状态更新与反馈回路', ['method','mechanism','assimilation'], 'mechanism',
    '观测或反馈改变系统的下一状态，线性列表会丢失核心机制。', '没有实际更新方程或因果方向，却画一个闭环表示完整。',
    '预测状态、观测、误差/创新量、更新对象和时间索引。', '闭环中区分预测、观测与校正，右栏保留状态/参数/单位身份。',
    capacity(1,2,220,[.8,1.8]), ['method-pipeline','equation-interpretation'], [
      slot('cycle','预测与更新回路','method',[0,0,.68,1],['drawing','diagram','figure']),
      slot('states','状态与更新条件','conditions',[.72,0,.28,1],['card','table','drawing']),
    ], [row(1,['cycle',2.3],'states')]),
  entry('experiment-design', '实验处理与共同评估', ['design','experiment','proposal'], 'hierarchy',
    '需要说明样本如何分组、接受处理并进入共同评估。', '直接放结果却没有交代随机化、对照或分析单位。',
    '实验单位、分配规则、处理、对照、评价指标和重复结构。', '分支代表处理，汇合代表共同评估；下栏保留公平比较的条件。',
    capacity(1,1,210,[1.4,3]), ['factorial-design','cohort-flow'], [
      slot('design','样本、处理与评估','method',[0,0,1,.70],method),
      slot('controls','对照、重复与测量条件','conditions',[0,.77,1,.23],['card','drawing','table']),
    ], [row(3,'design'),row(1,'controls')]),
  entry('cohort-flow', '样本流转与排除理由', ['design','experiment','methods'], 'sequence',
    '样本数量在筛选、随访或清洗中发生变化。', '只有总样本量，无法核对各步骤的数量守恒。',
    '每一步的样本数量、排除理由、分析集与重复单位。', '纵向流转与右侧排除/分组对应，不能以流程图掩盖样本变化。',
    capacity(1,2,220,[.5,1.3]), ['experiment-design','result-statistics'], [
      slot('flow','筛选与分析集','method',[0,0,.44,1],method),
      slot('accounting','样本量与排除依据','conditions',[.49,0,.51,1],['table','drawing','card']),
    ], [row(1,['flow',.86],'accounting')]),
  entry('factorial-design', '因子、处理组合与分析', ['design','experiment','comparison'], 'matrix',
    '两个或多个因素的处理组合决定实验安排。', '观测分组被误写成随机因子设计。',
    '因素、水平、重复、随机化/区组方式、交互效应的分析定义。', '左侧精确组合矩阵，右侧表达分配/分析关系。',
    capacity(1,2,190,[1,2]), ['experiment-design','literature-matrix'], [
      slot('factors','因素与水平组合','conditions',[0,0,.52,1],exact),
      slot('allocation','分配、重复与分析','method',[.56,0,.44,1],method),
    ], [row(1,['factors',1.2],'allocation')]),
  entry('mechanism-proof', '机制与支持证据', ['mechanism','evidence','results'], 'mechanism',
    '机制示意需要与具体结果相互核对。', '示意箭头被当成因果证据，或证据只支持相关性。',
    '机制来源、对应观测/干预、替代解释和适用边界。', '左机制右证据逐点对应，下栏标明证据不能证明什么。',
    capacity(1,2,180,[.8,1.8]), ['evidence-ledger','contradiction-explainer'], [
      slot('mechanism','待解释的机制','method',[0,0,.50,.76],method),
      slot('proof','支持或约束该机制的证据','evidence',[.54,0,.46,.76],evidence),
      slot('limits','因果与外推边界','conditions',[0,.82,1,.18],explanation),
    ], [row(4,['mechanism',1.1],'proof'),row(1,'limits')]),
  entry('equation-interpretation', '公式、符号与成立条件', ['theory','method','mechanism'], 'definition',
    '核心方程值得逐项解释，并且影响后续方法或判断。', '公式仅增加学术感，或渲染不能保留数学符号。',
    '公式来源/推导身份、变量与单位、假设、适用域。', '公式为主视觉；符号解释与假设是不同层，不能只放无定义方程。',
    capacity(1,1,220,[1.8,4]), ['feedback-cycle','method-pipeline'], [
      slot('equation','关键表达式','method',[0,0,1,.38],['drawing','figure']),
      slot('symbols','变量、单位与含义','explanation',[0,.45,.60,.55],['drawing','table','card']),
      slot('assumptions','成立条件','conditions',[.64,.45,.36,.55],explanation),
    ], [row(.7,'equation'),row(1,['symbols',1.6],'assumptions')]),
  entry('ablation-study', '消融结果与干预定义', ['results','comparison','method'], 'comparison',
    '需要把性能变化与具体移除/替换的组件关联。', '多个因素同时变化却把差异归因于单一组件。',
    '基线、唯一干预、共同训练/验证条件、方差和指标方向。', '左侧结果对齐右侧组件/干预表，阅读者能核查每个比较的含义。',
    capacity(1,2,170,[.9,2.2]), ['result-statistics','paired-comparison'], [
      slot('effects','消融效果与不确定性','evidence',[0,0,.64,1],evidence),
      slot('interventions','组件与公平比较条件','conditions',[.68,0,.32,1],['table','drawing','card']),
    ], [row(1,['effects',2],'interventions')]),
  entry('robustness-landscape', '条件变化与稳健性边界', ['results','robustness','limitation'], 'matrix',
    '结论随环境、参数或数据分布变化，需要呈现失效区域。', '只有最佳配置的一个数字，却宣称普遍稳健。',
    '实际扫描范围、指标尺度、失败条件与未观测区域。', '上部条件空间保留连续性/离散性，下部解释有效域与失效域。',
    capacity(1,2,180,[1.4,3]), ['small-multiples','limitation-response'], [
      slot('landscape','条件空间与结果','evidence',[0,0,1,.68],evidence),
      slot('supported','被证据支持的范围','conditions',[0,.75,.485,.25],explanation),
      slot('failure','失效或未知范围','conditions',[.515,.75,.485,.25],explanation),
    ], [row(2.7,'landscape'),row(1,'supported','failure')]),
  entry('contradiction-explainer', '冲突结果与条件解释', ['review','synthesis','comparison'], 'comparison',
    '研究得到方向不同的结果，需要解释条件差异。', '通过删去反向结果来制造一致结论。',
    '两项结果的真实出处、指标、样本、尺度及可比性。', '冲突先可见，再比较可能解释；假设性的解释明确为推断。',
    capacity(2,2,220,[1,2]), ['paired-comparison','cross-study-synthesis'], [
      slot('finding-a','结果 A','evidence',[0,0,.485,.62],evidence),
      slot('finding-b','结果 B','evidence',[.515,0,.485,.62],evidence),
      slot('explanation','条件差异与替代解释','synthesis',[0,.69,1,.31],['table','drawing','card']),
    ], [row(2,'finding-a','finding-b'),row(1,'explanation')]),
  entry('cross-study-synthesis', '跨研究证据与综合判断', ['review','synthesis','conclusion'], 'synthesis',
    '一组研究已经比较过，需要回答共同问题并保留分歧。', '未完成逐项核对就生成包罗万象的共识。',
    '比较过的来源、支持/冲突/缺测记录和推断边界。', '上部证据关系压缩但可追溯，下部明确综合判断与尚未知之处。',
    capacity(2,6,240,[1.7,3.5]), ['literature-matrix','source-evidence-map'], [
      slot('evidence-map','共同维度下的证据','evidence',[0,0,1,.63],['table','drawing','figure']),
      slot('synthesis','有条件的综合判断','synthesis',[0,.70,.65,.30],explanation),
      slot('unresolved','仍待回答','conditions',[.69,.70,.31,.30],explanation),
    ], [row(2.1,'evidence-map'),row(1,['synthesis',2.1],'unresolved')]),
  entry('limitation-response', '局限、影响与可检验响应', ['limitation','proposal','discussion'], 'matrix',
    '需要把局限具体连接到影响和补救/验证动作。', '列出泛泛缺点，然后默认未来工作必然解决。',
    '局限的证据、影响哪一项判断、可测的响应与失败分支。', '每一行是局限→影响→行动的同一关系，行数由实际材料决定。',
    capacity(0,3,300,[1.8,3.5]), ['proposal-decision','robustness-landscape'], [
      slot('responses','局限、影响与响应的对应关系','synthesis',[0,0,1,1],['drawing','table']),
    ], [row(1,'responses')]),
  entry('proposal-decision', '研究方案与判定分支', ['proposal','plan','design'], 'sequence',
    '尚未实施的方案需要解释如何得到可判定结果。', '将预期效果写成已取得结果，或只画成功路线。',
    '明确假设、公平对照、观测指标、预先定义的判断及失败后行动。', '问题通向实验，再分为支持/不支持两条路径，保留两种结果。',
    capacity(0,2,240,[1.5,3]), ['experiment-design','research-gap'], [
      slot('hypothesis','待检验假设','explanation',[0,.10,.25,.80],explanation),
      slot('test','实验与判定流程','method',[.29,0,.71,1],['drawing','diagram','figure']),
    ]),
  entry('work-package-dependency', '研究任务的依赖网络', ['plan','proposal','organization'], 'hierarchy',
    '多个工作包有真实数据、方法或交付物依赖。', '只需并列任务清单却画大量无意义箭头。',
    '每个工作包的输入、输出、负责人/边界、依赖与汇合。', '节点是研究任务，边是可说明的交付物，关键路径不能靠颜色臆断。',
    capacity(0,1,240,[1.4,3]), ['method-swimlane','milestone-timeline'], [
      slot('dependencies','任务、交付物与依赖','method',[0,0,1,1],['drawing','diagram']),
    ], [row(1,'dependencies')]),
  entry('milestone-timeline', '里程碑与验收证据', ['plan','progress','proposal'], 'sequence',
    '研究进度必须对应时间和可核验交付物。', '时间点没有依据，或把所有任务画成顺序串行。',
    '开始/结束或阶段时间、依赖、当前状态与验收定义。', '上部时间与任务对齐，下部说明关键里程碑如何被验收。',
    capacity(0,1,200,[2,4]), ['work-package-dependency','proposal-decision'], [
      slot('timeline','时间、任务与依赖','method',[0,0,1,.73],['drawing','table']),
      slot('acceptance','里程碑验收依据','conditions',[0,.79,1,.21],explanation),
    ], [row(3.4,'timeline'),row(1,'acceptance')]),
  entry('resource-allocation', '资源结构与精确核对', ['plan','budget','organization'], 'hierarchy',
    '需要解释资源如何分配，并核对总量与项目。', '缺少真实预算或数量，却用饼图面积暗示精确比例。',
    '真实总量、单位、分配规则、分类互斥性与加总校验。', '结构图解释归属，表格保留精确数值；图表不新增虚构预算。',
    capacity(1,2,150,[1,2]), ['result-statistics','literature-matrix'], [
      slot('allocation','资源归属关系','method',[0,0,.47,1],['drawing','diagram','chart']),
      slot('accounting','精确数值与总量核对','evidence',[.51,0,.49,1],['table','drawing']),
    ], [row(1,['allocation',.96],'accounting')]),
  entry('conclusion-return', '以证据回应开场问题', ['conclusion','synthesis','closing'], 'synthesis',
    '结尾需要回到开场问题，明确已知、边界和下一步讨论。', '最后一页只重复章节标题或喊口号。',
    '已讲过的证据链、可支持的回答、不可外推范围。', '主区域回答问题，下部将关键证据与未决条件并置，不引入新发现。',
    capacity(1,3,180,[1.4,3]), ['cross-study-synthesis','question-evidence'], [
      slot('answer','对开场问题的有条件回答','synthesis',[0,0,1,.44],['drawing','card']),
      slot('support','已呈现的关键证据关系','evidence',[0,.51,.65,.49],['drawing','table','figure']),
      slot('boundary','讨论与下一步判断','conditions',[.69,.51,.31,.49],explanation),
    ], [row(.9,'answer'),row(1,['support',2.1],'boundary')]),
]);

const byId = new Map(PAGE_RECIPES.map(recipe => [recipe.id, recipe]));
export const PAGE_RECIPE_IDS = freeze(PAGE_RECIPES.map(recipe => recipe.id));
const cleanText = value => String(value ?? '').trim().toLowerCase();
const validLimit = (value, fallback) => {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > PAGE_RECIPES.length) throw new Error('PAGE_RECIPE_LIMIT: limit must be 1–' + PAGE_RECIPES.length);
  return value;
};

/** Return detached data so an agent cannot mutate the shared catalogue. */
export function getPageRecipe(id) {
  if (!byId.has(id)) throw new Error('UNKNOWN_PAGE_RECIPE: ' + String(id));
  return copy(byId.get(id));
}

export function listPageRecipes({ purpose, relationship, limit } = {}) {
  const query = cleanText(purpose);
  return PAGE_RECIPES.filter(recipe => (!relationship || recipe.relationship === relationship)
    && (!query || [recipe.id,recipe.name,...recipe.purposes,recipe.choose].some(value => cleanText(value).includes(query))))
    .slice(0, validLimit(limit, PAGE_RECIPES.length)).map(copy);
}

/** Rank candidates, report tradeoffs, never choose a slide for the author. */
export function recommendPageRecipes({ purpose, relationship, carriers = [], evidenceCount, figureAspect, textChars, limit } = {}) {
  if (!Array.isArray(carriers) || carriers.some(value => !CARRIER_NAMES.has(value))) throw new Error('PAGE_RECIPE_CARRIERS: unknown carrier');
  for (const [key,value] of Object.entries({ evidenceCount, figureAspect, textChars })) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || (key === 'figureAspect' && value === 0))) throw new Error('PAGE_RECIPE_QUERY: invalid ' + key);
  }
  const query = cleanText(purpose);
  return PAGE_RECIPES.map(recipe => {
    let score = 0; const reasons = [], warnings = [];
    if (query && [recipe.id,recipe.name,...recipe.purposes,recipe.choose].some(value => cleanText(value).includes(query))) { score += 5; reasons.push('适合当前页面任务。'); }
    if (relationship) {
      if (recipe.relationship === relationship) { score += 6; reasons.push('信息关系一致。'); }
      else warnings.push('本配方的关系为 ' + recipe.relationship + '，需要重新论证适用性。');
    }
    const available = new Set(recipe.slots.flatMap(slot => slot.accepts));
    for (const carrier of new Set(carriers)) {
      if (available.has(carrier)) score += 1;
      else { score -= 4; warnings.push('此配方没有 ' + carrier + ' 的自然位置。'); }
    }
    if (evidenceCount !== undefined) {
      const [minimum,maximum] = recipe.capacity.evidenceItems;
      if (evidenceCount >= minimum && evidenceCount <= maximum) { score += 3; reasons.push('证据数量在建议容量内；仍须检查实际标签。'); }
      else { score -= 3; warnings.push('建议证据数量为 ' + minimum + '–' + maximum + '；不要为填槽位新增内容。'); }
    }
    if (figureAspect !== undefined) {
      const [minimum,maximum] = recipe.capacity.figureAspect;
      if (figureAspect >= minimum && figureAspect <= maximum) score += 2;
      else { score -= 2; warnings.push('原图长宽比与常用区域不匹配；改区域或拆分精读，不能裁掉证据。'); }
    }
    if (textChars !== undefined && textChars > recipe.capacity.textChars) { score -= 2; warnings.push('解释文字超过该结构的建议容量；不要缩小字号。'); }
    return { id:recipe.id, name:recipe.name, relationship:recipe.relationship, score, reasons, warnings, alternatives:copy(recipe.alternatives) };
  }).sort((a,b) => b.score - a.score || PAGE_RECIPE_IDS.indexOf(a.id) - PAGE_RECIPE_IDS.indexOf(b.id))
    .slice(0, validLimit(limit, 4));
}

const CARRIERS = { figureIds:'figure', cardIds:'card', drawingIds:'drawing', referenceIds:'references', chart:'chart', table:'table', diagram:'diagram', plot:'plot', plotId:'plot' };
const CARRIER_NAMES = new Set(Object.values(CARRIERS));
const PANEL_FIELDS = new Set([...Object.keys(CARRIERS),'title','heading','surface','padding','kind']);
const finiteBox = box => box && ['x','y','w','h'].every(key => Number.isFinite(box[key])) && box.w > 0 && box.h > 0;
const inside = (a,b) => finiteBox(a) && a.x >= b.x - 1e-8 && a.y >= b.y - 1e-8 && a.x + a.w <= b.x + b.w + 1e-8 && a.y + a.h <= b.y + b.h + 1e-8;
const overlaps = (a,b) => Math.min(a.x+a.w,b.x+b.w) > Math.max(a.x,b.x) + 1e-8 && Math.min(a.y+a.h,b.y+b.h) > Math.max(a.y,b.y) + 1e-8;
const assertObject = (value, label) => {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('PAGE_RECIPE_INPUT: ' + label + ' must be an object');
};
const arrayLimits = { figureIds:4, cardIds:8, drawingIds:8, referenceIds:6 };

/**
 * Compile a selected grammar to the existing public slide contract.
 *
 * Regions require the actual body box AFTER header/source/lead placement.
 * For row-capable recipes, mode:'rows' lets the renderer allocate that box.
 * `overrides[slotId].box` is normalized to contentBox and permits authored
 * geometry. It is never used to silently shrink evidence or text.
 *
 * Returns a patch plus diagnostics. The caller still supplies all referenced
 * slide/project carriers and runs the normal source, geometry and visual gates.
 */
export function compilePageRecipe(recipeId, { bindings, mode = 'regions', contentBox, overrides = {}, rationale, repetitionReason } = {}) {
  const recipe = getPageRecipe(recipeId);
  assertObject(bindings, 'bindings'); assertObject(overrides, 'overrides');
  if (!['rows','regions'].includes(mode)) throw new Error('PAGE_RECIPE_MODE: choose rows or regions');
  if (mode === 'rows' && !recipe.rows) throw new Error('PAGE_RECIPE_ROWS: this relationship spans rows; use explicit regions');
  if (mode === 'regions' && !inside(contentBox,{x:0,y:0,w:1280,h:720})) throw new Error('PAGE_RECIPE_CONTENT_BOX: supply the actual, valid 1280×720 body area');
  const known = new Set(recipe.slots.map(slot => slot.id));
  for (const key of [...Object.keys(bindings),...Object.keys(overrides)]) if (!known.has(key)) throw new Error('PAGE_RECIPE_SLOT: unknown slot ' + key);
  const warnings = [], used = new Set(), totals = {figureIds:0,cardIds:0,drawingIds:0,referenceIds:0};
  const panels = recipe.slots.map(slot => {
    if (!Object.hasOwn(bindings,slot.id)) throw new Error('PAGE_RECIPE_BINDING: missing slot ' + slot.id + '; choose or author a structure matching the available material');
    assertObject(bindings[slot.id], 'binding ' + slot.id);
    const edit = overrides[slot.id] ?? {};
    assertObject(edit,'override ' + slot.id);
    for (const key of Object.keys(edit)) if (!['box','title','heading','surface','padding','kind'].includes(key)) throw new Error('PAGE_RECIPE_OVERRIDE: unsupported ' + key);
    for (const key of Object.keys(bindings[slot.id])) if (!PANEL_FIELDS.has(key)) throw new Error('PAGE_RECIPE_BINDING: unsupported panel field ' + key);
    const {box:changedBox,...appearance} = edit;
    if (changedBox && mode === 'rows') throw new Error('PAGE_RECIPE_ROWS: box overrides need regions mode');
    const normalized = changedBox ?? slot.box;
    if (!inside(normalized,{x:0,y:0,w:1,h:1})) throw new Error('PAGE_RECIPE_GEOMETRY: normalized box must fit the body for ' + slot.id);
    const panel = {id:slot.id,title:slot.label,heading:'hidden',surface:'plain',padding:0,...copy(bindings[slot.id]),...copy(appearance)};
    if (typeof panel.title !== 'string' || panel.title.length > 300 || !['visible','hidden'].includes(panel.heading) || !['inherit','plain','rule','tint','band'].includes(panel.surface) || !Number.isFinite(panel.padding) || panel.padding < 0 || panel.padding > 24) throw new Error('PAGE_RECIPE_APPEARANCE: invalid heading, title, surface or padding for ' + slot.id);
    if (panel.heading === 'visible' && !panel.title.trim()) throw new Error('PAGE_RECIPE_APPEARANCE: visible heading needs a title');
    if (panel.kind && !['question','method','setting','result','boundary','hypothesis'].includes(panel.kind)) throw new Error('PAGE_RECIPE_APPEARANCE: unknown kind');
    let count = 0, primaryCount = 0, cardCount = 0;
    for (const [field,carrier] of Object.entries(CARRIERS)) {
      if (panel[field] === undefined) continue;
      let identities;
      if (Object.hasOwn(arrayLimits,field)) {
        if (!Array.isArray(panel[field]) || panel[field].length > arrayLimits[field] || panel[field].some(id => typeof id !== 'string' || !ID.test(id))) throw new Error('PAGE_RECIPE_CARRIER: invalid ' + field);
        identities=panel[field]; totals[field] += identities.length;
      } else if (field === 'plotId') {
        if (typeof panel[field] !== 'string' || !ID.test(panel[field])) throw new Error('PAGE_RECIPE_CARRIER: invalid plotId');
        identities=[panel[field]];
      } else {
        if (typeof panel[field] !== 'boolean') throw new Error('PAGE_RECIPE_CARRIER: ' + field + ' must be boolean');
        identities=panel[field] ? ['$single'] : [];
      }
      if (identities.length && !slot.accepts.includes(carrier)) throw new Error('PAGE_RECIPE_CARRIER: ' + slot.id + ' does not accept ' + carrier);
      for (const identity of identities) {
        // A slide has both a legacy plot and identified plots, so their key
        // namespaces differ. Every other carrier has exactly one namespace.
        const key = (field === 'plot' ? 'legacy-plot' : carrier) + ':' + identity;
        if (used.has(key)) throw new Error('PAGE_RECIPE_DUPLICATE: ' + key + ' must have one display position');
        used.add(key);
      }
      count += identities.length;
      if (carrier === 'card') cardCount += identities.length;
      else primaryCount += identities.length;
    }
    if (!count) throw new Error('PAGE_RECIPE_EMPTY: slot ' + slot.id + ' needs actual evidence or explanation');
    if (panel.plot && panel.plotId) throw new Error('PAGE_RECIPE_CARRIER: do not stack a legacy and identified plot in one slot');
    if (primaryCount > slot.capacity.maxPrimaryItems || cardCount > slot.capacity.maxCards) warnings.push({code:'recipe-slot-capacity',slotId:slot.id,message:'This slot exceeds its suggested carrier capacity. Re-measure or change the composition; do not shrink labels.'});
    if (mode === 'regions') panel.box = {
      x:contentBox.x + normalized.x * contentBox.w, y:contentBox.y + normalized.y * contentBox.h,
      w:normalized.w * contentBox.w, h:normalized.h * contentBox.h,
    };
    return panel;
  });
  for (const [field,maximum] of Object.entries({figureIds:4,cardIds:8,drawingIds:12,referenceIds:6})) if (totals[field] > maximum) throw new Error('PAGE_RECIPE_SLIDE_CAPACITY: ' + field + ' exceeds the current slide contract');
  if (mode === 'regions') for (let i=0;i<panels.length;i++) for (let j=i+1;j<panels.length;j++) if (overlaps(panels[i].box,panels[j].box)) throw new Error('PAGE_RECIPE_OVERLAP: ' + panels[i].id + ' and ' + panels[j].id + '; express nested relationships inside a drawing');
  const panelMap = new Map(panels.map(panel => [panel.id,panel]));
  const composition = mode === 'regions' ? {regions:panels} : {rows:recipe.rows.map(row => ({weight:row.weight,panels:row.slots.map(member => ({...panelMap.get(member.id),weight:member.weight}))}))};
  const order = mode === 'rows' ? recipe.rows.flatMap(row => row.slots.map(slot => slot.id)) : recipe.slots.map(slot => slot.id);
  const primary = [...recipe.slots].sort((a,b) => {
    const ab=overrides[a.id]?.box??a.box,bb=overrides[b.id]?.box??b.box;
    return bb.w*bb.h-ab.w*ab.h;
  })[0];
  const reason = rationale ?? recipe.grammar;
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 1000) throw new Error('PAGE_RECIPE_RATIONALE: provide a nonempty rationale up to 1000 characters');
  if (repetitionReason !== undefined && (typeof repetitionReason !== 'string' || !repetitionReason.trim() || repetitionReason.length > 600)) throw new Error('PAGE_RECIPE_REPETITION: explain the actual scientific comparability');
  const roles = [...new Set(recipe.slots.map(slot => slot.role))];
  const visualPlan = {
    relationship:recipe.relationship,primaryPanelId:primary.id,readingOrder:order,rationale:reason,
    contentLayers:roles.map(role => ({role,panelIds:recipe.slots.filter(slot => slot.role===role).map(slot => slot.id),summary:recipe.slots.filter(slot => slot.role===role).map(slot => slot.label).join('；')})),
    alternatives:recipe.alternatives.slice(0,2).map(id => ({structure:id,tradeoff:byId.get(id).choose})),
    ...(repetitionReason ? {repetitionReason} : {}),
  };
  warnings.push({code:'recipe-review-required',message:'This is a composition proposal. Verify referenced sources, actual glyph/figure legibility, evidence relations and every rendered PPTX page before approval.'});
  return {recipeId,slidePatch:{layout:'academic',composition,visualPlan},warnings};
}
