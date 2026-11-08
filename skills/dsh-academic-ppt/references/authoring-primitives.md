# 可组合的原生几何辅助，而不是整页模板

运行时contract(design)返回authoringHelpers.modulePath绝对位置，可在本地Node脚本中import。只把生成的drawings/composition写入recordsPath，再走正常record/check/build/render。不要直接执行样张重建脚本冒充当前报告，也不绕过证据与协作流程。

```js
const {nativeDrawing,splitBox}=await import('file:///实际插件目录/src/authoring-primitives.mjs');
// 使用context.pageGeometry对应页的真实contentBox，不照抄固定高度。
const p=nativeDrawing('method-graph',contentBox);
const [input,transform,output]=splitBox({x:0,y:90,w:contentBox.w,h:130},[1,1.5,1],{gap:28});
for (const [box,label] of [[input,'已核对输入'],[transform,'已核对变换'],[output,'已核对输出']]) {
  p.rect(box,{fill:'#EFF3F3'});
  p.text(label,{x:box.x+18,y:box.y+18,w:box.w-36},{bold:true});
}
p.edge(input,'right',transform,'left');
p.edge(transform,'right',output,'left');
// slide.drawings=[p.drawing]; slide.composition={regions:[p.region]};
```

这仅演示API，节点文字必须换成有来源的真实步骤，关系也必须有来源。`nativeDrawing`按原字号测量换行，不自动缩字或丢字；放不下会报具体区域，应该改结构。`splitBox`只计算权重/间距；`edge`附着指定节点边缘，复杂避障路径仍需显式via并看图。

多图页不要先画两个等宽空框。先查看原图的长宽比及所需面板，再决定等高并列、共享时间轴、主图与局部放大或方法—结果上下配合。真实图片仍通过assetId及composition.region.figureIds上页。辅助函数不会替你判断裁切是否合法、统计是否可比、图内字是否可读。
