import{L as I,M as A,R as T,a as U,l as R}from"./index-vHIG8pf8.js";/* empty css              */class O extends I{type="custom-shader";vertexShader;fragmentShader;vertexBufferLayouts;animated;rawMode;blendState;_vertexBuffers=[];_indexBuffer=null;_indexFormat="uint32";_customUniforms=null;_textures=[];_drawParams={};_topology;constructor(e){super(e),this.vertexShader=e.vertexShader,this.fragmentShader=e.fragmentShader,this.vertexBufferLayouts=e.vertexBufferLayouts,this.animated=e.animated??!1,this.rawMode=e.rawMode??!1,this.blendState=e.blendState,this._topology=e.topology??"triangle-list"}setVertexBuffer(e,r){this._vertexBuffers[e]=r}setIndexBuffer(e,r="uint32"){this._indexBuffer=e,this._indexFormat=r}setCustomUniforms(e){this._customUniforms=e instanceof Float32Array?e.buffer:e}setTexture(e,r){this._textures=[{texture:e,sampler:r}]}setDrawParams(e){this._drawParams=e}requestRender(){this.eventBus.emit("refresh",void 0)}getVertexBuffers(){return this._vertexBuffers}getIndexBuffer(){return this._indexBuffer}getCustomUniforms(){return this._customUniforms}getTextures(){return this._textures}getDrawCommand(){return{topology:this._topology,vertexCount:this._drawParams.vertexCount,instanceCount:this._drawParams.instanceCount,indexCount:this._drawParams.indexCount,indexFormat:this._indexBuffer?this._indexFormat:void 0}}async onLoad(){}}function E(n){const e=document.getElementById("log"),r=new Date().toLocaleTimeString("en-GB",{hour12:!1}),a=document.createElement("div");a.className="entry",a.innerHTML=`<span class="time">${r}</span> ${n}`,e.appendChild(a),e.scrollTop=e.scrollHeight,console.log(`[animated-lines] ${n}`)}const z=`
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
`,V=`
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
`,M=[{name:"Istanbul",lonLat:[29,41.01]},{name:"Ankara",lonLat:[32.85,39.92]},{name:"Izmir",lonLat:[27.14,38.42]},{name:"Antalya",lonLat:[30.71,36.89]},{name:"Trabzon",lonLat:[39.72,41]},{name:"Adana",lonLat:[35.33,37]},{name:"Bursa",lonLat:[29.06,40.19]},{name:"Konya",lonLat:[32.49,37.87]},{name:"Samsun",lonLat:[36.33,41.29]},{name:"Diyarbakir",lonLat:[40.22,37.91]},{name:"Kayseri",lonLat:[35.48,38.73]},{name:"Eskisehir",lonLat:[30.52,39.78]}];function _(){const n=M[Math.floor(Math.random()*M.length)];let e=n;for(;e===n;)e=M[Math.floor(Math.random()*M.length)];const r=5+Math.floor(Math.random()*10),a=[];for(let d=0;d<r;d++){const f=d/(r-1),o=n.lonLat[0]+(e.lonLat[0]-n.lonLat[0])*f+(Math.random()-.5)*1.5,u=n.lonLat[1]+(e.lonLat[1]-n.lonLat[1])*f+(Math.random()-.5)*1,[m,h]=R(o,u);a.push([m,h])}return a}function F(){const e=Math.random()*6,r=Math.max(0,Math.min(255,Math.round((Math.abs(e-3)-1)*255))),a=Math.max(0,Math.min(255,Math.round((2-Math.abs(e-2))*255))),d=Math.max(0,Math.min(255,Math.round((2-Math.abs(e-4))*255)));return[r,a,d,255]}const b=28,G=7;function P(n,e){let r=0,a=0;for(const p of n)p.length<2||(r+=p.length*2,a+=(p.length-1)*6);const d=new ArrayBuffer(r*b),f=new Float32Array(d),o=new Uint8Array(d),u=new Uint32Array(a);let m=0,h=0;for(let p=0;p<n.length;p++){const C=n[p],t=e[p];if(C.length<2)continue;let v=0;const s=m;for(let i=0;i<C.length;i++){const[w,S]=C[i];let L=0,g=0;if(i<C.length-1){const[x,l]=C[i+1],c=x-w,y=l-S,B=Math.sqrt(c*c+y*y);B>0&&(L+=-y/B,g+=c/B)}if(i>0){const[x,l]=C[i-1],c=w-x,y=S-l,B=Math.sqrt(c*c+y*y);B>0&&(L+=-y/B,g+=c/B),v+=Math.sqrt((w-x)*(w-x)+(S-l)*(S-l))}const D=Math.sqrt(L*L+g*g);D>0&&(L/=D,g/=D);for(const x of[1,-1]){const l=m*G;f[l+0]=w,f[l+1]=S,f[l+2]=L,f[l+3]=g,f[l+4]=v,f[l+5]=x;const c=m*b+24;o[c+0]=t[0],o[c+1]=t[1],o[c+2]=t[2],o[c+3]=t[3],m++}if(i>0){const x=s+(i-1)*2,l=s+(i-1)*2+1,c=s+i*2,y=s+i*2+1;u[h++]=x,u[h++]=l,u[h++]=c,u[h++]=l,u[h++]=y,u[h++]=c}}}return{vertexData:d,indexData:u,vertexCount:m,indexCount:h}}async function X(){E("Initializing animated lines demo...");const n=new T,e=new A({container:"#map-container",mode:"2d",center:[32,39.5],zoom:6,renderEngine:n});await e.when(),E("MapView ready, GPU initialized");const r=new U({id:"osm",urlTemplate:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",minZoom:0,maxZoom:19,opacity:1});await r.load(),e.map.add(r),e.switchTo("3d"),E("Base map loaded");let a=parseInt(document.getElementById("slider-count").value),d=parseFloat(document.getElementById("slider-width").value),f=parseFloat(document.getElementById("slider-speed").value);const o=new O({id:"animated-lines",vertexShader:z,fragmentShader:V,vertexBufferLayouts:[{arrayStride:b,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"},{shaderLocation:2,offset:16,format:"float32x2"},{shaderLocation:3,offset:24,format:"unorm8x4"}]}],animated:!0,topology:"triangle-list",blendState:{color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}});await o.load();function u(){const t=[],v=[];for(let g=0;g<a;g++)t.push(_()),v.push(F());const{vertexData:s,indexData:i,indexCount:w}=P(t,v),S=n.createBuffer(new Float32Array(s),GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST),L=n.createBuffer(i,GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST);o.setVertexBuffer(0,S),o.setIndexBuffer(L,"uint32"),o.setDrawParams({indexCount:w}),E(`Geometry: ${a} lines, ${w} indices`)}function m(){const t=new Float32Array(4);t[0]=d,t[1]=f*1e3,t[2]=2e5,t[3]=8e5,o.setCustomUniforms(t)}u(),m();{const t=P(Array.from({length:a},()=>_()),Array.from({length:a},()=>F())),v=new Float32Array(t.vertexData);console.log("[CP1-GEOM]",{lineCount:a,vertexCount:t.vertexCount,indexCount:t.indexCount,vertexFirst10:Array.from(v.slice(0,10)),indexFirst6:Array.from(t.indexData.slice(0,6)),hasNaN:Array.from(v.slice(0,Math.min(v.length,200))).some(i=>!Number.isFinite(i))});const s=new Float32Array(4);s[0]=d,s[1]=f*1e3,s[2]=2e5,s[3]=8e5,console.log("[CP1-UNIF]",{halfWidth:s[0],trailSpeed:s[1],trailLength:s[2],trailCycle:s[3]}),console.log("[CP1-LAYER]",{opacity:o.opacity,blendState:o.blendState,animated:o.animated,topology:o.topology??"default"})}e.map.add(o),E(`Animated lines layer added — ${a} polylines`);const h=document.getElementById("val-count"),p=document.getElementById("val-width"),C=document.getElementById("val-speed");document.getElementById("slider-count").addEventListener("input",t=>{a=parseInt(t.target.value),h.textContent=String(a),u(),o.requestRender()}),document.getElementById("slider-width").addEventListener("input",t=>{d=parseFloat(t.target.value),p.textContent=String(d),m(),o.requestRender()}),document.getElementById("slider-speed").addEventListener("input",t=>{f=parseFloat(t.target.value),C.textContent=String(f),m(),o.requestRender()}),document.getElementById("btn-istanbul").addEventListener("click",()=>{e.goTo({center:[29,41.01],zoom:8,duration:1e3})}),document.getElementById("btn-ankara").addEventListener("click",()=>{e.goTo({center:[32.85,39.92],zoom:8,duration:1e3})}),e.on("frame",({fps:t})=>{document.title=`Animated Lines — ${t.toFixed(0)} FPS`}),E("Demo ready — polylines animating!")}X().catch(n=>{E(`ERROR: ${n instanceof Error?n.message:String(n)}`),console.error(n)});
