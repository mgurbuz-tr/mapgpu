import{L as b,M as _,R as P,a as F,l as I}from"./index-CCIhYy9t.js";class T extends b{type="custom-shader";vertexShader;fragmentShader;vertexBufferLayouts;animated;rawMode;blendState;_vertexBuffers=[];_indexBuffer=null;_indexFormat="uint32";_customUniforms=null;_textures=[];_drawParams={};_topology;constructor(e){super(e),this.vertexShader=e.vertexShader,this.fragmentShader=e.fragmentShader,this.vertexBufferLayouts=e.vertexBufferLayouts,this.animated=e.animated??!1,this.rawMode=e.rawMode??!1,this.blendState=e.blendState,this._topology=e.topology??"triangle-list"}setVertexBuffer(e,a){this._vertexBuffers[e]=a}setIndexBuffer(e,a="uint32"){this._indexBuffer=e,this._indexFormat=a}setCustomUniforms(e){this._customUniforms=e instanceof Float32Array?e.buffer:e}setTexture(e,a){this._textures=[{texture:e,sampler:a}]}setDrawParams(e){this._drawParams=e}requestRender(){this.eventBus.emit("refresh",void 0)}getVertexBuffers(){return this._vertexBuffers}getIndexBuffer(){return this._indexBuffer}getCustomUniforms(){return this._customUniforms}getTextures(){return this._textures}getDrawCommand(){return{topology:this._topology,vertexCount:this._drawParams.vertexCount,instanceCount:this._drawParams.instanceCount,indexCount:this._drawParams.indexCount,indexFormat:this._indexBuffer?this._indexFormat:void 0}}async onLoad(){}}const U=`
struct CustomUniforms {
  halfWidth: f32,
  trailSpeed: f32,
  trailLength: f32,
  trailCycle: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) vColor: vec4<f32>,
  @location(1) vDistSide: vec2<f32>,
};

@vertex fn vs_main(
  @location(0) position: vec2<f32>,
  @location(1) offset: vec2<f32>,
  @location(2) distSide: vec2<f32>,
  @location(3) color: vec4<f32>,
) -> VertexOutput {
  var out: VertexOutput;

  // Project center position to clip space (works in both 2D and 3D/globe)
  let clipCenter = projectMercator(position);

  // Guard: if w <= 0 the vertex is behind the camera — collapse it.
  // Place at screen center (inside clip volume) with extreme side value
  // so edgeFade → 0 → alpha → 0 → discard in fragment shader.
  // Previously used vec4(0,0,2,1) which is BEYOND the far clip plane.
  // GPU clipped triangles at z=1, creating large screen-filling triangles
  // with dark interpolated vColor — the "black overlay" root cause.
  if (clipCenter.w < 0.0001) {
    out.position = vec4<f32>(0.0, 0.0, 0.5, 1.0);
    out.vColor = vec4<f32>(0.0);
    out.vDistSide = vec2<f32>(0.0, 100.0);
    return out;
  }

  // Project a nearby offset point to find screen-space normal direction
  let clipOffset = projectMercator(position + offset * 50000.0);

  // Guard: offset projection invalid — collapse extrusion to zero width
  // at the valid center position (degenerate triangle, near-zero area)
  if (clipOffset.w < 0.0001) {
    out.position = vec4<f32>(clipCenter.xy, clipCenter.z, clipCenter.w);
    out.vColor = color;
    out.vDistSide = vec2<f32>(distSide.x, 100.0);
    return out;
  }

  // Screen-space normal direction
  let screenCenter = clipCenter.xy / clipCenter.w;
  let screenOffset = clipOffset.xy / clipOffset.w;
  let rawDir = (screenOffset - screenCenter) * camera.viewport;
  let rawLen = length(rawDir);

  // Guard against degenerate direction (sub-pixel offset at low zoom)
  var screenDir: vec2<f32>;
  if (rawLen > 0.001) {
    screenDir = (rawDir / rawLen) / camera.viewport * custom.halfWidth * 2.0;
  } else {
    screenDir = vec2<f32>(0.0, 0.0);
  }

  let finalXY = clipCenter.xy + screenDir * clipCenter.w * distSide.y;

  // Final NaN safety: collapse to valid center position with extreme side
  if (!(finalXY.x == finalXY.x) || !(finalXY.y == finalXY.y) ||
      !(clipCenter.z == clipCenter.z) || !(clipCenter.w == clipCenter.w)) {
    out.position = vec4<f32>(clipCenter.xy, clipCenter.z, clipCenter.w);
    out.vColor = vec4<f32>(0.0);
    out.vDistSide = vec2<f32>(0.0, 100.0);
    return out;
  }

  out.position = vec4<f32>(finalXY, clipCenter.z, clipCenter.w);
  out.vColor = color;
  out.vDistSide = distSide;
  return out;
}
`,O=`
@fragment fn fs_main(
  @location(0) vColor: vec4<f32>,
  @location(1) vDistSide: vec2<f32>,
) -> @location(0) vec4<f32> {
  let dist = vDistSide.x;
  let side = vDistSide.y;

  // Trail animation: repeating pattern along distance
  let trailPos = dist - frame.time * custom.trailSpeed;
  let phase = trailPos - custom.trailCycle * floor(trailPos / custom.trailCycle);

  // Trail brightness: bright at head, fading tail
  let headFactor = 1.0 - smoothstep(0.0, custom.trailLength, phase);

  // Edge softness: fade at line edges
  let edgeFade = exp(-abs(side) * 3.0);

  // Combine — vColor.a gates guard vertices (interpolated → 0 near guards)
  let alpha = min(headFactor * edgeFade * frame.opacity * vColor.a, 0.85);

  // Discard transparent fragments (threshold raised from 0.002 for guard cleanup)
  if (alpha < 0.01 || !(alpha == alpha)) {
    discard;
  }

  // Premultiplied alpha output
  return vec4<f32>(vColor.rgb * alpha, alpha);
}
`,E=[{name:"Istanbul",lonLat:[29,41.01]},{name:"Ankara",lonLat:[32.85,39.92]},{name:"Izmir",lonLat:[27.14,38.42]},{name:"Antalya",lonLat:[30.71,36.89]},{name:"Trabzon",lonLat:[39.72,41]},{name:"Adana",lonLat:[35.33,37]},{name:"Bursa",lonLat:[29.06,40.19]},{name:"Konya",lonLat:[32.49,37.87]},{name:"Samsun",lonLat:[36.33,41.29]},{name:"Diyarbakir",lonLat:[40.22,37.91]},{name:"Kayseri",lonLat:[35.48,38.73]},{name:"Eskisehir",lonLat:[30.52,39.78]}];function R(){const n=E[Math.floor(Math.random()*E.length)];let e=n;for(;e===n;)e=E[Math.floor(Math.random()*E.length)];const a=5+Math.floor(Math.random()*10),f=[];for(let l=0;l<a;l++){const c=l/(a-1),r=n.lonLat[0]+(e.lonLat[0]-n.lonLat[0])*c+(Math.random()-.5)*1.5,d=n.lonLat[1]+(e.lonLat[1]-n.lonLat[1])*c+(Math.random()-.5)*1,[u,m]=I(r,d);f.push([u,m])}return f}function z(){const e=Math.random()*6,a=Math.max(0,Math.min(255,Math.round((Math.abs(e-3)-1)*255))),f=Math.max(0,Math.min(255,Math.round((2-Math.abs(e-2))*255))),l=Math.max(0,Math.min(255,Math.round((2-Math.abs(e-4))*255)));return[a,f,l,255]}const D=28,A=7;function V(n,e){let a=0,f=0;for(const h of n)h.length<2||(a+=h.length*2,f+=(h.length-1)*6);const l=new ArrayBuffer(a*D),c=new Float32Array(l),r=new Uint8Array(l),d=new Uint32Array(f);let u=0,m=0;for(let h=0;h<n.length;h++){const x=n[h],t=e[h];if(x.length<2)continue;let B=0;const S=u;for(let s=0;s<x.length;s++){const[w,C]=x[s];let y=0,p=0;if(s<x.length-1){const[v,o]=x[s+1],i=v-w,g=o-C,L=Math.sqrt(i*i+g*g);L>0&&(y+=-g/L,p+=i/L)}if(s>0){const[v,o]=x[s-1],i=w-v,g=C-o,L=Math.sqrt(i*i+g*g);L>0&&(y+=-g/L,p+=i/L),B+=Math.sqrt((w-v)*(w-v)+(C-o)*(C-o))}const M=Math.sqrt(y*y+p*p);M>0&&(y/=M,p/=M);for(const v of[1,-1]){const o=u*A;c[o+0]=w,c[o+1]=C,c[o+2]=y,c[o+3]=p,c[o+4]=B,c[o+5]=v;const i=u*D+24;r[i+0]=t[0],r[i+1]=t[1],r[i+2]=t[2],r[i+3]=t[3],u++}if(s>0){const v=S+(s-1)*2,o=S+(s-1)*2+1,i=S+s*2,g=S+s*2+1;d[m++]=v,d[m++]=o,d[m++]=i,d[m++]=o,d[m++]=g,d[m++]=i}}}return{vertexData:l,indexData:d,vertexCount:u,indexCount:m}}async function G(){const n=new P,e=new _({container:"#map-container",mode:"2d",center:[32,39.5],zoom:6,renderEngine:n});await e.when();const a=new F({id:"osm",urlTemplate:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",minZoom:0,maxZoom:19,opacity:1});await a.load(),e.map.add(a),e.switchTo("3d");let f=parseInt(document.getElementById("slider-count").value),l=parseFloat(document.getElementById("slider-width").value),c=parseFloat(document.getElementById("slider-speed").value);const r=new T({id:"animated-lines",vertexShader:U,fragmentShader:O,vertexBufferLayouts:[{arrayStride:D,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"},{shaderLocation:2,offset:16,format:"float32x2"},{shaderLocation:3,offset:24,format:"unorm8x4"}]}],animated:!0,topology:"triangle-list",blendState:{color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}});await r.load();function d(){const t=[],B=[];for(let p=0;p<f;p++)t.push(R()),B.push(z());const{vertexData:S,indexData:s,indexCount:w}=V(t,B),C=n.createBuffer(new Float32Array(S),GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST),y=n.createBuffer(s,GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST);r.setVertexBuffer(0,C),r.setIndexBuffer(y,"uint32"),r.setDrawParams({indexCount:w})}function u(){const t=new Float32Array(4);t[0]=l,t[1]=c*1e3,t[2]=2e5,t[3]=8e5,r.setCustomUniforms(t)}d(),u(),e.map.add(r);const m=document.getElementById("val-count"),h=document.getElementById("val-width"),x=document.getElementById("val-speed");document.getElementById("slider-count").addEventListener("input",t=>{f=parseInt(t.target.value),m.textContent=String(f),d(),r.requestRender()}),document.getElementById("slider-width").addEventListener("input",t=>{l=parseFloat(t.target.value),h.textContent=String(l),u(),r.requestRender()}),document.getElementById("slider-speed").addEventListener("input",t=>{c=parseFloat(t.target.value),x.textContent=String(c),u(),r.requestRender()}),document.getElementById("btn-istanbul").addEventListener("click",()=>{e.goTo({center:[29,41.01],zoom:8,duration:1e3})}),document.getElementById("btn-ankara").addEventListener("click",()=>{e.goTo({center:[32.85,39.92],zoom:8,duration:1e3})}),e.on("frame",({fps:t})=>{document.title=`Animated Lines — ${t.toFixed(0)} FPS`})}G().catch(console.error);
