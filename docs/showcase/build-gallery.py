#!/usr/bin/env python3
"""Compose README previews from the shipped, renderer-generated card SVGs."""
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
LIBRARY = ROOT / 'skills/dsh-academic-ppt/references/card-library'
OUTPUT = Path(__file__).resolve().parent
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
CATALOG = {c['id']: c for c in json.loads((LIBRARY / 'manifest.json').read_text())['cards']}
FAMILIES = {
    'research': '问题与背景', 'method': '方法与流程', 'evidence': '证据与解释',
    'metric': '指标与读数', 'boundary': '条件与限制', 'progress': '阶段与决策', 'figure': '图片嵌入与解释',
}


def element(tag, attrs=None, text=None):
    node = ET.Element(f'{{{NS}}}{tag}', attrs or {})
    node.text = text
    return node


def label(x, y, content, size=22, weight=400, color='#4E5F6C'):
    return element('text', {
        'x': str(x), 'y': str(y), 'font-family': 'Noto Sans CJK SC, Microsoft YaHei, sans-serif',
        'font-size': str(size), 'font-weight': str(weight), 'fill': color,
    }, content)


def build(filename, heading, ids):
    rows = [ids[n:n + 2] for n in range(0, len(ids), 2)]
    row_heights = [max(CATALOG[key]['height'] * min(1, 576 / CATALOG[key]['width']) for key in row) + 78 for row in rows]
    height = 148 + sum(row_heights) + 32
    root = element('svg', {
        'viewBox': f'0 0 1280 {height}', 'width': '1280', 'height': str(height),
        'role': 'img', 'aria-labelledby': 'gallery-title gallery-desc',
    })
    root.append(element('title', {'id': 'gallery-title'}, heading))
    root.append(element('desc', {'id': 'gallery-desc'},
                        '从插件现有原生卡片 SVG 中选取内容关系与图片编排结构。示例图像、内容与数值仅用于展示组件，不是研究结果。'))
    root.append(element('rect', {'width': '1280', 'height': str(height), 'fill': '#F8FAFB'}))
    root.append(label(40, 55, heading, 32, 700, '#203C50'))
    root.append(label(40, 92, '内容决定结构 · 学术配色可调整 · 文字与形状可编辑', 21))
    root.append(element('line', {'x1': '40', 'y1': '116', 'x2': '1240', 'y2': '116',
                                 'stroke': '#CED9DF', 'stroke-width': '1'}))
    y = 148
    for row, row_height in zip(rows, row_heights):
        for column, key in enumerate(row):
            card = CATALOG[key]
            x = 40 + column * 624
            scale = min(1, 576 / card['width'])
            display_height = card['height'] * scale
            root.append(label(x, y + 15, f"{FAMILIES[card['family']]}  /  {card['name']}", 21, 500))
            svg = ET.fromstring((LIBRARY / card['svg']).read_text())
            # Translate the original viewBox, retaining all native geometry.
            # Explicit clipping also works in SVG renderers without nested-viewBox support.
            view_x, view_y, _, _ = map(float, svg.attrib['viewBox'].split())
            # Replace the renderer's whole-slide background with the card crop.
            # This avoids a 1280x720 backdrop covering neighboring samples in viewers
            # that incompletely implement SVG clip paths.
            for child in list(svg):
                if (child.tag == f'{{{NS}}}rect' and child.attrib == {
                    'x': '0', 'y': '0', 'width': '1280', 'height': '720', 'fill': '#FFFFFF'
                }):
                    svg.remove(child)
            root.append(element('rect', {'x': str(x), 'y': str(y + 32), 'width': '576',
                                        'height': str(display_height), 'fill': '#FFFFFF'}))
            identifiers = {node.attrib['id']: key + '--' + node.attrib['id']
                           for node in svg.iter() if 'id' in node.attrib}
            for node in svg.iter():
                for attr, value in list(node.attrib.items()):
                    if attr == 'id':
                        node.set(attr, identifiers[value])
                    else:
                        node.set(attr, re.sub(r'url\(#([^)]*)\)',
                                             lambda match: f'url(#{identifiers.get(match[1], match[1])})', value))
            clip_id = key + '--showcase-clip'
            clip = element('clipPath', {'id': clip_id, 'clipPathUnits': 'userSpaceOnUse'})
            clip.append(element('rect', {'x': str(x), 'y': str(y + 32), 'width': '576',
                                        'height': str(display_height)}))
            root.append(clip)
            clipped = element('g', {'clip-path': f'url(#{clip_id})'})
            drawing = element('g', {'transform': f'translate({x} {y + 32}) scale({scale}) translate({-view_x} {-view_y})'})
            drawing.extend(list(svg))
            clipped.append(drawing)
            root.append(clipped)
        y += row_height
    root.append(label(40, height - 20, '组件示例；示例数值不代表研究结果。完整卡库包含 48 款（含 12 款图片卡），可按实际内容重新组合。', 17))
    ET.ElementTree(root).write(OUTPUT / filename, encoding='utf-8', xml_declaration=True)


build('card-gallery.svg', '学术信息卡 · 六类内容关系', [
    'research-tab', 'method-io', 'evidence-interpretation', 'metric-pair',
    'boundary-response', 'progress-decision',
])
build('card-gallery-more.svg', '更多组件结构 · 按研究任务选择', [
    'research-bracket', 'method-ladder', 'evidence-compare', 'metric-ledger',
    'boundary-cut', 'progress-route',
])
build('image-card-gallery.svg', '论文图片嵌入卡 · 六种证据组织', [
    'figure-pair', 'figure-caption', 'figure-matrix', 'figure-overview-details',
    'figure-margin-notes', 'figure-conditions',
])
print('Built 3 showcase sheets from 18 shipped native card SVGs.')
