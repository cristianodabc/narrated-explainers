const W = 1280, H = 720;
const C = {ink: '#233746', blue: '#2879a5', orange: '#dc7546', green: '#4b956e', pale: '#f4f7f6', paper: '#fffefa'};
const font = 'Chalkboard SE, Marker Felt, Trebuchet MS, Arial, sans-serif';
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const show = (t, at, length = .7) => ease((t - at) / length);
export const escapeXml = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

function path(points, p, color = C.ink, width = 5) {
  p = clamp(p);
  if (!p) return '';
  const lengths = points.slice(1).map((q, i) => Math.hypot(q[0] - points[i][0], q[1] - points[i][1]));
  let left = lengths.reduce((a, b) => a + b, 0) * p;
  const visible = [points[0]];
  for (let i = 0; i < lengths.length; i++) {
    if (left >= lengths[i]) { visible.push(points[i + 1]); left -= lengths[i]; }
    else { const f = lengths[i] ? left / lengths[i] : 0; visible.push([points[i][0] + (points[i + 1][0] - points[i][0]) * f, points[i][1] + (points[i + 1][1] - points[i][1]) * f]); break; }
  }
  return `<path d="M ${visible.map(([x,y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function rect(x, y, w, h, p, color = C.ink, sw = 5) { return path([[x+7,y],[x+w-5,y+2],[x+w,y+h-6],[x+3,y+h],[x,y+5],[x+7,y]],p,color,sw); }
function circle(x, y, rx, ry, p, color = C.ink, sw = 5) { return path(Array.from({length: 51}, (_,i) => { const a = -Math.PI/2+i*Math.PI*2/50; return [x+Math.cos(a)*rx,y+Math.sin(a)*ry]; }),p,color,sw); }
function arrow(x1,y1,x2,y2,p,color=C.ink) { const a=Math.atan2(y2-y1,x2-x1),s=16; return path([[x1,y1],[x2,y2],[x2-Math.cos(a-.65)*s,y2-Math.sin(a-.65)*s],[x2,y2],[x2-Math.cos(a+.65)*s,y2-Math.sin(a+.65)*s]],p,color); }
function text(x,y,value,size=30,color=C.ink,p=1,anchor='middle',weight=500,maxChars) {
  if (p<=0) return '';
  const words=String(value).split(/\s+/); const lines=[]; let line='';
  const max = maxChars ?? (size >= 45 ? 26 : size >= 30 ? 22 : 30);
  for (const word of words) { if (`${line} ${word}`.trim().length > max && line) { lines.push(line); line=word; } else line=`${line} ${word}`.trim(); }
  if (line) lines.push(line);
  return `<text x="${x}" y="${y-(lines.length-1)*size*.55}" fill="${color}" font-family="${font}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" opacity="${clamp(p).toFixed(2)}">${lines.map((part,i)=>`<tspan x="${x}" dy="${i ? size*1.15 : 0}">${escapeXml(part)}</tspan>`).join('')}</text>`;
}
function box(x,y,w,h,label,t,at,color=C.ink,size=31) { return rect(x,y,w,h,show(t,at,.8),color)+text(x+w/2,y+h/2+size/3,label,size,color,show(t,at+.5,.6)); }

function visual(type, labels, t, title) {
  const [a,b,c]=labels;
  if (type==='intro') return rect(110,234,1060,294,show(t,.4,1.2),C.ink)
    + text(640,282,title,Math.max(25,Math.min(38,1050/(title.length*.56))),C.blue,show(t,1.2,.7),'middle',500,100)
    + circle(287,400,105,87,show(t,1.8,1),C.orange)
    + text(287,407,a,29,C.orange,show(t,2.5,.5))
    + arrow(407,400,491,400,show(t,3.2,.6))
    + box(505,333,220,136,b,t,3.7,C.green,29)
    + arrow(743,400,839,400,show(t,4.8,.6))
    + box(855,333,220,136,c,t,5.3,C.blue,29);
  if (type==='flow') return box(90,282,288,154,a,t,.7,C.blue)
    + arrow(392,359,479,359,show(t,2,.8),C.ink)
    + box(495,282,288,154,b,t,2.8,C.orange)
    + arrow(800,359,886,359,show(t,4,.8),C.ink)
    + box(902,282,288,154,c,t,4.8,C.green);
  if (type==='cards') return [a,b,c].map((label,i)=> {
    const x=100+i*365, col=[C.blue,C.orange,C.green][i],at=.7+i*1.4;
    return rect(x,258,335,210,show(t,at,.9),col)+circle(x+167,322,30,30,show(t,at+.45,.6),col,4)+text(x+167,410,label,30,col,show(t,at+.8,.6));
  }).join('');
  if (type==='focus') return circle(640,364,151,116,show(t,.7,1),C.orange)
    + text(640,373,a,36,C.orange,show(t,1.5,.6))
    + arrow(479,362,353,362,show(t,2.2,.7),C.ink)
    + box(83,299,256,126,b,t,3,C.blue,29)
    + arrow(802,362,926,362,show(t,4.1,.7),C.ink)
    + box(941,299,256,126,c,t,4.9,C.green,29);
  return rect(114,233,1052,292,show(t,.6,1),C.ink)
    + [a,b,c].map((label,i)=>box(147+i*338,312,305,126,label,t,1.8+i*1.4,[C.blue,C.orange,C.green][i],29)).join('')
    + text(640,557,title,34,C.ink,show(t,6.4,.6));
}

export function renderSvg(story, scene, index, seconds, duration) {
  const t=seconds*8/Math.max(duration-1,8);
  const progress=W*(index+clamp(seconds/duration))/story.scenes.length;
  const headingSize=Math.max(35,Math.min(53,1050/(scene.title.length*.56)));
  const heading=text(76,139,scene.title,headingSize,C.ink,show(t,.15,.6),'start',600,100);
  const underline=path([[76,158],[Math.min(1120,90+scene.title.length*24),158]],show(t,.6,.8),C.orange);
  const captionSize=Math.max(23,Math.min(32,1100/(scene.caption.length*.56)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.paper}"/><rect x="0" y="0" width="${progress.toFixed(1)}" height="8" fill="${C.blue}"/>${text(76,62,`${story.title.toUpperCase()}  /  ${String(index+1).padStart(2,'0')}`,24,C.blue,1,'start',600,100)}${heading}${underline}${visual(scene.visual.type,scene.visual.labels,t,story.title)}<rect x="0" y="620" width="1280" height="100" fill="${C.pale}"/>${text(74,679,scene.caption,captionSize,C.ink,show(t,.45,.5),'start',500,100)}</svg>`;
}
