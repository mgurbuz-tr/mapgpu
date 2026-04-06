import{l as ie,m as ne,b as le,W as se,c as ce,d as ue,e as fe}from"./index-D94mbQcn.js";const B=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];function H(t){return{min:[t.min[0],t.min[1],t.min[2]],max:[t.max[0],t.max[1],t.max[2]]}}function S(t){return Object.is(t,-0)?0:t}function R(){return{min:[1/0,1/0,1/0],max:[-1/0,-1/0,-1/0]}}function U(t,e){e[0]<t.min[0]&&(t.min[0]=e[0]),e[1]<t.min[1]&&(t.min[1]=e[1]),e[2]<t.min[2]&&(t.min[2]=e[2]),e[0]>t.max[0]&&(t.max[0]=e[0]),e[1]>t.max[1]&&(t.max[1]=e[1]),e[2]>t.max[2]&&(t.max[2]=e[2])}function z(t){return Number.isFinite(t.min[0])?(t.min[0]=S(t.min[0]),t.min[1]=S(t.min[1]),t.min[2]=S(t.min[2]),t.max[0]=S(t.max[0]),t.max[1]=S(t.max[1]),t.max[2]=S(t.max[2]),t):{min:[0,0,0],max:[0,0,0]}}function me(t){return[t[0],-t[2],t[1]]}function $(t){const e=t.min[0],o=t.min[1],i=t.min[2],l=t.max[0],a=t.max[1],n=t.max[2];return[[e,o,i],[l,o,i],[l,a,i],[e,a,i],[e,o,n],[l,o,n],[l,a,n],[e,a,n]]}function pe(t){const e=Math.hypot(t[0],t[1],t[2],t[3])||1;return[t[0]/e,t[1]/e,t[2]/e,t[3]/e]}function de(t,e,o){const[i,l,a,n]=pe(e),s=i+i,c=l+l,r=a+a,u=i*s,f=i*c,m=i*r,p=l*c,d=l*r,h=a*r,v=n*s,g=n*c,b=n*r,x=1-(p+h),y=f-b,w=m+g,T=f+b,O=1-(u+h),D=d-v,E=m-g,V=d+v,I=1-(u+p);return new Float32Array([x*o[0],T*o[0],E*o[0],0,y*o[1],O*o[1],V*o[1],0,w*o[2],D*o[2],I*o[2],0,t[0],t[1],t[2],1])}function oe(t,e){return[t[0]*e[0]+t[4]*e[1]+t[8]*e[2]+t[12],t[1]*e[0]+t[5]*e[1]+t[9]*e[2]+t[13],t[2]*e[0]+t[6]*e[1]+t[10]*e[2]+t[14]]}function he(t){const e=t[0],o=t[4],i=t[8],l=t[1],a=t[5],n=t[9],s=t[2],c=t[6],r=t[10],u=r*a-n*c,f=-r*l+n*s,m=c*l-a*s;let p=e*u+o*f+i*m;if(Math.abs(p)<1e-8)return new Float32Array(B);p=1/p;const d=u*p,h=(-r*o+i*c)*p,v=(n*o-i*a)*p,g=f*p,b=(r*e-i*s)*p,x=(-n*e+i*l)*p,y=m*p,w=(-c*e+o*s)*p,T=(a*e-o*l)*p;return new Float32Array([d,h,v,0,g,b,x,0,y,w,T,0,0,0,0,1])}function q(t,e,o,i){t.set(o,e),t.set(i,e+16)}function k(t,e,o,i){const l=t.map((r,u)=>de(e[u]??r.translation,o[u]??r.rotation,i[u]??r.scale)),a=t.map(()=>new Float32Array(B)),n=t.map(()=>new Float32Array(B)),s=new Array(t.length).fill(!1),c=r=>{if(s[r])return;const u=t[r],f=l[r];u.parentIndex===null||u.parentIndex<0?a[r]=f:(c(u.parentIndex),a[r]=le(a[u.parentIndex],f)),n[r]=he(a[r]),s[r]=!0};for(let r=0;r<t.length;r++)c(r);return{worldMatrices:a,normalMatrices:n}}function j(t,e){const o=R();for(const i of t){const l=i.nodeIndex===null?B:e[i.nodeIndex]??B;for(const a of $(i.bounds))U(o,me(oe(l,a)))}return z(o)}function Q(t,e,o,i){const l=H(t),a=H(e);return{localBounds:H(a),restLocalBounds:l,currentLocalBounds:a,groundAnchorLocalZ:-a.min[2],restGroundAnchorLocalZ:-l.min[2],currentGroundAnchorLocalZ:-a.min[2],units:"meters",localAxes:"east-north-up",isAnimated:o,hasHierarchy:i}}function W(t){return t*Math.PI/180}function ge(t,e,o,i,l,a){const n=W(i),s=W(l),c=W(a),r=Math.cos(n),u=Math.sin(n),f=Math.cos(s),m=Math.sin(s),p=Math.cos(c),d=Math.sin(c);return[r*f*t+(r*m*d-u*p)*e+(r*m*p+u*d)*o,u*f*t+(u*m*d+r*p)*e+(u*m*p-r*d)*o,-m*t+f*d*e+f*p*o]}function ve(t,e){const o=t.currentLocalBounds??t.localBounds,i=e.scale??1,l=e.heading??0,a=e.pitch??0,n=e.roll??0,s=e.anchorZ??0,[c,r,u]=e.coordinates,[f,m]=ie(c,r),p=$(o).map(g=>{const[b,x,y]=ge(g[0]*i,g[1]*i,g[2]*i,l,a,n),[w,T]=ne(f+b,m+x);return[w,T,u+s+y]}),d=R();for(const g of p)U(d,g);const h=[0,1,2,3,0].map(g=>p[g]),v=[4,5,6,7,4].map(g=>p[g]);return{cornersLonLatAlt:p,aabbLonLatAlt:z(d),footprint:h,topOutline:v}}const xe={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},be={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};function A(t,e,o){const i=be[t.type]??1,l=xe[t.componentType]??4,a=t.count*i;if(t.bufferView===void 0)return t.componentType===5126?new Float32Array(a):new Uint32Array(a);const n=e[t.bufferView],s=(n.byteOffset??0)+(t.byteOffset??0);if(n.byteStride&&n.byteStride>i*l){const u=new Float32Array(a);for(let f=0;f<t.count;f++){const m=s+f*n.byteStride;for(let p=0;p<i;p++){const d=new DataView(o.buffer,o.byteOffset+m+p*l,l);u[f*i+p]=t.componentType===5126?d.getFloat32(0,!0):d.getUint16(0,!0)}}return u}const c=a*l,r=new ArrayBuffer(c);switch(new Uint8Array(r).set(o.subarray(s,s+c)),t.componentType){case 5123:return new Uint16Array(r,0,a);case 5125:return new Uint32Array(r,0,a);default:return new Float32Array(r,0,a)}}function F(t){if(t instanceof Float32Array)return t;const e=new Float32Array(t.length);for(let o=0;o<t.length;o++)e[o]=t[o];return e}function ye(t,e,o,i){const l=[];for(const a of t.animations??[]){const n=[];for(const c of a.channels??[]){const r=a.samplers?.[c.sampler],u=c.target.node,f=c.target.path;if(!r||u===void 0||f!=="translation"&&f!=="rotation"&&f!=="scale")continue;const m=e[r.input],p=e[r.output];!m||!p||n.push({node:u,path:f,interpolation:r.interpolation??"LINEAR",input:F(A(m,o,i)),output:F(A(p,o,i))})}if(n.length===0)continue;let s=0;for(const c of n){const r=c.input[c.input.length-1]??0;r>s&&(s=r)}l.push({name:a.name,duration:s,channels:n})}return l}function Te(t,e,o,i){const l=e[t.attributes.POSITION],a=F(A(l,o,i)),n=l.count,s=R();for(let d=0;d<n;d++)U(s,[a[d*3],a[d*3+1],a[d*3+2]]);const c=t.attributes.NORMAL,r=c!==void 0?F(A(e[c],o,i)):(()=>{const d=new Float32Array(n*3);for(let h=0;h<n;h++)d[h*3+2]=1;return d})(),u=t.attributes.TEXCOORD_0,f=u!==void 0?F(A(e[u],o,i)):new Float32Array(n*2);let m,p;if(t.indices!==void 0){const d=A(e[t.indices],o,i);m=d instanceof Float32Array?new Uint32Array(d):d,p=e[t.indices].count}else{m=new Uint32Array(n);for(let d=0;d<n;d++)m[d]=d;p=n}return{positions:a,normals:r,texcoords:f,indices:m,vertexCount:n,indexCount:p,bounds:z(s)}}function _e(t,e,o,i,l){const a={baseColorFactor:[1,1,1,1],metallicFactor:1,roughnessFactor:1,doubleSided:!1,alphaMode:"OPAQUE",alphaCutoff:.5,unlit:!1,emissiveFactor:[0,0,0]};if(t===void 0||!e||!e[t])return a;const n=e[t],s=n.pbrMetallicRoughness,c=s?.baseColorFactor,r={baseColorFactor:c&&c.length>=4?[c[0],c[1],c[2],c[3]]:a.baseColorFactor,metallicFactor:s?.metallicFactor??a.metallicFactor,roughnessFactor:s?.roughnessFactor??a.roughnessFactor,doubleSided:n.doubleSided??!1,alphaMode:n.alphaMode??"OPAQUE",alphaCutoff:n.alphaCutoff??.5,unlit:n.extensions?.KHR_materials_unlit!==void 0,emissiveFactor:n.emissiveFactor&&n.emissiveFactor.length>=3?[n.emissiveFactor[0],n.emissiveFactor[1],n.emissiveFactor[2]]:[0,0,0]},u=f=>{if(f===void 0)return;const m=o.textures?.[f];if(!m||m.source===void 0)return;const p=o.images?.[m.source];if(p){if(p.bufferView!==void 0){const d=i[p.bufferView],h=d.byteOffset??0,v=new Uint8Array(d.byteLength);return v.set(l.subarray(h,h+d.byteLength)),{data:v,mimeType:p.mimeType??"image/png"}}if(p.uri?.startsWith("data:")){const[d,h]=p.uri.split(","),v=d?.match(/data:(.*?);/)?.[1]??"image/png",g=atob(h),b=new Uint8Array(g.length);for(let x=0;x<g.length;x++)b[x]=g.charCodeAt(x);return{data:b,mimeType:v}}}};return r.baseColorTexture=u(s?.baseColorTexture?.index),r.normalTexture=u(n.normalTexture?.index),r.metallicRoughnessTexture=u(s?.metallicRoughnessTexture?.index),r.occlusionTexture=u(n.occlusionTexture?.index),r.emissiveTexture=u(n.emissiveTexture?.index),r}function re(t,e){if(!t.meshes?.length)throw new Error("GLTF2: no meshes");const o=t.accessors??[],i=t.bufferViews??[],l=[],a=new Array((t.nodes??[]).length).fill(null);(t.nodes??[]).forEach((f,m)=>{for(const p of f.children??[])a[p]=m});const n=(t.nodes??[]).map((f,m)=>({name:f.name,mesh:f.mesh,translation:f.translation??[0,0,0],rotation:f.rotation??[0,0,0,1],scale:f.scale??[1,1,1],children:[...f.children??[]],parentIndex:a[m]??null})),s=ye(t,o,i,e),c=R(),{worldMatrices:r}=k(n,n.map(f=>f.translation),n.map(f=>f.rotation),n.map(f=>f.scale)),u=(f,m,p)=>{const d=t.meshes[f];for(const h of d.primitives){const v=Te(h,o,i,e),g=_e(h.material,t.materials,t,i,e),b=p===void 0?null:r[p]??null;for(const x of $(v.bounds)){const y=b?oe(b,x):x;U(c,y)}l.push({mesh:v,material:g,name:m?.name??d.name,nodeIndex:p})}};if(t.nodes?.length){const f=new Set;t.nodes.forEach((m,p)=>{m.mesh!==void 0&&(f.add(m.mesh),u(m.mesh,m,p))});for(let m=0;m<t.meshes.length;m++)f.has(m)||u(m)}else for(let f=0;f<t.meshes.length;f++)u(f);if(!l.length)throw new Error("GLTF2: no primitives");return{primitives:l,boundingBox:z(c),nodes:n,animations:s}}function J(t){const e=new DataView(t);if(e.getUint32(0,!0)!==1179937895)throw new Error("GLTF2: invalid GLB magic");if(e.getUint32(4,!0)!==2)throw new Error("GLTF2: unsupported version");let o=12;const i=e.getUint32(o,!0);o+=8;const l=JSON.parse(new TextDecoder().decode(new Uint8Array(t,o,i)));o+=i;let a=new Uint8Array(0);if(o+8<=t.byteLength){const n=e.getUint32(o,!0);o+=8,a=new Uint8Array(t,o,n)}return re(l,a)}function Me(t,e){const o=t;let i=0;for(const s of e)i+=s.byteLength;const l=new Uint8Array(i),a=[];let n=0;for(const s of e)a.push(n),l.set(new Uint8Array(s),n),n+=s.byteLength;if(o.bufferViews)for(const s of o.bufferViews)s.byteOffset=(s.byteOffset??0)+(a[s.buffer]??0),s.buffer=0;return re(o,l)}const K=`
${se}

struct ModelMaterial {
  baseColorFactor: vec4<f32>,
  tintColor: vec4<f32>,
  emissiveFactor: vec3<f32>,
  metallic: f32,
  roughness: f32,
  hasBaseColorTex: f32,
  hasNormalTex: f32,
  hasMetallicRoughnessTex: f32,
  hasOcclusionTex: f32,
  hasEmissiveTex: f32,
  alphaCutoff: f32,
  isUnlit: f32,
  nodeMatrix: mat4x4<f32>,
  nodeNormalMatrix: mat4x4<f32>,
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;
@group(1) @binding(1) var texSampler: sampler;
@group(1) @binding(2) var baseColorTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
@group(1) @binding(5) var occlusionTex: texture_2d<f32>;
@group(1) @binding(6) var emissiveTex: texture_2d<f32>;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) texcoord: vec2<f32>,
  @location(3) worldPos: vec3<f32>,
  @location(4) scaleHeading: vec2<f32>,
  @location(5) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTexcoord: vec2<f32>,
  @location(2) vWorldPos: vec3<f32>,
};

fn degreesToRadians(d: f32) -> f32 { return d * 3.14159265 / 180.0; }

fn eulerToRotationMatrix(heading: f32, pitch: f32, roll: f32) -> mat3x3<f32> {
  let h = degreesToRadians(heading);
  let p = degreesToRadians(pitch);
  let r = degreesToRadians(roll);
  let ch = cos(h); let sh = sin(h);
  let cp = cos(p); let sp = sin(p);
  let cr = cos(r); let sr = sin(r);
  return mat3x3<f32>(
    vec3<f32>(ch*cp, sh*cp, -sp),
    vec3<f32>(ch*sp*sr - sh*cr, sh*sp*sr + ch*cr, cp*sr),
    vec3<f32>(ch*sp*cr + sh*sr, sh*sp*cr - ch*sr, cp*cr),
  );
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let scale = input.scaleHeading.x;
  let heading = input.scaleHeading.y;
  let pitch = input.pitchRollAnchor.x;
  let roll = input.pitchRollAnchor.y;
  let anchorZ = input.pitchRollAnchor.z;

  let gltfPosition = (material.nodeMatrix * vec4<f32>(input.position, 1.0)).xyz;
  let gltfNormal = normalize((material.nodeNormalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
  // glTF assets are Y-up by convention; mapgpu's model symbol math expects Z-up.
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);
  let nodeNormal = normalize(vec3<f32>(gltfNormal.x, -gltfNormal.z, gltfNormal.y));
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let mercatorScale = mercatorMetersPerMeter(input.worldPos.y);
  let rotated = rotMat * (nodePosition * (scale * mercatorScale));
  let relativeOrigin = input.worldPos - camera.worldOrigin.xyz;
  let projectedWorldPos = relativeOrigin + vec3<f32>(rotated.x, rotated.y, 0.0);
  let heightMeters = input.worldPos.z + anchorZ + rotated.z / max(mercatorScale, 0.01);
  let worldPos = vec3<f32>(projectedWorldPos.x, projectedWorldPos.y, heightMeters);

  output.clipPosition = camera.relativeViewProjection * vec4<f32>(projectedWorldPos, 1.0);
  let absH = abs(heightMeters);
  let logH = log2(max(absH, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  output.clipPosition.z = max(0.0, normalizedZ - 0.001) * output.clipPosition.w;
  output.vNormal = normalize(rotMat * nodeNormal);
  output.vTexcoord = input.texcoord;
  output.vWorldPos = worldPos;

  return output;
}

// ─── PBR Helpers ───

const PI: f32 = 3.14159265358979;
const EARTH_RADIUS_M: f32 = 6378137.0;

fn distributionGGX(NdotH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 0.0001);
}

fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

fn geometrySmith(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
  return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn encodeOutputColor(color: vec3<f32>) -> vec3<f32> {
  return pow(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2));
}

fn mercatorMetersPerMeter(mercatorY: f32) -> f32 {
  let lat = atan(exp(mercatorY / EARTH_RADIUS_M)) * 2.0 - PI * 0.5;
  return 1.0 / max(cos(lat), 0.01);
}

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  let uv = input.vTexcoord;

  // Base color
  var baseColor = material.baseColorFactor;
  if (material.hasBaseColorTex > 0.5) {
    baseColor = baseColor * textureSample(baseColorTex, texSampler, uv);
  }
  baseColor = vec4<f32>(baseColor.rgb * material.tintColor.rgb, baseColor.a * material.tintColor.a);

  let alphaCutoff = max(material.alphaCutoff, 0.0);
  let finalAlpha = select(baseColor.a, 1.0, material.alphaCutoff != 0.0);

  if (alphaCutoff > 0.0 && baseColor.a < alphaCutoff) { discard; }
  if (material.isUnlit > 0.5) { return vec4<f32>(encodeOutputColor(baseColor.rgb), finalAlpha); }

  // Normal — flip for back-faces (doubleSided materials)
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }

  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).rgb * 2.0 - 1.0;
    let dpdx_val = dpdx(input.vWorldPos);
    let dpdy_val = dpdy(input.vWorldPos);
    let dudx = dpdx(uv);
    let dvdy = dpdy(uv);
    let T = normalize(dpdx_val * dvdy.y - dpdy_val * dudx.y);
    let B = normalize(cross(N, T));
    let TBN = mat3x3<f32>(T, B, N);
    N = normalize(TBN * tangentNormal);
  }

  // PBR parameters
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g;
    metallic = metallic * mrSample.b;
  }
  roughness = clamp(roughness, 0.04, 1.0);

  // Lighting — top-down view direction for 2D map mode
  let lightDir = normalize(vec3<f32>(0.35, 0.52, 0.78));
  let fillLightDir = normalize(vec3<f32>(-0.28, -0.18, 0.94));
  let viewDir = normalize(vec3<f32>(0.0, 0.0, 1.0));
  let H = normalize(lightDir + viewDir);

  let NdotL = max(dot(N, lightDir), 0.0);
  let NdotFill = max(dot(N, fillLightDir), 0.0);
  let NdotV = max(dot(N, viewDir), 0.001);
  let NdotH = max(dot(N, H), 0.0);
  let HdotV = max(dot(H, viewDir), 0.0);

  let F0 = mix(vec3<f32>(0.04), baseColor.rgb, metallic);
  let D = distributionGGX(NdotH, roughness);
  let G = geometrySmith(NdotV, NdotL, roughness);
  let F = fresnelSchlick(HdotV, F0);

  let specular = (D * G * F) / (4.0 * NdotV * NdotL + 0.0001);
  let kD = (vec3<f32>(1.0) - F) * (1.0 - metallic);
  let diffuse = kD * baseColor.rgb / PI;
  let hemi = mix(
    vec3<f32>(0.14, 0.12, 0.10),
    vec3<f32>(0.58, 0.64, 0.76),
    clamp(N.z * 0.5 + 0.5, 0.0, 1.0),
  );

  var color = (diffuse + specular) * NdotL;
  color += diffuse * NdotFill * 0.35;
  color += hemi * baseColor.rgb * 0.45;

  if (material.hasOcclusionTex > 0.5) {
    color = color * textureSample(occlusionTex, texSampler, uv).r;
  }

  var emissive = material.emissiveFactor;
  if (material.hasEmissiveTex > 0.5) {
    emissive = emissive * textureSample(emissiveTex, texSampler, uv).rgb;
  }
  color += emissive;

  return vec4<f32>(encodeOutputColor(color), finalAlpha);
}
`,ee=`
${ce}
${ue}

struct ModelMaterial {
  baseColorFactor: vec4<f32>,
  tintColor: vec4<f32>,
  emissiveFactor: vec3<f32>,
  metallic: f32,
  roughness: f32,
  hasBaseColorTex: f32,
  hasNormalTex: f32,
  hasMetallicRoughnessTex: f32,
  hasOcclusionTex: f32,
  hasEmissiveTex: f32,
  alphaCutoff: f32,
  isUnlit: f32,
  nodeMatrix: mat4x4<f32>,
  nodeNormalMatrix: mat4x4<f32>,
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;
@group(1) @binding(1) var texSampler: sampler;
@group(1) @binding(2) var baseColorTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
@group(1) @binding(5) var occlusionTex: texture_2d<f32>;
@group(1) @binding(6) var emissiveTex: texture_2d<f32>;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) texcoord: vec2<f32>,
  @location(3) worldPos: vec3<f32>,
  @location(4) scaleHeading: vec2<f32>,
  @location(5) pitchRollAnchor: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTexcoord: vec2<f32>,
  @location(2) vGlobePos: vec3<f32>,
  @location(3) clipDot: f32,
  @location(4) vFlatPos: vec3<f32>,
};

fn degreesToRadians(d: f32) -> f32 { return d * PI / 180.0; }

fn eulerToRotationMatrix(heading: f32, pitch: f32, roll: f32) -> mat3x3<f32> {
  let h = degreesToRadians(heading);
  let p = degreesToRadians(pitch);
  let r = degreesToRadians(roll);
  let ch = cos(h); let sh = sin(h);
  let cp = cos(p); let sp = sin(p);
  let cr = cos(r); let sr = sin(r);
  return mat3x3<f32>(
    vec3<f32>(ch*cp, sh*cp, -sp),
    vec3<f32>(ch*sp*sr - sh*cr, sh*sp*sr + ch*cr, cp*sr),
    vec3<f32>(ch*sp*cr + sh*sr, sh*sp*cr - ch*sr, cp*cr),
  );
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let scale = input.scaleHeading.x;
  let heading = input.scaleHeading.y;
  let pitch = input.pitchRollAnchor.x;
  let roll = input.pitchRollAnchor.y;
  let anchorZ = input.pitchRollAnchor.z;

  // Mercator → sphere
  let merc01 = epsg3857ToMerc01(input.worldPos);
  let angular = mercatorToAngular(merc01);
  let spherePos = angularToSphere(angular.x, angular.y);

  // Tangent frame
  let up = normalize(spherePos);
  var refDir = vec3<f32>(0.0, 1.0, 0.0);
  if (abs(up.y) > 0.999) { refDir = vec3<f32>(1.0, 0.0, 0.0); }
  let east = normalize(cross(refDir, up));
  let north = cross(up, east);
  // mapgpu model math uses local axes x=east, y=north, z=up.
  let tangentMatrix = mat3x3<f32>(east, north, up);

  let gltfPosition = (material.nodeMatrix * vec4<f32>(input.position, 1.0)).xyz;
  let gltfNormal = normalize((material.nodeNormalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
  let nodePosition = vec3<f32>(gltfPosition.x, -gltfPosition.z, gltfPosition.y);
  let nodeNormal = normalize(vec3<f32>(gltfNormal.x, -gltfNormal.z, gltfNormal.y));
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);

  // Globe model position
  let globeScale = scale / EARTH_RADIUS_M;
  let localOffset = tangentMatrix * (rotMat * (nodePosition * globeScale));
  let totalAlt = input.worldPos.z + anchorZ;
  let altFrac = totalAlt / EARTH_RADIUS_M * ALTITUDE_EXAG;
  let globeFinal = spherePos * (1.0 + altFrac) + localOffset;

  // STANDARD projection — NO depth override, NO globeClippingZ hack
  // GPU perspective depth handles model self-occlusion correctly.
  var globeClip = camera.viewProjection * vec4<f32>(globeFinal, 1.0);

  // Small depth bias so model renders above the globe surface tiles
  globeClip.z -= 0.0003 * globeClip.w;
  globeClip.z = min(globeClip.z, globeClip.w * 0.9999);

  // Flat path (for 2D↔3D transition)
  let flatMercatorScale = 1.0 / max(cos(angular.y), 0.01);
  let flatRotated = rotMat * (nodePosition * scale);
  let flatLocalScale = flatMercatorScale / (2.0 * HALF_CIRCUMFERENCE);
  let flatMerc = vec3<f32>(
    merc01.x + flatRotated.x * flatLocalScale,
    merc01.y - flatRotated.y * flatLocalScale,
    altitudeOffset(input.worldPos.z) + (flatRotated.z + anchorZ) * flatLocalScale
  );
  output.vFlatPos = flatMerc;
  var flatClip = camera.flatViewProjection * vec4<f32>(flatMerc, 1.0);

  // Blend globe ↔ flat
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipPos = flatClip;
  } else {
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }

  output.clipPosition = clipPos;

  // Normal in globe tangent frame
  let globeNormal = normalize(tangentMatrix * (rotMat * nodeNormal));
  let flatNormal = normalize(rotMat * nodeNormal);
  if (camera.projectionTransition >= 0.999) {
    output.vNormal = globeNormal;
  } else if (camera.projectionTransition <= 0.001) {
    output.vNormal = flatNormal;
  } else {
    output.vNormal = normalize(mix(flatNormal, globeNormal, camera.projectionTransition));
  }

  output.vTexcoord = input.texcoord;
  output.vGlobePos = globeFinal;
  output.clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  return output;
}

// ─── PBR ───

fn distributionGGX(NdotH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 0.0001);
}

fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

fn geometrySmith(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
  return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn encodeOutputColor(color: vec3<f32>) -> vec3<f32> {
  return pow(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2));
}

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  // Horizon occlusion
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }

  let uv = input.vTexcoord;

  // Base color
  var baseColor = material.baseColorFactor;
  if (material.hasBaseColorTex > 0.5) {
    baseColor = baseColor * textureSample(baseColorTex, texSampler, uv);
  }
  baseColor = vec4<f32>(baseColor.rgb * material.tintColor.rgb, baseColor.a * material.tintColor.a);

  let alphaCutoff = max(material.alphaCutoff, 0.0);
  let finalAlpha = select(baseColor.a, 1.0, material.alphaCutoff != 0.0);

  if (alphaCutoff > 0.0 && baseColor.a < alphaCutoff) { discard; }
  if (material.isUnlit > 0.5) { return vec4<f32>(encodeOutputColor(baseColor.rgb), finalAlpha); }

  // Normal — flip for back-faces
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }
  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).rgb * 2.0 - 1.0;
    var surfacePos = input.vFlatPos;
    if (camera.projectionTransition > 0.5) {
      surfacePos = input.vGlobePos;
    }
    let dpdx_val = dpdx(surfacePos);
    let dpdy_val = dpdy(surfacePos);
    let dudx = dpdx(uv);
    let dvdy = dpdy(uv);
    let T = normalize(dpdx_val * dvdy.y - dpdy_val * dudx.y);
    let B = normalize(cross(N, T));
    let TBN = mat3x3<f32>(T, B, N);
    N = normalize(TBN * tangentNormal);
  }

  // PBR parameters
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g;
    metallic = metallic * mrSample.b;
  }
  roughness = clamp(roughness, 0.04, 1.0);

  let globeViewDir = normalize(camera.cameraWorld.xyz - input.vGlobePos);
  let flatViewDir = normalize(camera.cameraMerc01.xyz - input.vFlatPos);
  let viewDir = normalize(mix(flatViewDir, globeViewDir, camera.projectionTransition));

  // Light direction — sun-like, slightly from above-right
  let lightDir = normalize(vec3<f32>(0.34, 0.82, 0.46));
  let fillLightDir = normalize(vec3<f32>(-0.52, 0.18, 0.84));
  let H = normalize(lightDir + viewDir);

  let NdotL = max(dot(N, lightDir), 0.0);
  let NdotFill = max(dot(N, fillLightDir), 0.0);
  let NdotV = max(dot(N, viewDir), 0.001);
  let NdotH = max(dot(N, H), 0.0);
  let HdotV = max(dot(H, viewDir), 0.0);

  let F0 = mix(vec3<f32>(0.04), baseColor.rgb, metallic);
  let D = distributionGGX(NdotH, roughness);
  let G = geometrySmith(NdotV, NdotL, roughness);
  let F = fresnelSchlick(HdotV, F0);

  let specular = (D * G * F) / (4.0 * NdotV * NdotL + 0.0001);
  let kD = (vec3<f32>(1.0) - F) * (1.0 - metallic);
  let diffuse = kD * baseColor.rgb / PI;
  let upDir = normalize(mix(vec3<f32>(0.0, 0.0, 1.0), normalize(input.vGlobePos), camera.projectionTransition));
  let hemi = mix(
    vec3<f32>(0.15, 0.12, 0.10),
    vec3<f32>(0.56, 0.62, 0.74),
    clamp(dot(N, upDir) * 0.5 + 0.5, 0.0, 1.0),
  );

  var color = (diffuse + specular) * NdotL;
  color += diffuse * NdotFill * 0.32;
  color += hemi * baseColor.rgb * 0.42;

  if (material.hasOcclusionTex > 0.5) {
    color = color * textureSample(occlusionTex, texSampler, uv).r;
  }

  var emissive = material.emissiveFactor;
  if (material.hasEmissiveTex > 0.5) {
    emissive = emissive * textureSample(emissiveTex, texSampler, uv).rgb;
  }
  color += emissive;

  return vec4<f32>(encodeOutputColor(color), finalAlpha);
}
`,Pe=`
struct MipmapVertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var mipSampler: sampler;
@group(0) @binding(1) var mipSource: texture_2d<f32>;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> MipmapVertexOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(2.0, 1.0),
    vec2<f32>(0.0, -1.0),
  );

  var output: MipmapVertexOutput;
  output.clipPosition = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

@fragment
fn fs_main(input: MipmapVertexOutput) -> @location(0) vec4<f32> {
  return textureSampleLevel(mipSource, mipSampler, input.uv, 0.0);
}
`;function C(t){return[t[0],t[1],t[2]]}function te(t){return[t[0],t[1],t[2],t[3]]}function L(t){return{min:C(t.min),max:C(t.max)}}function X(t){const e=Math.hypot(t[0],t[1],t[2],t[3])||1;return[t[0]/e,t[1]/e,t[2]/e,t[3]/e]}function N(t,e,o){return t+(e-t)*o}function we(t,e,o){let i=t[0],l=t[1],a=t[2],n=t[3],s=e[0],c=e[1],r=e[2],u=e[3],f=i*s+l*c+a*r+n*u;if(f<0&&(s=-s,c=-c,r=-r,u=-u,f=-f),f>.9995)return X([N(i,s,o),N(l,c,o),N(a,r,o),N(n,u,o)]);const m=Math.acos(Math.min(Math.max(f,-1),1)),p=Math.sqrt(1-f*f)||1,d=Math.sin((1-o)*m)/p,h=Math.sin(o*m)/p;return[i*d+s*h,l*d+c*h,a*d+r*h,n*d+u*h]}function Ne(t){return{...t,localBounds:L(t.localBounds),restLocalBounds:L(t.restLocalBounds),currentLocalBounds:L(t.currentLocalBounds)}}class Ae{_device;_models=new Map;_flatOpaquePipeline=null;_flatBlendPipeline=null;_globeOpaquePipeline=null;_globeBlendPipeline=null;_sampler=null;_materialLayout=null;_placeholderTexture=null;_mipmapBindGroupLayout=null;_mipmapSampler=null;_mipmapShaderModule=null;_mipmapPipelines=new Map;constructor(e){this._device=e}async loadModel(e,o){if(this._models.has(e))return;let i;if(o instanceof ArrayBuffer)i=J(o);else{const l=o;if(l.endsWith(".gltf")||l.includes(".gltf?")){const a=l.substring(0,l.lastIndexOf("/")+1),s=await(await fetch(l)).json(),c=s.buffers??[],r=await Promise.all(c.map(async u=>{if(!u.uri)return new ArrayBuffer(u.byteLength);const f=u.uri.startsWith("data:")?u.uri:a+u.uri;return(await fetch(f)).arrayBuffer()}));i=Me(s,r)}else{const a=await fetch(l);i=J(await a.arrayBuffer())}}await this._uploadModel(e,i)}has(e){return this._models.has(e)}getBoundingBox(e){const o=this._models.get(e)?.metadata;return o?L(o.localBounds):null}getGroundAnchorUnits(e){return this._models.get(e)?.metadata.groundAnchorLocalZ??null}getModelMetadata(e){const o=this._models.get(e)?.metadata;return o?Ne(o):null}resolveModelBounds(e){const o=this._models.get(e.modelId)?.metadata;return o?ve(o,e):null}isAnimated(e){return this._models.get(e)?.animations.some(o=>o.duration>0&&o.channels.length>0)??!1}syncAnimationState(e,o){const i=this._models.get(e);i&&this._updateAnimations(i,o)}drawFlat(e,o,i,l,a,n,s,c){const r=this._models.get(s);if(!r)return;this._updateAnimations(r,c);const u=this._ensureFlatPipeline(l,a,n,!1),f=r.primitives.some(m=>m.alphaMode==="BLEND")?this._ensureFlatPipeline(l,a,n,!0):null;this._drawPrimitives(e,r,o,i,u,f)}drawGlobe(e,o,i,l,a,n,s,c){const r=this._models.get(s);if(!r)return;this._updateAnimations(r,c);const u=this._ensureGlobePipeline(l,a,n,!1),f=r.primitives.some(m=>m.alphaMode==="BLEND")?this._ensureGlobePipeline(l,a,n,!0):null;this._drawPrimitives(e,r,o,i,u,f)}destroy(){for(const e of this._models.values())for(const o of e.primitives){o.vertexBuffer.destroy(),o.indexBuffer.destroy(),o.materialBuffer.destroy();for(const i of o.ownedTextures)i.destroy()}this._models.clear(),this._placeholderTexture?.destroy()}async _uploadModel(e,o){const i=[];for(let r=0;r<o.primitives.length;r++){const u=o.primitives[r],f=await this._uploadPrimitive(e,u,r);i.push(f)}const l=o.primitives.map(r=>({bounds:L(r.mesh.bounds),nodeIndex:r.nodeIndex??null})),a=k(o.nodes,o.nodes.map(r=>C(r.translation)),o.nodes.map(r=>te(r.rotation)),o.nodes.map(r=>C(r.scale))),n=j(l,a.worldMatrices),s=Q(n,n,o.animations.some(r=>r.duration>0&&r.channels.length>0),o.nodes.some(r=>r.parentIndex!==null||r.children.length>0)),c={primitives:i,primitiveBounds:l,nodes:o.nodes,animations:o.animations,lastAnimationTime:null,metadata:s,worldMatrices:a.worldMatrices,normalMatrices:a.normalMatrices};this._writePrimitiveMatrices(c),this._models.set(e,c)}async _uploadPrimitive(e,o,i){const{mesh:l,material:a}=o,n=this._device,s=8,c=new Float32Array(l.vertexCount*s);for(let M=0;M<l.vertexCount;M++){const _=M*s,P=M*3,G=M*2;c[_]=l.positions[P],c[_+1]=l.positions[P+1],c[_+2]=l.positions[P+2],c[_+3]=l.normals[P],c[_+4]=l.normals[P+1],c[_+5]=l.normals[P+2],c[_+6]=l.texcoords[G],c[_+7]=l.texcoords[G+1]}const r=n.createBuffer({label:`gltf2-vb-${e}-${i}`,size:c.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0});new Float32Array(r.getMappedRange()).set(c),r.unmap();const u=l.indices,f=u instanceof Uint32Array?"uint32":"uint16",m=Math.ceil(u.byteLength/4)*4,p=n.createBuffer({label:`gltf2-ib-${e}-${i}`,size:Math.max(m,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0}),d=p.getMappedRange(0,Math.max(m,4));u instanceof Uint32Array?new Uint32Array(d).set(u):new Uint16Array(d).set(u),p.unmap();const h=new Float32Array(52);h[0]=a.baseColorFactor[0],h[1]=a.baseColorFactor[1],h[2]=a.baseColorFactor[2],h[3]=a.baseColorFactor[3],h[4]=1,h[5]=1,h[6]=1,h[7]=1,h[8]=a.emissiveFactor[0],h[9]=a.emissiveFactor[1],h[10]=a.emissiveFactor[2],h[11]=a.metallicFactor,h[12]=a.roughnessFactor,h[13]=a.baseColorTexture?1:0,h[14]=a.normalTexture?1:0,h[15]=a.metallicRoughnessTexture?1:0,h[16]=a.occlusionTexture?1:0,h[17]=a.emissiveTexture?1:0,h[18]=a.alphaMode==="MASK"?a.alphaCutoff:a.alphaMode==="OPAQUE"?-1:0,h[19]=a.unlit?1:0;const v=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);q(h,20,v,v);const g=n.createBuffer({label:`gltf2-mat-${e}-${i}`,size:h.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(g,0,h);const b=this._getPlaceholder(),x=this._getSampler(),y=this._getMaterialLayout(),w=[],T=async(M,_)=>{if(!M)return b;try{const P=new ArrayBuffer(M.data.byteLength);new Uint8Array(P).set(M.data);const G=new Blob([P],{type:M.mimeType}),Z=await createImageBitmap(G),Y=this._createTextureWithMipmaps(`gltf2-tex-${e}-${i}-${_}`,Z,this._getTextureFormat(_));return Z.close(),w.push(Y),Y}catch{return b}},O=await T(a.baseColorTexture,"baseColor"),D=await T(a.normalTexture,"normal"),E=await T(a.metallicRoughnessTexture,"metallicRoughness"),V=await T(a.occlusionTexture,"occlusion"),I=await T(a.emissiveTexture,"emissive"),ae=n.createBindGroup({label:`gltf2-bg-${e}-${i}`,layout:y,entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:x},{binding:2,resource:O.createView()},{binding:3,resource:D.createView()},{binding:4,resource:E.createView()},{binding:5,resource:V.createView()},{binding:6,resource:I.createView()}]});return{vertexBuffer:r,indexBuffer:p,indexFormat:f,indexCount:l.indexCount,vertexCount:l.vertexCount,materialBuffer:g,materialData:h,materialBindGroup:ae,alphaMode:a.alphaMode,ownedTextures:w,doubleSided:a.doubleSided,nodeIndex:o.nodeIndex??null}}_drawPrimitives(e,o,i,l,a,n){e.setBindGroup(0,l);let s=null;const c=(r,u)=>{s!==u&&(e.setPipeline(u),s=u),e.setBindGroup(1,r.materialBindGroup),e.setVertexBuffer(0,r.vertexBuffer),e.setVertexBuffer(1,i.instanceBuffer),e.setIndexBuffer(r.indexBuffer,r.indexFormat),e.drawIndexed(r.indexCount,i.instanceCount)};for(const r of o.primitives)r.alphaMode!=="BLEND"&&c(r,a);if(n)for(const r of o.primitives)r.alphaMode==="BLEND"&&c(r,n)}_updateAnimations(e,o){if(e.animations.length===0||e.lastAnimationTime!==null&&Math.abs(e.lastAnimationTime-o)<1e-6)return;e.lastAnimationTime=o;const i=e.nodes.map(s=>C(s.translation)),l=e.nodes.map(s=>te(s.rotation)),a=e.nodes.map(s=>C(s.scale));for(const s of e.animations){const c=s.duration>0?o%s.duration:0;for(const r of s.channels)this._applyAnimationChannel(r,c,i,l,a)}const n=k(e.nodes,i,l,a);e.worldMatrices=n.worldMatrices,e.normalMatrices=n.normalMatrices,e.metadata=Q(e.metadata.restLocalBounds,j(e.primitiveBounds,e.worldMatrices),e.metadata.isAnimated,e.metadata.hasHierarchy),this._writePrimitiveMatrices(e)}_writePrimitiveMatrices(e){for(const o of e.primitives){const i=o.nodeIndex===null?new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]):e.worldMatrices[o.nodeIndex]??new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),l=o.nodeIndex===null?i:e.normalMatrices[o.nodeIndex]??i;q(o.materialData,20,i,l),this._device.queue.writeBuffer(o.materialBuffer,0,o.materialData.buffer,o.materialData.byteOffset,o.materialData.byteLength)}}_applyAnimationChannel(e,o,i,l,a){const n=e.node,{input:s,output:c}=e;if(n<0||n>=i.length||s.length===0)return;const r=e.path==="rotation"?4:3;let u=0;for(;u+1<s.length&&o>=s[u+1];)u++;const f=Math.min(u+1,s.length-1),m=s[u]??0,p=s[f]??m,d=e.interpolation==="STEP"||f===u||p<=m?0:(o-m)/(p-m),h=x=>{const y=x*r;return Array.from(c.subarray(y,y+r))};if(e.path==="rotation"){const x=h(u),y=h(f);l[n]=X(d===0?x:we(x,y,d));return}const v=h(u),g=h(f),b=d===0?[v[0],v[1],v[2]]:[N(v[0],g[0],d),N(v[1],g[1],d),N(v[2],g[2],d)];e.path==="translation"?i[n]=b:a[n]=b}_ensureFlatPipeline(e,o,i,l){return l?this._flatBlendPipeline?this._flatBlendPipeline:(this._flatBlendPipeline=this._createPipeline("gltf2-flat-blend",K,e,o,i,!0),this._flatBlendPipeline):this._flatOpaquePipeline?this._flatOpaquePipeline:(this._flatOpaquePipeline=this._createPipeline("gltf2-flat-opaque",K,e,o,i,!1),this._flatOpaquePipeline)}_ensureGlobePipeline(e,o,i,l){return l?this._globeBlendPipeline?this._globeBlendPipeline:(this._globeBlendPipeline=this._createPipeline("gltf2-globe-blend",ee,e,o,i,!0),this._globeBlendPipeline):this._globeOpaquePipeline?this._globeOpaquePipeline:(this._globeOpaquePipeline=this._createPipeline("gltf2-globe-opaque",ee,e,o,i,!1),this._globeOpaquePipeline)}_createPipeline(e,o,i,l,a,n){const s=this._device,c=this._getMaterialLayout(),r=s.createShaderModule({label:`${e}-shader`,code:o});return s.createRenderPipeline({label:e,layout:s.createPipelineLayout({label:`${e}-layout`,bindGroupLayouts:[i,c]}),vertex:{module:r,entryPoint:"vs_main",buffers:[{arrayStride:32,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]},{arrayStride:32,stepMode:"instance",attributes:[{shaderLocation:3,offset:0,format:"float32x3"},{shaderLocation:4,offset:12,format:"float32x2"},{shaderLocation:5,offset:20,format:"float32x3"}]}]},fragment:{module:r,entryPoint:"fs_main",targets:[{format:l,blend:n?{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}:void 0}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:a,depthWriteEnabled:!n,depthCompare:"less"},multisample:{count:fe}})}_getTextureFormat(e){return e==="baseColor"||e==="emissive"?"rgba8unorm-srgb":"rgba8unorm"}_createTextureWithMipmaps(e,o,i){const l=Math.floor(Math.log2(Math.max(o.width,o.height)))+1,a=this._device.createTexture({label:e,size:{width:o.width,height:o.height},mipLevelCount:l,format:i,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});return this._device.queue.copyExternalImageToTexture({source:o},{texture:a},{width:o.width,height:o.height}),l>1&&this._generateMipmaps(a,i,l),a}_generateMipmaps(e,o,i){const l=this._getMipmapPipeline(o),a=this._getMipmapBindGroupLayout(),n=this._getMipmapSampler(),s=this._device.createCommandEncoder({label:"gltf2-mipmap-encoder"});for(let c=1;c<i;c++){const r=e.createView({baseMipLevel:c-1,mipLevelCount:1}),u=e.createView({baseMipLevel:c,mipLevelCount:1}),f=this._device.createBindGroup({label:`gltf2-mipmap-bind-group-${c}`,layout:a,entries:[{binding:0,resource:n},{binding:1,resource:r}]}),m=s.beginRenderPass({colorAttachments:[{view:u,loadOp:"clear",clearValue:{r:0,g:0,b:0,a:0},storeOp:"store"}]});m.setPipeline(l),m.setBindGroup(0,f),m.draw(3),m.end()}this._device.queue.submit([s.finish()])}_getMipmapPipeline(e){const o=this._mipmapPipelines.get(e);if(o)return o;const i=this._device.createRenderPipeline({label:`gltf2-mipmap-${e}`,layout:this._device.createPipelineLayout({label:`gltf2-mipmap-layout-${e}`,bindGroupLayouts:[this._getMipmapBindGroupLayout()]}),vertex:{module:this._getMipmapShaderModule(),entryPoint:"vs_main"},fragment:{module:this._getMipmapShaderModule(),entryPoint:"fs_main",targets:[{format:e}]},primitive:{topology:"triangle-list"}});return this._mipmapPipelines.set(e,i),i}_getMipmapBindGroupLayout(){return this._mipmapBindGroupLayout?this._mipmapBindGroupLayout:(this._mipmapBindGroupLayout=this._device.createBindGroupLayout({label:"gltf2-mipmap-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]}),this._mipmapBindGroupLayout)}_getMipmapShaderModule(){return this._mipmapShaderModule?this._mipmapShaderModule:(this._mipmapShaderModule=this._device.createShaderModule({label:"gltf2-mipmap-shader",code:Pe}),this._mipmapShaderModule)}_getMipmapSampler(){return this._mipmapSampler?this._mipmapSampler:(this._mipmapSampler=this._device.createSampler({label:"gltf2-mipmap-sampler",minFilter:"linear",magFilter:"linear",mipmapFilter:"linear",maxAnisotropy:8,addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this._mipmapSampler)}_getPlaceholder(){return this._placeholderTexture?this._placeholderTexture:(this._placeholderTexture=this._device.createTexture({label:"gltf2-placeholder",size:{width:1,height:1},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this._device.queue.writeTexture({texture:this._placeholderTexture},new Uint8Array([255,255,255,255]),{bytesPerRow:4},{width:1,height:1}),this._placeholderTexture)}_getSampler(){return this._sampler?this._sampler:(this._sampler=this._device.createSampler({label:"gltf2-sampler",magFilter:"linear",minFilter:"linear",mipmapFilter:"linear",maxAnisotropy:8,addressModeU:"repeat",addressModeV:"repeat"}),this._sampler)}_getMaterialLayout(){return this._materialLayout?this._materialLayout:(this._materialLayout=this._device.createBindGroupLayout({label:"gltf2-material-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]}),this._materialLayout)}}export{Ae as Gltf2Renderer};
