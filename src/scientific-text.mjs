/** Lossless lexical units for scientific slide text. This is a typography
 * heuristic, not a parser or a check of the underlying scientific meaning. */
const hspace = '[ \\t\\u00a0\\u202f]*';
const number = '[+\\-−±]?(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)(?:[eE][+\\-−]?\\d+)?';
const superscript = '[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+';
const exponent = `(?:\\^[+\\-−]?\\d+|${superscript})`;
const scaled = `${number}(?:${hspace}[×·]${hspace}10${exponent})?`;
const value = `${scaled}(?:${hspace}(?:±|[–−-]|/|:)${hspace}${scaled})?`;
const unitNames = ['kg','mg','µg','μg','g','t','Mg','Gt','ha','km','cm','mm','µm','μm','nm','m','s','ms','min','h','d','days','day','yr','years','year','L','mL','mol','mmol','µmol','μmol','K','Pa','kPa','MPa','W','kW','MW','J','kJ','MJ','Hz','kHz','MHz','GHz','°C','°F','°N','°S','°E','°W','°','个百分点','个月','小时','分钟','样方','站点','样本','年','月','天','秒','周','县','项','个','次','篇','组'];
const unitName = `(?:${unitNames.sort((a,b)=>b.length-a.length).join('|')})`;
const unit = `${unitName}(?:\\^[+\\-−]?\\d+|[−-]\\d+|${superscript}|[23])?`;
const unitSequence = `${unit}(?:(?:${hspace}[/·⋅]${hspace}|[ \\t\\u00a0\\u202f]+)${unit})*(?![A-Za-zµμ])`;
const measurement = `${value}(?:${hspace}(?:[%％‰]|${unitSequence}))?`;
const letters = '[A-Za-z\\u0370-\\u03ff]';
const script = `(?:_[A-Za-z0-9]+|_\\{[A-Za-z0-9+−-]+\\}|\\^[A-Za-z0-9+−-]+|\\^\\{[A-Za-z0-9+−-]+\\}|[₀₁₂₃₄₅₆₇₈₉₊₋ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]+|${superscript})`;
const identifier = `${letters}[A-Za-z0-9\\u0370-\\u03ff]*(?:${script})*`;
const scriptedIdentifier = `${letters}[A-Za-z0-9\\u0370-\\u03ff]*(?:${script})+`;
const expression = `${identifier}${hspace}(?:[=<>≤≥≈≠])${hspace}${measurement}`;
const scientific = `${expression}|${scriptedIdentifier}|${measurement}`;
const tokens = new RegExp(`(?<scientific>${scientific})|(?<word>[A-Za-z0-9]+(?:[.'’:/+%−–-][A-Za-z0-9]+)*)|(?<space>\\s+)|(?<glyph>[^A-Za-z0-9\\s])`, 'gu');

export function scientificTextTokens(value) {
  return [...String(value ?? '').matchAll(tokens)].map(match => ({
    text:match[0], atomic:match.groups.scientific !== undefined,
  }));
}

export function glueTextPunctuation(tokens) {
  const closing=/^[，。！？；：、）》〉」』】〕）］｝’”….,!?;:\])}%％]+$/u;
  const opening=/^[（(［\[｛{《〈「『【〔‘“]+$/u;
  const out=[];let prefix={text:'',atomic:false};
  const merge=parts=>({text:parts.map(p=>p.text).join(''),atomic:parts.some(p=>p.atomic)});
  for(const token of tokens){
    if(out.length&&(/^[\p{Mark}\ufe00-\ufe0f\u200d]+$/u.test(token.text)||out.at(-1).text.endsWith('\u200d'))){out[out.length-1]=merge([out.at(-1),token]);continue;}
    if(opening.test(token.text)){prefix=merge([prefix,token]);continue;}
    const chunk=merge([prefix,token]);prefix={text:'',atomic:false};
    if(closing.test(token.text)&&out.length){
      let from=out.length-1;while(from>0&&/^\s+$/u.test(out[from].text))from--;
      out.push(merge([...out.splice(from),chunk]));
    }else out.push(chunk);
  }
  if(prefix.text)out.push(prefix);
  return out;
}

/** Review only; never delete copy, rewrite a value, or silently reduce size. */
export function scientificWrappingIssues(value, lines, width, size, measure, options={}) {
  const issues=[], seen=new Set();
  for(const paragraph of String(value??'').replace(/\r\n?/g,'\n').split('\n')){
    for(const token of glueTextPunctuation(scientificTextTokens(paragraph))){
      if(!token.atomic||measure(token.text,size,options)<=width+1e-9||seen.has(token.text))continue;
      seen.add(token.text);
      issues.push({severity:'error',code:'scientific-token-too-wide',token:token.text,
        requiredWidth:Math.ceil(measure(token.text,size,options)),availableWidth:width,
        message:`科研语义单元“${token.text}”无法完整放入当前宽度。扩大文字框或数值列、重排单位与条件，不能拆断数字、变量或缩小字号。`});
    }
  }
  const clean=lines.map(line=>String(line).trim()),last=clean.at(-1)||'',previous=clean.at(-2)||'';
  if(clean.length>1&&/\p{Script=Han}/u.test(last)&&[...last.replace(/[\s\p{P}]/gu,'')].length<=2&&[...previous.replace(/[\s\p{P}]/gu,'')].length>=6){
    issues.push({severity:'warning',code:'text-short-last-line',message:'末行仅剩一两个汉字。检查是否出现断词或孤行，优先精简重复文案、调整区域或语义断行；不要为消除提醒删去必要限定。'});
  }
  if(clean.some(line=>/^[，。！？；：、）》〉」』】〕）］｝’”….,!?;:\])}%％]/u.test(line)||/[（(［\[｛{《〈「『【〔‘“]$/u.test(line))){
    issues.push({severity:'warning',code:'text-punctuation-break',message:'行首或行尾出现不合适的标点断行。核对显式换行与实际字形，按完整短语重排，不改变科研数值。'});
  }
  return issues;
}
