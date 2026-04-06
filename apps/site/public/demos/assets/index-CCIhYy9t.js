(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const n of r)if(n.type==="childList")for(const s of n.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&i(s)}).observe(document,{childList:!0,subtree:!0});function t(r){const n={};return r.integrity&&(n.integrity=r.integrity),r.referrerPolicy&&(n.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?n.credentials="include":r.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(r){if(r.ep)return;r.ep=!0;const n=t(r);fetch(r.href,n)}})();const Vt={format:"depth24plus",compareFunc:"less",clearValue:1};function Ot(o){return typeof o.vertexShader=="string"&&typeof o.fragmentShader=="string"&&typeof o.getVertexBuffers=="function"&&typeof o.getDrawCommand=="function"}function Ki(o){return typeof o.getTileUrl=="function"&&"minZoom"in o&&"maxZoom"in o}function De(o){return typeof o.getFeatures=="function"}function Nt(o){return typeof o.requestTile=="function"&&typeof o.getReadyHeightTile=="function"&&typeof o.getReadyHillshadeTile=="function"&&"minZoom"in o&&"maxZoom"in o&&"exaggeration"in o}function qi(o){return typeof o.getSourcePoints3857=="function"&&"clusterRadius"in o}function Qi(o){return typeof o.updatePositions=="function"&&"pointCount"in o}function Ji(o){return o.type==="image-overlay"&&"imageData"in o}function ct(o){return o.type==="video-overlay"&&"videoElement"in o}function Lt(o){const e=Nr(o?.sky);return{fog:{enabled:o?.fog?.enabled??!1,density:o?.fog?.density??3e-4,color:o?.fog?.color??[.6,.7,.9,1],startDistance:o?.fog?.startDistance??0,equation:o?.fog?.equation??"exp"},nightImagery:{enabled:o?.nightImagery?.enabled??!1,textureUrl:o?.nightImagery?.textureUrl??"",intensity:o?.nightImagery?.intensity??1,transitionWidth:o?.nightImagery?.transitionWidth??.1},waterMask:{enabled:o?.waterMask?.enabled??!1,color:o?.waterMask?.color??[0,.05,.15,1],specularPower:o?.waterMask?.specularPower??64,fresnelBias:o?.waterMask?.fresnelBias??.02,waveFrequency:o?.waterMask?.waveFrequency??0,waveAmplitude:o?.waterMask?.waveAmplitude??.01},atmosphere:{enabled:o?.atmosphere?.enabled??!0,colorInner:o?.atmosphere?.colorInner??[.3,.5,1,.3],colorOuter:o?.atmosphere?.colorOuter??[.1,.3,.8,0],strength:o?.atmosphere?.strength??1,falloff:o?.atmosphere?.falloff??4},sky:e,lighting:{enabled:o?.lighting?.enabled??!0,ambient:o?.lighting?.ambient??.5,diffuse:o?.lighting?.diffuse??.85,shadowStrength:o?.lighting?.shadowStrength??.2,shadowSoftness:o?.lighting?.shadowSoftness??.4,sunAzimuth:o?.lighting?.sunAzimuth??315,sunAltitude:o?.lighting?.sunAltitude??45},poleCaps:{enabled:o?.poleCaps?.enabled??!0,color:o?.poleCaps?.color??[.65,.78,.88]},backgroundColor:o?.backgroundColor??[0,0,0,1]}}const Or={"realistic-cinematic":{enabled:!0,horizonColor:[.79,.88,1,1],zenithColor:[.19,.46,.93,1],spaceColor:[.015,.04,.12,1],horizonBlend:.18,verticalFalloff:1.6,starIntensity:.38,starDensity:.34,starSeed:17,syncWithLighting:!0},stylized:{enabled:!0,horizonColor:[.62,.83,1,1],zenithColor:[.18,.36,.9,1],spaceColor:[.03,.06,.17,1],horizonBlend:.26,verticalFalloff:1.15,starIntensity:.52,starDensity:.46,starSeed:29,syncWithLighting:!0},neutral:{enabled:!0,horizonColor:[.76,.84,.94,1],zenithColor:[.29,.5,.75,1],spaceColor:[.04,.07,.15,1],horizonBlend:.18,verticalFalloff:1.7,starIntensity:.26,starDensity:.24,starSeed:11,syncWithLighting:!0}};function Nr(o){const e=o?.preset??"realistic-cinematic",t=Or[e==="custom"?"realistic-cinematic":e];return{...t,...o,preset:e,enabled:o?.enabled??t.enabled,horizonBlend:gt(o?.horizonBlend??t.horizonBlend),verticalFalloff:Math.max(.1,o?.verticalFalloff??t.verticalFalloff),starIntensity:gt(o?.starIntensity??t.starIntensity),starDensity:gt(o?.starDensity??t.starDensity),starSeed:o?.starSeed??t.starSeed,syncWithLighting:o?.syncWithLighting??t.syncWithLighting}}function gt(o){return Math.max(0,Math.min(1,o))}class be{listeners=new Map;on(e,t){this.listeners.has(e)||this.listeners.set(e,new Set),this.listeners.get(e).add(t)}off(e,t){this.listeners.get(e)?.delete(t)}emit(e,t){const i=this.listeners.get(e);if(i)for(const r of i)try{r(t)}catch(n){console.error(`Event handler error [${String(e)}]:`,n)}}once(e,t){const i=(r=>{this.off(e,i),t(r)});this.on(e,i)}removeAll(e){e?this.listeners.delete(e):this.listeners.clear()}}const $=6378137,Kt=85.0511287798066;function H(o,e){const t=Math.max(-Kt,Math.min(Kt,e)),i=o*Math.PI*$/180,r=t*Math.PI/180,n=Math.log(Math.tan(Math.PI/4+r/2))*$;return[i,n]}function qt(o,e){const t=o/$*(180/Math.PI),i=(Math.atan(Math.exp(e/$))-Math.PI/4)*(360/Math.PI);return[t,i]}class Hr{_layers=[];_events=new be;get layers(){return this._layers}add(e){if(this._layers.some(i=>i.id===e.id))return;if(e.type==="layer-group"){const i=e;if(i.getLayers)for(const r of i.getLayers())this.add(r);this._layers.push(e),this._events.emit("layer-add",{layer:e,index:this._layers.length-1});return}const t=this._layers.length;this._layers.push(e),this._events.emit("layer-add",{layer:e,index:t})}remove(e){if(e.type==="layer-group"){const r=e;if(r.getLayers)for(const n of r.getLayers())this.remove(n)}const t=this._layers.findIndex(r=>r.id===e.id);if(t===-1)return;const[i]=this._layers.splice(t,1);return i&&this._events.emit("layer-remove",{layer:i,index:t}),i}findLayerById(e){return this._layers.find(t=>t.id===e)}reorder(e,t){const i=this._layers.findIndex(n=>n.id===e.id);if(i===-1)return;const r=Math.max(0,Math.min(this._layers.length-1,t));i!==r&&(this._layers.splice(i,1),this._layers.splice(r,0,e),this._events.emit("layer-reorder",{layer:e,fromIndex:i,toIndex:r}))}removeAll(){for(;this._layers.length>0;){const e=this._layers.pop();e&&this._events.emit("layer-remove",{layer:e,index:this._layers.length})}}on(e,t){this._events.on(e,t)}off(e,t){this._events.off(e,t)}destroy(){this.removeAll(),this._events.removeAll()}}const Wr=20037508342789244e-9;class Zr{_center;_zoom;_rotation;_minZoom;_maxZoom;_viewportWidth;_viewportHeight;_dirty=!0;_viewMatrix=new Float32Array(16);_projectionMatrix=new Float32Array(16);constructor(e={}){this._center=e.center??[0,0],this._zoom=e.zoom??0,this._rotation=e.rotation??0,this._minZoom=e.minZoom??0,this._maxZoom=e.maxZoom??24,this._viewportWidth=e.viewportWidth??800,this._viewportHeight=e.viewportHeight??600,this._clampZoom(),this._updateMatrices()}get center(){return[this._center[0],this._center[1]]}get zoom(){return this._zoom}get rotation(){return this._rotation}get minZoom(){return this._minZoom}get maxZoom(){return this._maxZoom}get viewportWidth(){return this._viewportWidth}get viewportHeight(){return this._viewportHeight}get dirty(){return this._dirty}setCenter(e){this._center=[e[0],e[1]],this._dirty=!0,this._updateMatrices()}setZoom(e){this._zoom=e,this._clampZoom(),this._dirty=!0,this._updateMatrices()}setRotation(e){this._rotation=e,this._dirty=!0,this._updateMatrices()}setViewport(e,t){this._viewportWidth=e,this._viewportHeight=t,this._dirty=!0,this._updateMatrices()}zoomIn(){this.setZoom(this._zoom+1)}zoomOut(){this.setZoom(this._zoom-1)}clearDirty(){this._dirty=!1}get viewMatrix(){return this._viewMatrix}get projectionMatrix(){return this._projectionMatrix}getExtent(){const e=this._getResolution(),t=this._viewportWidth/2*e,i=this._viewportHeight/2*e;if(this._rotation===0)return{minX:this._center[0]-t,minY:this._center[1]-i,maxX:this._center[0]+t,maxY:this._center[1]+i,spatialReference:"EPSG:3857"};const r=Math.cos(this._rotation),n=Math.sin(this._rotation),s=[[-t,-i],[t,-i],[t,i],[-t,i]];let a=1/0,l=1/0,c=-1/0,d=-1/0;for(const[u,h]of s){const f=u*r-h*n+this._center[0],p=u*n+h*r+this._center[1];a=Math.min(a,f),l=Math.min(l,p),c=Math.max(c,f),d=Math.max(d,p)}return{minX:a,minY:l,maxX:c,maxY:d,spatialReference:"EPSG:3857"}}screenToMap(e,t){const i=this._getResolution();let r=(e-this._viewportWidth/2)*i,n=(this._viewportHeight/2-t)*i;if(this._rotation!==0){const s=Math.cos(-this._rotation),a=Math.sin(-this._rotation),l=r*s-n*a,c=r*a+n*s;r=l,n=c}return[this._center[0]+r,this._center[1]+n]}mapToScreen(e,t){const i=this._getResolution();let r=e-this._center[0],n=t-this._center[1];if(this._rotation!==0){const l=Math.cos(this._rotation),c=Math.sin(this._rotation),d=r*l-n*c,u=r*c+n*l;r=d,n=u}const s=r/i+this._viewportWidth/2,a=this._viewportHeight/2-n/i;return[s,a]}_getResolution(){return Wr*2/(256*Math.pow(2,this._zoom))}_clampZoom(){this._zoom=Math.max(this._minZoom,Math.min(this._maxZoom,this._zoom))}_updateMatrices(){const e=this._getResolution(),t=this._viewportWidth/2*e,i=this._viewportHeight/2*e,r=this._projectionMatrix;r.fill(0),r[0]=1/t,r[5]=1/i,r[10]=-1,r[15]=1;const n=this._viewMatrix,s=Math.cos(-this._rotation),a=Math.sin(-this._rotation),l=-this._center[0],c=-this._center[1];n.fill(0),n[0]=s,n[1]=a,n[4]=-a,n[5]=s,n[10]=1,n[12]=s*l+-a*c,n[13]=a*l+s*c,n[15]=1}}class jr{_layers=new Map;_events=new be;_currentZoom=0;async addLayer(e){if(this._layers.has(e.id))return;const t={layer:e,loading:!1,loadError:null,dirty:!0,effectivelyVisible:this._isVisibleAtZoom(e,this._currentZoom)};this._layers.set(e.id,t),await this._loadLayer(t)}removeLayer(e){const t=this._layers.get(e);t&&(t.layer.destroy(),this._layers.delete(e))}removeAll(){for(const e of this._layers.values())e.layer.destroy();this._layers.clear()}getLayer(e){return this._layers.get(e)?.layer}getLayerIds(){return Array.from(this._layers.keys())}setCurrentZoom(e){this._currentZoom=e;for(const[t,i]of this._layers){const r=i.effectivelyVisible;i.effectivelyVisible=this._isVisibleAtZoom(i.layer,e),r!==i.effectivelyVisible&&(this._events.emit("layer-visibility-change",{layerId:t,visible:i.effectivelyVisible}),i.dirty=!0)}}isLayerVisible(e){const t=this._layers.get(e);return t?t.effectivelyVisible:!1}markDirty(e){const t=this._layers.get(e);t&&(t.dirty=!0,this._events.emit("layer-dirty",{layerId:e}))}getDirtyLayers(){const e=[];for(const[t,i]of this._layers)i.dirty&&i.effectivelyVisible&&e.push(t);return e}clearDirty(e){const t=this._layers.get(e);t&&(t.dirty=!1)}clearAllDirty(){for(const e of this._layers.values())e.dirty=!1}hasAnyDirty(){for(const e of this._layers.values())if(e.dirty&&e.effectivelyVisible)return!0;return!1}on(e,t){this._events.on(e,t)}off(e,t){this._events.off(e,t)}destroy(){this.removeAll(),this._events.removeAll()}async _loadLayer(e){if(!(e.layer.loaded||e.loading)){e.loading=!0;try{await e.layer.load(),e.loading=!1,e.dirty=!0,this._events.emit("layer-loaded",{layerId:e.layer.id})}catch(t){e.loading=!1;const i={kind:"layer-load-failed",layerId:e.layer.id,cause:t instanceof Error?t:new Error(String(t))};e.loadError=i,this._events.emit("layer-load-error",{layerId:e.layer.id,error:i})}}}_isVisibleAtZoom(e,t){if(!e.visible)return!1;const i=559082264028717e-6/Math.pow(2,t);return!(e.minScale!==void 0&&e.minScale>0&&i>e.minScale||e.maxScale!==void 0&&e.maxScale>0&&i<e.maxScale)}}const te=20037508342789244e-9,Qt=85.0511287798066;class Xr{_maxConcurrent;_tileSize;constructor(e={}){this._maxConcurrent=e.maxConcurrent??6,this._tileSize=e.tileSize??256}get maxConcurrent(){return this._maxConcurrent}get tileSize(){return this._tileSize}getTilesForExtent(e,t){const i=Math.max(0,Math.round(t)),r=Math.pow(2,i),s=te*2/r,a=Math.max(0,Math.floor((e.minX+te)/s)),l=Math.min(r-1,Math.floor((e.maxX+te)/s)),c=Math.max(0,Math.floor((te-e.maxY)/s)),d=Math.min(r-1,Math.floor((te-e.minY)/s)),u=(e.minX+e.maxX)/2,h=(e.minY+e.maxY)/2,f=[];for(let p=c;p<=d;p++)for(let g=a;g<=l;g++){const x=this.tileToExtent(i,g,p),v=(x.minX+x.maxX)/2,y=(x.minY+x.maxY)/2,m=v-u,_=y-h,w=m*m+_*_;f.push({z:i,x:g,y:p,priority:w})}return f.sort((p,g)=>p.priority-g.priority),f}tileToExtent(e,t,i){const r=Math.pow(2,e),n=te*2/r,s=t*n-te,a=te-i*n,l=s+n,c=a-n;return{minX:s,minY:c,maxX:l,maxY:a,spatialReference:"EPSG:3857"}}lonLatToTile(e,t,i){const r=Math.max(0,Math.round(i)),n=Math.pow(2,r),s=Math.max(-Qt,Math.min(Qt,t)),a=Math.floor((e+180)/360*n),l=s*Math.PI/180,c=Math.floor((1-Math.log(Math.tan(l)+1/Math.cos(l))/Math.PI)/2*n);return{z:r,x:Math.max(0,Math.min(n-1,a)),y:Math.max(0,Math.min(n-1,c))}}clipToConcurrentLimit(e){return e.slice(0,this._maxConcurrent)}}class $r{_running=!1;_dirty=!0;_rafId=null;_firstFrame=!0;_lastTimestamp=0;_frameNumber=0;_skippedFrames=0;_fps=0;_frameDurationMs=0;_targetFps;_minFrameInterval;_fpsAccumulator=0;_fpsFrameCount=0;_fpsLastUpdate=0;_renderEngine=null;_cameraStateProvider=null;_frameCallbacks=new Set;_preFrameCallbacks=new Set;_requestAnimationFrame;_cancelAnimationFrame;constructor(e={},t,i){this._targetFps=e.targetFps??60,this._minFrameInterval=this._targetFps>0?1e3/this._targetFps:0,this._requestAnimationFrame=t??(r=>requestAnimationFrame(r)),this._cancelAnimationFrame=i??(r=>cancelAnimationFrame(r))}setRenderEngine(e){this._renderEngine=e}setCameraStateProvider(e){this._cameraStateProvider=e}onFrame(e){this._frameCallbacks.add(e)}offFrame(e){this._frameCallbacks.delete(e)}onPreFrame(e){this._preFrameCallbacks.add(e)}offPreFrame(e){this._preFrameCallbacks.delete(e)}markDirty(){this._dirty=!0}get isDirty(){return this._dirty}get running(){return this._running}start(){this._running||(this._running=!0,this._firstFrame=!0,this._lastTimestamp=0,this._fpsLastUpdate=0,this._scheduleFrame())}stop(){this._running=!1,this._rafId!==null&&(this._cancelAnimationFrame(this._rafId),this._rafId=null)}getStats(){return{fps:this._fps,frameDurationMs:this._frameDurationMs,totalFrames:this._frameNumber,skippedFrames:this._skippedFrames}}destroy(){this.stop(),this._renderEngine=null,this._cameraStateProvider=null,this._frameCallbacks.clear(),this._preFrameCallbacks.clear()}_scheduleFrame(){this._running&&(this._rafId=this._requestAnimationFrame(e=>{this._tick(e)}))}_tick(e){if(!this._running)return;if(this._firstFrame){this._firstFrame=!1,this._lastTimestamp=e,this._fpsLastUpdate=e,this._scheduleFrame();return}const t=e-this._lastTimestamp;if(this._minFrameInterval>0&&t<this._minFrameInterval){this._scheduleFrame();return}if(this._lastTimestamp=e,!this._dirty){this._skippedFrames++,this._scheduleFrame();return}this._dirty=!1,this._frameNumber++,this._frameDurationMs=t,this._fpsFrameCount++,this._fpsAccumulator+=t,e-this._fpsLastUpdate>=1e3&&(this._fps=this._fpsAccumulator>0?this._fpsFrameCount/this._fpsAccumulator*1e3:0,this._fpsFrameCount=0,this._fpsAccumulator=0,this._fpsLastUpdate=e);for(const i of this._preFrameCallbacks)try{i(t,this._frameNumber)}catch(r){console.error("RenderLoop pre-frame callback error:",r)}if(this._renderEngine&&this._cameraStateProvider){const i=this._cameraStateProvider();this._renderEngine.beginFrame(i)}for(const i of this._frameCallbacks)try{i(t,this._frameNumber)}catch(r){console.error("RenderLoop frame callback error:",r)}this._renderEngine&&(this._renderEngine.endFrame(),this._renderEngine.needsContinuousRender&&(this._dirty=!0)),this._scheduleFrame()}}class Yr{_undoStack=[];_redoStack=[];_maxHistorySize;_events=new be;constructor(e={}){this._maxHistorySize=e.maxHistorySize??50}execute(e){for(e.execute(),this._undoStack.push(e),this._redoStack=[];this._undoStack.length>this._maxHistorySize;)this._undoStack.shift();this._events.emit("command-executed",{command:e})}undo(){const e=this._undoStack.pop();return e?(e.undo(),this._redoStack.push(e),this._events.emit("command-undone",{command:e}),!0):!1}redo(){const e=this._redoStack.pop();return e?(e.execute(),this._undoStack.push(e),this._events.emit("command-redone",{command:e}),!0):!1}get canUndo(){return this._undoStack.length>0}get canRedo(){return this._redoStack.length>0}get undoCount(){return this._undoStack.length}get redoCount(){return this._redoStack.length}clear(){this._undoStack=[],this._redoStack=[]}on(e,t){this._events.on(e,t)}off(e,t){this._events.off(e,t)}destroy(){this.clear(),this._events.removeAll()}}function Kr(o){return{m0:o[0]??0,m1:o[1]??0,m2:o[2]??0,m3:o[3]??0,m4:o[4]??0,m5:o[5]??0,m6:o[6]??0,m7:o[7]??0,m8:o[8]??0,m9:o[9]??0,m10:o[10]??0,m11:o[11]??0,m12:o[12]??0,m13:o[13]??0,m14:o[14]??0,m15:o[15]??0}}function qr(o){const{m0:e,m1:t,m2:i,m3:r,m4:n,m5:s,m6:a,m7:l,m8:c,m9:d,m10:u,m11:h,m12:f,m13:p,m14:g,m15:x}=Kr(o);return[me({a:r+e,b:l+n,c:h+c,d:x+f}),me({a:r-e,b:l-n,c:h-c,d:x-f}),me({a:r+t,b:l+s,c:h+d,d:x+p}),me({a:r-t,b:l-s,c:h-d,d:x-p}),me({a:i,b:a,c:u,d:g}),me({a:r-i,b:l-a,c:h-u,d:x-g})]}function me(o){const e=Math.sqrt(o.a*o.a+o.b*o.b+o.c*o.c);return e<1e-15?o:{a:o.a/e,b:o.b/e,c:o.c/e,d:o.d/e}}const Qr=async o=>{const e=await fetch(o,{mode:"cors"});if(!e.ok)throw new Error(`Tile fetch failed: ${e.status} ${o}`);const t=await e.blob();return createImageBitmap(t)};class Jr{_tileScheduler;_maxCacheEntries;_maxConcurrent;_fetcher;_cache=new Map;_inFlight=new Map;_renderEngine=null;onDirty=null;_destroyed=!1;constructor(e){this._tileScheduler=e.tileScheduler,this._maxCacheEntries=e.maxCacheEntries??512,this._maxConcurrent=e.maxConcurrent??6,this._fetcher=e.fetcher??Qr}setRenderEngine(e){this._renderEngine=e}getReadyTiles(e,t,i){if(this._destroyed)return[];const r=Date.now(),n=new Set,s=[],a=[];for(let l=0;l<i.length;l++){const c=i[l],d=Math.max(c.minZoom,Math.min(c.maxZoom,Math.round(t))),u=this._tileScheduler.getTilesForExtent(e,d);for(const h of u){const f=`${c.sourceId}/${h.z}/${h.x}/${h.y}`,p=this._cache.get(f);if(p)p.lastUsed=r,a.push({texture:p.texture,extent:p.extent,opacity:p.opacity,filters:c.filters});else{this._startFetch(f,c,h.z,h.x,h.y);let g=h.z-1,x=Math.floor(h.x/2),v=Math.floor(h.y/2);for(;g>=c.minZoom;){const y=`${c.sourceId}/${g}/${x}/${v}`,m=this._cache.get(y);if(m){n.has(y)||(n.add(y),m.lastUsed=r,s.push({texture:m.texture,extent:m.extent,opacity:m.opacity,filters:c.filters}));break}g--,x=Math.floor(x/2),v=Math.floor(v/2)}}}}return this._evictIfNeeded(),[...s,...a]}getReadyTilesForCoords(e,t){if(this._destroyed)return[];const i=Date.now(),r=new Set,n=[],s=[];for(let a=0;a<t.length;a++){const l=t[a];for(const c of e){if(Math.max(l.minZoom,Math.min(l.maxZoom,c.z))!==c.z)continue;const u=`${l.sourceId}/${c.z}/${c.x}/${c.y}`,h=this._cache.get(u);if(h)h.lastUsed=i,s.push({texture:h.texture,extent:h.extent,opacity:h.opacity,filters:l.filters});else{this._startFetch(u,l,c.z,c.x,c.y);let f=c.z-1,p=Math.floor(c.x/2),g=Math.floor(c.y/2);for(;f>=l.minZoom;){const x=`${l.sourceId}/${f}/${p}/${g}`,v=this._cache.get(x);if(v){r.has(x)||(r.add(x),v.lastUsed=i,n.push({texture:v.texture,extent:v.extent,opacity:v.opacity,filters:l.filters,depthBias:.002}));break}f--,p=Math.floor(p/2),g=Math.floor(g/2)}}}}return this._evictIfNeeded(),[...n,...s]}invalidateAll(){if(!this._destroyed){for(const e of this._cache.values())this._renderEngine?.releaseTexture(e.texture);this._cache.clear(),this._inFlight.clear()}}invalidateSource(e){if(this._destroyed)return;const t=`${e}/`;for(const[i,r]of this._cache)i.startsWith(t)&&(this._renderEngine?.releaseTexture(r.texture),this._cache.delete(i));for(const i of this._inFlight.keys())i.startsWith(t)&&this._inFlight.delete(i)}destroy(){this._destroyed=!0;for(const e of this._cache.values())this._renderEngine&&this._renderEngine.releaseTexture(e.texture);this._cache.clear(),this._inFlight.clear(),this._renderEngine=null,this.onDirty=null}get cacheSize(){return this._cache.size}get inFlightCount(){return this._inFlight.size}_startFetch(e,t,i,r,n){if(this._inFlight.has(e)||this._inFlight.size>=this._maxConcurrent)return;const s=t.getTileUrl(i,r,n),a=this._fetchAndCache(e,s,t,i,r,n);this._inFlight.set(e,a),a.finally(()=>{this._inFlight.delete(e)})}async _fetchAndCache(e,t,i,r,n,s){try{const a=await this._fetcher(t);if(this._destroyed||!this._renderEngine)return;const l=this._renderEngine.createTexture(a),c=this._tileScheduler.tileToExtent(r,n,s),d=[c.minX,c.minY,c.maxX,c.maxY];this._cache.set(e,{texture:l,extent:d,opacity:i.opacity,lastUsed:Date.now()}),this.onDirty?.()}catch{}}_evictIfNeeded(){if(this._cache.size<=this._maxCacheEntries)return;const e=[...this._cache.entries()].sort((i,r)=>i[1].lastUsed-r[1].lastUsed),t=this._cache.size-this._maxCacheEntries;for(let i=0;i<t;i++){const[r,n]=e[i];this._renderEngine&&this._renderEngine.releaseTexture(n.texture),this._cache.delete(r)}}}class eo{_maxHeightCacheEntries;_maxHillshadeCacheEntries;_maxConcurrent;_heightCache=new Map;_hillshadeCache=new Map;_inFlight=new Map;_renderEngine=null;_destroyed=!1;_activeLayerId=null;_pendingQueue=[];_pendingKeys=new Set;onDirty=null;constructor(e={}){this._maxHeightCacheEntries=e.maxHeightCacheEntries??256,this._maxHillshadeCacheEntries=e.maxHillshadeCacheEntries??256,this._maxConcurrent=e.maxConcurrent??8}setRenderEngine(e){this._renderEngine=e}setActiveLayer(e){this._activeLayerId!==e&&(this._activeLayerId=e,this._pruneCachesForActiveLayer())}requestTiles(e,t){if(!this._destroyed){this.setActiveLayer(e.id);for(const i of t){const r=this._normalizeRequestCoord(e,i);if(!r)continue;const{z:n,x:s,y:a}=r;this._materializeHeightIfReady(e,n,s,a),this._materializeHillshadeIfReady(e,n,s,a),this._startRequest(e,n,s,a)}}}getReadyHeightTile(e,t,i,r){if(this._destroyed||t<e.minZoom)return null;this.setActiveLayer(e.id);let n=t,s=i,a=r;if(n>e.maxZoom){const c=1<<n-e.maxZoom;s=Math.floor(s/c),a=Math.floor(a/c),n=e.maxZoom}for(;n>=e.minZoom;){const l=this._getOrMaterializeHeight(e,n,s,a);if(l)return l.lastUsed=Date.now(),{texture:l.texture,sourceCoord:l.coord,uvOffsetScale:this._computeUvOffsetScale(t,i,r,l.coord.z,l.coord.x,l.coord.y)};n-=1,s=Math.floor(s/2),a=Math.floor(a/2)}return null}getReadyHillshadeTile(e,t,i,r){if(this._destroyed||t<e.minZoom)return null;this.setActiveLayer(e.id);let n=t,s=i,a=r;if(n>e.maxZoom){const c=1<<n-e.maxZoom;s=Math.floor(s/c),a=Math.floor(a/c),n=e.maxZoom}for(;n>=e.minZoom;){const l=this._getOrMaterializeHillshade(e,n,s,a);if(l)return l.lastUsed=Date.now(),{texture:l.texture,sourceCoord:l.coord};n-=1,s=Math.floor(s/2),a=Math.floor(a/2)}return null}invalidateLayer(e){if(!this._destroyed){this._invalidateCachesForLayer(e);for(const t of this._inFlight.keys())this._layerIdFromKey(t)===e&&this._inFlight.delete(t);this._clearPendingForLayer(e)}}invalidateAll(){this._destroyed||(this._releaseCache(this._heightCache),this._releaseCache(this._hillshadeCache),this._inFlight.clear(),this._pendingQueue.length=0,this._pendingKeys.clear())}destroy(){this._destroyed||(this._destroyed=!0,this._releaseCache(this._heightCache),this._releaseCache(this._hillshadeCache),this._inFlight.clear(),this._pendingQueue.length=0,this._pendingKeys.clear(),this._renderEngine=null,this.onDirty=null,this._activeLayerId=null)}get heightCacheSize(){return this._heightCache.size}get hillshadeCacheSize(){return this._hillshadeCache.size}get inFlightCount(){return this._inFlight.size}_startRequest(e,t,i,r){const n=this._cacheKey(e.id,t,i,r);if(!this._inFlight.has(n)&&!this._pendingKeys.has(n)){if(this._inFlight.size>=this._maxConcurrent){this._pendingQueue.length<64&&(this._pendingQueue.push({layer:e,z:t,x:i,y:r}),this._pendingKeys.add(n));return}this._executeRequest(e,t,i,r,n)}}_executeRequest(e,t,i,r,n){const s=Promise.resolve().then(async()=>{if(await e.requestTile(t,i,r),this._destroyed||this._activeLayerId!==e.id)return;const a=this._materializeHeightIfReady(e,t,i,r),l=this._materializeHillshadeIfReady(e,t,i,r);(a||l)&&this.onDirty?.()}).catch(()=>{}).finally(()=>{this._inFlight.delete(n),this._drainQueue()});this._inFlight.set(n,s)}_drainQueue(){for(;this._pendingQueue.length>0&&this._inFlight.size<this._maxConcurrent;){const e=this._pendingQueue.shift(),t=this._cacheKey(e.layer.id,e.z,e.x,e.y);this._pendingKeys.delete(t),!this._inFlight.has(t)&&this._activeLayerId===e.layer.id&&(this._heightCache.has(t)||this._executeRequest(e.layer,e.z,e.x,e.y,t))}}_normalizeRequestCoord(e,t){if(t.z<e.minZoom)return null;if(t.z<=e.maxZoom)return t;const r=1<<t.z-e.maxZoom;return{z:e.maxZoom,x:Math.floor(t.x/r),y:Math.floor(t.y/r)}}_cacheKey(e,t,i,r){return`${e}|${t}/${i}/${r}`}_layerIdFromKey(e){const t=e.indexOf("|");return t<0?e:e.slice(0,t)}_materializeHeightIfReady(e,t,i,r){return this._getOrMaterializeHeight(e,t,i,r)!==null}_materializeHillshadeIfReady(e,t,i,r){return this._getOrMaterializeHillshade(e,t,i,r)!==null}_getOrMaterializeHeight(e,t,i,r){const n=this._cacheKey(e.id,t,i,r),s=this._heightCache.get(n);if(s)return s;if(!this._renderEngine)return null;const a=e.getReadyHeightTile(t,i,r);if(!a)return null;const l=this._createHeightEntry(a);return this._heightCache.set(n,l),this._evictIfNeeded(this._heightCache,this._maxHeightCacheEntries),l}_getOrMaterializeHillshade(e,t,i,r){const n=this._cacheKey(e.id,t,i,r),s=this._hillshadeCache.get(n);if(s)return s;if(!this._renderEngine)return null;const a=e.getReadyHillshadeTile(t,i,r);if(!a)return null;const l=this._createHillshadeEntry(a);return this._hillshadeCache.set(n,l),this._evictIfNeeded(this._hillshadeCache,this._maxHillshadeCacheEntries),l}_createHeightEntry(e){if(!this._renderEngine)throw new Error("TerrainTileManager render engine is not set");return{texture:this._renderEngine.createFloat32Texture(e.data,e.width,e.height),coord:{z:e.z,x:e.x,y:e.y},lastUsed:Date.now()}}_createHillshadeEntry(e){if(!this._renderEngine)throw new Error("TerrainTileManager render engine is not set");let t=e.data;return e.data.length===e.width*e.height&&(t=this._expandGrayToRgba(e.data)),{texture:this._renderEngine.createRGBA8Texture(t,e.width,e.height),coord:{z:e.z,x:e.x,y:e.y},lastUsed:Date.now()}}_expandGrayToRgba(e){const t=new Uint8Array(e.length*4);for(let i=0;i<e.length;i++){const r=e[i]??0,n=i*4;t[n]=r,t[n+1]=r,t[n+2]=r,t[n+3]=255}return t}_computeUvOffsetScale(e,t,i,r,n,s){if(r>=e)return[0,0,1,1];const l=1<<e-r,c=1/l,d=(t-n*l)*c,u=(i-s*l)*c;return[d,u,c,c]}_evictIfNeeded(e,t){if(!this._renderEngine||e.size<=t)return;const i=[...e.entries()].sort((n,s)=>n[1].lastUsed-s[1].lastUsed),r=e.size-t;for(let n=0;n<r;n++){const s=i[n];if(!s)break;e.delete(s[0]),this._renderEngine.releaseTexture(s[1].texture)}}_pruneCachesForActiveLayer(){if(this._renderEngine){for(const e of[...this._heightCache.keys()]){if(this._layerIdFromKey(e)===this._activeLayerId)continue;const t=this._heightCache.get(e);t&&(this._heightCache.delete(e),this._renderEngine.releaseTexture(t.texture))}for(const e of[...this._hillshadeCache.keys()]){if(this._layerIdFromKey(e)===this._activeLayerId)continue;const t=this._hillshadeCache.get(e);t&&(this._hillshadeCache.delete(e),this._renderEngine.releaseTexture(t.texture))}}}_clearPendingForLayer(e){for(let t=this._pendingQueue.length-1;t>=0;t--){const i=this._pendingQueue[t];if(i&&i.layer.id===e){const r=this._cacheKey(i.layer.id,i.z,i.x,i.y);this._pendingKeys.delete(r),this._pendingQueue.splice(t,1)}}}_invalidateCachesForLayer(e){if(this._renderEngine){for(const t of[...this._heightCache.keys()]){if(this._layerIdFromKey(t)!==e)continue;const i=this._heightCache.get(t);i&&(this._heightCache.delete(t),this._renderEngine.releaseTexture(i.texture))}for(const t of[...this._hillshadeCache.keys()]){if(this._layerIdFromKey(t)!==e)continue;const i=this._hillshadeCache.get(t);i&&(this._hillshadeCache.delete(t),this._renderEngine.releaseTexture(i.texture))}}}_releaseCache(e){if(this._renderEngine)for(const t of e.values())this._renderEngine.releaseTexture(t.texture);e.clear()}}class to{_element;_camera;_onDirty;_onViewChange;_panEnabled;_zoomEnabled;_keyboardEnabled;_doubleClickZoom;_zoomSpeed;_inertiaDuration;_dragging=!1;_lastPointerX=0;_lastPointerY=0;_activePointerId=null;_pointers=new Map;_lastPinchDist=0;_lastPinchCenterX=0;_lastPinchCenterY=0;_velocityX=0;_velocityY=0;_lastMoveTime=0;_inertiaRafId=null;_lastClickTime=0;_lastClickX=0;_lastClickY=0;_onPointerDown;_onPointerMove;_onPointerUp;_onWheel;_onKeyDown;_onContextMenu;_destroyed=!1;constructor(e,t,i,r,n={}){this._element=e,this._camera=t,this._onDirty=i,this._onViewChange=r,this._panEnabled=n.pan??!0,this._zoomEnabled=n.zoom??!0,this._keyboardEnabled=n.keyboard??!0,this._doubleClickZoom=n.doubleClickZoom??!0,this._zoomSpeed=n.zoomSpeed??1,this._inertiaDuration=n.inertiaDuration??300,this._onPointerDown=this._handlePointerDown.bind(this),this._onPointerMove=this._handlePointerMove.bind(this),this._onPointerUp=this._handlePointerUp.bind(this),this._onWheel=this._handleWheel.bind(this),this._onKeyDown=this._handleKeyDown.bind(this),this._onContextMenu=s=>s.preventDefault(),this._attach()}destroy(){this._destroyed||(this._destroyed=!0,this._stopInertia(),this._detach())}_attach(){const e=this._element;e.addEventListener("pointerdown",this._onPointerDown),e.addEventListener("pointermove",this._onPointerMove),e.addEventListener("pointerup",this._onPointerUp),e.addEventListener("pointercancel",this._onPointerUp),e.addEventListener("wheel",this._onWheel,{passive:!1}),e.addEventListener("contextmenu",this._onContextMenu),this._keyboardEnabled&&(e.getAttribute("tabindex")||e.setAttribute("tabindex","0"),e.addEventListener("keydown",this._onKeyDown)),e.style.touchAction="none"}_detach(){const e=this._element;e.removeEventListener("pointerdown",this._onPointerDown),e.removeEventListener("pointermove",this._onPointerMove),e.removeEventListener("pointerup",this._onPointerUp),e.removeEventListener("pointercancel",this._onPointerUp),e.removeEventListener("wheel",this._onWheel),e.removeEventListener("contextmenu",this._onContextMenu),e.removeEventListener("keydown",this._onKeyDown)}_handlePointerDown(e){if(this._destroyed)return;const t=e.target;if(!(t&&t!==this._element&&t.tagName!=="CANVAS"))if(this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this._element.setPointerCapture(e.pointerId),this._stopInertia(),this._pointers.size===1){if(!this._panEnabled)return;if(this._dragging=!0,this._activePointerId=e.pointerId,this._lastPointerX=e.clientX,this._lastPointerY=e.clientY,this._velocityX=0,this._velocityY=0,this._lastMoveTime=performance.now(),this._doubleClickZoom){const i=performance.now(),r=i-this._lastClickTime,n=e.clientX-this._lastClickX,s=e.clientY-this._lastClickY;if(r<300&&Math.abs(n)<5&&Math.abs(s)<5){this._handleDoubleClick(e.clientX,e.clientY),this._lastClickTime=0;return}this._lastClickTime=i,this._lastClickX=e.clientX,this._lastClickY=e.clientY}}else this._pointers.size===2&&(this._dragging=!1,this._initPinch())}_handlePointerMove(e){if(this._destroyed)return;if(this._pointers.has(e.pointerId)&&this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this._pointers.size===2&&this._zoomEnabled){this._handlePinchMove();return}if(!this._dragging||e.pointerId!==this._activePointerId)return;const t=e.clientX-this._lastPointerX,i=e.clientY-this._lastPointerY;if(t===0&&i===0)return;const r=this._getResolution(),n=-t*r,s=i*r,a=this._camera.rotation;let l=n,c=s;if(a!==0){const f=Math.cos(-a),p=Math.sin(-a);l=n*f-s*p,c=n*p+s*f}const d=this._camera.center;this._camera.setCenter([d[0]+l,d[1]+c]);const u=performance.now(),h=u-this._lastMoveTime;h>0&&(this._velocityX=l/h,this._velocityY=c/h),this._lastMoveTime=u,this._lastPointerX=e.clientX,this._lastPointerY=e.clientY,this._notifyChange()}_handlePointerUp(e){if(!this._destroyed){this._pointers.delete(e.pointerId);try{this._element.releasePointerCapture(e.pointerId)}catch{}if(this._pointers.size<2&&(this._lastPinchDist=0),this._pointers.size===1){const[t,i]=[...this._pointers.entries()][0];this._dragging=!0,this._activePointerId=t,this._lastPointerX=i.x,this._lastPointerY=i.y;return}e.pointerId===this._activePointerId&&(this._dragging=!1,this._activePointerId=null,this._inertiaDuration>0&&this._panEnabled&&Math.sqrt(this._velocityX*this._velocityX+this._velocityY*this._velocityY)>.001&&this._startInertia())}}_handleWheel(e){if(this._destroyed||!this._zoomEnabled)return;e.preventDefault();let t=e.deltaY;e.deltaMode===1&&(t*=16),e.deltaMode===2&&(t*=100);const i=-t*.002*this._zoomSpeed,r=this._camera.zoom+i,n=this._element.getBoundingClientRect(),s=e.clientX-n.left,a=e.clientY-n.top;this._zoomToPoint(s,a,r),this._notifyChange()}_handleKeyDown(e){if(this._destroyed)return;const t=e.target;if(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT")return;const r=100*this._getResolution();switch(e.key){case"+":case"=":if(!this._zoomEnabled)return;e.preventDefault(),this._camera.setZoom(this._camera.zoom+1),this._notifyChange();break;case"-":case"_":if(!this._zoomEnabled)return;e.preventDefault(),this._camera.setZoom(this._camera.zoom-1),this._notifyChange();break;case"ArrowLeft":if(!this._panEnabled)return;e.preventDefault(),this._camera.setCenter([this._camera.center[0]-r,this._camera.center[1]]),this._notifyChange();break;case"ArrowRight":if(!this._panEnabled)return;e.preventDefault(),this._camera.setCenter([this._camera.center[0]+r,this._camera.center[1]]),this._notifyChange();break;case"ArrowUp":if(!this._panEnabled)return;e.preventDefault(),this._camera.setCenter([this._camera.center[0],this._camera.center[1]+r]),this._notifyChange();break;case"ArrowDown":if(!this._panEnabled)return;e.preventDefault(),this._camera.setCenter([this._camera.center[0],this._camera.center[1]-r]),this._notifyChange();break}}_handleDoubleClick(e,t){if(!this._zoomEnabled)return;const i=this._element.getBoundingClientRect(),r=e-i.left,n=t-i.top;this._zoomToPoint(r,n,this._camera.zoom+1),this._notifyChange()}_initPinch(){const e=[...this._pointers.values()];if(e.length<2)return;const t=e[0],i=e[1];this._lastPinchDist=Math.hypot(i.x-t.x,i.y-t.y),this._lastPinchCenterX=(t.x+i.x)/2,this._lastPinchCenterY=(t.y+i.y)/2}_handlePinchMove(){const e=[...this._pointers.values()];if(e.length<2)return;const t=e[0],i=e[1],r=Math.hypot(i.x-t.x,i.y-t.y),n=(t.x+i.x)/2,s=(t.y+i.y)/2;if(this._lastPinchDist>0){const a=r/this._lastPinchDist,l=Math.log2(a),c=this._camera.zoom+l,d=this._element.getBoundingClientRect(),u=n-d.left,h=s-d.top;if(this._zoomToPoint(u,h,c),this._panEnabled){const f=this._getResolution(),p=-(n-this._lastPinchCenterX)*f,g=(s-this._lastPinchCenterY)*f,x=this._camera.center;this._camera.setCenter([x[0]+p,x[1]+g])}this._notifyChange()}this._lastPinchDist=r,this._lastPinchCenterX=n,this._lastPinchCenterY=s}_startInertia(){const e=performance.now(),t=this._velocityX,i=this._velocityY,r=this._inertiaDuration,n=()=>{if(this._destroyed||this._dragging)return;const s=performance.now()-e;if(s>=r){this._inertiaRafId=null;return}const a=s/r,l=1-a*a,c=16,d=t*c*l,u=i*c*l,h=this._camera.center;this._camera.setCenter([h[0]+d,h[1]+u]),this._notifyChange(),this._inertiaRafId=requestAnimationFrame(n)};this._inertiaRafId=requestAnimationFrame(n)}_stopInertia(){this._inertiaRafId!==null&&(cancelAnimationFrame(this._inertiaRafId),this._inertiaRafId=null)}_zoomToPoint(e,t,i){const r=this._camera.screenToMap(e,t);this._camera.setZoom(i);const n=this._camera.screenToMap(e,t),s=this._camera.center;this._camera.setCenter([s[0]+(r[0]-n[0]),s[1]+(r[1]-n[1])])}_getResolution(){return 20037508342789244e-9*2/(256*Math.pow(2,this._camera.zoom))}_notifyChange(){this._onDirty(),this._onViewChange()}}function io(o,e,t=2){const i=e&&e.length,r=i?e[0]*t:o.length;let n=er(o,0,r,t,!0);const s=[];if(!n||n.next===n.prev)return s;let a,l,c;if(i&&(n=ao(o,e,n,t)),o.length>80*t){a=o[0],l=o[1];let d=a,u=l;for(let h=t;h<r;h+=t){const f=o[h],p=o[h+1];f<a&&(a=f),p<l&&(l=p),f>d&&(d=f),p>u&&(u=p)}c=Math.max(d-a,u-l),c=c!==0?32767/c:0}return Re(n,s,t,a,l,c,0),s}function er(o,e,t,i,r){let n;if(r===yo(o,e,t,i)>0)for(let s=e;s<t;s+=i)n=Jt(s/i|0,o[s],o[s+1],n);else for(let s=t-i;s>=e;s-=i)n=Jt(s/i|0,o[s],o[s+1],n);return n&&_e(n,n.next)&&(Ae(n),n=n.next),n}function he(o,e){if(!o)return o;e||(e=o);let t=o,i;do if(i=!1,!t.steiner&&(_e(t,t.next)||z(t.prev,t,t.next)===0)){if(Ae(t),t=e=t.prev,t===t.next)break;i=!0}else t=t.next;while(i||t!==e);return e}function Re(o,e,t,i,r,n,s){if(!o)return;!s&&n&&fo(o,i,r,n);let a=o;for(;o.prev!==o.next;){const l=o.prev,c=o.next;if(n?oo(o,i,r,n):ro(o)){e.push(l.i,o.i,c.i),Ae(o),o=c.next,a=c.next;continue}if(o=c,o===a){s?s===1?(o=no(he(o),e),Re(o,e,t,i,r,n,2)):s===2&&so(o,e,t,i,r,n):Re(he(o),e,t,i,r,n,1);break}}}function ro(o){const e=o.prev,t=o,i=o.next;if(z(e,t,i)>=0)return!1;const r=e.x,n=t.x,s=i.x,a=e.y,l=t.y,c=i.y,d=Math.min(r,n,s),u=Math.min(a,l,c),h=Math.max(r,n,s),f=Math.max(a,l,c);let p=i.next;for(;p!==e;){if(p.x>=d&&p.x<=h&&p.y>=u&&p.y<=f&&Fe(r,a,n,l,s,c,p.x,p.y)&&z(p.prev,p,p.next)>=0)return!1;p=p.next}return!0}function oo(o,e,t,i){const r=o.prev,n=o,s=o.next;if(z(r,n,s)>=0)return!1;const a=r.x,l=n.x,c=s.x,d=r.y,u=n.y,h=s.y,f=Math.min(a,l,c),p=Math.min(d,u,h),g=Math.max(a,l,c),x=Math.max(d,u,h),v=Dt(f,p,e,t,i),y=Dt(g,x,e,t,i);let m=o.prevZ,_=o.nextZ;for(;m&&m.z>=v&&_&&_.z<=y;){if(m.x>=f&&m.x<=g&&m.y>=p&&m.y<=x&&m!==r&&m!==s&&Fe(a,d,l,u,c,h,m.x,m.y)&&z(m.prev,m,m.next)>=0||(m=m.prevZ,_.x>=f&&_.x<=g&&_.y>=p&&_.y<=x&&_!==r&&_!==s&&Fe(a,d,l,u,c,h,_.x,_.y)&&z(_.prev,_,_.next)>=0))return!1;_=_.nextZ}for(;m&&m.z>=v;){if(m.x>=f&&m.x<=g&&m.y>=p&&m.y<=x&&m!==r&&m!==s&&Fe(a,d,l,u,c,h,m.x,m.y)&&z(m.prev,m,m.next)>=0)return!1;m=m.prevZ}for(;_&&_.z<=y;){if(_.x>=f&&_.x<=g&&_.y>=p&&_.y<=x&&_!==r&&_!==s&&Fe(a,d,l,u,c,h,_.x,_.y)&&z(_.prev,_,_.next)>=0)return!1;_=_.nextZ}return!0}function no(o,e){let t=o;do{const i=t.prev,r=t.next.next;!_e(i,r)&&ir(i,t,t.next,r)&&ze(i,r)&&ze(r,i)&&(e.push(i.i,t.i,r.i),Ae(t),Ae(t.next),t=o=r),t=t.next}while(t!==o);return he(t)}function so(o,e,t,i,r,n){let s=o;do{let a=s.next.next;for(;a!==s.prev;){if(s.i!==a.i&&go(s,a)){let l=rr(s,a);s=he(s,s.next),l=he(l,l.next),Re(s,e,t,i,r,n,0),Re(l,e,t,i,r,n,0);return}a=a.next}s=s.next}while(s!==o)}function ao(o,e,t,i){const r=[];for(let n=0,s=e.length;n<s;n++){const a=e[n]*i,l=n<s-1?e[n+1]*i:o.length,c=er(o,a,l,i,!1);c===c.next&&(c.steiner=!0),r.push(mo(c))}r.sort(lo);for(let n=0;n<r.length;n++)t=co(r[n],t);return t}function lo(o,e){let t=o.x-e.x;if(t===0&&(t=o.y-e.y,t===0)){const i=(o.next.y-o.y)/(o.next.x-o.x),r=(e.next.y-e.y)/(e.next.x-e.x);t=i-r}return t}function co(o,e){const t=uo(o,e);if(!t)return e;const i=rr(t,o);return he(i,i.next),he(t,t.next)}function uo(o,e){let t=e;const i=o.x,r=o.y;let n=-1/0,s;if(_e(o,t))return t;do{if(_e(o,t.next))return t.next;if(r<=t.y&&r>=t.next.y&&t.next.y!==t.y){const u=t.x+(r-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(u<=i&&u>n&&(n=u,s=t.x<t.next.x?t:t.next,u===i))return s}t=t.next}while(t!==e);if(!s)return null;const a=s,l=s.x,c=s.y;let d=1/0;t=s;do{if(i>=t.x&&t.x>=l&&i!==t.x&&tr(r<c?i:n,r,l,c,r<c?n:i,r,t.x,t.y)){const u=Math.abs(r-t.y)/(i-t.x);ze(t,o)&&(u<d||u===d&&(t.x>s.x||t.x===s.x&&ho(s,t)))&&(s=t,d=u)}t=t.next}while(t!==a);return s}function ho(o,e){return z(o.prev,o,e.prev)<0&&z(e.next,o,o.next)<0}function fo(o,e,t,i){let r=o;do r.z===0&&(r.z=Dt(r.x,r.y,e,t,i)),r.prevZ=r.prev,r.nextZ=r.next,r=r.next;while(r!==o);r.prevZ.nextZ=null,r.prevZ=null,po(r)}function po(o){let e,t=1;do{let i=o,r;o=null;let n=null;for(e=0;i;){e++;let s=i,a=0;for(let c=0;c<t&&(a++,s=s.nextZ,!!s);c++);let l=t;for(;a>0||l>0&&s;)a!==0&&(l===0||!s||i.z<=s.z)?(r=i,i=i.nextZ,a--):(r=s,s=s.nextZ,l--),n?n.nextZ=r:o=r,r.prevZ=n,n=r;i=s}n.nextZ=null,t*=2}while(e>1);return o}function Dt(o,e,t,i,r){return o=(o-t)*r|0,e=(e-i)*r|0,o=(o|o<<8)&16711935,o=(o|o<<4)&252645135,o=(o|o<<2)&858993459,o=(o|o<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,o|e<<1}function mo(o){let e=o,t=o;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==o);return t}function tr(o,e,t,i,r,n,s,a){return(r-s)*(e-a)>=(o-s)*(n-a)&&(o-s)*(i-a)>=(t-s)*(e-a)&&(t-s)*(n-a)>=(r-s)*(i-a)}function Fe(o,e,t,i,r,n,s,a){return!(o===s&&e===a)&&tr(o,e,t,i,r,n,s,a)}function go(o,e){return o.next.i!==e.i&&o.prev.i!==e.i&&!xo(o,e)&&(ze(o,e)&&ze(e,o)&&vo(o,e)&&(z(o.prev,o,e.prev)||z(o,e.prev,e))||_e(o,e)&&z(o.prev,o,o.next)>0&&z(e.prev,e,e.next)>0)}function z(o,e,t){return(e.y-o.y)*(t.x-e.x)-(e.x-o.x)*(t.y-e.y)}function _e(o,e){return o.x===e.x&&o.y===e.y}function ir(o,e,t,i){const r=Ve(z(o,e,t)),n=Ve(z(o,e,i)),s=Ve(z(t,i,o)),a=Ve(z(t,i,e));return!!(r!==n&&s!==a||r===0&&ke(o,t,e)||n===0&&ke(o,i,e)||s===0&&ke(t,o,i)||a===0&&ke(t,e,i))}function ke(o,e,t){return e.x<=Math.max(o.x,t.x)&&e.x>=Math.min(o.x,t.x)&&e.y<=Math.max(o.y,t.y)&&e.y>=Math.min(o.y,t.y)}function Ve(o){return o>0?1:o<0?-1:0}function xo(o,e){let t=o;do{if(t.i!==o.i&&t.next.i!==o.i&&t.i!==e.i&&t.next.i!==e.i&&ir(t,t.next,o,e))return!0;t=t.next}while(t!==o);return!1}function ze(o,e){return z(o.prev,o,o.next)<0?z(o,e,o.next)>=0&&z(o,o.prev,e)>=0:z(o,e,o.prev)<0||z(o,o.next,e)<0}function vo(o,e){let t=o,i=!1;const r=(o.x+e.x)/2,n=(o.y+e.y)/2;do t.y>n!=t.next.y>n&&t.next.y!==t.y&&r<(t.next.x-t.x)*(n-t.y)/(t.next.y-t.y)+t.x&&(i=!i),t=t.next;while(t!==o);return i}function rr(o,e){const t=Rt(o.i,o.x,o.y),i=Rt(e.i,e.x,e.y),r=o.next,n=e.prev;return o.next=e,e.prev=o,t.next=r,r.prev=t,i.next=t,t.prev=i,n.next=i,i.prev=n,i}function Jt(o,e,t,i){const r=Rt(o,e,t);return i?(r.next=i.next,r.prev=i,i.next.prev=r,i.next=r):(r.prev=r,r.next=r),r}function Ae(o){o.next.prev=o.prev,o.prev.next=o.next,o.prevZ&&(o.prevZ.nextZ=o.nextZ),o.nextZ&&(o.nextZ.prevZ=o.prevZ)}function Rt(o,e,t){return{i:o,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function yo(o,e,t,i){let r=0;for(let n=e,s=t-i;n<t;n+=i)r+=(o[s]-o[n])*(o[n+1]+o[s+1]),s=n;return r}function or(o,e,t=2){return io(o,e??void 0,t)}function ei(o,e,t,i){let r=0;for(let n=e,s=t-i;n<t;n+=i)r+=(o[s]-o[n])*(o[n+1]+o[s+1]),s=n;return r}function _o(o,e,t,i){const r=e&&e.length>0,n=r?e[0]*t:o.length;let s=0;for(let l=0;l<i.length;l+=3){const c=i[l]*t,d=i[l+1]*t,u=i[l+2]*t;s+=Math.abs((o[c]-o[u])*(o[d+1]-o[c+1])-(o[c]-o[d])*(o[u+1]-o[c+1]))}let a=Math.abs(ei(o,0,n,t));if(r)for(let l=0;l<e.length;l++){const c=e[l]*t,d=l<e.length-1?e[l+1]*t:o.length;a-=Math.abs(ei(o,c,d,t))}return a===0&&s===0?0:Math.abs((s-a)/a)}const nr=6378137,ti=85.0511287798066;function zt(o){return o*Math.PI*nr/180}function At(o){const t=Math.max(-ti,Math.min(ti,o))*Math.PI/180;return Math.log(Math.tan(Math.PI/4+t/2))*nr}function le(o,e){return e==="EPSG:3857"?[o[0],o[1],o[2]??0]:[zt(o[0]),At(o[1]),o[2]??0]}class j{static pointsFromFeatures(e){const t=[];for(const r of e)j._extractPoints(r.geometry,t);if(t.length===0)return null;const i=t.length/3;return{vertices:new Float32Array(t),count:i}}static linesFromFeatures(e){const t=[];for(const i of e)j._extractLines(i.geometry,t);return t.length===0?null:j._buildLineBuffers(t)}static polygonsFromFeatures(e){const t=[],i=[];let r=0;for(const n of e)j._extractPolygons(n.geometry,t,i,r),r=t.length/3;return i.length===0?null:{vertices:new Float32Array(t),indices:new Uint32Array(i),indexCount:i.length}}static modelInstancesFromFeatures(e,t,i,r,n,s){const a=[];for(const l of e){const c=l.geometry;if(!c)continue;const d=l.attributes??{},u=d.scale??t,h=i??d.heading??0,f=r??d.pitch??0,p=n??d.roll??0,g=d.anchorZ??s;if(c.type==="Point"){const x=c.coordinates;a.push(zt(x[0]),At(x[1]),x[2]??0,u,h,f,p,g)}else if(c.type==="MultiPoint"){const x=c.coordinates;for(const v of x)a.push(zt(v[0]),At(v[1]),v[2]??0,u,h,f,p,g)}}return a.length===0?null:{instances:new Float32Array(a),count:a.length/8}}static _extractPoints(e,t){const i=e.coordinates;switch(e.type){case"Point":{const r=i,[n,s,a]=le(r,e.spatialReference);t.push(n,s,a);break}case"MultiPoint":{const r=i;for(const n of r){const[s,a,l]=le(n,e.spatialReference);t.push(s,a,l)}break}}}static _extractLines(e,t){const i=e.coordinates;switch(e.type){case"LineString":{const r=i,n=[];for(const s of r){const[a,l,c]=le(s,e.spatialReference);n.push(a,l,c)}n.length>=6&&t.push(n);break}case"MultiLineString":{const r=i;for(const n of r){const s=[];for(const a of n){const[l,c,d]=le(a,e.spatialReference);s.push(l,c,d)}s.length>=6&&t.push(s)}break}case"Polygon":{const r=i;for(const n of r){const s=[];for(const a of n){const[l,c,d]=le(a,e.spatialReference);s.push(l,c,d)}s.length>=6&&t.push(s)}break}case"MultiPolygon":{const r=i;for(const n of r)for(const s of n){const a=[];for(const l of s){const[c,d,u]=le(l,e.spatialReference);a.push(c,d,u)}a.length>=6&&t.push(a)}break}}}static _extractPolygons(e,t,i,r){const n=e.coordinates;switch(e.type){case"Polygon":{const s=n;j._triangulatePolygon(s,e.spatialReference,t,i,r);break}case"MultiPolygon":{const s=n;for(const a of s){const l=t.length/3;j._triangulatePolygon(a,e.spatialReference,t,i,l)}break}}}static _triangulatePolygon(e,t,i,r,n){const s=[],a=[],l=[];for(let u=0;u<e.length;u++){u>0&&l.push(s.length/2);const h=e[u];for(const f of h){const[p,g,x]=le(f,t);s.push(p,g),a.push(x)}}const c=or(s,l.length>0?l:void 0,2),d=i.length/3;for(let u=0;u<s.length;u+=2)i.push(s[u],s[u+1],a[u/2]??0);for(const u of c)r.push(d+u)}static _buildLineBuffers(e){let t=0,i=0;for(const c of e){const d=c.length/3;t+=d*2,i+=(d-1)*6}const r=new Float32Array(t*11),n=new Uint32Array(i);let s=0,a=0,l=0;for(const c of e){const d=c.length/3;let u=0;for(let h=0;h<d;h++){if(h>0){const x=(h-1)*3,v=h*3,y=c[v]-c[x],m=c[v+1]-c[x+1];u+=Math.sqrt(y*y+m*m)}const f=Math.max(0,h-1)*3,p=h*3,g=Math.min(d-1,h+1)*3;r[s++]=c[f],r[s++]=c[f+1],r[s++]=c[f+2],r[s++]=c[p],r[s++]=c[p+1],r[s++]=c[p+2],r[s++]=c[g],r[s++]=c[g+1],r[s++]=c[g+2],r[s++]=1,r[s++]=u,r[s++]=c[f],r[s++]=c[f+1],r[s++]=c[f+2],r[s++]=c[p],r[s++]=c[p+1],r[s++]=c[p+2],r[s++]=c[g],r[s++]=c[g+1],r[s++]=c[g+2],r[s++]=-1,r[s++]=u}for(let h=0;h<d-1;h++){const f=l+h*2,p=l+h*2+1,g=l+(h+1)*2,x=l+(h+1)*2+1;n[a++]=f,n[a++]=p,n[a++]=g,n[a++]=p,n[a++]=x,n[a++]=g}l+=d*2}return{vertices:r,indices:n,indexCount:i}}}function bo(o=1,e=1,t=1){const i=o/2,r=e/2,n=t/2,s=new Float32Array([-i,-r,n,i,-r,n,i,r,n,-i,r,n,i,-r,-n,-i,-r,-n,-i,r,-n,i,r,-n,-i,r,n,i,r,n,i,r,-n,-i,r,-n,-i,-r,-n,i,-r,-n,i,-r,n,-i,-r,n,i,-r,n,i,-r,-n,i,r,-n,i,r,n,-i,-r,-n,-i,-r,n,-i,r,n,-i,r,-n]),a=new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0]),l=new Uint32Array([0,1,2,0,2,3,4,5,6,4,6,7,8,9,10,8,10,11,12,13,14,12,14,15,16,17,18,16,18,19,20,21,22,20,22,23]);return{positions:s,normals:a,indices:l,vertexCount:24}}function ii(o=.5,e=.5,t=1,i=32){const r=t/2,n=[],s=[],a=[];let l=0;for(let u=0;u<=i;u++){const h=u/i*Math.PI*2,f=Math.cos(h),p=Math.sin(h);n.push(f*e,-r,p*e),n.push(f*o,r,p*o);const g=e-o,x=Math.sqrt(g*g+t*t),v=f*t/x,y=g/x,m=p*t/x;if(s.push(v,y,m),s.push(v,y,m),u<i){const _=l;a.push(_,_+1,_+3),a.push(_,_+3,_+2),l+=2}}l+=2;const c=l;n.push(0,r,0),s.push(0,1,0),l++;for(let u=0;u<i;u++){const h=u/i*Math.PI*2;n.push(Math.cos(h)*o,r,Math.sin(h)*o),s.push(0,1,0),u>0&&a.push(c,l-1,l),l++}a.push(c,l-1,c+1);const d=l;n.push(0,-r,0),s.push(0,-1,0),l++;for(let u=0;u<i;u++){const h=u/i*Math.PI*2;n.push(Math.cos(h)*e,-r,Math.sin(h)*e),s.push(0,-1,0),u>0&&a.push(d,l,l-1),l++}return a.push(d,d+1,l-1),{positions:new Float32Array(n),normals:new Float32Array(s),indices:new Uint32Array(a),vertexCount:n.length/3}}function Po(o=1,e=32,t=12){const i=[],r=[],n=[];for(let a=0;a<=t;a++){const l=a/t*(Math.PI/2),c=Math.sin(l),d=Math.cos(l);for(let u=0;u<=e;u++){const h=u/e*Math.PI*2,f=c*Math.cos(h),p=d,g=c*Math.sin(h);i.push(f*o,p*o,g*o),r.push(f,p,g)}}for(let a=0;a<t;a++)for(let l=0;l<e;l++){const c=a*(e+1)+l,d=c+e+1;n.push(c,d,c+1),n.push(d,d+1,c+1)}const s=i.length/3;i.push(0,0,0),r.push(0,-1,0);for(let a=0;a<=e;a++){const l=a/e*Math.PI*2;i.push(Math.cos(l)*o,0,Math.sin(l)*o),r.push(0,-1,0)}for(let a=0;a<e;a++)n.push(s,s+1+a+1,s+1+a);return{positions:new Float32Array(i),normals:new Float32Array(r),indices:new Uint32Array(n),vertexCount:i.length/3}}const sr=6378137,ri=85.0511287798066;function oi(o){return o*Math.PI*sr/180}function ni(o){const e=Math.max(-ri,Math.min(ri,o));return Math.log(Math.tan(Math.PI/4+e*Math.PI/180/2))*sr}function wo(o,e,t){if(o.length<2||e.length<o.length)return{positions:new Float32Array(0),normals:new Float32Array(0),indices:new Uint32Array(0),vertexCount:0};const i=t??new Array(o.length).fill(0),r=[],n=[],s=[];for(let a=0;a<o.length-1;a++){const[l,c]=o[a],[d,u]=o[a+1],h=oi(l),f=ni(c),p=oi(d),g=ni(u),x=p-h,v=g-f,y=Math.sqrt(x*x+v*v)||1,m=-v/y,_=x/y,w=r.length/3;r.push(h,f,i[a]),r.push(p,g,i[a+1]),r.push(p,g,e[a+1]),r.push(h,f,e[a]),n.push(m,_,0),n.push(m,_,0),n.push(m,_,0),n.push(m,_,0),s.push(w,w+1,w+2),s.push(w,w+2,w+3)}return{positions:new Float32Array(r),normals:new Float32Array(n),indices:new Uint32Array(s),vertexCount:r.length/3}}const Ge=$*Math.PI;function it(o,e){const[t,i]=H(o,e);return[(t+Ge)/(2*Ge),1-(i+Ge)/(2*Ge)]}function Co(o,e,t){const i=o.length>1&&o[0][0]===o[o.length-1][0]&&o[0][1]===o[o.length-1][1]?o.length-1:o.length,[r,n]=it(e[0],e[1]),s=[];for(let y=0;y<i;y++)s.push(it(o[y][0],o[y][1]));const a=i+1+1+i,l=i+i,c=new Float32Array(a*6),d=new Uint32Array(l*3);let u=0,h=0;function f(y,m,_,w,P,M){const b=u;return c[u*6+0]=y,c[u*6+1]=m,c[u*6+2]=_,c[u*6+3]=w,c[u*6+4]=P,c[u*6+5]=M,u++,b}const p=u;for(let y=0;y<i;y++){const[m,_]=s[y],w=m-r,P=_-n,M=Math.sqrt(w*w+P*P)||1,b=Math.atan2(t,M*2*Ge),C=Math.cos(b),S=Math.sin(b);f(m,_,0,w/M*C,P/M*C,S)}const g=f(r,n,t,0,0,1);for(let y=0;y<i;y++){const m=(y+1)%i;d[h++]=p+y,d[h++]=p+m,d[h++]=g}const x=f(r,n,0,0,0,-1),v=u;for(let y=0;y<i;y++){const[m,_]=s[y];f(m,_,0,0,0,-1)}for(let y=0;y<i;y++){const m=(y+1)%i;d[h++]=x,d[h++]=v+m,d[h++]=v+y}return{vertices:c,indices:d,indexCount:h}}function Mo(o,e,t,i=12){const r=o.length>1&&o[0][0]===o[o.length-1][0]&&o[0][1]===o[o.length-1][1]?o.length-1:o.length,[n,s]=it(e[0],e[1]),a=[];for(let P=0;P<r;P++)a.push(it(o[P][0],o[P][1]));const l=[];for(let P=0;P<r;P++){const M=a[P][0]-n,b=a[P][1]-s,C=Math.sqrt(M*M+b*b)||1;l.push([M/C,b/C,C])}const c=(i+1)*r,d=1+r,u=c+d,h=i*r,f=r,p=h*2+f,g=new Float32Array(u*6),x=new Uint32Array(p*3);let v=0,y=0;function m(P,M,b,C,S,T){const B=v;return g[v*6+0]=P,g[v*6+1]=M,g[v*6+2]=b,g[v*6+3]=C,g[v*6+4]=S,g[v*6+5]=T,v++,B}for(let P=0;P<=i;P++){const b=P/i*(Math.PI/2),C=Math.cos(b),S=Math.sin(b)*t;for(let T=0;T<r;T++){const[B,F,E]=l[T],G=n+B*E*C,D=s+F*E*C,V=B*Math.cos(b),U=F*Math.cos(b),k=Math.sin(b),X=Math.sqrt(V*V+U*U+k*k)||1;m(G,D,S,V/X,U/X,k/X)}}for(let P=0;P<i;P++){const M=P*r,b=(P+1)*r;for(let C=0;C<r;C++){const S=(C+1)%r;x[y++]=M+C,x[y++]=M+S,x[y++]=b+C,x[y++]=M+S,x[y++]=b+S,x[y++]=b+C}}const _=m(n,s,0,0,0,-1),w=v;for(let P=0;P<r;P++)m(a[P][0],a[P][1],0,0,0,-1);for(let P=0;P<r;P++){const M=(P+1)%r;x[y++]=_,x[y++]=w+M,x[y++]=w+P}return{vertices:g,indices:x,indexCount:y}}const ge=$*Math.PI,xt=Math.PI/180;function So(o,e){const t=e.meshType,i=e.scale?.[0]??50,r=e.scale?.[1]??100;if(t==="cone"||t==="sphere")return Fo(o,e,i,r);const n=To(t);if(!n)return null;const s=e.scale?.[0]??1,a=e.scale?.[1]??1,l=e.scale?.[2]??1,c=(e.heading??0)*xt,d=(e.pitch??0)*xt,u=(e.roll??0)*xt,h=Math.cos(c),f=Math.sin(c),p=Math.cos(d),g=Math.sin(d),x=Math.cos(u),v=Math.sin(u),y=h*x+f*g*v,m=-h*v+f*g*x,_=f*p,w=p*v,P=p*x,M=-g,b=-f*x+h*g*v,C=f*v+h*g*x,S=h*p,T=n.positions,B=n.normals,F=n.indices,E=n.vertexCount,G=F.length,D=E*o.length,V=G*o.length,U=new Float32Array(D*6),k=new Uint32Array(V);let X=0,ee=0;for(const Pe of o){const ae=Pe.geometry;if(!ae||ae.type!=="Point")continue;const fe=ae.coordinates,we=fe[0],Ce=fe[1],[Er,Lr]=H(we,Ce),Dr=(Er+ge)/(2*ge),Rr=1-(Lr+ge)/(2*ge);for(let O=0;O<E;O++){const ut=T[O*3]*s,ht=T[O*3+1]*a,dt=T[O*3+2]*l,Ar=y*ut+m*ht+_*dt,Ir=w*ut+P*ht+M*dt,Ur=b*ut+C*ht+S*dt,kr=Ar/(2*ge),Vr=-Ur/(2*ge),pe=(X+O)*6;U[pe+0]=Dr+kr,U[pe+1]=Rr+Vr,U[pe+2]=Ir;const ft=B[O*3],pt=B[O*3+1],mt=B[O*3+2];U[pe+3]=y*ft+m*pt+_*mt,U[pe+4]=w*ft+P*pt+M*mt,U[pe+5]=b*ft+C*pt+S*mt}const zr=X;for(let O=0;O<G;O++)k[ee+O]=zr+F[O];X+=E,ee+=G}return ee===0?null:{vertices:U,indices:k,indexCount:ee}}function To(o){switch(o){case"box":return vt(bo(2,1,2));case"cylinder":return vt(ii(1,1,1,32));case"sphere":return Po(1,32,12);case"cone":return vt(ii(0,1,1,32));default:return null}}function vt(o){let e=1/0;for(let t=1;t<o.positions.length;t+=3)o.positions[t]<e&&(e=o.positions[t]);if(e!==0)for(let t=1;t<o.positions.length;t+=3)o.positions[t]=o.positions[t]-e;return o}function Bo(o,e,t,i=32){const r=Math.PI/180,n=l=>l/(111320*Math.cos(e*r)),s=l=>l/110540,a=[];for(let l=0;l<=i;l++){const c=l/i*Math.PI*2;a.push([o+n(Math.cos(c)*t),e+s(Math.sin(c)*t)])}return a}function Fo(o,e,t,i){const r=[],n=[];let s=0;for(const a of o){const l=a.geometry;if(!l||l.type!=="Point")continue;const c=l.coordinates,d=c[0],u=c[1],h=Bo(d,u,t,32);let f;if(e.meshType==="cone"?f=Co(h,[d,u],i):f=Mo(h,[d,u],i,12),!(!f||f.indexCount===0)){for(let p=0;p<f.vertices.length;p++)r.push(f.vertices[p]);for(let p=0;p<f.indexCount;p++)n.push(f.indices[p]+s);s+=f.vertices.length/6}}return n.length===0?null:{vertices:new Float32Array(r),indices:new Uint32Array(n),indexCount:n.length}}const ar=6378137,si=85.0511287798066,Ee=20037508342789244e-9,ai=1e-7,Go=1e-10,Eo=.001,Lo=1e6/(2*Ee);function Do(o){return o*Math.PI*ar/180}function Ro(o){const t=Math.max(-si,Math.min(si,o))*Math.PI/180;return Math.log(Math.tan(Math.PI/4+t/2))*ar}function zo(o,e){return e==="EPSG:3857"?[o[0],o[1]]:[Do(o[0]),Ro(o[1])]}function Me(o,e){return[(o+Ee)/(2*Ee),1-(e+Ee)/(2*Ee)]}function li(o,e,t,i){return Math.abs(o-t)<=ai&&Math.abs(e-i)<=ai}function Ao(o,e){const t=[];for(const i of o){const[r,n]=zo(i,e);if(!Number.isFinite(r)||!Number.isFinite(n))continue;const s=t[t.length-1];s&&li(s[0],s[1],r,n)||t.push([r,n])}if(t.length>1){const i=t[0],r=t[t.length-1];li(i[0],i[1],r[0],r[1])&&t.pop()}return t}function Io(o,e,t){const i=[],r=[];let n=0;for(const a of o){const l=a.geometry;if(!l)continue;const c=Number(a.attributes[e])||10,d=Number(a.attributes[t])||0;if(l.type==="Polygon"){const u=l.coordinates;n=ci(u,l.spatialReference,c,d,i,r,n)}else if(l.type==="MultiPolygon"){const u=l.coordinates;for(const h of u)n=ci(h,l.spatialReference,c,d,i,r,n)}}if(r.length===0)return null;const s=Uo(i,r,Lo);if(s.length===0)return null;if(typeof globalThis<"u"&&globalThis.__MAPGPU_EXTRUSION_DEBUG){const a=i.length/8,l=s.length/3,c=r.length/3-l;let d=1/0,u=-1/0,h=1/0,f=-1/0,p=1/0,g=-1/0;for(let x=0;x<i.length;x+=8){const v=i[x],y=i[x+1],m=i[x+2];v<d&&(d=v),v>u&&(u=v),y<h&&(h=y),y>f&&(f=y),m<p&&(p=m),m>g&&(g=m)}console.log(`[Extrusion] features=${o.length} verts=${a} tris=${l} dropped=${c} xy=[${d.toFixed(6)}..${u.toFixed(6)}, ${h.toFixed(6)}..${f.toFixed(6)}] z=[${p.toFixed(1)}..${g.toFixed(1)}m]`)}return{vertices:new Float32Array(i),indices:new Uint32Array(s),indexCount:s.length}}function ci(o,e,t,i,r,n,s){if(!Number.isFinite(t)||!Number.isFinite(i))return s;const a=[],l=[],c=[],d=[];for(const y of o){const m=Ao(y,e);m.length>=3&&d.push(m)}if(d.length===0)return s;for(let y=0;y<d.length;y++){y>0&&l.push(a.length/2);const m=d[y],_=[];for(const w of m){const P=w[0],M=w[1];a.push(P,M),_.push([P,M])}c.push(_)}const u=c[0];let h=0,f=0;for(const y of u){const[m,_]=Me(y[0],y[1]);h+=m,f+=_}h/=u.length,f/=u.length;const p=or(a,l.length>0?l:void 0,2);if(p.length>0){const y=_o(a,l.length>0?l:void 0,2,p);y>.01&&console.warn(`[ExtrusionConverter] High earcut deviation: ${y.toFixed(4)} — polygon may have rendering artifacts`)}const g=s,x=a.length/2;for(let y=0;y<a.length;y+=2){const[m,_]=Me(a[y],a[y+1]);r.push(m,_,t),r.push(0,0,1),r.push(h,f)}for(const y of p)n.push(g+y);s+=x;const v=t-i>Eo;if(i>0&&v){const y=s;for(let m=0;m<a.length;m+=2){const[_,w]=Me(a[m],a[m+1]);r.push(_,w,i),r.push(0,0,-1),r.push(h,f)}for(let m=p.length-1;m>=0;m--)n.push(y+p[m]);s+=x}if(!v)return s;for(const y of c){const m=y.length;for(let _=0;_<m;_++){const w=y[_][0],P=y[_][1],M=y[(_+1)%m],b=M[0],C=M[1],S=b-w,T=C-P,B=Math.sqrt(S*S+T*T);if(B<Go)continue;const F=T/B,E=-S/B,[G,D]=Me(w,P),[V,U]=Me(b,C),k=s;r.push(G,D,i,F,E,0,h,f),r.push(V,U,i,F,E,0,h,f),r.push(V,U,t,F,E,0,h,f),r.push(G,D,t,F,E,0,h,f),n.push(k,k+1,k+2),n.push(k,k+2,k+3),s+=4}}return s}function Uo(o,e,t){const i=[],r=t*t,n=Math.floor(o.length/8);for(let s=0;s+2<e.length;s+=3){const a=e[s],l=e[s+1],c=e[s+2];if(a<0||l<0||c<0||a>=n||l>=n||c>=n)continue;const d=a*8,u=l*8,h=c*8,f=o[d],p=o[d+1],g=o[d+2],x=o[u],v=o[u+1],y=o[u+2],m=o[h],_=o[h+1],w=o[h+2];if(!Number.isFinite(f)||!Number.isFinite(p)||!Number.isFinite(g)||!Number.isFinite(x)||!Number.isFinite(v)||!Number.isFinite(y)||!Number.isFinite(m)||!Number.isFinite(_)||!Number.isFinite(w))continue;const P=(x-f)*(x-f)+(v-p)*(v-p),M=(m-x)*(m-x)+(_-v)*(_-v),b=(f-m)*(f-m)+(p-_)*(p-_);P>r||M>r||b>r||i.push(a,l,c)}return i}const ko={type:"simple-marker",color:[66,133,244,255],size:8,outlineColor:[255,255,255,255],outlineWidth:1.5},Vo={type:"simple-line",color:[255,87,34,255],width:2,style:"solid"},yt={type:"simple-fill",color:[66,133,244,80],outlineColor:[33,33,33,255],outlineWidth:1},W=40,Q=24,K=20037508342789244e-9;class Oo{_engine;_buffers=new Map;_tileBuffers=new Map;_tileSlotToRenderKey=new Map;_tileScopes=new Map;_rendererKeys=new Map;_featureCounts=new Map;_lastZoomInt=-1;_zoomSensitiveLayers=new Set;_onInvalidate=null;_terrainVersion=0;_layerTerrainVersions=new Map;constructor(e=null){this._engine=e}setOnInvalidate(e){this._onInvalidate=e}setRenderEngine(e){this._engine=e}bumpTerrainVersion(){this._terrainVersion++}getOrBuild(e,t,i,r,n,s="2d",a,l){if(!this._engine||t.length===0)return null;if(r!==void 0){const x=Math.floor(r);if(x!==this._lastZoomInt){this._lastZoomInt=x;for(const v of this._zoomSensitiveLayers)this.invalidate(v)}}i?.zoomSensitive?this._zoomSensitiveLayers.add(e):this._zoomSensitiveLayers.delete(e);const c=i?Pt(i):"",d=this._rendererKeys.get(e),u=this._featureCounts.get(e);d!==void 0&&(d!==c||u!==t.length)&&this.invalidate(e),this._rendererKeys.set(e,c),this._featureCounts.set(e,t.length);const h=a?.mode!==void 0&&a.mode!=="absolute"?this._terrainVersion:0,f=this._layerTerrainVersions.get(e);f!==void 0&&f!==h&&this.invalidate(e),this._layerTerrainVersions.set(e,h);let p=this._buffers.get(e);if(p)return p;const g=r!==void 0?{renderMode:s,zoom:r,resolution:0}:void 0;return p=this._build(t,i,g,n,a,l),this._buffers.set(e,p),p}getOrBuildTile(e,t){if(!this._engine||t.length===0)return null;const i=e.renderMode??(e.globe?"3d":"2d"),r=e.renderer?Pt(e.renderer):"",n=e.renderer?.zoomSensitive&&e.zoom!==void 0?Math.floor(e.zoom):-1,s=ui({layerId:e.layerId,tileKey:e.tileKey,rendererKey:r,zoomBucket:n,mode:i,source:"feature",version:e.version}),a=bt(e.layerId,i,e.tileKey),l=this._tileSlotToRenderKey.get(a);l&&l!==s&&this._invalidateTileEntry(l,!1);let c=this._tileBuffers.get(s);if(c)return this._registerTileSlot(e.layerId,i,a,s),c;const d=e.zoom!==void 0?{renderMode:i,zoom:e.zoom,resolution:0}:void 0;return c=this._build(t,e.renderer,d),this._stampExtrusionIds(c,e.tileKey),this._tileBuffers.set(s,c),this._registerTileSlot(e.layerId,i,a,s),c}getOrBuildTileBinary(e,t){if(!this._engine||!No(t))return null;const i=e.renderMode??(e.globe?"3d":"2d"),r=e.renderer?Pt(e.renderer):"",n=e.renderer?.zoomSensitive&&e.zoom!==void 0?Math.floor(e.zoom):-1,s=ui({layerId:e.layerId,tileKey:e.tileKey,rendererKey:r,zoomBucket:n,mode:i,source:"binary",version:e.version}),a=bt(e.layerId,i,e.tileKey),l=this._tileSlotToRenderKey.get(a);l&&l!==s&&this._invalidateTileEntry(l,!1);let c=this._tileBuffers.get(s);return c?(this._registerTileSlot(e.layerId,i,a,s),c):(c=this._buildFromBinaryPayload(t),this._stampExtrusionIds(c,e.tileKey),this._tileBuffers.set(s,c),this._registerTileSlot(e.layerId,i,a,s),c)}has(e){return this._buffers.has(e)}invalidate(e){const t=this._buffers.get(e);t&&(this._releaseEntry(t),this._buffers.delete(e));for(const i of["2d","3d"]){const r=_t(e,i),n=this._tileScopes.get(r);if(n)for(const s of[...n]){const a=this._tileSlotToRenderKey.get(s);a&&this._invalidateTileEntry(a,!1)}}this._rendererKeys.delete(e),this._featureCounts.delete(e),this._layerTerrainVersions.delete(e),this._onInvalidate?.()}pruneTileEntries(e,t,i){const r=t?"3d":"2d",n=_t(e,r),s=this._tileScopes.get(n);if(!s)return;const a=new Set;for(const l of i)a.add(bt(e,r,l));for(const l of[...s]){if(a.has(l))continue;const c=this._tileSlotToRenderKey.get(l);c&&this._invalidateTileEntry(c,!1)}}invalidateAll(){for(const e of[...this._buffers.keys()])this.invalidate(e);for(const e of[...this._tileBuffers.keys()])this._invalidateTileEntry(e,!1)}destroy(){this.invalidateAll();for(const e of[...this._tileBuffers.keys()])this._invalidateTileEntry(e,!1);this._engine=null}_stampExtrusionIds(e,t){for(const i of e.extrusionGroups)i.buffer.id=t}_buildFromBinaryPayload(e){const t={pointGroups:[],lineGroups:[],polygonGroups:[],modelGroups:[],extrusionGroups:[],mesh3dGroups:[]};for(const i of e.pointGroups){if(i.count<=0)continue;const r=this._engine.createBuffer(i.vertices,W);t.pointGroups.push({buffer:{vertexBuffer:r,count:i.count},symbol:i.symbol})}for(const i of e.lineGroups){if(i.indexCount<=0)continue;const r=this._engine.createBuffer(i.vertices,W),n=this._engine.createBuffer(i.indices,Q);t.lineGroups.push({buffer:{vertexBuffer:r,indexBuffer:n,indexCount:i.indexCount},symbol:i.symbol})}for(const i of e.polygonGroups){if(i.indexCount<=0)continue;const r=this._engine.createBuffer(i.vertices,W),n=this._engine.createBuffer(i.indices,Q);t.polygonGroups.push({buffer:{vertexBuffer:r,indexBuffer:n,indexCount:i.indexCount},symbol:i.symbol})}for(const i of e.modelGroups){if(i.count<=0)continue;const r=this._engine.createBuffer(i.instances,W);t.modelGroups.push({buffer:{instanceBuffer:r,instanceCount:i.count},symbol:i.symbol})}for(const i of e.extrusionGroups){if(i.indexCount<=0)continue;const r=this._engine.createBuffer(i.vertices,W),n=this._engine.createBuffer(i.indices,Q);t.extrusionGroups.push({buffer:{vertexBuffer:r,indexBuffer:n,indexCount:i.indexCount},symbol:i.symbol})}return t}_build(e,t,i,r,n,s){const a={pointGroups:[],lineGroups:[],polygonGroups:[],modelGroups:[],extrusionGroups:[],mesh3dGroups:[]},l=s?Xo(s):void 0;if(!t||t.type==="simple"){const c=t?t.getSymbol(e[0],i):null;return this._buildSingleGroup(e,a,c,r,n,l),a}return this._buildMultiGroup(e,t,a,i,n,l),a}_buildSingleGroup(e,t,i,r,n,s){if(Zo(r)){this._buildWallGroup(r,i,t,n,s);return}if(i&&It(i)){this._buildModelGroup(e,i,t,n,s);return}if(i&&xi(i)){this._buildExtrusionGroup(e,i,t,n,s);return}if(i&&Wo(i)){this._buildMesh3DGroup(e,i,t);return}const a=i?mi(i)?i:hi(i):{...ko},l=i?gi(i)?i:di(i):{...Vo},c=i?Ne(i)?i:Oe(i):{...yt};this._buildPointGroup(e,a,t,n,s),this._buildLineGroup(e,l,t,n,s),this._buildPolygonGroup(e,c,t,n,s)}_buildMultiGroup(e,t,i,r,n,s){const a=new Map,l=new Map,c=new Map,d=new Map,u=new Map;for(const h of e){const f=h.geometry?.type;if(!f)continue;const p=t.getSymbol(h,r);if(p){if(xi(p)&&pi(f)){const g=ve(p);let x=u.get(g);x||(x={symbol:p,features:[]},u.set(g,x)),x.features.push(h);continue}if(It(p)&&fi(f)){const g=ve(p);let x=d.get(g);x||(x={symbol:p,features:[]},d.set(g,x)),x.features.push(h);continue}if(fi(f)){const g=mi(p)?p:hi(p),x=ve(g);let v=a.get(x);v||(v={symbol:g,features:[]},a.set(x,v)),v.features.push(h)}else if(Ho(f)){const g=gi(p)?p:di(p),x=ve(g);let v=l.get(x);v||(v={symbol:g,features:[]},l.set(x,v)),v.features.push(h)}else if(pi(f)){const g=Ne(p)?p:Oe(p),x=ve(g);let v=c.get(x);v||(v={symbol:g,features:[]},c.set(x,v)),v.features.push(h)}}}for(const{symbol:h,features:f}of a.values())this._buildPointGroup(f,h,i,n,s);for(const{symbol:h,features:f}of l.values())this._buildLineGroup(f,h,i,n,s);for(const{symbol:h,features:f}of c.values())this._buildPolygonGroup(f,h,i,n,s);for(const{symbol:h,features:f}of d.values())this._buildModelGroup(f,h,i,n,s);for(const{symbol:h,features:f}of u.values())this._buildExtrusionGroup(f,h,i,n,s)}_buildPointGroup(e,t,i,r,n){const s=j.pointsFromFeatures(e);if(s&&s.count>0){r&&r.mode!=="absolute"&&n&&Se(s.vertices,3,2,r,n);const a=this._engine.createBuffer(s.vertices,W);i.pointGroups.push({buffer:{vertexBuffer:a,count:s.count},symbol:t})}}_buildLineGroup(e,t,i,r,n){const s=j.linesFromFeatures(e);if(s&&s.indexCount>0){r&&r.mode!=="absolute"&&n&&vi(s.vertices,11,r,n);const a=this._engine.createBuffer(s.vertices,W),l=this._engine.createBuffer(s.indices,Q);i.lineGroups.push({buffer:{vertexBuffer:a,indexBuffer:l,indexCount:s.indexCount},symbol:t})}}_buildPolygonGroup(e,t,i,r,n){const s=j.polygonsFromFeatures(e);if(s&&s.indexCount>0){r&&r.mode!=="absolute"&&n&&Se(s.vertices,3,2,r,n);const a=this._engine.createBuffer(s.vertices,W),l=this._engine.createBuffer(s.indices,Q);i.polygonGroups.push({buffer:{vertexBuffer:a,indexBuffer:l,indexCount:s.indexCount},symbol:t});const c={type:"simple-line",color:t.outlineColor,width:t.outlineWidth,style:"solid",glowColor:t.outlineGlowColor,glowWidth:t.outlineGlowWidth},d=j.linesFromFeatures(e);if(d&&d.indexCount>0){r&&r.mode!=="absolute"&&n&&vi(d.vertices,11,r,n);const u=this._engine.createBuffer(d.vertices,W),h=this._engine.createBuffer(d.indices,Q);i.lineGroups.push({buffer:{vertexBuffer:u,indexBuffer:h,indexCount:d.indexCount},symbol:c})}}}_buildExtrusionGroup(e,t,i,r,n){const s=Io(e,t.heightField,t.minHeightField??"render_min_height");if(s&&s.indexCount>0){r&&r.mode!=="absolute"&&n&&Se(s.vertices,8,2,r,n,"merc01");const a=this._engine.createBuffer(s.vertices,W),l=this._engine.createBuffer(s.indices,Q);i.extrusionGroups.push({buffer:{vertexBuffer:a,indexBuffer:l,indexCount:s.indexCount},symbol:t})}}_buildMesh3DGroup(e,t,i){const r=So(e,t);if(r&&r.indexCount>0){const n=this._engine.createBuffer(r.vertices,W),s=this._engine.createBuffer(r.indices,Q);i.mesh3dGroups.push({buffer:{vertexBuffer:n,indexBuffer:s,indexCount:r.indexCount},symbol:t})}}_buildWallGroup(e,t,i,r,n){const s=e.getWallGeometryData();if(!("hasIncrementalBuffer"in e&&typeof e.hasIncrementalBuffer=="function"&&e.hasIncrementalBuffer())){const h=wo(s.positions,s.maximumHeights,s.minimumHeights);if(h.indices.length<=0)return;r&&r.mode!=="absolute"&&n&&Se(h.positions,3,2,r,n);const f=t?Ne(t)?t:Oe(t):{...yt},p=this._engine.createBuffer(this._interleaveWallMesh(h),W),g=this._engine.createBuffer(h.indices,Q);i.mesh3dGroups.push({buffer:{vertexBuffer:p,indexBuffer:g,indexCount:h.indices.length},symbol:{type:"mesh-3d",meshType:"box",color:[...f.color],ambient:1,shininess:18,specularStrength:0}})}const l=t?Ne(t)?t:Oe(t):{...yt};if(l.outlineWidth<=0||l.outlineColor[3]<=0||s.positions.length<2)return;const c=s.positions.map(([h,f],p)=>[h,f,s.maximumHeights[p]]),d=s.positions.map(([h,f],p)=>[h,f,s.minimumHeights[p]]),u=[{id:`${e.id}-wall-top`,geometry:{type:"LineString",coordinates:c},attributes:{}},{id:`${e.id}-wall-bottom`,geometry:{type:"LineString",coordinates:d},attributes:{}},{id:`${e.id}-wall-start`,geometry:{type:"LineString",coordinates:[d[0],c[0]]},attributes:{}},{id:`${e.id}-wall-end`,geometry:{type:"LineString",coordinates:[d[d.length-1],c[c.length-1]]},attributes:{}}];this._buildLineGroup(u,{type:"simple-line",color:l.outlineColor,width:l.outlineWidth,style:"solid"},i,r,n)}_buildModelGroup(e,t,i,r,n){const s=j.modelInstancesFromFeatures(e,t.scale??1,t.heading,t.pitch,t.roll,t.anchorZ??0);if(s&&s.count>0){r&&r.mode!=="absolute"&&n&&Se(s.instances,8,2,r,n);const a=this._engine.createBuffer(s.instances,W);i.modelGroups.push({buffer:{instanceBuffer:a,instanceCount:s.count},symbol:t})}}_releaseEntry(e){if(this._engine){for(const t of e.pointGroups)this._engine.releaseBuffer(t.buffer.vertexBuffer);for(const t of e.lineGroups)this._engine.releaseBuffer(t.buffer.vertexBuffer),this._engine.releaseBuffer(t.buffer.indexBuffer);for(const t of e.polygonGroups)this._engine.releaseBuffer(t.buffer.vertexBuffer),this._engine.releaseBuffer(t.buffer.indexBuffer);for(const t of e.modelGroups)this._engine.releaseBuffer(t.buffer.instanceBuffer);for(const t of e.extrusionGroups)this._engine.releaseBuffer(t.buffer.vertexBuffer),this._engine.releaseBuffer(t.buffer.indexBuffer);for(const t of e.mesh3dGroups)this._engine.releaseBuffer(t.buffer.vertexBuffer),this._engine.releaseBuffer(t.buffer.indexBuffer)}}_interleaveWallMesh(e){const t=new Float32Array(e.vertexCount*6);for(let i=0;i<e.vertexCount;i++){const r=i*3,n=i*6,s=e.positions[r],a=e.positions[r+1];t[n+0]=(s+K)/(2*K),t[n+1]=1-(a+K)/(2*K),t[n+2]=e.positions[r+2],t[n+3]=e.normals[r],t[n+4]=e.normals[r+1],t[n+5]=e.normals[r+2]}return t}_registerTileSlot(e,t,i,r){this._tileSlotToRenderKey.set(i,r);const n=_t(e,t);let s=this._tileScopes.get(n);s||(s=new Set,this._tileScopes.set(n,s)),s.add(i)}_invalidateTileEntry(e,t){const i=this._tileBuffers.get(e);i&&(this._releaseEntry(i),this._tileBuffers.delete(e));for(const[r,n]of[...this._tileSlotToRenderKey.entries()])if(n===e){this._tileSlotToRenderKey.delete(r);for(const[s,a]of this._tileScopes)if(a.delete(r)){a.size===0&&this._tileScopes.delete(s);break}}t&&this._onInvalidate?.()}}function _t(o,e){return`${o}@@${e}`}function bt(o,e,t){return`${o}@@${e}@@${t}`}function ui(o){return[o.layerId,o.tileKey,o.rendererKey,String(o.zoomBucket),o.mode,o.source,String(o.version)].join("::")}function No(o){return o.pointGroups.length>0||o.lineGroups.length>0||o.polygonGroups.length>0||o.modelGroups.length>0||o.extrusionGroups.length>0}function ve(o){if(o.type==="simple-marker"){const e=o;return`m:${e.color}:${e.size}:${e.outlineColor??""}:${e.outlineWidth??0}:${e.glowColor??""}:${e.glowSize??0}`}if(o.type==="icon"){const e=o;return`i:${e.src??""}:${e.size}:${e.color}:${e.rotation??0}:${e.glowColor??""}:${e.glowSize??0}:${e.backgroundColor??""}:${e.backgroundSize??0}:${e.outlineColor??""}:${e.outlineWidth??0}`}if(o.type==="simple-line"){const e=o;return`l:${e.color}:${e.width}:${e.style}:${e.glowColor??""}:${e.glowWidth??0}`}if(o.type==="simple-fill"){const e=o;return`f:${e.color}:${e.outlineColor}:${e.outlineWidth}:${e.outlineGlowColor??""}:${e.outlineGlowWidth??0}`}if(o.type==="model"){const e=o;return`M:${e.modelId}:${e.scale??1}:${e.heading??0}:${e.pitch??0}:${e.roll??0}:${e.anchorZ??0}:${e.tintColor??""}`}if(o.type==="fill-extrusion"){const e=o;return`E:${e.color}:${e.heightField}:${e.minHeightField??""}:${e.ambient??.35}:${e.shininess??32}:${e.specularStrength??.15}`}return`?:${JSON.stringify(o)}`}function Pt(o){const e=o.getSymbol({attributes:{},geometry:{type:"Point",coordinates:[0,0]},id:"__fp__"});return e?ve(e):""}function Ht(o){return"color"in o?o.color:It(o)&&o.tintColor?o.tintColor:[128,128,128,255]}function hi(o){const e=Ht(o),t="outlineColor"in o&&o.outlineColor?o.outlineColor:[e[0],e[1],e[2],255];return{type:"simple-marker",color:e,size:"size"in o?o.size:10,outlineColor:t,outlineWidth:"outlineWidth"in o?o.outlineWidth:1}}function di(o){const e=Ht(o);return{type:"simple-line",color:[e[0],e[1],e[2],255],width:"width"in o?o.width:"outlineWidth"in o?o.outlineWidth+1:2,style:"solid"}}function Oe(o){const e=Ht(o);return{type:"simple-fill",color:[e[0],e[1],e[2],e[3]<255?e[3]:100],outlineColor:[e[0],e[1],e[2],255],outlineWidth:"outlineWidth"in o?o.outlineWidth:1}}function fi(o){return o==="Point"||o==="MultiPoint"}function Ho(o){return o==="LineString"||o==="MultiLineString"}function pi(o){return o==="Polygon"||o==="MultiPolygon"}function mi(o){return o.type==="simple-marker"||o.type==="icon"||o.type==="sdf-icon"}function gi(o){return o.type==="simple-line"}function Ne(o){return o.type==="simple-fill"}function It(o){return o.type==="model"}function xi(o){return o.type==="fill-extrusion"}function Wo(o){return o.type==="mesh-3d"}function Zo(o){return!!o&&o.type==="wall"&&typeof o.getWallGeometryData=="function"}function ye(o,e){const t=o/K*180,r=(2*Math.atan(Math.exp(e/K*Math.PI))-Math.PI/2)*(180/Math.PI);return[t,r]}function jo(o,e){const t=o*2*K-K,i=(1-e)*2*K-K;return ye(t,i)}function Se(o,e,t,i,r,n="epsg3857"){const s=i.offset??0,a=Math.floor(o.length/e);if(a===0)return;const l=n==="merc01"?jo:ye;if(i.sampling==="centroid"){let c=0,d=0;for(let p=0;p<o.length;p+=e)c+=o[p],d+=o[p+1];const[u,h]=l(c/a,d/a),f=r.sampleElevation(u,h)??0;for(let p=0;p<o.length;p+=e)i.mode==="on-the-ground"?o[p+t]=f+s:o[p+t]=o[p+t]+f+s;return}for(let c=0;c<o.length;c+=e){const[d,u]=l(o[c],o[c+1]),h=r.sampleElevation(d,u)??0;i.mode==="on-the-ground"?o[c+t]=h+s:o[c+t]=o[c+t]+h+s}}function vi(o,e,t,i){const r=t.offset??0,n=Math.floor(o.length/e);if(t.sampling==="centroid"&&n>0){let s=0,a=0;for(let u=0;u<o.length;u+=e)s+=o[u+3],a+=o[u+4];const[l,c]=ye(s/n,a/n),d=i.sampleElevation(l,c)??0;for(let u=0;u<o.length;u+=e)t.mode==="on-the-ground"?(o[u+2]=d+r,o[u+5]=d+r,o[u+8]=d+r):(o[u+2]=o[u+2]+d+r,o[u+5]=o[u+5]+d+r,o[u+8]=o[u+8]+d+r);return}for(let s=0;s<o.length;s+=e){const[a,l]=ye(o[s],o[s+1]),c=i.sampleElevation(a,l)??0,[d,u]=ye(o[s+3],o[s+4]),h=i.sampleElevation(d,u)??0,[f,p]=ye(o[s+6],o[s+7]),g=i.sampleElevation(f,p)??0;t.mode==="on-the-ground"?(o[s+2]=c+r,o[s+5]=h+r,o[s+8]=g+r):(o[s+2]=o[s+2]+c+r,o[s+5]=o[s+5]+h+r,o[s+8]=o[s+8]+g+r)}}function Xo(o){const e=new Map;return{sampleElevation(t,i){const r=`${t},${i}`;if(e.has(r))return e.get(r)??null;const n=o.sampleElevation(t,i);return e.set(r,n),n}}}class $o{map;renderEngine=null;renderLoop;tileScheduler;tileManager;terrainManager;layerManager;bufferCache;canvas=null;container=null;resizeObserver=null;destroyed=!1;gpuReady=!1;globeEffects=Lt();constructor(){this.map=new Hr,this.layerManager=new jr,this.tileScheduler=new Xr,this.tileManager=new Jr({tileScheduler:this.tileScheduler}),this.terrainManager=new eo,this.renderLoop=new $r,this.bufferCache=new Oo}createCanvas(e){const t=document.createElement("canvas");getComputedStyle(e).position==="static"&&(e.style.position="relative"),t.style.position="absolute",t.style.top="0",t.style.left="0",t.style.width="100%",t.style.height="100%",t.style.display="block";const r=typeof devicePixelRatio<"u"?devicePixelRatio:1,n=e.clientWidth||800,s=e.clientHeight||600;return t.width=Math.round(n*r),t.height=Math.round(s*r),e.appendChild(t),this.canvas=t,this.container=e,t}setupResizeObserver(e,t,i){typeof ResizeObserver>"u"||(this.resizeObserver=new ResizeObserver(r=>{if(!this.destroyed)for(const n of r){const{width:s,height:a}=n.contentRect;if(s===0||a===0)continue;const l=typeof devicePixelRatio<"u"?devicePixelRatio:1,c=Math.round(s*l),d=Math.round(a*l);(t.width!==c||t.height!==d)&&(t.width=c,t.height=d,i(s,a))}}),this.resizeObserver.observe(e))}async initGpu(e,t,i){this.renderEngine=e,this.bufferCache.setRenderEngine(e),this.tileManager.setRenderEngine(e),this.terrainManager.setRenderEngine(e),this.renderLoop.setRenderEngine(e);const r=await e.init(t,i);if(this.destroyed)throw new Error("View destroyed during GPU init");return this.gpuReady=!0,this.tileManager.onDirty=()=>{this.renderLoop.markDirty()},this.terrainManager.onDirty=()=>{this.bufferCache.bumpTerrainVersion(),this.renderLoop.markDirty()},this.bufferCache.setOnInvalidate(()=>{this.renderLoop.markDirty()}),r.mode!=="full-gpu"&&console.warn(`[mapgpu] GPU running in degraded mode: ${r.mode}`),r}destroy(){this.destroyed||(this.destroyed=!0,this.resizeObserver?.disconnect(),this.resizeObserver=null,this.bufferCache.destroy(),this.tileManager.destroy(),this.terrainManager.destroy(),this.renderLoop.destroy(),this.layerManager.destroy(),this.map.destroy(),this.canvas&&this.canvas.parentNode&&this.canvas.parentNode.removeChild(this.canvas),this.canvas=null,this.container=null)}}const Yo=Math.PI/180,Ko=180/Math.PI,yi=85.051129,_i=2*Math.PI;class qo{name="mercator";wrapsHorizontally=!0;project(e,t){const i=Math.max(-yi,Math.min(yi,t)),r=(e+180)/360,n=i*Yo,s=.5-Math.log(Math.tan(Math.PI/4+n/2))/_i;return[r,s]}unproject(e,t){const i=e*360-180,n=(2*Math.atan(Math.exp((.5-t)*_i))-Math.PI/2)*Ko;return[i,n]}}class Z{name="globe";static TRANSITION_ZOOM_LOW=5;static TRANSITION_ZOOM_HIGH=6;_globeness=1;_mercator;constructor(){this._mercator=new qo}get globeness(){return this._globeness}get wrapsHorizontally(){return this._globeness<1}static globenessFromZoom(e){if(e<=Z.TRANSITION_ZOOM_LOW)return 1;if(e>=Z.TRANSITION_ZOOM_HIGH)return 0;const t=(e-Z.TRANSITION_ZOOM_LOW)/(Z.TRANSITION_ZOOM_HIGH-Z.TRANSITION_ZOOM_LOW);return .5*(1+Math.cos(t*Math.PI))}setGlobeness(e){this._globeness=Math.max(0,Math.min(1,e))}updateFromZoom(e){this._globeness=Z.globenessFromZoom(e)}project(e,t){return this._mercator.project(e,t)}unproject(e,t){return this._mercator.unproject(e,t)}static mercatorToAngular(e,t){const i=e*2*Math.PI-Math.PI,r=2*Math.atan(Math.exp(Math.PI-t*2*Math.PI))-Math.PI/2;return[i,r]}static angularToSphere(e,t){const i=Math.cos(t);return[i*Math.sin(e),Math.sin(t),i*Math.cos(e)]}static lonLatToSphere(e,t){const i=e*(Math.PI/180),r=t*(Math.PI/180);return Z.angularToSphere(i,r)}}const R=Math.PI/180,wt=180/Math.PI,Qo=36.87,Jo=85,bi=0,ie=22;class lr{_center=[0,0];_zoom=2;_pitch=0;_bearing=0;_fov=Qo;_viewportWidth=800;_viewportHeight=600;_minCameraSurfaceDistanceMeters=0;_viewMatrix=new Float32Array(16);_projectionMatrix=new Float32Array(16);_viewProjectionMatrix=new Float32Array(16);_flatViewProjectionMatrix=new Float32Array(16);_cameraPosition=[0,0,0];_clippingPlane=[0,0,1,0];_dirty=!0;constructor(e){e&&(e.center&&(this._center=[...e.center]),e.zoom!==void 0&&(this._zoom=e.zoom),e.pitch!==void 0&&(this._pitch=e.pitch),e.bearing!==void 0&&(this._bearing=e.bearing),e.fov!==void 0&&(this._fov=e.fov),e.viewportWidth!==void 0&&(this._viewportWidth=e.viewportWidth),e.viewportHeight!==void 0&&(this._viewportHeight=e.viewportHeight)),this.updateMatrices()}get center(){return[...this._center]}get zoom(){return this._zoom}get pitch(){return this._pitch}get bearing(){return this._bearing}get fov(){return this._fov}get viewportWidth(){return this._viewportWidth}get viewportHeight(){return this._viewportHeight}get cameraSurfaceDistanceMeters(){return this._cameraSurfaceDistanceMetersFor(this._zoom,this._pitch)}get viewMatrix(){return this._ensureClean(),this._viewMatrix}get projectionMatrix(){return this._ensureClean(),this._projectionMatrix}get viewProjectionMatrix(){return this._ensureClean(),this._viewProjectionMatrix}get flatViewProjectionMatrix(){return this._ensureClean(),this._flatViewProjectionMatrix}get cameraPosition(){return this._ensureClean(),[...this._cameraPosition]}get globeRadius(){return 512*Math.pow(2,this._zoom)/(2*Math.PI)}get cameraToCenterDistance(){const t=this._fov*R/2;return .5*this._viewportHeight/Math.tan(t)/this.globeRadius}get mercatorCameraDistance(){const e=512*Math.pow(2,this._zoom),t=this._fov*R;return .5*this._viewportHeight/Math.tan(t/2)/e}setCenter(e,t){if(!Number.isFinite(e)||!Number.isFinite(t))return;const i=e>=-180&&e<180?e:(e%360+540)%360-180;this._center=[i,Math.max(-85.051129,Math.min(85.051129,t))],this._dirty=!0}setZoom(e){this._applyZoom(e)}setPitch(e){this._pitch=Math.max(0,Math.min(Jo,e)),this._applyZoom(this._zoom),this._dirty=!0}setBearing(e){this._bearing=(e%360+360)%360,this._dirty=!0}setViewport(e,t){this._viewportWidth=e,this._viewportHeight=t,this._applyZoom(this._zoom),this._dirty=!0}setFov(e){this._fov=Math.max(10,Math.min(90,e)),this._applyZoom(this._zoom),this._dirty=!0}setMinCameraSurfaceDistance(e){const t=Number.isFinite(e)?Math.max(0,e):0;return Math.abs(t-this._minCameraSurfaceDistanceMeters)<1e-6?!1:(this._minCameraSurfaceDistanceMeters=t,this._applyZoom(this._zoom))}_ensureClean(){this._dirty&&this.updateMatrices()}_applyZoom(e){const t=this._clampZoom(e),i=Math.abs(t-this._zoom)>1e-9;return this._zoom=t,this._dirty=!0,i}_clampZoom(e){const t=Math.max(bi,Math.min(ie,e)),i=this._maxZoomForSurfaceDistance(this._pitch,this._minCameraSurfaceDistanceMeters);return Math.min(t,i)}_cameraSurfaceDistanceMetersFor(e,t){const i=this._cameraToCenterDistanceFor(e),r=t*R,n=Math.sqrt(1+i*i+2*i*Math.cos(r));return Math.max(0,(n-1)*$)}_cameraToCenterDistanceFor(e){const i=this._fov*R/2,r=Math.tan(i);if(!(this._viewportHeight>0)||!Number.isFinite(r)||r<=0)return 0;const n=.5*this._viewportHeight/r,s=512*Math.pow(2,e);return n/(s/(2*Math.PI))}_maxZoomForSurfaceDistance(e,t){if(!(t>0)||!(this._viewportHeight>0))return ie;const i=this._fov*R,r=Math.tan(i/2);if(!Number.isFinite(r)||r<=0)return ie;const n=t/$,s=Math.cos(e*R),a=-s+Math.sqrt(s*s+2*n+n*n);if(!(a>0))return ie;const c=.5*this._viewportHeight/r*(2*Math.PI/512);if(!(c>0))return ie;const d=Math.log2(c/a);return Number.isFinite(d)?Math.max(bi,Math.min(ie,d)):ie}updateMatrices(){const e=this._fov*R,t=this._pitch*R,i=this._bearing*R,r=this._center[0]*R,n=this._center[1]*R,s=this._viewportWidth/this._viewportHeight,a=this.cameraToCenterDistance,[l,c]=this.computeNearFar();Pi(this._projectionMatrix,e,s,l,c),en(this._viewMatrix),He(this._viewMatrix,0,0,-a),Ct(this._viewMatrix,-t),wi(this._viewMatrix,i),He(this._viewMatrix,0,0,-1),Ct(this._viewMatrix,n),tn(this._viewMatrix,-r),rn(this._viewProjectionMatrix,this._projectionMatrix,this._viewMatrix),this._computeCameraPosition(a,t,i,r,n),this._computeClippingPlane(a,t,i,r,n),this._computeFlatViewProjection(),this._dirty=!1}computeNearFar(){const e=this.cameraToCenterDistance,t=Math.max(.001,e*.1),i=e+2;return[t,i]}_computeFlatViewProjection(){const e=this._flatViewProjectionMatrix,t=this._center[1]*R,i=(this._center[0]+180)/360,r=(1-Math.log(Math.tan(t)+1/Math.cos(t))/Math.PI)/2,n=512*Math.pow(2,this._zoom),s=this._fov*R,a=this._pitch*R,l=this._bearing*R,c=this._viewportWidth/this._viewportHeight,u=.5*this._viewportHeight/Math.tan(s/2)/n,h=u*.05,f=u*200;Pi(e,s,c,h,f),He(e,0,0,-u),Ct(e,-a),e[4]=-e[4],e[5]=-e[5],e[6]=-e[6],e[7]=-e[7],wi(e,l),He(e,-i,-r,0)}_computeCameraPosition(e,t,i,r,n){let s=0,a=0,l=e;const c=Math.cos(t),d=Math.sin(t),u=a*c-l*d,h=a*d+l*c;a=u,l=h;const f=Math.cos(-i),p=Math.sin(-i),g=s*f-a*p,x=s*p+a*f;s=g,a=x,l+=1;const v=Math.cos(-n),y=Math.sin(-n),m=a*v-l*y,_=a*y+l*v;a=m,l=_;const w=Math.cos(r),P=Math.sin(r),M=s*w+l*P,b=-s*P+l*w;s=M,l=b,this._cameraPosition=[s,a,l]}_computeClippingPlane(e,t,i,r,n){const a=this._cameraPosition[0],l=this._cameraPosition[1],c=this._cameraPosition[2],d=Math.sqrt(a*a+l*l+c*c);if(d<=1){this._clippingPlane=[0,0,0,-1];return}const u=1/d,h=a/d,f=l/d,p=c/d;this._clippingPlane=[h,f,p,-u]}getClippingPlane(){return this._ensureClean(),[...this._clippingPlane]}screenToLonLat(e,t){this._ensureClean();const i=2*e/this._viewportWidth-1,r=1-2*t/this._viewportHeight,n=this._fov*R,s=Math.tan(n/2),a=this._viewportWidth/this._viewportHeight,l=[i*s*a,r*s,-1],c=this._pitch*R,d=this._bearing*R,u=this._center[0]*R,h=this._center[1]*R;let f=Math.sqrt(l[0]**2+l[1]**2+l[2]**2),p=l[0]/f,g=l[1]/f,x=l[2]/f;{const S=Math.cos(c),T=Math.sin(c),B=g*S-x*T,F=g*T+x*S;g=B,x=F}{const S=Math.cos(-d),T=Math.sin(-d),B=p*S-g*T,F=p*T+g*S;p=B,g=F}{const S=Math.cos(-h),T=Math.sin(-h),B=g*S-x*T,F=g*T+x*S;g=B,x=F}{const S=Math.cos(u),T=Math.sin(u),B=p*S+x*T,F=-p*T+x*S;p=B,x=F}const v=this._cameraPosition[0],y=this._cameraPosition[1],m=this._cameraPosition[2],_=on(v,y,m,p,g,x,1);if(_===null)return null;const w=v+_*p,P=y+_*g,M=m+_*x,b=Math.asin(Math.max(-1,Math.min(1,P)))*wt;return[Math.atan2(w,M)*wt,b]}lonLatToScreen(e,t){this._ensureClean();const[i,r,n]=Ci(e,t,0);return Si(i,r,n,this._clippingPlane)?We(this._viewProjectionMatrix,i,r,n,this._viewportWidth,this._viewportHeight):null}lonLatToScreenWithAltitude(e,t,i){this._ensureClean();const[r,n,s]=Ci(e,t,i);return Si(r,n,s,this._clippingPlane)?We(this._viewProjectionMatrix,r,n,s,this._viewportWidth,this._viewportHeight):null}lonLatToScreenFlat(e,t){this._ensureClean();const[i,r]=Mi(e,t);return We(this._flatViewProjectionMatrix,i,r,0,this._viewportWidth,this._viewportHeight)}lonLatToScreenFlatWithAltitude(e,t,i){this._ensureClean();const[r,n]=Mi(e,t);return We(this._flatViewProjectionMatrix,r,n,i/$,this._viewportWidth,this._viewportHeight)}screenToLonLatFlat(e,t){this._ensureClean();const i=2*e/this._viewportWidth-1,r=1-2*t/this._viewportHeight,n=this._flatViewProjectionMatrix,s=n[0]-i*n[3],a=n[4]-i*n[7],l=i*n[15]-n[12],c=n[1]-r*n[3],d=n[5]-r*n[7],u=r*n[15]-n[13],h=s*d-a*c;if(Math.abs(h)<1e-12)return null;const f=(l*d-u*a)/h,p=(s*u-c*l)/h,g=f*360-180,v=(Math.atan(Math.exp(Math.PI-p*2*Math.PI))*2-Math.PI/2)*wt;return v<-85.051129||v>85.051129||g<-180||g>180?null:[g,v]}}function en(o){o.fill(0),o[0]=1,o[5]=1,o[10]=1,o[15]=1}function Pi(o,e,t,i,r){const n=1/Math.tan(e/2),s=1/(i-r);o.fill(0),o[0]=n/t,o[5]=n,o[10]=r*s,o[11]=-1,o[14]=i*r*s}function He(o,e,t,i){for(let r=0;r<4;r++){const n=o[12+r];o[12+r]=n+o[r]*e+o[4+r]*t+o[8+r]*i}}function Ct(o,e){const t=Math.cos(e),i=Math.sin(e);for(let r=0;r<4;r++){const n=o[4+r],s=o[8+r];o[4+r]=n*t+s*i,o[8+r]=s*t-n*i}}function tn(o,e){const t=Math.cos(e),i=Math.sin(e);for(let r=0;r<4;r++){const n=o[r],s=o[8+r];o[r]=n*t-s*i,o[8+r]=n*i+s*t}}function wi(o,e){const t=Math.cos(e),i=Math.sin(e);for(let r=0;r<4;r++){const n=o[r],s=o[4+r];o[r]=n*t+s*i,o[4+r]=s*t-n*i}}function rn(o,e,t){for(let i=0;i<4;i++)for(let r=0;r<4;r++){let n=0;for(let s=0;s<4;s++)n+=e[s*4+r]*t[i*4+s];o[i*4+r]=n}}function on(o,e,t,i,r,n,s){const a=2*(o*i+e*r+t*n),l=o*o+e*e+t*t-s*s,c=a*a-4*l;if(c<0)return null;const d=Math.sqrt(c),u=(-a-d)/2,h=(-a+d)/2;return u>0?u:h>0?h:null}function Ci(o,e,t){const i=o*R,r=e*R,n=Math.cos(r),s=1+t/$;return[n*Math.sin(i)*s,Math.sin(r)*s,n*Math.cos(i)*s]}function Mi(o,e){const t=e*R,i=(o+180)/360,r=Math.sin(t),n=Math.max(-.9999,Math.min(.9999,r)),s=(1-Math.log((1+n)/(1-n))/(2*Math.PI))/2;return[i,s]}function Si(o,e,t,i){return o*i[0]+e*i[1]+t*i[2]+i[3]>=0}function We(o,e,t,i,r,n){const s=o[0]*e+o[4]*t+o[8]*i+o[12],a=o[1]*e+o[5]*t+o[9]*i+o[13],l=o[3]*e+o[7]*t+o[11]*i+o[15];if(l<=0)return null;const c=s/l,d=a/l;return[(c+1)*.5*r,(1-d)*.5*n]}function nn(o){const e=Math.max(1,o.viewportWidth),t=Math.max(1,o.viewportHeight),i=o.tolerancePx??.5,r=o.maxIterations??8,n=e*.5,s=t*.5;let a=[...o.center];for(let l=0;l<r;l++){const c=ur(o,a,e,t),d=cr(c,o.zoom,o.targetCenter,o.targetAltitude);if(!d){if(!Ze(a[0],o.targetCenter[0],1e-9)||!Ze(a[1],o.targetCenter[1],1e-9)){a=[...o.targetCenter];continue}return a}const u=d[0]-n,h=d[1]-s;if(Math.abs(u)<=i&&Math.abs(h)<=i)return a;const f=sn(o,a,e,t);if(!f)return a;const p=f.dScreenXDLon*f.dScreenYDLat-f.dScreenXDLat*f.dScreenYDLon;if(Math.abs(p)<1e-9)return a;const g=(u*f.dScreenYDLat-h*f.dScreenXDLat)/p,x=(f.dScreenXDLon*h-f.dScreenYDLon*u)/p,v=[hr(a[0]-tt(g,-1,1)),tt(a[1]-tt(x,-1,1),-85.051129,85.051129)];if(Ze(a[0],v[0],1e-9)&&Ze(a[1],v[1],1e-9))return a;a=v}return a}function cr(o,e,t,i){const r=Z.globenessFromZoom(e),[n,s]=t;if(r>=.999)return o.lonLatToScreenWithAltitude(n,s,i);if(r<=.001)return o.lonLatToScreenFlatWithAltitude(n,s,i);const a=o.lonLatToScreenWithAltitude(n,s,i),l=o.lonLatToScreenFlatWithAltitude(n,s,i);return l?a?[l[0]+(a[0]-l[0])*r,l[1]+(a[1]-l[1])*r]:l:a}function ur(o,e,t,i){return new lr({center:e,zoom:o.zoom,pitch:o.pitch,bearing:o.bearing,viewportWidth:t,viewportHeight:i})}function sn(o,e,t,i){const n=Mt(o,e,t,i),s=Mt(o,[hr(e[0]+.001),e[1]],t,i),a=Mt(o,[e[0],tt(e[1]+.001,-85.051129,85.051129)],t,i);return!n||!s||!a?null:{dScreenXDLon:(s[0]-n[0])/.001,dScreenXDLat:(a[0]-n[0])/.001,dScreenYDLon:(s[1]-n[1])/.001,dScreenYDLat:(a[1]-n[1])/.001}}function Mt(o,e,t,i){const r=ur(o,e,t,i);return cr(r,o.zoom,o.targetCenter,o.targetAltitude)}function hr(o){let e=((o+180)%360+360)%360-180;return e===-180&&o>0&&(e=180),e}function tt(o,e,t){return Math.max(e,Math.min(t,o))}function Ze(o,e,t){return Math.abs(o-e)<=t}function dr(o,e,t){let i=!0,r=null;const n=()=>{i=!1,r!==null&&(clearTimeout(r),r=null)};return{promise:new Promise(a=>{const l=Date.now(),c=()=>{if(!i||!t()){a();return}const d=Date.now()-l,u=Math.min(1,d/o),h=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;e(h),u>=1?(i=!1,r=null,a()):r=setTimeout(c,16)};c()}),cancel:n}}function an(o){return typeof o=="object"&&o!==null&&o.type==="vector-tile"&&typeof o.getVisibleRenderTiles=="function"}function fr(o,e){const t=[],i=[],r=[],n=[],s=[],a=[],l=[],c=[],u=o.getLayerIds().map(h=>({id:h,layer:o.getLayer(h)})).filter(({layer:h})=>h!==void 0).sort((h,f)=>(h.layer.zIndex??0)-(f.layer.zIndex??0));for(const{id:h,layer:f}of u)if(!(!f||!f.visible||!f.loaded)){if(Qi(f)){a.push(h);continue}if(qi(f)){s.push(h);continue}if(Nt(f)){i.push(h);continue}if(Ji(f)||ct(f)){c.push(h);continue}if(f.type==="vector-tile"){const p=e!==void 0?Math.floor(e):void 0;if(p!==void 0&&p<f.minZoom)continue;De(f)&&l.push(h);continue}if(Ki(f)){if(e!==void 0&&(e<f.minZoom||e>f.maxZoom))continue;t.push({sourceId:h,getTileUrl:(p,g,x)=>f.getTileUrl(p,g,x),opacity:f.opacity,minZoom:f.minZoom,maxZoom:f.maxZoom,filters:f.filters})}De(f)&&r.push(h),Ot(f)&&n.push(h)}return{tileSources:t,terrainLayerIds:i,vectorLayerIds:r,customLayerIds:n,clusterLayerIds:s,dynamicPointLayerIds:a,vectorTileLayerIds:l,overlayLayerIds:c}}function pr(o,e,t,i){const r=t.getLayer(o);if(!r||!Qi(r)||!r.positionBuffer||r.pointCount===0)return;const n={vertexBuffer:r.positionBuffer,count:r.pointCount};i?e.drawGlobePoints(n,r.pointSymbol):e.drawPoints(n,r.pointSymbol)}function re(o,e){return e>=1?o:{...o,color:[o.color[0],o.color[1],o.color[2],o.color[3]*e]}}function ln(o){return!!o&&o.type==="wall"&&typeof o.bindRenderEngine=="function"&&typeof o.hasIncrementalBuffer=="function"&&typeof o.rebuildWithTerrain=="function"}function mr(o,e,t,i,r,n,s){const a=t.getLayer(o);if(!a||!De(a))return;const l=r?"3d":"2d";if(e.setCurrentLayerId(o),ln(a)){a.bindRenderEngine(e);const f="elevationInfo"in a?a.elevationInfo:void 0;f&&f.mode!=="absolute"&&s&&a.rebuildWithTerrain(f,s);const g=a.getIncrementalRenderBuffer();if(g&&g.indexCount>0){const v=a.getWallSymbol();r?e.drawGlobeMesh3D(g,v):e.drawMesh3D(g,v)}const x=a.getFeatures();if(x.length>0){const v=i.getOrBuild(o,x,a.renderer,n,a,l,f,s);if(v){const y=a.opacity;if(r)for(const m of v.lineGroups)e.drawGlobeLines(m.buffer,re(m.symbol,y));else for(const m of v.lineGroups)e.drawLines(m.buffer,re(m.symbol,y))}}return}const c=a.getFeatures();if(c.length===0)return;const d="elevationInfo"in a?a.elevationInfo:void 0,u=i.getOrBuild(o,c,a.renderer,n,a,l,d,s);if(!u)return;const h=a.opacity;if(r){for(const f of u.polygonGroups)e.drawGlobePolygons(f.buffer,re(f.symbol,h));for(const f of u.lineGroups)e.drawGlobeLines(f.buffer,re(f.symbol,h));for(const f of u.pointGroups)e.drawGlobePoints(f.buffer,re(f.symbol,h));for(const f of u.modelGroups)e.drawGlobeModels(f.buffer,f.symbol);for(const f of u.extrusionGroups)e.drawGlobeExtrusion(f.buffer,f.symbol);for(const f of u.mesh3dGroups)e.drawGlobeMesh3D(f.buffer,f.symbol)}else{for(const f of u.polygonGroups)e.drawPolygons(f.buffer,re(f.symbol,h));for(const f of u.lineGroups)e.drawLines(f.buffer,re(f.symbol,h));for(const f of u.pointGroups)e.drawPoints(f.buffer,re(f.symbol,h));for(const f of u.modelGroups)e.drawModels(f.buffer,f.symbol);for(const f of u.extrusionGroups)e.drawExtrusion(f.buffer,f.symbol);for(const f of u.mesh3dGroups)e.drawMesh3D(f.buffer,f.symbol)}}function gr(o,e,t,i,r,n){const s=t.getLayer(o);if(!s||!an(s))return;const a=r?"3d":"2d";e.setCurrentLayerId(o);const l=s.getVisibleRenderTiles();if(l.length===0){i.pruneTileEntries(o,r,[]);return}const c=new Set;for(const d of l){c.add(d.key);let u=r&&d.binaryPayload?i.getOrBuildTileBinary({layerId:o,tileKey:d.key,version:d.version,renderer:s.renderer,zoom:n,globe:r,renderMode:a},d.binaryPayload):null;if(!u&&d.features.length>0&&(u=i.getOrBuildTile({layerId:o,tileKey:d.key,version:d.version,renderer:s.renderer,zoom:n,globe:r,renderMode:a},d.features)),!!u)if(r){for(const h of u.polygonGroups)e.drawGlobePolygons(h.buffer,h.symbol);for(const h of u.lineGroups)e.drawGlobeLines(h.buffer,h.symbol);for(const h of u.pointGroups)e.drawGlobePoints(h.buffer,h.symbol);for(const h of u.modelGroups)e.drawGlobeModels(h.buffer,h.symbol);for(const h of u.extrusionGroups)e.drawGlobeExtrusion(h.buffer,h.symbol)}else{for(const h of u.polygonGroups)e.drawPolygons(h.buffer,h.symbol);for(const h of u.lineGroups)e.drawLines(h.buffer,h.symbol);for(const h of u.pointGroups)e.drawPoints(h.buffer,h.symbol);for(const h of u.modelGroups)e.drawModels(h.buffer,h.symbol);for(const h of u.extrusionGroups)e.drawExtrusion(h.buffer,h.symbol)}}i.pruneTileEntries(o,r,c)}function xr(o,e,t,i,r){const n=t.getLayer(o);if(!n||!Ot(n))return;const s=n.getDrawCommand(),a=n.getCustomUniforms(),l=n.getTextures(),c=i(n,a,l),d=a!==null,u=l.length>0,h=`custom:${o}:${n.vertexShader.length}:${n.fragmentShader.length}:${n.vertexBufferLayouts.length}:${String(d)}:${String(u)}${r?":globe":""}`,f=performance.now()/1e3,p=new Float32Array(4);p[0]=f,p[1]=.016,p[2]=0,p[3]=n.opacity;const g={pipelineKey:h,shaderSource:c,vertexBufferLayouts:n.vertexBufferLayouts,vertexBuffers:n.getVertexBuffers(),indexBuffer:n.getIndexBuffer(),indexFormat:s.indexFormat,frameUniforms:p,customUniforms:a,textures:l,vertexCount:s.vertexCount,instanceCount:s.instanceCount,indexCount:s.indexCount,topology:s.topology,blendState:n.blendState,...r?{useGlobeCamera:!0}:{}};e.drawCustom(g)}function vr(o,e,t,i,r,n,s){const a=t.getLayer(o);if(!a||!qi(a))return;s&&a.attachView(s);const l=a.getSourcePoints3857();!l||l.length===0||(e.setClusterSource(o,l,a.sourceVersion),e.drawClusters(o,a.clusterStyle,a.clusterRadius,a.clusterMinPoints,i,r,n))}const oe=20037508342789244e-9;function yr(o,e,t,i,r){const n=t.getLayer(o);if(!n)return;let s,a;if(Ji(n)){const f=n.imageData;if(!f)return;a=n.bounds;const p=i.get(o);p&&p.source===f?s=p.texture:(p&&e.releaseTexture(p.texture),s=e.createTexture(f),i.set(o,{texture:s,source:f,videoWidth:0,videoHeight:0}))}else if(ct(n)){const f=n.videoElement;if(!f||f.readyState<2)return;a=n.bounds;const p=i.get(o);p&&p.videoWidth===f.videoWidth&&p.videoHeight===f.videoHeight?(e.updateTextureFromVideo(p.texture,f),s=p.texture):(p&&e.releaseTexture(p.texture),s=e.createTextureFromVideo(f),i.set(o,{texture:s,source:null,videoWidth:f.videoWidth,videoHeight:f.videoHeight}))}if(!s||!a)return;const[l,c,d,u]=a,h=n.opacity;if(r){const[f,p]=H(l,c),[g,x]=H(d,u),v=(f+oe)/(2*oe),y=(g+oe)/(2*oe),m=1-(x+oe)/(2*oe),_=1-(p+oe)/(2*oe);e.drawGlobeTile({texture:s,mercatorExtent:[v,m,y,_],opacity:h,depthBias:.001})}else{const[f,p]=H(l,c),[g,x]=H(d,u);e.drawImagery({texture:s,extent:[f,p,g,x],opacity:h})}}class Ti{type="2d";_camera;_interaction=null;_anim=null;_destroyed=!1;_markDirty=null;_onViewChange=null;_overlayTextureCache=new Map;constructor(e={}){const t=e.center??[0,0],[i,r]=H(t[0],t[1]);this._camera=new Zr({center:[i,r],zoom:e.zoom??0,rotation:e.rotation?e.rotation*Math.PI/180:0,minZoom:e.minZoom,maxZoom:e.maxZoom,viewportWidth:e.viewportWidth??800,viewportHeight:e.viewportHeight??600})}setState(e){if(e.center){const[t,i]=H(e.center[0],e.center[1]);this._camera.setCenter([t,i])}e.zoom!==void 0&&this._camera.setZoom(e.zoom),e.rotation!==void 0&&this._camera.setRotation(e.rotation*Math.PI/180)}getState(){const e=this._camera.center,[t,i]=qt(e[0],e[1]);return{center:[t,i],zoom:this._camera.zoom,pitch:0,bearing:0,rotation:this._camera.rotation*180/Math.PI}}getCameraState(){return{viewMatrix:this._camera.viewMatrix,projectionMatrix:this._camera.projectionMatrix,position:[this._camera.center[0],this._camera.center[1],0],viewportWidth:this._camera.viewportWidth,viewportHeight:this._camera.viewportHeight}}setViewport(e,t){this._camera.setViewport(e,t)}get camera(){return this._camera}goTo(e,t,i){if(this._destroyed)return Promise.reject(new Error("Mode disposed"));const r=e.duration??500;this.cancelAnimation();const n=e.center?H(e.center[0],e.center[1]):this._camera.center,s=e.zoom??this._camera.zoom,a=e.rotation!==void 0?e.rotation*Math.PI/180:this._camera.rotation;if(r<=0)return this._camera.setCenter(n),this._camera.setZoom(s),this._camera.setRotation(a),t(),i(),Promise.resolve();const l=this._camera.center,c=this._camera.zoom,d=this._camera.rotation;return this._anim=dr(r,u=>{const h=l[0]+(n[0]-l[0])*u,f=l[1]+(n[1]-l[1])*u;this._camera.setCenter([h,f]),this._camera.setZoom(c+(s-c)*u),this._camera.setRotation(d+(a-d)*u),t(),i()},()=>!this._destroyed),this._anim.promise}cancelAnimation(){this._anim?.cancel(),this._anim=null}renderFrame(e){const{renderEngine:t,layerManager:i,tileManager:r,terrainManager:n,tileScheduler:s,bufferCache:a}=e,l=this._camera.getExtent(),c=Math.round(this._camera.zoom),d=Math.max(0,Math.floor(this._camera.zoom)),{tileSources:u,terrainLayerIds:h,vectorLayerIds:f,customLayerIds:p,clusterLayerIds:g,dynamicPointLayerIds:x,vectorTileLayerIds:v,overlayLayerIds:y}=fr(i,this._camera.zoom),m=this._resolveActiveTerrainLayer(i,h);n.setActiveLayer(m?.id??null);const _=s.getTilesForExtent(l,d).map(M=>({z:M.z,x:M.x,y:M.y}));m&&_.length>0&&n.requestTiles(m,_);let w=[];if(u.length>0){w=r.getReadyTiles(l,c,u);for(const M of w)t.drawImagery(M)}if(m){const M=new Set,b=(C,S,T)=>{const B=n.getReadyHillshadeTile(m,C,S,T);if(!B)return;const F=B.sourceCoord,E=`${F.z}/${F.x}/${F.y}`;M.has(E)||(M.add(E),t.drawImagery({texture:B.texture,extent:un(F.z,F.x,F.y),opacity:m.opacity}))};for(const C of _)b(C.z,C.x,C.y)}const P=new Set(y);for(const[M,b]of this._overlayTextureCache)P.has(M)||(t.releaseTexture(b.texture),this._overlayTextureCache.delete(M));for(const M of y)yr(M,t,i,this._overlayTextureCache,!1);for(const M of y){const b=i.getLayer(M);if(b&&ct(b)){const C=b.videoElement;if(C&&!C.paused&&!C.ended){this._markDirty?.();break}}}for(const M of v){const b=i.getLayer(M);if(!b||!("updateVisibleTiles"in b))continue;const C=b.maxZoom??c,S=Math.min(c,C),T=s.getTilesForExtent(l,S).map(B=>({z:B.z,x:B.x,y:B.y}));b.updateVisibleTiles(T,{renderMode:"2d",zoom:this._camera.zoom})}for(const M of v)gr(M,t,i,a,!1,this._camera.zoom);for(const M of f)mr(M,t,i,a,!1,this._camera.zoom);for(const M of p)xr(M,t,i,(b,C,S)=>this._buildCustomShaderSource(b,C,S),!1);if(g.length>0){const M=[l.minX,l.minY,l.maxX,l.maxY],b=this._markDirty?{toMap:(C,S)=>this.toMap(C,S),toScreen:(C,S)=>this.toScreen(C,S),getZoom:()=>this._camera.zoom,getExtent:()=>[l.minX,l.minY,l.maxX,l.maxY],getViewportSize:()=>[this._camera.viewportWidth,this._camera.viewportHeight],goTo:C=>this.goTo(C,this._markDirty,this._onViewChange??(()=>{}))}:void 0;for(const C of g)vr(C,t,i,this._camera.zoom,M,!1,b)}for(const M of x)pr(M,t,i,!1)}_resolveActiveTerrainLayer(e,t){for(let i=t.length-1;i>=0;i--){const r=t[i];if(!r)continue;const n=e.getLayer(r);if(n&&Nt(n))return n}return null}_buildCustomShaderSource(e,t,i){if(e.rawMode===!0)return e.vertexShader+`
`+e.fragmentShader;let r=`struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
};
@group(0) @binding(0) var<uniform> camera: CameraUniforms;

struct FrameUniforms {
  time: f32,
  deltaTime: f32,
  frameNumber: f32,
  opacity: f32,
};
@group(1) @binding(0) var<uniform> frame: FrameUniforms;

`;return t!==null&&(r+=`@group(2) @binding(0) var<uniform> custom: CustomUniforms;

`),i.length>0&&(r+=`@group(3) @binding(0) var texSampler: sampler;
@group(3) @binding(1) var texInput: texture_2d<f32>;

`),r+=`fn projectMercator(pos: vec2<f32>) -> vec4<f32> {
  return camera.viewProjection * vec4<f32>(pos, 0.0, 1.0);
}

`,r+e.vertexShader+`
`+e.fragmentShader}attachInteraction(e,t,i,r){this._markDirty=t,this._onViewChange=i,r!==!1&&(this._interaction=new to(e,this._camera,t,i,r))}toMap(e,t){const[i,r]=this._camera.screenToMap(e,t);return qt(i,r)}toScreen(e,t){const[i,r]=H(e,t);return this._camera.mapToScreen(i,r)}dispose(){if(!this._destroyed){this._destroyed=!0,this.cancelAnimation(),this._interaction?.destroy(),this._interaction=null,this._onViewChange=null;for(const e of this._overlayTextureCache.values())e.texture.destroy();this._overlayTextureCache.clear()}}}const Ut=20037508342789244e-9,cn=Ut*2;function un(o,e,t){const i=Math.pow(2,o),r=cn/i,n=e*r-Ut,s=Ut-t*r,a=n+r,l=s-r;return[n,l,a,s]}class rt{planes;sphereCenter;sphereRadius;constructor(e,t,i){this.planes=e,this.sphereCenter=t,this.sphereRadius=i}static fromTile(e,t,i){const r=Math.pow(2,e),n=t/r,s=(t+1)/r,a=i/r,l=(i+1)/r,c=Te(n,a),d=Te(s,a),u=Te(n,l),h=Te(s,l),f=[(n+s)/2,(a+l)/2],p=Te(f[0],f[1]),g=[je(c,d,p),je(d,h,p),je(h,u,p),je(u,c,p)],x={a:-p[0],b:-p[1],c:-p[2],d:1},v=[c,d,u,h].map(P=>P[0]*p[0]+P[1]*p[1]+P[2]*p[2]),y=Math.min(...v),m={a:p[0],b:p[1],c:p[2],d:-y},_=[...g,x,m],w=Math.max(Xe(p,c),Xe(p,d),Xe(p,u),Xe(p,h));return new rt(_,p,w)}intersectsFrustum(e){for(const t of e)if(t.a*this.sphereCenter[0]+t.b*this.sphereCenter[1]+t.c*this.sphereCenter[2]+t.d<-this.sphereRadius)return!1;return!0}intersectsClippingPlane(e){return e[0]*this.sphereCenter[0]+e[1]*this.sphereCenter[1]+e[2]*this.sphereCenter[2]+e[3]>-this.sphereRadius}isVisible(e,t){return this.intersectsClippingPlane(t)&&this.intersectsFrustum(e)}}function Te(o,e){const[t,i]=Z.mercatorToAngular(o,e);return Z.angularToSphere(t,i)}function je(o,e,t){let i=o[1]*e[2]-o[2]*e[1],r=o[2]*e[0]-o[0]*e[2],n=o[0]*e[1]-o[1]*e[0];const s=Math.sqrt(i*i+r*r+n*n);return s<1e-15?{a:0,b:0,c:0,d:0}:(i/=s,r/=s,n/=s,i*t[0]+r*t[1]+n*t[2]<0&&(i=-i,r=-r,n=-n),{a:i,b:r,c:n,d:0})}function Xe(o,e){const t=o[0]-e[0],i=o[1]-e[1],r=o[2]-e[2];return Math.sqrt(t*t+i*i+r*r)}class hn{_maxZoom;_minZoom;constructor(e){this._maxZoom=e?.maxZoom??22,this._minZoom=e?.minZoom??0}getTilesForGlobe(e,t){const i=Math.max(this._minZoom,Math.min(this._maxZoom,Math.floor(t))),r=qr(e.viewProjectionMatrix),n=e.getClippingPlane(),s=[];if(i===0)return rt.fromTile(0,0,0).isVisible(r,n)&&s.push({z:0,x:0,y:0}),s;const a=this._minZoom,l=a===0?[{z:0,x:0,y:0}]:this._tilesAtZoom(a);for(const c of l)this._subdivide(c.z,c.x,c.y,i,r,n,s);return s}_subdivide(e,t,i,r,n,s,a){if(!rt.fromTile(e,t,i).isVisible(n,s))return;if(e>=r){a.push({z:e,x:t,y:i});return}const c=e+1,d=t*2,u=i*2;this._subdivide(c,d,u,r,n,s,a),this._subdivide(c,d+1,u,r,n,s,a),this._subdivide(c,d,u+1,r,n,s,a),this._subdivide(c,d+1,u+1,r,n,s,a)}_tilesAtZoom(e){const t=Math.pow(2,e),i=[];for(let r=0;r<t;r++)for(let n=0;n<t;n++)i.push({z:e,x:r,y:n});return i}static tileForLonLat(e,t,i){const r=Math.floor(i),n=Math.pow(2,r),s=Math.floor((e+180)/360*n),a=t*(Math.PI/180),l=Math.floor((1-Math.log(Math.tan(a)+1/Math.cos(a))/Math.PI)/2*n);return{z:r,x:Math.max(0,Math.min(n-1,s)),y:Math.max(0,Math.min(n-1,l))}}static tileBounds(e,t,i){const r=Math.pow(2,e),n=t/r*360-180,s=(t+1)/r*360-180,a=Bi(i,r),l=Bi(i+1,r);return{west:n,east:s,north:a,south:l}}}function Bi(o,e){return Math.atan(Math.sinh(Math.PI-2*Math.PI*o/e))*(180/Math.PI)}class dn{_element;_transform;_onDirty;_onViewChange;_panEnabled;_zoomEnabled;_keyboardEnabled;_doubleClickZoom;_pitchBearingEnabled;_zoomSpeed;_getGlobeness;_dragging=!1;_lastPointerX=0;_lastPointerY=0;_activePointerId=null;_dragButton=0;_pointers=new Map;_lastPinchDist=0;_lastClickTime=0;_onPointerDown;_onPointerMove;_onPointerUp;_onWheel;_onKeyDown;_onContextMenu;_destroyed=!1;constructor(e,t,i,r,n){this._element=e,this._transform=t,this._onDirty=i,this._onViewChange=r,this._panEnabled=n?.pan??!0,this._zoomEnabled=n?.zoom??!0,this._keyboardEnabled=n?.keyboard??!0,this._doubleClickZoom=n?.doubleClickZoom??!0,this._pitchBearingEnabled=n?.pitchBearing??!0,this._zoomSpeed=n?.zoomSpeed??1,this._getGlobeness=n?.getGlobeness??(()=>1),this._onPointerDown=this._handlePointerDown.bind(this),this._onPointerMove=this._handlePointerMove.bind(this),this._onPointerUp=this._handlePointerUp.bind(this),this._onWheel=this._handleWheel.bind(this),this._onKeyDown=this._handleKeyDown.bind(this),this._onContextMenu=s=>s.preventDefault(),e.addEventListener("pointerdown",this._onPointerDown),e.addEventListener("pointermove",this._onPointerMove),e.addEventListener("pointerup",this._onPointerUp),e.addEventListener("pointercancel",this._onPointerUp),e.addEventListener("wheel",this._onWheel,{passive:!1}),e.addEventListener("contextmenu",this._onContextMenu),this._keyboardEnabled&&(e.setAttribute("tabindex","0"),e.addEventListener("keydown",this._onKeyDown))}_handlePointerDown(e){if(this._destroyed)return;const t=e.target;if(!(t&&t!==this._element&&t.tagName!=="CANVAS"))if(this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this._pointers.size===1){if(this._dragging=!0,this._dragButton=e.button,this._activePointerId=e.pointerId,this._lastPointerX=e.clientX,this._lastPointerY=e.clientY,this._element.setPointerCapture(e.pointerId),this._doubleClickZoom&&e.button===0){const i=Date.now();i-this._lastClickTime<300&&this._handleDoubleClick(e),this._lastClickTime=i}}else this._pointers.size===2&&(this._lastPinchDist=this._getPinchDistance())}_handlePointerMove(e){if(this._destroyed)return;if(this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this._pointers.size===2&&this._zoomEnabled){const r=this._getPinchDistance();if(this._lastPinchDist>0){const n=r/this._lastPinchDist,s=Math.log2(n);this._transform.setZoom(this._transform.zoom+s),this._onDirty(),this._onViewChange()}this._lastPinchDist=r;return}if(!this._dragging||e.pointerId!==this._activePointerId)return;const t=e.clientX-this._lastPointerX,i=e.clientY-this._lastPointerY;if(this._lastPointerX=e.clientX,this._lastPointerY=e.clientY,this._dragButton===2&&this._pitchBearingEnabled){const r=t*.3,n=-i*.3;this._transform.setBearing(this._transform.bearing+r),this._transform.setPitch(this._transform.pitch+n),this._onDirty(),this._onViewChange()}else this._dragButton===0&&this._panEnabled&&this._handlePan(t,i)}_handlePointerUp(e){if(!this._destroyed){if(this._pointers.delete(e.pointerId),e.pointerId===this._activePointerId){this._dragging=!1,this._activePointerId=null;try{this._element.releasePointerCapture(e.pointerId)}catch{}}this._pointers.size<2&&(this._lastPinchDist=0)}}_handlePan(e,t){const i=180/(Math.pow(2,this._transform.zoom)*256),r=this._transform.center,n=this._transform.bearing*(Math.PI/180),s=Math.cos(n),a=Math.sin(n),l=e*s+t*a,c=-e*a+t*s,d=r[1]*(Math.PI/180),u=Math.max(.1,Math.cos(d)),h=r[0]-l*i/u,f=Math.max(-85.051129,Math.min(85.051129,r[1]+c*i));this._transform.setCenter(h,f),this._onDirty(),this._onViewChange()}_handleWheel(e){if(this._destroyed||!this._zoomEnabled)return;e.preventDefault();const t=-e.deltaY*.003*this._zoomSpeed,i=this._transform.zoom,r=i+t,n=typeof this._element.getBoundingClientRect=="function"?this._element.getBoundingClientRect():null,s=n?e.clientX-n.left:this._transform.viewportWidth/2,a=n?e.clientY-n.top:this._transform.viewportHeight/2,l=s-this._transform.viewportWidth/2,c=a-this._transform.viewportHeight/2;if(this._transform.setZoom(r),this._transform.zoom-i!==0&&(Math.abs(l)>.5||Math.abs(c)>.5)){const h=1-this._getGlobeness();if(h>.001){const f=this._transform.bearing*(Math.PI/180),p=Math.cos(f),g=Math.sin(f),x=l*p+c*g,v=-l*g+c*p,y=360/(Math.pow(2,i)*512),m=360/(Math.pow(2,this._transform.zoom)*512),_=this._transform.center,w=_[1]*(Math.PI/180),P=Math.max(.1,Math.cos(w)),M=x*(y-m)/P*h,b=-v*(y-m)*h;this._transform.setCenter(_[0]+M,Math.max(-85.051129,Math.min(85.051129,_[1]+b)))}}this._onDirty(),this._onViewChange()}_handleDoubleClick(e){this._zoomEnabled&&(this._transform.setZoom(this._transform.zoom+1),this._onDirty(),this._onViewChange())}_handleKeyDown(e){if(this._destroyed)return;const t=50,i=180/(Math.pow(2,this._transform.zoom)*256);switch(e.key){case"+":case"=":this._zoomEnabled&&(this._transform.setZoom(this._transform.zoom+.5),this._onDirty(),this._onViewChange());break;case"-":this._zoomEnabled&&(this._transform.setZoom(this._transform.zoom-.5),this._onDirty(),this._onViewChange());break;case"ArrowLeft":if(this._panEnabled){const r=this._transform.center;this._transform.setCenter(r[0]-t*i,r[1]),this._onDirty(),this._onViewChange()}break;case"ArrowRight":if(this._panEnabled){const r=this._transform.center;this._transform.setCenter(r[0]+t*i,r[1]),this._onDirty(),this._onViewChange()}break;case"ArrowUp":if(this._panEnabled){const r=this._transform.center;this._transform.setCenter(r[0],Math.min(85.051129,r[1]+t*i)),this._onDirty(),this._onViewChange()}break;case"ArrowDown":if(this._panEnabled){const r=this._transform.center;this._transform.setCenter(r[0],Math.max(-85.051129,r[1]-t*i)),this._onDirty(),this._onViewChange()}break}}_getPinchDistance(){const e=[...this._pointers.values()];if(e.length<2)return 0;const t=e[1].x-e[0].x,i=e[1].y-e[0].y;return Math.sqrt(t*t+i*i)}destroy(){this._destroyed||(this._destroyed=!0,this._element.removeEventListener("pointerdown",this._onPointerDown),this._element.removeEventListener("pointermove",this._onPointerMove),this._element.removeEventListener("pointerup",this._onPointerUp),this._element.removeEventListener("pointercancel",this._onPointerUp),this._element.removeEventListener("wheel",this._onWheel),this._element.removeEventListener("contextmenu",this._onContextMenu),this._element.removeEventListener("keydown",this._onKeyDown))}}const J=20037508342789244e-9,fn=5;class Fi{type="3d";_transform;_projection;_tileCovering;_interaction=null;_anim=null;_destroyed=!1;_markDirty=null;_onViewChange=null;_overlayTextureCache=new Map;_activeTerrainLayer=null;_frameCounter=0;_frameCacheId=-1;_frameTileCache=new Map;_frameFlatCache=new Map;constructor(e={}){this._transform=new lr({center:e.center??[0,0],zoom:e.zoom??2,pitch:e.pitch??0,bearing:e.bearing??0,viewportWidth:e.viewportWidth??800,viewportHeight:e.viewportHeight??600}),this._projection=new Z,this._projection.updateFromZoom(this._transform.zoom),this._tileCovering=new hn}get transform(){return this._transform}get projection(){return this._projection}setState(e){e.center&&this._transform.setCenter(e.center[0],e.center[1]),e.zoom!==void 0&&this._transform.setZoom(e.zoom),e.pitch!==void 0&&this._transform.setPitch(e.pitch),e.bearing!==void 0&&this._transform.setBearing(e.bearing),this._syncCameraSurfaceConstraint(),this._projection.updateFromZoom(this._transform.zoom)}getState(){return{center:this._transform.center,zoom:this._transform.zoom,pitch:this._transform.pitch,bearing:this._transform.bearing,rotation:0}}getCameraState(){const e=this._transform.center,t=e[1]*Math.PI/180,i=(e[0]+180)/360,r=(1-Math.log(Math.tan(t)+1/Math.cos(t))/Math.PI)/2;return{viewMatrix:this._transform.viewMatrix,projectionMatrix:this._transform.projectionMatrix,position:this._transform.cameraPosition,viewportWidth:this._transform.viewportWidth,viewportHeight:this._transform.viewportHeight,projectionTransition:this._projection.globeness,clippingPlane:this._transform.getClippingPlane(),globeRadius:1,flatViewProjectionMatrix:this._transform.flatViewProjectionMatrix,cameraMerc01:[i,r,this._transform.mercatorCameraDistance]}}setViewport(e,t){this._transform.setViewport(e,t)}goTo(e,t,i){if(this._destroyed)return Promise.reject(new Error("Mode disposed"));const r=e.duration??500;this.cancelAnimation();const n=e.center??this._transform.center,s=e.zoom??this._transform.zoom,a=e.pitch??this._transform.pitch,l=e.bearing??this._transform.bearing;if(r<=0)return this._transform.setCenter(n[0],n[1]),this._transform.setZoom(s),this._transform.setPitch(a),this._transform.setBearing(l),this._syncCameraSurfaceConstraint(),this._projection.updateFromZoom(this._transform.zoom),t(),i(),Promise.resolve();const c=this._transform.center,d=this._transform.zoom,u=this._transform.pitch,h=this._transform.bearing;return this._anim=dr(r,f=>{this._transform.setCenter(c[0]+(n[0]-c[0])*f,c[1]+(n[1]-c[1])*f),this._transform.setZoom(d+(s-d)*f),this._transform.setPitch(u+(a-u)*f),this._transform.setBearing(h+(l-h)*f),this._syncCameraSurfaceConstraint(),this._projection.updateFromZoom(this._transform.zoom),t(),i()},()=>!this._destroyed),this._anim.promise}cancelAnimation(){this._anim?.cancel(),this._anim=null}renderFrame(e){this._frameCounter++;const{renderEngine:t,layerManager:i,tileManager:r,terrainManager:n,bufferCache:s,globeEffects:a}=e;this._projection.updateFromZoom(this._transform.zoom);const l=Math.floor(this._transform.zoom),{tileSources:c,terrainLayerIds:d,vectorLayerIds:u,customLayerIds:h,clusterLayerIds:f,dynamicPointLayerIds:p,vectorTileLayerIds:g,overlayLayerIds:x}=fr(i,this._transform.zoom),v=this._resolveActiveTerrainLayer(i,d),y=this._syncCameraSurfaceConstraint(v);y&&this._projection.updateFromZoom(this._transform.zoom),n.setActiveLayer(v?.id??null),y&&(this._markDirty?.(),this._onViewChange?.());const m=this._projection.globeness;if(this._drawSkyBackground(t,a),this._drawGlobeShellEffects(t,a,m),c.length===0&&u.length===0&&h.length===0&&f.length===0&&g.length===0&&x.length===0)return;if(c.length>0){const P=this._getCachedTiles(m,l);v&&n.requestTiles(v,P);const M=r.getReadyTilesForCoords(P,c);for(const b of M){const C=20037508342789244e-9,S=(b.extent[0]+C)/(2*C),T=(b.extent[2]+C)/(2*C),B=1-(b.extent[3]+C)/(2*C),F=1-(b.extent[1]+C)/(2*C),E=[S,B,T,F],G=pn(E),D=v&&G?n.getReadyHeightTile(v,G.z,G.x,G.y):null,V=v!==null;t.drawGlobeTile({texture:b.texture,mercatorExtent:E,opacity:b.opacity,depthBias:b.depthBias??0,filters:b.filters,terrainHeightTexture:D?.texture,terrainUvOffsetScale:D?.uvOffsetScale??[0,0,1,1],heightMode:V?1:0,heightExaggeration:V?v.exaggeration:void 0,lighting3D:(V?v.lighting3D:void 0)??{enabled:a.lighting.enabled,ambient:a.lighting.ambient,diffuse:a.lighting.diffuse,shadowStrength:a.lighting.shadowStrength,shadowSoftness:a.lighting.shadowSoftness,sunAzimuth:a.lighting.sunAzimuth,sunAltitude:a.lighting.sunAltitude}})}}const _=new Set(x);for(const[P,M]of this._overlayTextureCache)_.has(P)||(t.releaseTexture(M.texture),this._overlayTextureCache.delete(P));for(const P of x)yr(P,t,i,this._overlayTextureCache,!0);for(const P of x){const M=i.getLayer(P);if(M&&ct(M)){const b=M.videoElement;if(b&&!b.paused&&!b.ended){this._markDirty?.();break}}}for(const P of g){const M=i.getLayer(P);if(!M||!("updateVisibleTiles"in M))continue;const b=Math.floor(this._transform.zoom),C=M.maxZoom??b,S=Math.min(b,C),T=this._getCachedTiles(m,S);M.updateVisibleTiles(T,{renderMode:"3d",zoom:this._transform.zoom})}for(const P of g)gr(P,t,i,s,!0,this._transform.zoom);const w=v&&typeof v.sampleElevation=="function"?v:void 0;for(const P of u)mr(P,t,i,s,!0,this._transform.zoom,w);for(const P of h)xr(P,t,i,(M,b,C)=>this._buildCustomShaderSource(M,b,C),!0);if(f.length>0){const P=this._fallbackClusterExtent3857(this._transform.center),M=this._computeClusterExtent3857()??P,b=this._markDirty?{toMap:(C,S)=>this.toMap(C,S),toScreen:(C,S)=>this.toScreen(C,S),getZoom:()=>this._transform.zoom,getExtent:()=>this._computeClusterExtent3857()??P,getViewportSize:()=>[this._transform.viewportWidth,this._transform.viewportHeight],goTo:C=>this.goTo(C,this._markDirty,this._onViewChange??(()=>{}))}:void 0;for(const C of f)vr(C,t,i,this._transform.zoom,M,!0,b)}for(const P of p)pr(P,t,i,!0)}_resolveActiveTerrainLayer(e,t){for(let i=t.length-1;i>=0;i--){const r=t[i];if(!r)continue;const n=e.getLayer(r);if(n&&Nt(n))return n}return null}_computeClusterExtent3857(){const e=this._transform.viewportWidth,t=this._transform.viewportHeight;if(!(e>0)||!(t>0))return null;const i=Math.min(e*.08,64),r=Math.min(t*.08,64),n=i,s=e*.5,a=Math.max(n,e-i),l=r,c=t*.5,d=Math.max(l,t-r),u=[[n,l],[s,l],[a,l],[n,c],[s,c],[a,c],[n,d],[s,d],[a,d]],h=this.toMap(s,c)??this._transform.center;let f=1/0,p=1/0,g=-1/0,x=-1/0,v=0;for(const[w,P]of u){const M=this.toMap(w,P);if(!M)continue;const[b,C]=H(M[0],M[1]);f=Math.min(f,b),p=Math.min(p,C),g=Math.max(g,b),x=Math.max(x,C),v++}if(v<3||!isFinite(f)||!isFinite(p)||!isFinite(g)||!isFinite(x))return this._fallbackClusterExtent3857(h);const y=g-f,m=x-p;if(!(y>0)||!(m>0))return this._fallbackClusterExtent3857(h);const _=Math.max(y,m)*.08;return[Math.max(-J,f-_),Math.max(-J,p-_),Math.min(J,g+_),Math.min(J,x+_)]}_fallbackClusterExtent3857(e){const[t,i]=H(e[0],e[1]),r=2*J/(256*Math.pow(2,this._transform.zoom)),n=Math.max(r*this._transform.viewportWidth*.6,r*32),s=Math.max(r*this._transform.viewportHeight*.6,r*32);return[Math.max(-J,t-n),Math.max(-J,i-s),Math.min(J,t+n),Math.min(J,i+s)]}_buildCustomShaderSource(e,t,i){if(e.rawMode===!0)return e.vertexShader+`
`+e.fragmentShader;let r=`struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  flatViewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  projectionTransition: f32,
  globeRadius: f32,
  clippingPlane: vec4<f32>,
};
@group(0) @binding(0) var<uniform> camera: CameraUniforms;

struct FrameUniforms {
  time: f32,
  deltaTime: f32,
  frameNumber: f32,
  opacity: f32,
};
@group(1) @binding(0) var<uniform> frame: FrameUniforms;

`;return t!==null&&(r+=`@group(2) @binding(0) var<uniform> custom: CustomUniforms;

`),i.length>0&&(r+=`@group(3) @binding(0) var texSampler: sampler;
@group(3) @binding(1) var texInput: texture_2d<f32>;

`),r+=`const _PI: f32 = 3.141592653589793;
const _TWO_PI: f32 = 6.283185307179586;
const _HALF_CIRC: f32 = 20037508.342789244;

fn _epsg3857ToMerc01(pos: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    (pos.x + _HALF_CIRC) / (2.0 * _HALF_CIRC),
    1.0 - (pos.y + _HALF_CIRC) / (2.0 * _HALF_CIRC)
  );
}

fn _mercToAngular(merc: vec2<f32>) -> vec2<f32> {
  let lon = merc.x * _TWO_PI - _PI;
  let lat = atan(exp(_PI - merc.y * _TWO_PI)) * 2.0 - _PI * 0.5;
  return vec2<f32>(lon, lat);
}

fn _angularToSphere(lon: f32, lat: f32) -> vec3<f32> {
  let cosLat = cos(lat);
  return vec3<f32>(cosLat * sin(lon), sin(lat), cosLat * cos(lon));
}

fn projectMercator(pos: vec2<f32>) -> vec4<f32> {
  let merc01 = _epsg3857ToMerc01(pos);
  let ang = _mercToAngular(merc01);
  let sp = _angularToSphere(ang.x, ang.y);
  var globeClip = camera.viewProjection * vec4<f32>(sp, 1.0);
  let clipZ = 1.0 - (dot(sp, camera.clippingPlane.xyz) + camera.clippingPlane.w);
  globeClip.z = clipZ * globeClip.w;
  if (camera.projectionTransition >= 0.999) { return globeClip; }
  let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, 0.0, 1.0);
  if (camera.projectionTransition <= 0.001) { return flatClip; }
  return mix(flatClip, globeClip, camera.projectionTransition);
}

`,r+e.vertexShader+`
`+e.fragmentShader}_getCachedTiles(e,t){this._frameCounter!==this._frameCacheId&&(this._frameTileCache.clear(),this._frameFlatCache.clear(),this._frameCacheId=this._frameCounter);const i=Math.max(0,Math.min(22,Math.floor(t)));if(e>=.5){let n=this._frameTileCache.get(i);return n||(n=this._tileCovering.getTilesForGlobe(this._transform,i),this._frameTileCache.set(i,n)),n}let r=this._frameFlatCache.get(i);return r||(r=this._getTilesForFlat(i),this._frameFlatCache.set(i,r)),r}_getTilesForFlat(e){const t=Math.max(0,Math.min(22,Math.floor(e))),i=Math.pow(2,t),r=this._transform.center,n=r[1]*Math.PI/180,s=(Math.floor((r[0]+180)/360*i)%i+i)%i,a=Math.floor((1-Math.log(Math.tan(n)+1/Math.cos(n))/Math.PI)/2*i),l=1/Math.max(.3,Math.cos(this._transform.pitch*Math.PI/180)),c=Math.ceil(this._transform.viewportWidth/256/2)+1,d=Math.ceil(this._transform.viewportHeight/256/2*l)+1,u=[];for(let h=-d;h<=d;h++)for(let f=-c;f<=c;f++){const p=s+f,g=a+h;p>=0&&p<i&&g>=0&&g<i&&u.push({z:t,x:p,y:g})}return u}attachInteraction(e,t,i,r){if(this._markDirty=t,this._onViewChange=i,r===!1)return;const n={...r,getGlobeness:()=>this._projection.globeness};this._interaction=new dn(e,this._transform,t,()=>{this._syncCameraSurfaceConstraint()&&t(),this._projection.updateFromZoom(this._transform.zoom),i()},n)}_syncCameraSurfaceConstraint(e=this._activeTerrainLayer){this._activeTerrainLayer=e;const[t,i]=this._transform.center,r=e?fn:0,n=e?.sampleElevation?.(t,i)??0,s=e&&Number.isFinite(n)&&n>0?n*Math.max(0,e?.exaggeration??1):0;return this._transform.setMinCameraSurfaceDistance(r+s)}_drawSkyBackground(e,t){t.sky.enabled&&e.drawSky(t.sky,t.lighting.sunAltitude,t.lighting.sunAzimuth)}_drawGlobeShellEffects(e,t,i){if(!(i<=.01)&&(t.atmosphere.enabled&&e.drawAtmosphere(i,t.atmosphere),t.poleCaps.enabled)){const[r,n,s]=t.poleCaps.color;e.drawPoleCaps([r,n,s,i])}}toMap(e,t){const i=this._projection.globeness;if(i>=.999)return this._transform.screenToLonLat(e,t);if(i<=.001)return this._transform.screenToLonLatFlat(e,t);const r=this._transform.screenToLonLat(e,t),n=this._transform.screenToLonLatFlat(e,t);return n?r?[n[0]+(r[0]-n[0])*i,n[1]+(r[1]-n[1])*i]:n:r}toScreen(e,t){const i=this._projection.globeness;if(i>=.999)return this._transform.lonLatToScreen(e,t);if(i<=.001)return this._transform.lonLatToScreenFlat(e,t);const r=this._transform.lonLatToScreen(e,t),n=this._transform.lonLatToScreenFlat(e,t);return n?r?[n[0]+(r[0]-n[0])*i,n[1]+(r[1]-n[1])*i]:n:r}dispose(){if(!this._destroyed){this._destroyed=!0,this.cancelAnimation(),this._interaction?.destroy(),this._interaction=null,this._onViewChange=null;for(const e of this._overlayTextureCache.values())e.texture.destroy();this._overlayTextureCache.clear()}}}function pn(o){const e=o[2]-o[0];if(!(e>0))return null;const t=Math.floor(Math.log2(1/e)+1e-6);if(!Number.isFinite(t)||t<0)return null;const i=Math.pow(2,t);if(!(i>0))return null;const r=Math.max(0,Math.min(i-1,Math.floor(o[0]*i+1e-6))),n=Math.max(0,Math.min(i-1,Math.floor(o[1]*i+1e-6)));return{z:t,x:r,y:n}}class mn{_tools=new Map;_activeTool=null;_overlay=null;_events=new be;_commands;_previewLayer=null;_wheelPassthrough;_destroyed=!1;_canvas=null;_container=null;_toMap=null;_toScreen=null;_getMode=null;_getZoom=null;_markDirty=null;_lastClickTime=0;_lastClickX=0;_lastClickY=0;_dblClickThreshold=300;_dblClickDistance=5;_boundPointerDown=null;_boundPointerMove=null;_boundPointerUp=null;_boundKeyDown=null;_boundWheel=null;_boundContextMenu=null;constructor(e={}){this._commands=new Yr({maxHistorySize:e.maxHistorySize??50}),this._previewLayer=e.previewLayer??null,this._wheelPassthrough=e.wheelPassthrough??!0,this._commands.on("command-executed",()=>this._emitHistoryChange()),this._commands.on("command-undone",()=>this._emitHistoryChange()),this._commands.on("command-redone",()=>this._emitHistoryChange())}init(e){this._canvas=e.canvas,this._container=e.container,this._toMap=e.toMap,this._toScreen=e.toScreen,this._getMode=e.getMode,this._getZoom=e.getZoom,this._markDirty=e.markDirty}setPreviewLayer(e){this._previewLayer=e}get previewLayer(){return this._previewLayer}registerTool(e){if(this._tools.has(e.id))throw new Error(`Tool already registered: ${e.id}`);this._tools.set(e.id,e)}unregisterTool(e){const t=this._tools.get(e);t&&(this._activeTool===t&&this.deactivateTool(),t.destroy(),this._tools.delete(e))}getTool(e){return this._tools.get(e)}get tools(){return this._tools}activateTool(e){if(this._destroyed)return;const t=this._tools.get(e);if(!t)throw new Error(`Tool not found: ${e}`);if(this._activeTool&&this._activeTool!==t&&this.deactivateTool(),this._activeTool===t)return;this._ensureOverlay();const i=this._buildContext();if(!i){console.warn("[ToolManager] Cannot activate tool — view not initialized");return}this._activeTool=t,t.activate(i),this._overlay&&(this._overlay.style.pointerEvents="auto",this._overlay.style.cursor=t.cursor),this._events.emit("tool-activate",{toolId:e})}deactivateTool(){if(!this._activeTool)return;const e=this._activeTool.id;this._activeTool.deactivate(),this._activeTool=null,this._overlay&&(this._overlay.style.pointerEvents="none",this._overlay.style.cursor="default"),this._previewLayer?.clear(),this._markDirty?.(),this._events.emit("tool-deactivate",{toolId:e})}get activeTool(){return this._activeTool}get commands(){return this._commands}undo(){const e=this._commands.undo();return e&&this._markDirty?.(),e}redo(){const e=this._commands.redo();return e&&this._markDirty?.(),e}get canUndo(){return this._commands.canUndo}get canRedo(){return this._commands.canRedo}on(e,t){this._events.on(e,t)}off(e,t){this._events.off(e,t)}destroy(){if(!this._destroyed){this._destroyed=!0,this.deactivateTool();for(const e of this._tools.values())e.destroy();this._tools.clear(),this._removeOverlay(),this._commands.destroy(),this._events.removeAll(),this._previewLayer=null,this._canvas=null,this._container=null}}_ensureOverlay(){if(this._overlay||!this._container)return;const e=document.createElement("div");e.style.position="absolute",e.style.top="0",e.style.left="0",e.style.width="100%",e.style.height="100%",e.style.pointerEvents="none",e.style.zIndex="10",e.style.touchAction="none",e.setAttribute("data-mapgpu-tool-overlay","true"),getComputedStyle(this._container).position==="static"&&(this._container.style.position="relative"),this._container.appendChild(e),this._overlay=e,this._boundPointerDown=this._onPointerDown.bind(this),this._boundPointerMove=this._onPointerMove.bind(this),this._boundPointerUp=this._onPointerUp.bind(this),this._boundKeyDown=this._onKeyDown.bind(this),this._boundWheel=this._onWheel.bind(this),this._boundContextMenu=i=>i.preventDefault(),e.addEventListener("pointerdown",this._boundPointerDown),e.addEventListener("pointermove",this._boundPointerMove),e.addEventListener("pointerup",this._boundPointerUp),e.addEventListener("wheel",this._boundWheel,{passive:!1}),e.addEventListener("contextmenu",this._boundContextMenu),document.addEventListener("keydown",this._boundKeyDown)}_removeOverlay(){this._overlay&&(this._boundPointerDown&&this._overlay.removeEventListener("pointerdown",this._boundPointerDown),this._boundPointerMove&&this._overlay.removeEventListener("pointermove",this._boundPointerMove),this._boundPointerUp&&this._overlay.removeEventListener("pointerup",this._boundPointerUp),this._boundWheel&&this._overlay.removeEventListener("wheel",this._boundWheel),this._boundContextMenu&&this._overlay.removeEventListener("contextmenu",this._boundContextMenu),this._boundKeyDown&&document.removeEventListener("keydown",this._boundKeyDown),this._overlay.parentElement?.removeChild(this._overlay),this._overlay=null)}_onPointerDown(e){if(!this._activeTool||e.button!==0)return;const t=this._buildPointerEvent(e);this._activeTool.onPointerDown(t),this._syncCursor()}_onPointerMove(e){if(!this._activeTool)return;const t=this._buildPointerEvent(e);this._activeTool.onPointerMove(t),this._events.emit("cursor-move",{screenX:t.screenX,screenY:t.screenY,mapCoords:t.mapCoords}),this._syncCursor()}_onPointerUp(e){if(!this._activeTool||e.button!==0)return;const t=this._buildPointerEvent(e),i=Date.now(),r=Math.abs(t.screenX-this._lastClickX),n=Math.abs(t.screenY-this._lastClickY);i-this._lastClickTime<this._dblClickThreshold&&r<this._dblClickDistance&&n<this._dblClickDistance?(this._activeTool.onDoubleClick(t),this._lastClickTime=0):(this._activeTool.onPointerUp(t),this._lastClickTime=i,this._lastClickX=t.screenX,this._lastClickY=t.screenY),this._syncCursor()}_onKeyDown(e){if(this._activeTool){if((e.ctrlKey||e.metaKey)&&e.key==="z"&&!e.shiftKey){e.preventDefault(),this.undo();return}if((e.ctrlKey||e.metaKey)&&e.key==="z"&&e.shiftKey){e.preventDefault(),this.redo();return}if((e.ctrlKey||e.metaKey)&&e.key==="y"){e.preventDefault(),this.redo();return}if(e.key==="Escape"){e.preventDefault(),this._activeTool.cancel(),this._syncCursor();return}this._activeTool.onKeyDown(e)&&e.preventDefault()}}_onWheel(e){if(!this._wheelPassthrough||!this._container)return;const t=new WheelEvent("wheel",{deltaX:e.deltaX,deltaY:e.deltaY,deltaZ:e.deltaZ,deltaMode:e.deltaMode,clientX:e.clientX,clientY:e.clientY,screenX:e.screenX,screenY:e.screenY,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,bubbles:!0,cancelable:!0});this._overlay&&(this._overlay.style.pointerEvents="none",this._canvas?.dispatchEvent(t),queueMicrotask(()=>{this._overlay&&this._activeTool&&(this._overlay.style.pointerEvents="auto")})),e.preventDefault()}_buildPointerEvent(e){const t=this._canvas?.getBoundingClientRect(),i=t?e.clientX-t.left:e.offsetX,r=t?e.clientY-t.top:e.offsetY,n=this._toMap?this._toMap(i,r):null;return{screenX:i,screenY:r,mapCoords:n,originalEvent:e,button:e.button,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey||e.metaKey}}_buildContext(){return!this._canvas||!this._toMap||!this._toScreen||!this._getMode||!this._getZoom||!this._previewLayer||!this._markDirty?null:{toMap:this._toMap,toScreen:this._toScreen,canvas:this._canvas,mode:this._getMode(),zoom:this._getZoom(),previewLayer:this._previewLayer,commands:this._commands,markDirty:this._markDirty,emitEvent:(e,t)=>{this._events.emit(e,t)}}}_syncCursor(){this._overlay&&this._activeTool&&(this._overlay.style.cursor=this._activeTool.cursor)}_emitHistoryChange(){this._events.emit("history-change",{canUndo:this._commands.canUndo,canRedo:this._commands.canRedo})}}const gn={format:"depth32float",compareFunc:"less",clearValue:1};function Gi(o){return o==="3d"?gn:Vt}class pl{get map(){return this._core.map}id;get type(){return this._mode.type}_core;_mode;_events=new be;_ready=!1;_destroyed=!1;_readyResolve=null;_readyPromise;_interactionOptions;_animatedLayerCallbacks=new Map;_toolManager=null;_clickHandler=null;_pointerMoveHandler=null;_cameraLock=null;constructor(e){this.id=`mapview-${Date.now()}`,this._core=new $o,this._interactionOptions=e.interaction??{},this._maxBounds=e.maxBounds??null;let t=null;if(typeof e.container=="string"){const s=document.querySelector(e.container);if(!s||!(s instanceof HTMLElement))throw new Error(`Container element not found: ${e.container}`);t=s}else t=e.container;t&&typeof document<"u"&&this._core.createCanvas(t);const i=t?.clientWidth||800,r=t?.clientHeight||600,n=e.mode??"2d";if(n==="3d"?this._mode=new Fi({center:e.center,zoom:e.zoom,pitch:e.pitch,bearing:e.bearing,viewportWidth:i,viewportHeight:r}):this._mode=new Ti({center:e.center,zoom:e.zoom,rotation:e.rotation,minZoom:e.minZoom,maxZoom:e.maxZoom,viewportWidth:i,viewportHeight:r}),this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._core.map.on("layer-add",({layer:s})=>{if(this._core.layerManager.addLayer(s),this._core.renderLoop.markDirty(),this._events.emit("layer-add",{layer:s}),s.on("refresh",()=>{this._core.bufferCache.invalidate(s.id),this._core.terrainManager.invalidateLayer(s.id),this._core.renderLoop.markDirty()}),s.on("visibility-change",()=>{this._core.renderLoop.markDirty()}),s.on("opacity-change",()=>{this._core.renderLoop.markDirty()}),Ot(s)&&s.animated){const a=(l,c)=>this._core.renderLoop.markDirty();this._animatedLayerCallbacks.set(s.id,a),this._core.renderLoop.onPreFrame(a)}}),this._core.map.on("layer-remove",({layer:s})=>{this._core.layerManager.removeLayer(s.id),this._core.bufferCache.invalidate(s.id),this._core.terrainManager.invalidateLayer(s.id),Ki(s)&&this._core.tileManager.invalidateSource(s.id),this._core.renderLoop.markDirty(),this._events.emit("layer-remove",{layer:s});const a=this._animatedLayerCallbacks.get(s.id);a&&(this._core.renderLoop.offPreFrame(a),this._animatedLayerCallbacks.delete(s.id))}),e.globeEffects&&(this._core.globeEffects=Lt(e.globeEffects)),e.renderEngine&&(this._core.renderEngine=e.renderEngine,this._core.bufferCache.setRenderEngine(e.renderEngine),this._core.tileManager.setRenderEngine(e.renderEngine),this._core.terrainManager.setRenderEngine(e.renderEngine),this._core.renderLoop.setRenderEngine(e.renderEngine),this._core.renderLoop.setCameraStateProvider(()=>this._mode.getCameraState()),n==="3d")){const[s,a,l,c]=this._core.globeEffects.backgroundColor;e.renderEngine.setClearColor(s,a,l,c)}if(this._core.renderLoop.onPreFrame(s=>{this._applyCameraLock(s)}),this._core.renderLoop.onFrame((s,a)=>{if(!this._core.gpuReady||!this._core.renderEngine)return;const l={renderEngine:this._core.renderEngine,layerManager:this._core.layerManager,tileManager:this._core.tileManager,terrainManager:this._core.terrainManager,tileScheduler:this._core.tileScheduler,bufferCache:this._core.bufferCache,globeEffects:this._core.globeEffects};this._mode.renderFrame(l);const c=this._core.renderLoop.getStats();this._events.emit("frame",{frameNumber:a,fps:c.fps})}),this._core.container&&this._core.canvas&&this._core.setupResizeObserver(this._core.container,this._core.canvas,(s,a)=>{this._mode.setViewport(s,a),this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._core.renderLoop.markDirty(),this._emitViewChange()}),this._core.container&&this._interactionOptions!==!1&&this._mode.attachInteraction(this._core.container,()=>this._core.renderLoop.markDirty(),()=>{this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._emitViewChange()},this._interactionOptions),this._core.container){let s=0,a=0,l=0;const c=5,d=500,u=this._core.container,h=y=>{const m=u.getBoundingClientRect();s=y.clientX-m.left,a=y.clientY-m.top,l=Date.now()},f=y=>{const m=u.getBoundingClientRect(),_=y.clientX-m.left,w=y.clientY-m.top,P=_-s,M=w-a,b=Date.now()-l;if(Math.sqrt(P*P+M*M)<c&&b<d){const C=this._mode.toMap(_,w);this._events.emit("click",{screenX:_,screenY:w,mapPoint:C})}},p=y=>{const m=u.getBoundingClientRect(),_=y.clientX-m.left,w=y.clientY-m.top;this._events.emit("mousedown",{screenX:_,screenY:w,mapPoint:this._mode.toMap(_,w),button:y.button})},g=y=>{const m=u.getBoundingClientRect(),_=y.clientX-m.left,w=y.clientY-m.top;this._events.emit("mouseup",{screenX:_,screenY:w,mapPoint:this._mode.toMap(_,w),button:y.button})},x=y=>{const m=u.getBoundingClientRect(),_=y.clientX-m.left,w=y.clientY-m.top;this._events.emit("dblclick",{screenX:_,screenY:w,mapPoint:this._mode.toMap(_,w)})},v=y=>{const m=u.getBoundingClientRect(),_=y.clientX-m.left,w=y.clientY-m.top;this._events.emit("contextmenu",{screenX:_,screenY:w,mapPoint:this._mode.toMap(_,w),originalEvent:y})};u.addEventListener("pointerdown",h),u.addEventListener("pointerup",f),u.addEventListener("pointerdown",p),u.addEventListener("pointerup",g),u.addEventListener("dblclick",x),u.addEventListener("contextmenu",v),this._clickHandler=()=>{u.removeEventListener("pointerdown",h),u.removeEventListener("pointerup",f),u.removeEventListener("pointerdown",p),u.removeEventListener("pointerup",g),u.removeEventListener("dblclick",x),u.removeEventListener("contextmenu",v)}}if(this._core.container){let s=!1;const a=this._core.container,l=c=>{s||(s=!0,requestAnimationFrame(()=>{s=!1;const d=a.getBoundingClientRect(),u=c.clientX-d.left,h=c.clientY-d.top,f=this._mode.toMap(u,h);this._events.emit("pointer-move",{screenX:u,screenY:h,mapPoint:f})}))};a.addEventListener("pointermove",l),this._pointerMoveHandler=()=>{a.removeEventListener("pointermove",l)}}this._readyPromise=new Promise(s=>{this._readyResolve=s}),e.renderEngine&&this._core.canvas?this._core.initGpu(e.renderEngine,this._core.canvas,Gi(n)).then(()=>{this._destroyed||(this._ready=!0,this._readyResolve?.(),this._events.emit("ready",void 0),this._core.renderLoop.start())},s=>{this._destroyed||(console.error("[mapgpu] GPU init failed:",s),this._ready=!0,this._readyResolve?.(),this._events.emit("error",{kind:"webgpu-not-supported",userAgent:typeof navigator<"u"?navigator.userAgent:"unknown"}),this._events.emit("ready",void 0))}):queueMicrotask(()=>{this._destroyed||(this._ready=!0,this._readyResolve?.(),this._events.emit("ready",void 0))})}get mode(){return this._mode.type}get center(){return this._mode.getState().center}get zoom(){return this._mode.getState().zoom}get pitch(){return this._mode.getState().pitch}get bearing(){return this._mode.getState().bearing}get rotation(){return this._mode.getState().rotation}get ready(){return this._ready}get cameraLocked(){return this._cameraLock!==null}get gpuReady(){return this._core.gpuReady}get canvas(){return this._core.canvas}getViewState(){return this._mode.getState()}lockCamera(e){if(this._destroyed)throw new Error("View is destroyed");this._cameraLock=e,this._mode.cancelAnimation(),this._applyCameraLock(),this._core.renderLoop.markDirty()}unlockCamera(){this._cameraLock=null}get toolManager(){return this._toolManager||(this._toolManager=new mn,this._core.canvas&&this._core.container&&this._toolManager.init({canvas:this._core.canvas,container:this._core.container,toMap:(e,t)=>this.toMap(e,t),toScreen:(e,t)=>this.toScreen(e,t),getMode:()=>this.mode,getZoom:()=>this.zoom,markDirty:()=>this._core.renderLoop.markDirty()})),this._toolManager}async switchTo(e){if(this._destroyed)throw new Error("View is destroyed");if(this._mode.type===e)return;const t=this._mode.getState(),i=this._mode.type;this._mode.dispose();const r=this._core.container?.clientWidth||800,n=this._core.container?.clientHeight||600;if(e==="3d"){this._mode=new Fi({center:t.center,zoom:t.zoom,pitch:t.pitch||0,bearing:t.bearing||0,viewportWidth:r,viewportHeight:n});const[s,a,l,c]=this._core.globeEffects.backgroundColor;this._core.renderEngine?.setClearColor(s,a,l,c)}else this._mode=new Ti({center:t.center,zoom:t.zoom,rotation:t.rotation||0,viewportWidth:r,viewportHeight:n});if(this._core.gpuReady&&this._core.renderEngine){const s=this._core.renderLoop.running;s&&this._core.renderLoop.stop(),this._core.bufferCache.invalidateAll(),this._core.tileManager.invalidateAll(),this._core.terrainManager.invalidateAll(),await this._core.renderEngine.recover(Gi(e)),s&&this._core.renderLoop.start()}this._core.renderLoop.setCameraStateProvider(()=>this._mode.getCameraState()),this._core.container&&this._interactionOptions!==!1&&this._mode.attachInteraction(this._core.container,()=>this._core.renderLoop.markDirty(),()=>{this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._emitViewChange()},this._interactionOptions),this._events.emit("mode-change",{from:i,to:e}),this._core.renderLoop.markDirty(),this._emitViewChange()}goTo(e){if(this._destroyed)return Promise.reject(new Error("View is destroyed"));const t=this._mode.getState(),i=e.zoom!==void 0&&e.zoom!==t.zoom,r=e.center!==void 0;return i&&this._events.emit("zoomstart",{zoom:t.zoom}),(r||i)&&this._events.emit("movestart",{center:t.center}),this._mode.goTo(e,()=>this._core.renderLoop.markDirty(),()=>{this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._clampToMaxBounds(),this._emitViewChange()}).then(()=>{const n=this._mode.getState();i&&this._events.emit("zoomend",{zoom:n.zoom}),(r||i)&&this._events.emit("moveend",{center:n.center})})}fitBounds(e,t){const[i,r,n,s]=e,a=(i+n)/2,l=(r+s)/2,c=this._core.container?.clientWidth??256,d=this._core.container?.clientHeight??256,u=t?.padding??0,h=typeof u=="number"?u:u.top,f=typeof u=="number"?u:u.right,p=typeof u=="number"?u:u.bottom,g=typeof u=="number"?u:u.left,x=c-g-f,v=d-h-p,[y,m]=H(i,r),[_,w]=H(n,s),P=Math.abs(_-y),M=Math.abs(w-m);if(P===0&&M===0)return this.goTo({center:[a,l],duration:t?.duration});const b=$*2*Math.PI,C=P>0?Math.log2(b*x/(P*256)):22,S=M>0?Math.log2(b*v/(M*256)):22,T=Math.min(C,S,22);return this.goTo({center:[a,l],zoom:Math.max(0,T),duration:t?.duration})}panTo(e,t){return this.goTo({center:e,duration:t?.duration})}setView(e,t,i){return this.goTo({center:e,zoom:t,duration:i?.duration})}zoomIn(e){return this.goTo({zoom:Math.min(this.zoom+1,22),duration:e?.duration??300})}zoomOut(e){return this.goTo({zoom:Math.max(this.zoom-1,0),duration:e?.duration??300})}flyTo(e,t){if(!e.center)return this.goTo({...e,duration:t?.duration});const i=this.zoom,r=e.zoom??i,n=Math.min(i,r)-2,s=t?.duration??2e3;return this.goTo({center:e.center,zoom:Math.max(0,n),duration:s*.5}).then(()=>this.goTo({center:e.center,zoom:r,pitch:e.pitch,bearing:e.bearing,duration:s*.5}))}_maxBounds=null;setMaxBounds(e){this._maxBounds=e,e&&this._clampToMaxBounds()}getMaxBounds(){return this._maxBounds}_clampToMaxBounds(){if(!this._maxBounds)return;const[e,t,i,r]=this._maxBounds,[n,s]=this.center,a=Math.max(e,Math.min(i,n)),l=Math.max(t,Math.min(r,s));(a!==n||l!==s)&&this._mode.goTo({center:[a,l],duration:0},()=>this._core.renderLoop.markDirty(),()=>this._emitViewChange())}toMap(e,t){return this._mode.toMap(e,t)}toScreen(e,t){return this._mode.toScreen(e,t)}on(e,t){this._events.on(e,t)}off(e,t){this._events.off(e,t)}when(){return this._readyPromise}destroy(){this._destroyed||(this._destroyed=!0,this._mode.cancelAnimation(),this._mode.dispose(),this._toolManager?.destroy(),this._toolManager=null,this._clickHandler?.(),this._clickHandler=null,this._pointerMoveHandler?.(),this._pointerMoveHandler=null,this._core.destroy(),this._events.emit("destroy",void 0),this._events.removeAll(),this._readyResolve?.())}async loadIcon(e,t){let i;if(typeof t=="string"){const n=await(await fetch(t)).blob();i=await createImageBitmap(n)}else i=t;this._core.renderEngine&&this._core.renderEngine.loadIcon(e,i)}async loadModel(e,t){if(!this._core.renderEngine)return;if(t instanceof ArrayBuffer){await this._core.renderEngine.loadModel(e,t);return}const i=t;if(i.endsWith(".gltf")||i.includes(".gltf?")){const r=i.substring(0,i.lastIndexOf("/")+1),s=await(await fetch(i)).json(),a=s.buffers??[],l=await Promise.all(a.map(async c=>{if(!c.uri)return new ArrayBuffer(c.byteLength);const d=c.uri.startsWith("data:")?c.uri:r+c.uri;return(await fetch(d)).arrayBuffer()}));await this._core.renderEngine.loadModel(e,{json:s,buffers:l})}else{const n=await(await fetch(i)).arrayBuffer();await this._core.renderEngine.loadModel(e,n)}}async loadModelV2(e,t){this._core.renderEngine&&(typeof t=="string"?await this._core.renderEngine.loadModelV2(e,t):await this._core.renderEngine.loadModelV2(e,t))}getModelMetadata(e){return this._core.renderEngine?.getModelMetadata(e)??null}resolveModelBounds(e){return this._core.renderEngine?.resolveModelBounds(e)??null}getBounds(){const e=this._core.container?.clientWidth??0,t=this._core.container?.clientHeight??0;if(e===0||t===0)return null;const i=[this._mode.toMap(0,0),this._mode.toMap(e,0),this._mode.toMap(e,t),this._mode.toMap(0,t)].filter(l=>l!==null);if(i.length===0)return null;let r=1/0,n=1/0,s=-1/0,a=-1/0;for(const[l,c]of i)l<r&&(r=l),l>s&&(s=l),c<n&&(n=c),c>a&&(a=c);return{minX:r,minY:n,maxX:s,maxY:a,spatialReference:"EPSG:4326"}}async hitTest(e,t){if(!this._core.renderEngine)return[];const i=this._mode.toMap(e,t),r=await this._core.renderEngine.pick(e,t);if(r){const u=this._core.layerManager.getLayer(r.layerId);if(u&&u.interactive!==!1){let h;return De(u)&&(h=u.getFeatures().find(p=>p.id===r.featureId)),h||(h={id:r.featureId,geometry:{type:"Point",coordinates:[]},attributes:{}}),[{layer:u,feature:h,mapPoint:i}]}}if(!i)return[];const n=this._mode.getState().zoom,l=16*(360/(256*Math.pow(2,n))),c=[],d=this._core.layerManager.getLayerIds();for(const u of d){const h=this._core.layerManager.getLayer(u);if(!h||!h.visible||!h.loaded||h.interactive===!1||!De(h))continue;const f=h.getFeatures();let p=l,g;for(const x of f){const v=x.geometry;if(v){if(v.type==="Point"){const y=v.coordinates,m=y[0]-i[0],_=y[1]-i[1],w=Math.sqrt(m*m+_*_);w<p&&(p=w,g=x)}else if(v.type==="LineString"){const y=v.coordinates;for(let m=0;m<y.length-1;m++){const _=xn(i[0],i[1],y[m][0],y[m][1],y[m+1][0],y[m+1][1]);_<p&&(p=_,g=x)}}}}g&&c.push({layer:h,feature:g,mapPoint:i})}return c}async loadSvgIcon(e,t,i,r){let n;try{const s=new Blob([t],{type:"image/svg+xml"}),a=URL.createObjectURL(s);try{const l=await new Promise((u,h)=>{const f=new Image(i,r);f.onload=()=>u(f),f.onerror=p=>h(new Error(`SVG image load failed for "${e}": ${p}`)),f.src=a}),c=new OffscreenCanvas(i,r);c.getContext("2d").drawImage(l,0,0,i,r),n=await createImageBitmap(c)}finally{URL.revokeObjectURL(a)}}catch(s){throw console.error(`[mapgpu] loadSvgIcon("${e}") failed to decode SVG:`,s),s}await this.loadIcon(e,n)}set debugTileVertices(e){this._core.renderEngine?.setDebugTileVertices(e),this._core.renderLoop.markDirty()}get debugTileVertices(){return!1}set extrusionDebug(e){this._core.renderEngine?.setExtrusionDebug(e),typeof globalThis<"u"&&(globalThis.__MAPGPU_EXTRUSION_DEBUG=e),this._core.renderLoop.markDirty()}get extrusionDebug(){return typeof globalThis<"u"&&!!globalThis.__MAPGPU_EXTRUSION_DEBUG}applyDebugBrush(e,t,i,r,n){this._core.renderEngine?.applyDebugBrush(e,t,i,r,n),this._core.renderLoop.markDirty()}clearDebugBrush(){this._core.renderEngine?.clearDebugBrush(),this._core.renderLoop.markDirty()}setHeightExaggeration(e){this._core.renderEngine?.setHeightExaggeration(e),this._core.renderLoop.markDirty()}setGlobeEffects(e){const t=this._core.globeEffects;if(this._core.globeEffects=Lt({fog:e.fog?{...t.fog,...e.fog}:t.fog,nightImagery:e.nightImagery?{...t.nightImagery,...e.nightImagery}:t.nightImagery,waterMask:e.waterMask?{...t.waterMask,...e.waterMask}:t.waterMask,atmosphere:e.atmosphere?{...t.atmosphere,...e.atmosphere}:t.atmosphere,sky:e.sky?{...t.sky,...e.sky}:t.sky,lighting:e.lighting?{...t.lighting,...e.lighting}:t.lighting,poleCaps:e.poleCaps?{...t.poleCaps,...e.poleCaps}:t.poleCaps,backgroundColor:e.backgroundColor??t.backgroundColor}),e.backgroundColor){const[i,r,n,s]=this._core.globeEffects.backgroundColor;this._core.renderEngine?.setClearColor(i,r,n,s)}this._core.renderLoop.markDirty()}setLighting(e){this._core.renderEngine?.setLighting(e),this._core.renderLoop.markDirty()}_emitViewChange(){const e=this._mode.getState();this._events.emit("view-change",{center:e.center,zoom:e.zoom,pitch:e.pitch,bearing:e.bearing,rotation:e.rotation,mode:this._mode.type})}_applyCameraLock(e=0){if(!this._cameraLock)return;const t=this._cameraLock.getTarget();if(!t)return;const i=this._mode.getState(),r=this._cameraLock.fields,n={center:ne("center",r,t)&&t.center?this._resolveCameraLockCenter(i,r,t):i.center,zoom:ne("zoom",r,t)&&t.zoom!==void 0?t.zoom:i.zoom,pitch:ne("pitch",r,t)&&t.pitch!==void 0?t.pitch:i.pitch,bearing:ne("bearing",r,t)&&t.bearing!==void 0?t.bearing:i.bearing,rotation:ne("rotation",r,t)&&t.rotation!==void 0?t.rotation:i.rotation},{nextState:s,needsMoreSmoothing:a}=_n(i,n,this._cameraLock.smoothing,e);if(vn(i,s)){a&&this._core.renderLoop.markDirty();return}this._mode.cancelAnimation(),this._mode.setState(s),this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._clampToMaxBounds(),this._emitViewChange(),a&&this._core.renderLoop.markDirty()}_resolveCameraLockCenter(e,t,i){if(!i.center)return e.center;if(this._mode.type!=="3d"||i.altitude===void 0)return i.center;const r=ne("zoom",t,i)&&i.zoom!==void 0?i.zoom:e.zoom,n=ne("pitch",t,i)&&i.pitch!==void 0?i.pitch:e.pitch,s=ne("bearing",t,i)&&i.bearing!==void 0?i.bearing:e.bearing,a=this._core.container?.clientWidth??800,l=this._core.container?.clientHeight??600;return nn({center:e.center,zoom:r,pitch:n,bearing:s,viewportWidth:a,viewportHeight:l,targetCenter:i.center,targetAltitude:i.altitude})}}function xn(o,e,t,i,r,n){const s=r-t,a=n-i,l=s*s+a*a;if(l===0)return Math.sqrt((o-t)**2+(e-i)**2);const c=Math.max(0,Math.min(1,((o-t)*s+(e-i)*a)/l)),d=t+c*s,u=i+c*a;return Math.sqrt((o-d)**2+(e-u)**2)}function vn(o,e){return yn(o.center[0],e.center[0])&&Le(o.center[1],e.center[1])&&Le(o.zoom,e.zoom)&&Le(o.pitch,e.pitch)&&Ei(o.bearing,e.bearing)&&Ei(o.rotation,e.rotation)}function Le(o,e,t=1e-6){return Math.abs(o-e)<=t}function yn(o,e,t=1e-6){return Math.abs(ot(o,e))<=t}function Ei(o,e,t=1e-6){return Math.abs(bn(o,e))<=t}function ne(o,e,t){return e&&e.length>0?e.includes(o):t[o]!==void 0}function _n(o,e,t,i){let r=!1;const n=Tt(o.center[0],e.center[0],t?.centerHalfLifeMs,i,Pn),s=St(o.center[1],e.center[1],t?.centerHalfLifeMs,i),a=St(o.zoom,e.zoom,t?.zoomHalfLifeMs,i),l=St(o.pitch,e.pitch,t?.pitchHalfLifeMs,i),c=Tt(o.bearing,e.bearing,t?.bearingHalfLifeMs,i,nt),d=Tt(o.rotation,e.rotation,t?.rotationHalfLifeMs,i,nt);return r=n.needsMore||s.needsMore||a.needsMore||l.needsMore||c.needsMore||d.needsMore,{nextState:{center:[n.value,s.value],zoom:a.value,pitch:l.value,bearing:c.value,rotation:d.value},needsMoreSmoothing:r}}function St(o,e,t,i){if(t===void 0)return{value:e,needsMore:!1};if(!Number.isFinite(t)||t<=0)return{value:e,needsMore:!1};if(Le(o,e))return{value:e,needsMore:!1};if(i<=0)return{value:o,needsMore:!0};const r=_r(i,t),n=o+(e-o)*r;return{value:n,needsMore:!Le(n,e)}}function Tt(o,e,t,i,r){if(t===void 0)return{value:r(e),needsMore:!1};if(!Number.isFinite(t)||t<=0)return{value:r(e),needsMore:!1};const n=ot(o,e);if(Math.abs(n)<=1e-6)return{value:r(e),needsMore:!1};if(i<=0)return{value:r(o),needsMore:!0};const s=_r(i,t),a=r(o+n*s);return{value:a,needsMore:Math.abs(ot(a,e))>1e-6}}function _r(o,e){return 1-Math.pow(.5,o/e)}function ot(o,e){const t=nt(o);let r=nt(e)-t;return r>180&&(r-=360),r<-180&&(r+=360),r}function bn(o,e){return ot(o,e)}function nt(o){const e=o%360;return e<0?e+360:e}function Pn(o){let e=((o+180)%360+360)%360-180;return e===-180&&o>0&&(e=180),e}async function wn(){const o={mode:"cpu-degraded",features:{timestampQuery:!1,float32Filterable:!1,indirectFirstInstance:!1,shaderF16:!1},limits:{maxTextureDimension2D:0,maxBufferSize:0,maxStorageBufferBindingSize:0},adapter:null,device:null};if(typeof navigator>"u"||!navigator.gpu)return o;const e=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!e)return o;const t={timestampQuery:e.features.has("timestamp-query"),float32Filterable:e.features.has("float32-filterable"),indirectFirstInstance:e.features.has("indirect-first-instance"),shaderF16:e.features.has("shader-f16")},i={maxTextureDimension2D:e.limits.maxTextureDimension2D,maxBufferSize:e.limits.maxBufferSize,maxStorageBufferBindingSize:e.limits.maxStorageBufferBindingSize},r=[];t.timestampQuery&&r.push("timestamp-query"),t.float32Filterable&&r.push("float32-filterable");const n=await e.requestDevice({requiredFeatures:r});return n.lost.then(a=>{console.error(`[mapgpu] GPU device lost: ${a.reason} — ${a.message}`)}),{mode:Cn(i),features:t,limits:i,adapter:e,device:n}}function Cn(o){return o.maxTextureDimension2D<4096||o.maxBufferSize<256*1024*1024?"gpu-lite":"full-gpu"}class Mn{device;tracked=new Map;persistentBytes=0;transientBytes=0;constructor(e){this.device=e}allocate(e,t,i="persistent"){const r=this.device.createBuffer({size:e,usage:t,mappedAtCreation:!1}),n={buffer:r,size:e,category:i};return this.tracked.set(r,n),i==="persistent"?this.persistentBytes+=e:this.transientBytes+=e,r}allocateWithData(e,t,i="persistent"){const r=this.device.createBuffer({size:e.byteLength,usage:t,mappedAtCreation:!0}),n=r.getMappedRange();new Uint8Array(n).set(new Uint8Array(e.buffer,e.byteOffset,e.byteLength)),r.unmap();const s={buffer:r,size:e.byteLength,category:i};return this.tracked.set(r,s),i==="persistent"?this.persistentBytes+=e.byteLength:this.transientBytes+=e.byteLength,r}release(e){const t=this.tracked.get(e);t&&(t.category==="persistent"?this.persistentBytes-=t.size:this.transientBytes-=t.size,this.tracked.delete(e),e.destroy())}releaseTransient(){for(const[e,t]of this.tracked)t.category==="transient"&&(this.transientBytes-=t.size,this.tracked.delete(e),e.destroy())}getMemoryAccounting(){return{persistentBufferBytes:this.persistentBytes,transientBufferBytes:this.transientBytes,textureBytes:0,totalTrackedBytes:this.persistentBytes+this.transientBytes}}destroy(){for(const[e]of this.tracked)e.destroy();this.tracked.clear(),this.persistentBytes=0,this.transientBytes=0}get trackedCount(){return this.tracked.size}}class Sn{device;tracked=new Map;totalTextureBytes=0;constructor(e){this.device=e}createFromImageBitmap(e){const t=this.device.createTexture({size:{width:e.width,height:e.height},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:e},{texture:t},{width:e.width,height:e.height});const i=e.width*e.height*4,r={texture:t,byteSize:i,lastAccessTime:performance.now()};return this.tracked.set(t,r),this.totalTextureBytes+=i,t}createFromVideoElement(e){const t=e.videoWidth,i=e.videoHeight,r=this.device.createTexture({size:{width:t,height:i},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:e},{texture:r},{width:t,height:i});const n=t*i*4;return this.tracked.set(r,{texture:r,byteSize:n,lastAccessTime:performance.now()}),this.totalTextureBytes+=n,r}updateFromVideoElement(e,t){this.device.queue.copyExternalImageToTexture({source:t},{texture:e},{width:t.videoWidth,height:t.videoHeight});const i=this.tracked.get(e);i&&(i.lastAccessTime=performance.now())}touch(e){const t=this.tracked.get(e);t&&(t.lastAccessTime=performance.now())}release(e){const t=this.tracked.get(e);t&&(this.totalTextureBytes-=t.byteSize,this.tracked.delete(e),e.destroy())}evict(e){if(this.totalTextureBytes<=e)return;const t=[...this.tracked.entries()].sort((i,r)=>i[1].lastAccessTime-r[1].lastAccessTime);for(const[i,r]of t){if(this.totalTextureBytes<=e)break;this.totalTextureBytes-=r.byteSize,this.tracked.delete(i),i.destroy()}}createFromFloat32(e,t,i){const r=this.device.createTexture({label:`r32float-${t}x${i}`,size:{width:t,height:i},format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});this.device.queue.writeTexture({texture:r},e.buffer,{bytesPerRow:t*4,rowsPerImage:i},{width:t,height:i});const n=t*i*4,s={texture:r,byteSize:n,lastAccessTime:performance.now()};return this.tracked.set(r,s),this.totalTextureBytes+=n,r}createFromUint8(e,t,i){const r=this.device.createTexture({label:`r8unorm-${t}x${i}`,size:{width:t,height:i},format:"r8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),n=Math.ceil(t/256)*256;if(n===t)this.device.queue.writeTexture({texture:r},e.buffer,{bytesPerRow:t,rowsPerImage:i},{width:t,height:i});else{const l=new Uint8Array(n*i);for(let c=0;c<i;c++)l.set(e.subarray(c*t,c*t+t),c*n);this.device.queue.writeTexture({texture:r},l.buffer,{bytesPerRow:n,rowsPerImage:i},{width:t,height:i})}const s=t*i,a={texture:r,byteSize:s,lastAccessTime:performance.now()};return this.tracked.set(r,a),this.totalTextureBytes+=s,r}createFromRGBA8(e,t,i){const r=this.device.createTexture({label:`rgba8unorm-${t}x${i}`,size:{width:t,height:i},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});this.device.queue.writeTexture({texture:r},e.buffer,{bytesPerRow:t*4,rowsPerImage:i},{width:t,height:i});const n=t*i*4,s={texture:r,byteSize:n,lastAccessTime:performance.now()};return this.tracked.set(r,s),this.totalTextureBytes+=n,r}get textureBytes(){return this.totalTextureBytes}get trackedCount(){return this.tracked.size}destroy(){for(const[e]of this.tracked)e.destroy();this.tracked.clear(),this.totalTextureBytes=0}}function Li(o){return`${o.pipelineId}:${o.resourceIds.join(",")}`}class Tn{cache=new Map;totalEstimatedBytes=0;resourceToKeys=new Map;getOrCreate(e,t){const i=Li(e),r=this.cache.get(i);if(r)return r.bindGroup;const n=t(),s=64+e.resourceIds.length*8,a=new Set(e.resourceIds),l={bindGroup:n,key:i,estimatedBytes:s,resourceRefs:a};this.cache.set(i,l),this.totalEstimatedBytes+=s;for(const c of e.resourceIds){let d=this.resourceToKeys.get(c);d||(d=new Set,this.resourceToKeys.set(c,d)),d.add(i)}return n}invalidate(e){const t=this.resourceToKeys.get(e);if(t){for(const i of t){const r=this.cache.get(i);if(r){this.totalEstimatedBytes-=r.estimatedBytes;for(const n of r.resourceRefs)if(n!==e){const s=this.resourceToKeys.get(n);s&&(s.delete(i),s.size===0&&this.resourceToKeys.delete(n))}this.cache.delete(i)}}this.resourceToKeys.delete(e)}}has(e){return this.cache.has(Li(e))}clear(){this.cache.clear(),this.resourceToKeys.clear(),this.totalEstimatedBytes=0}get size(){return this.cache.size}get estimatedBytes(){return this.totalEstimatedBytes}}class Bn{resolution;worldExtent;cpuHeightmap;gpuTexture;gpuSampler;bindGroup;dirty=!1;hasStrokes=!1;addTexel(e,t,i){if(e<0||t<0||e>=this.resolution||t>=this.resolution)return;const r=t*this.resolution+e;this.cpuHeightmap[r]=(this.cpuHeightmap[r]??0)+i}splatSubTexel(e,t,i){const r=e-.5,n=t-.5,s=Math.floor(r),a=Math.floor(n),l=r-s,c=n-a;this.addTexel(s,a,i*(1-l)*(1-c)),this.addTexel(s+1,a,i*l*(1-c)),this.addTexel(s,a+1,i*(1-l)*c),this.addTexel(s+1,a+1,i*l*c)}constructor(e,t,i){this.resolution=i?.resolution??512,this.worldExtent=i?.worldExtent??[0,0,1,1],this.cpuHeightmap=new Float32Array(this.resolution*this.resolution),this.gpuTexture=e.createTexture({label:"height-brush-texture",size:{width:this.resolution,height:this.resolution},format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.gpuSampler=e.createSampler({label:"height-brush-sampler",magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.bindGroup=e.createBindGroup({label:"height-brush-bind-group",layout:t,entries:[{binding:0,resource:this.gpuTexture.createView()},{binding:1,resource:this.gpuSampler}]})}apply(e,t,i,r,n=.8){const s=this.resolution,[a,l,c,d]=this.worldExtent,u=c-a,h=d-l,p=2-1.5*Math.max(0,Math.min(1,n)),g=(e-a)/u*s,x=(t-l)/h*s,v=i/u*s,y=i/h*s,m=Math.max(v,y);if(m<1){this.splatSubTexel(g,x,r),this.dirty=!0,this.hasStrokes=!0;return}const _=Math.max(0,Math.floor(x-m)),w=Math.min(s-1,Math.ceil(x+m)),P=Math.max(0,Math.floor(g-m)),M=Math.min(s-1,Math.ceil(g+m));for(let b=_;b<=w;b++)for(let C=P;C<=M;C++){const S=C+.5-g,T=b+.5-x,B=S*S+T*T,F=m*m;if(B<F){const E=1-Math.sqrt(B)/m,G=Math.pow(Math.max(0,E),p),D=b*s+C;this.cpuHeightmap[D]=(this.cpuHeightmap[D]??0)+r*G}}this.dirty=!0,this.hasStrokes=!0}flush(e){this.dirty&&(e.queue.writeTexture({texture:this.gpuTexture},this.cpuHeightmap.buffer,{bytesPerRow:this.resolution*4},{width:this.resolution,height:this.resolution}),this.dirty=!1)}getBindGroup(e){return this.hasStrokes?(this.flush(e),this.bindGroup):null}clear(){this.cpuHeightmap.fill(0),this.dirty=!0,this.hasStrokes=!1}destroy(){this.gpuTexture.destroy()}}function Fn(o){return o.createBindGroupLayout({label:"height-texture-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.VERTEX,sampler:{type:"non-filtering"}}]})}function br(o,e){const t=o.createTexture({label:"zero-height-texture",size:{width:1,height:1},format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});o.queue.writeTexture({texture:t},new Float32Array([0]).buffer,{bytesPerRow:4},{width:1,height:1});const i=o.createSampler({label:"zero-height-sampler",magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),r=o.createBindGroup({label:"zero-height-bind-group",layout:e,entries:[{binding:0,resource:t.createView()},{binding:1,resource:i}]});return{texture:t,bindGroup:r}}const Gn=`

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;
const EARTH_RADIUS_METERS: f32 = 6378137.0;

// ─── Bindings ───

struct GlobeCameraUniforms {
  // View-Projection matrix (column-major 4x4) — globe (unit sphere)
  viewProjection: mat4x4<f32>,
  // Flat Mercator VP matrix (column-major 4x4) — Mercator [0..1] ortho
  flatViewProjection: mat4x4<f32>,
  // Viewport dimensions
  viewport: vec2<f32>,
  // Projection transition: 0 = Mercator flat, 1 = globe sphere
  projectionTransition: f32,
  // Globe radius (unit sphere = 1.0)
  globeRadius: f32,
  // Clipping plane for horizon occlusion: Ax + By + Cz + D
  clippingPlane: vec4<f32>,
};

struct TileUniforms {
  // Tile Mercator extent: minX, minY, maxX, maxY (0..1 range)
  mercatorExtent: vec4<f32>,
  // Tile opacity
  opacity: f32,
  // Height exaggeration factor
  heightExaggeration: f32,
  // Height mode: 0 = world-space debug brush, 1 = tile-local terrain
  heightMode: f32,
  // Depth bias: fallback parent tiles pushed back to prevent z-fighting
  depthBias: f32,
  // Tile UV remap into terrain texture UV: [offsetX, offsetY, scaleX, scaleY]
  terrainUv: vec4<f32>,
  // Terrain lighting controls: [ambient, diffuse, shadowStrength, shadowSoftness]
  lightParams: vec4<f32>,
  // Sun controls: [azimuthDeg, altitudeDeg, enabled(0|1), _pad]
  sunParams: vec4<f32>,
  // Post-process filters: [brightness, contrast, saturate, _pad]
  filters: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: GlobeCameraUniforms;
@group(1) @binding(0) var<uniform> tile: TileUniforms;
@group(1) @binding(1) var tileSampler: sampler;
@group(1) @binding(2) var tileTexture: texture_2d<f32>;
@group(2) @binding(0) var heightMap: texture_2d<f32>;
@group(2) @binding(1) var heightSampler: sampler;

// ─── Manual bilinear height sampling ───
// r32float doesn't support filtering sampler without float32-filterable feature.
// We use textureLoad + manual bilinear to get smooth interpolation.

fn sampleHeight(uv: vec2<f32>) -> f32 {
  let dims = vec2<f32>(textureDimensions(heightMap, 0));
  let tc = uv * max(dims - vec2(1.0), vec2(0.0));
  let tc0 = vec2<i32>(floor(tc));
  let f = fract(tc);
  let maxC = vec2<i32>(dims) - 1;
  let h00 = textureLoad(heightMap, clamp(tc0, vec2(0), maxC), 0).r;
  let h10 = textureLoad(heightMap, clamp(tc0 + vec2(1, 0), vec2(0), maxC), 0).r;
  let h01 = textureLoad(heightMap, clamp(tc0 + vec2(0, 1), vec2(0), maxC), 0).r;
  let h11 = textureLoad(heightMap, clamp(tc0 + vec2(1, 1), vec2(0), maxC), 0).r;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}

fn terrainUvForTileUv(tileUv: vec2<f32>) -> vec2<f32> {
  return tile.terrainUv.xy + tileUv * tile.terrainUv.zw;
}

fn heightUvForTileUv(tileUv: vec2<f32>, mercUv: vec2<f32>) -> vec2<f32> {
  if (tile.heightMode >= 0.5) {
    return terrainUvForTileUv(tileUv);
  }
  return mercUv;
}

fn heightToWorldUnit(heightValue: f32) -> f32 {
  var hUnit = heightValue;
  if (tile.heightMode >= 0.5) {
    hUnit = heightValue / EARTH_RADIUS_METERS;
  }
  return hUnit * tile.heightExaggeration;
}

fn sunDirection(azimuthDeg: f32, altitudeDeg: f32) -> vec3<f32> {
  let az = azimuthDeg * PI / 180.0;
  let alt = altitudeDeg * PI / 180.0;
  let cosAlt = cos(alt);
  return normalize(vec3<f32>(
    sin(az) * cosAlt,  // east
    cos(az) * cosAlt,  // north
    sin(alt),          // up
  ));
}

// ─── Vertex ───

struct VertexInput {
  @location(0) uv: vec2<f32>,  // Grid UV (0..1)
  @location(1) skirt: f32,      // 0 = surface vertex, 1 = skirt vertex
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
  @location(1) clipDot: f32,  // For fragment discard (horizon)
};

// Mercator (0..1) → Angular (radians)
fn mercatorToAngular(merc: vec2<f32>) -> vec2<f32> {
  let lon = merc.x * TWO_PI - PI;
  let lat = atan(exp(PI - merc.y * TWO_PI)) * 2.0 - PI * 0.5;
  return vec2<f32>(lon, lat);
}

// Angular (radians) → Unit Sphere (3D)
fn angularToSphere(lon: f32, lat: f32) -> vec3<f32> {
  let cosLat = cos(lat);
  return vec3<f32>(
    cosLat * sin(lon),
    sin(lat),
    cosLat * cos(lon),
  );
}

// MapLibre custom Z: geometry-aware depth from clipping plane
// Replaces perspective Z — handles horizon occlusion + depth in one step
fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  // Map grid UV to tile Mercator coordinates
  let mercX = mix(tile.mercatorExtent.x, tile.mercatorExtent.z, input.uv.x);
  let mercY = mix(tile.mercatorExtent.y, tile.mercatorExtent.w, input.uv.y);

  // ─── Globe path: Mercator → Angular → Sphere → globe clip space ───
  let angular = mercatorToAngular(vec2<f32>(mercX, mercY));
  let sphereBase = angularToSphere(angular.x, angular.y);

  // Height sampling: world-space brush (mode=0) or tile-local terrain (mode=1).
  var h = 0.0;
  if (tile.heightMode >= 0.5) {
    h = sampleHeight(terrainUvForTileUv(input.uv));
  } else {
    h = sampleHeight(vec2<f32>(mercX, mercY));
  }
  var displacement = heightToWorldUnit(h);

  // Skirts hide tile cracks when adjacent tiles have different sampled heights.
  if (tile.heightMode >= 0.5 && input.skirt >= 0.5) {
    let skirtDepth = max(0.0015, abs(displacement) * 0.35 + 0.0006);
    displacement -= skirtDepth;
  }
  let spherePos = sphereBase * (1.0 + displacement);

  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  // Replace globe Z with horizon-aware depth (use base for stable clipping)
  globeClip.z = globeClippingZ(sphereBase) * globeClip.w;

  // ─── Blend clip-space positions ───
  let clipDot = dot(sphereBase, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Shader-level depth offset: tiles render in front of pole caps.
  // depthBias > 0 for fallback parent tiles, 0 for exact tiles — prevents z-fighting.
  const LAYER_DEPTH_OFFSET: f32 = 0.0001;
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    var flatClip = camera.flatViewProjection * vec4<f32>(mercX, mercY, displacement, 1.0);
    clipPos = flatClip;
  } else {
    var flatClip = camera.flatViewProjection * vec4<f32>(mercX, mercY, displacement, 1.0);
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }
  clipPos.z -= LAYER_DEPTH_OFFSET * clipPos.w;
  clipPos.z += tile.depthBias * clipPos.w;
  clipPos.z = min(clipPos.z, clipPos.w * 0.9999);

  var out: VertexOutput;
  out.position = clipPos;
  out.texCoord = vec2<f32>(input.uv.x, input.uv.y);
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

fn applyFilters(c: vec3<f32>) -> vec3<f32> {
  var rgb = c * tile.filters.x;
  rgb = (rgb - 0.5) * tile.filters.y + 0.5;
  let gray = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  return mix(vec3<f32>(gray), rgb, tile.filters.z);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Discard back-hemisphere fragments for clean horizon edge
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  var color = textureSample(tileTexture, tileSampler, input.texCoord);
  if (tile.sunParams.z < 0.5) {
    var rgb = applyFilters(color.rgb);
    return vec4<f32>(rgb, color.a * tile.opacity);
  }

  let mercX = mix(tile.mercatorExtent.x, tile.mercatorExtent.z, input.texCoord.x);
  let mercY = mix(tile.mercatorExtent.y, tile.mercatorExtent.w, input.texCoord.y);
  let mercUv = vec2<f32>(mercX, mercY);
  let heightUv = heightUvForTileUv(input.texCoord, mercUv);

  let dims = vec2<f32>(textureDimensions(heightMap, 0));
  let texel = vec2<f32>(1.0) / max(dims, vec2<f32>(1.0));
  let stepX = vec2<f32>(texel.x, 0.0);
  let stepY = vec2<f32>(0.0, texel.y);

  let hW = heightToWorldUnit(sampleHeight(heightUv - stepX));
  let hE = heightToWorldUnit(sampleHeight(heightUv + stepX));
  let hN = heightToWorldUnit(sampleHeight(heightUv - stepY));
  let hS = heightToWorldUnit(sampleHeight(heightUv + stepY));

  let dhdx = (hE - hW) / max(1e-6, 2.0 * texel.x);
  let dhdy = (hN - hS) / max(1e-6, 2.0 * texel.y);

  let angular = mercatorToAngular(mercUv);
  let up = normalize(angularToSphere(angular.x, angular.y));
  let refDir = select(vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(1.0, 0.0, 0.0), abs(up.z) > 0.99);
  let east = normalize(cross(refDir, up));
  let north = normalize(cross(up, east));
  let normal = normalize(up - east * dhdx - north * dhdy);

  let lightDir = sunDirection(tile.sunParams.x, tile.sunParams.y);
  let ambient = clamp(tile.lightParams.x, 0.0, 1.0);
  let diffuse = clamp(tile.lightParams.y, 0.0, 2.0);
  let ndotl = max(dot(normal, lightDir), 0.0);
  var lightTerm = ambient + diffuse * ndotl;

  // Pseudo-shadow: compare height toward sun direction in local tangent frame.
  var lightUvDir = vec2<f32>(dot(lightDir, east), -dot(lightDir, north));
  let dirLen = max(length(lightUvDir), 1e-6);
  lightUvDir = lightUvDir / dirLen;

  let softness = clamp(tile.lightParams.w, 0.0, 1.0);
  let sampleDist = mix(1.5, 7.0, softness);
  let shadowStep = vec2<f32>(lightUvDir.x * texel.x, lightUvDir.y * texel.y) * sampleDist;

  let hCenter = heightToWorldUnit(sampleHeight(heightUv));
  let hTowardSun = heightToWorldUnit(sampleHeight(heightUv + shadowStep));
  let rise = max(0.0, hTowardSun - hCenter);

  let sunAltRad = tile.sunParams.y * PI / 180.0;
  let altitudeFactor = max(0.15, sin(sunAltRad));
  let riseScale = select(800.0, 22000.0, tile.heightMode >= 0.5);
  let occlusion = clamp(rise * riseScale / altitudeFactor, 0.0, 1.0);
  // Disable pseudo-shadow when view is strongly globe-like (zoomed out).
  // Shadows fade in only as we transition toward the flatter close-zoom view.
  let transitionToFlat = clamp(1.0 - camera.projectionTransition, 0.0, 1.0);
  let zoomShadowFade = smoothstep(0.08, 0.32, transitionToFlat);
  let shadowStrength = clamp(tile.lightParams.z, 0.0, 1.0) * zoomShadowFade;
  let pseudoShadow = 1.0 - occlusion * shadowStrength;
  lightTerm *= pseudoShadow;

  let litRgb = color.rgb * clamp(lightTerm, 0.0, 2.0);
  var finalRgb = applyFilters(litRgb);
  return vec4<f32>(finalRgb, color.a * tile.opacity);
}
`;function Pr(o){return o.createBindGroupLayout({label:"globe-camera-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function En(o){return o.createBindGroupLayout({label:"globe-tile-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Ln(o){return o.createBindGroupLayout({label:"globe-raster-height-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:"non-filtering"}}]})}function Dn(o){const{device:e,colorFormat:t}=o,i=o.subdivisions??32,r=Pr(e),n=En(e),s=Ln(e),a=e.createShaderModule({label:"globe-raster-shader",code:Gn}),l=e.createPipelineLayout({label:"globe-raster-pipeline-layout",bindGroupLayouts:[r,n,s]}),c=Rn(e,i),d=e.createRenderPipeline({label:"globe-raster-pipeline",layout:l,vertex:{module:a,entryPoint:"vs_main",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32"}]}]},fragment:{module:a,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),u=e.createSampler({label:"globe-tile-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),h=e.createSampler({label:"globe-height-sampler",magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),{texture:f,bindGroup:p}=br(e,s);return{pipeline:d,globeCameraBindGroupLayout:r,globeTileBindGroupLayout:n,heightBindGroupLayout:s,sampler:u,heightSampler:h,subdivisionMesh:c,zeroHeightTexture:f,zeroHeightBindGroup:p}}function Rn(o,e=32){const t=e+1,i=t*t,r=[],n=new Uint32Array(i);for(let m=0;m<t;m++)for(let _=0;_<t;_++){const w=r.length/3;n[m*t+_]=w,r.push(_/e,m/e,0)}const s=[];for(let m=0;m<e;m++)for(let _=0;_<e;_++){const w=n[m*t+_],P=n[m*t+_+1],M=n[(m+1)*t+_],b=n[(m+1)*t+_+1];s.push(w,M,P),s.push(P,M,b)}const a=(m,_)=>{const w=r.length/3;return r.push(m,_,1),w},l=new Uint32Array(t),c=new Uint32Array(t),d=new Uint32Array(t),u=new Uint32Array(t);for(let m=0;m<t;m++){const _=m/e;l[m]=a(_,0),c[m]=a(1,_),d[m]=a(_,1),u[m]=a(0,_)}const h=(m,_,w,P)=>{s.push(m,w,_),s.push(_,w,P)};for(let m=0;m<e;m++)h(n[m],n[m+1],l[m],l[m+1]);for(let m=0;m<e;m++)h(n[m*t+e],n[(m+1)*t+e],c[m],c[m+1]);for(let m=0;m<e;m++)h(n[e*t+m],n[e*t+m+1],d[m],d[m+1]);for(let m=0;m<e;m++)h(n[m*t],n[(m+1)*t],u[m],u[m+1]);const f=new Float32Array(r),p=f.length/3,x=p>65535?new Uint32Array(s):new Uint16Array(s),v=o.createBuffer({label:"globe-subdivision-vertex-buffer",size:f.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});o.queue.writeBuffer(v,0,f);const y=o.createBuffer({label:"globe-subdivision-index-buffer",size:x.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});return o.queue.writeBuffer(y,0,x),{vertexBuffer:v,indexBuffer:y,indexCount:x.length,vertexCount:p,subdivisions:e}}function st(o,e){const t=new Float32Array(16);for(let i=0;i<4;i++)for(let r=0;r<4;r++){let n=0;for(let s=0;s<4;s++)n+=o[s*4+r]*e[i*4+s];t[i*4+r]=n}return t}function zn(o){const e=new Float32Array(16),t=o[0],i=o[1],r=o[2],n=o[3],s=o[4],a=o[5],l=o[6],c=o[7],d=o[8],u=o[9],h=o[10],f=o[11],p=o[12],g=o[13],x=o[14],v=o[15],y=t*a-i*s,m=t*l-r*s,_=t*c-n*s,w=i*l-r*a,P=i*c-n*a,M=r*c-n*l,b=d*g-u*p,C=d*x-h*p,S=d*v-f*p,T=u*x-h*g,B=u*v-f*g,F=h*v-f*x,E=y*F-m*B+_*T+w*S-P*C+M*b;if(Math.abs(E)<1e-8)return null;const G=1/E;return e[0]=(a*F-l*B+c*T)*G,e[1]=(r*B-i*F-n*T)*G,e[2]=(g*M-x*P+v*w)*G,e[3]=(h*P-u*M-f*w)*G,e[4]=(l*S-s*F-c*C)*G,e[5]=(t*F-r*S+n*C)*G,e[6]=(x*_-p*M-v*m)*G,e[7]=(d*M-h*_+f*m)*G,e[8]=(s*B-a*S+c*b)*G,e[9]=(i*S-t*B-n*b)*G,e[10]=(p*P-g*_+v*y)*G,e[11]=(u*_-d*P-f*y)*G,e[12]=(a*C-s*T-l*b)*G,e[13]=(t*T-i*C+r*b)*G,e[14]=(g*m-p*w-x*y)*G,e[15]=(d*w-u*m+h*y)*G,e}function An(o,e,t){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,o,e,t,1])}const L=4,In=160,wr=192;function Un(o){const e=st(o.projectionMatrix,o.viewMatrix),t=new Float32Array(wr/4);return t.set(e,0),o.flatViewProjectionMatrix&&t.set(o.flatViewProjectionMatrix,16),t[32]=o.viewportWidth,t[33]=o.viewportHeight,t[34]=o.projectionTransition??1,t[35]=o.globeRadius??1,o.clippingPlane&&(t[36]=o.clippingPlane[0],t[37]=o.clippingPlane[1],t[38]=o.clippingPlane[2],t[39]=o.clippingPlane[3]),t[40]=o.position[0]??0,t[41]=o.position[1]??0,t[42]=o.position[2]??0,o.cameraMerc01&&(t[44]=o.cameraMerc01[0],t[45]=o.cameraMerc01[1],t[46]=o.cameraMerc01[2]),t}class kn{device=null;context=null;colorFormat="bgra8unorm";canvas=null;bufferPool=null;bindGroupCache=null;depthConfig=Vt;depthTexture=null;cameraBuffer=null;cameraBindGroup=null;cameraBindGroupLayout=null;globeCameraBuffer=null;globeCameraBindGroup=null;globeCameraBindGroupLayout=null;commandEncoder=null;backgroundPass=null;renderPass=null;currentCamera=null;frameTime=0;swapChainView=null;msaaColorView=null;depthView=null;pickingEnabled=!0;pickingDrawCalls=[];currentLayerId="";placeholderTexture=null;sampleCount=L;msaaColorTexture=null;lightConfig=null;debugTileVertices=!1;extrusionDebugMode=!1;heightBrush=null;heightExaggeration=1;needsContinuousRender=!1;deviceLost=!1;ensureGlobeCameraResources(){this.globeCameraBuffer||!this.device||!this.bufferPool||(this.globeCameraBindGroupLayout=Pr(this.device),this.globeCameraBuffer=this.bufferPool.allocate(wr,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,"persistent"),this.globeCameraBindGroup=this.device.createBindGroup({label:"globe-camera-bind-group",layout:this.globeCameraBindGroupLayout,entries:[{binding:0,resource:{buffer:this.globeCameraBuffer}}]}))}writeGlobeCamera(e){if(!this.globeCameraBuffer||!this.device)return;const t=Un(e);this.device.queue.writeBuffer(this.globeCameraBuffer,0,t.buffer)}ensureGlobeCameraWritten(){this.currentCamera&&this.writeGlobeCamera(this.currentCamera)}}const Vn=`

// ─── Bindings ───

struct CameraUniforms {
  viewProjection: mat4x4<f32>,
};

struct TileUniforms {
  // Tile extent: minX, minY, maxX, maxY
  extent: vec4<f32>,
  // Opacity (0..1)
  opacity: f32,
  // Post-process filters (default 1.0 = no change)
  brightness: f32,
  contrast: f32,
  saturate: f32,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> tile: TileUniforms;
@group(1) @binding(1) var tileSampler: sampler;
@group(1) @binding(2) var tileTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Full-screen quad: 4 vertex, 2 triangle (triangle-strip)
// vertex_index 0..3 → quad corners
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
  // Quad corners: BL, BR, TL, TR
  var positions = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
  );

  let uv = positions[vid];

  // RTE (Relative-to-Eye): tile extent is camera-relative (CPU subtracted center
  // in f64).  Using w=0 treats the position as a direction vector so that
  // viewProjection applies rotation + scale but NOT the camera translation
  // (which is already baked into the relative coordinates).  Adding (0,0,0,1)
  // restores the homogeneous point.  This keeps full f32 precision at any zoom.
  let relX = mix(tile.extent.x, tile.extent.z, uv.x);
  let relY = mix(tile.extent.y, tile.extent.w, uv.y);
  let clipOffset = camera.viewProjection * vec4<f32>(relX, relY, 0.0, 0.0);

  var out: VertexOutput;
  out.position = clipOffset + vec4<f32>(0.0, 0.0, 0.0, 1.0);
  // Flip UV Y: texture (0,0) = top-left (north), but world minY = south
  out.uv = vec2<f32>(uv.x, 1.0 - uv.y);
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  var color = textureSample(tileTexture, tileSampler, input.uv);
  // Brightness
  var rgb = color.rgb * tile.brightness;
  // Contrast: (c - 0.5) * contrast + 0.5
  rgb = (rgb - 0.5) * tile.contrast + 0.5;
  // Saturation: mix grayscale ↔ color
  let gray = dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3<f32>(gray), rgb, tile.saturate);
  return vec4<f32>(rgb, color.a * tile.opacity);
}
`;function On(o){return o.createBindGroupLayout({label:"camera-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]})}function Nn(o){return o.createBindGroupLayout({label:"raster-tile-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Hn(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=o,r=Nn(e),n=e.createShaderModule({label:"raster-shader",code:Vn}),s=e.createPipelineLayout({label:"raster-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"raster-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main"},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-strip",stripIndexFormat:void 0},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:"always"},multisample:{count:o.sampleCount??L}}),l=e.createSampler({label:"raster-tile-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,rasterBindGroupLayout:r,sampler:l}}const q=`
struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  relativeViewProjection: mat4x4<f32>,
  worldOrigin: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;`,Ie=`
struct GlobeCameraUniforms {
  viewProjection: mat4x4<f32>,
  flatViewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  projectionTransition: f32,
  globeRadius: f32,
  clippingPlane: vec4<f32>,
  cameraWorld: vec4<f32>,
  cameraMerc01: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: GlobeCameraUniforms;`,Cr=`
const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;
const HALF_CIRCUMFERENCE: f32 = 20037508.34;`,Ue=`
const EARTH_RADIUS_M: f32 = 6378137.0;
const ALTITUDE_EXAG: f32 = 1.0;

fn altitudeOffset(altMeters: f32) -> f32 {
  return altMeters / EARTH_RADIUS_M * ALTITUDE_EXAG;
}`,Mr=`
fn epsg3857ToMerc01(pos: vec3<f32>) -> vec2<f32> {
  return vec2<f32>(
    (pos.x + HALF_CIRCUMFERENCE) / (2.0 * HALF_CIRCUMFERENCE),
    1.0 - (pos.y + HALF_CIRCUMFERENCE) / (2.0 * HALF_CIRCUMFERENCE)
  );
}

fn mercatorToAngular(merc: vec2<f32>) -> vec2<f32> {
  let lon = merc.x * TWO_PI - PI;
  let lat = atan(exp(PI - merc.y * TWO_PI)) * 2.0 - PI * 0.5;
  return vec2<f32>(lon, lat);
}

fn angularToSphere(lon: f32, lat: f32) -> vec3<f32> {
  let cosLat = cos(lat);
  return vec3<f32>(
    cosLat * sin(lon),
    sin(lat),
    cosLat * cos(lon),
  );
}

fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}`,de=Ie+`
`+Cr+`
`+Mr,Wn=`

// ─── Bindings ───
${q}

struct PointMaterial {
  color: vec4<f32>,
  outlineColor: vec4<f32>,
  size: f32,
  outlineWidth: f32,
  // 0 = circle, 1 = square
  shape: f32,
  // 0 = solid (normal), >0 = soft radial glow falloff
  glowFalloff: f32,
};

@group(1) @binding(0) var<uniform> material: PointMaterial;

// ─── Vertex ───

struct VertexInput {
  // Per-instance: point center position (x, y, z)
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Billboard quad: 6 vertices (2 triangles) per point instance
@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  // Quad corners: 2 triangles (0,1,2) and (2,1,3)
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let offset = quadOffsets[vid];
  let uv = offset + vec2<f32>(0.5, 0.5);

  // Project center to clip space
  let clipCenter = camera.viewProjection * vec4<f32>(input.position.xy, 0.0, 1.0);

  // Billboard: offset in screen space then back to clip
  let pixelSize = material.size + material.outlineWidth * 2.0;
  let screenOffset = offset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clipCenter.z,
    clipCenter.w,
  );
  out.uv = uv;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let centered = input.uv - vec2<f32>(0.5, 0.5);
  let totalRadius = 0.5;
  let dist = length(centered);

  // ── Soft glow mode: radial gradient falloff ──
  if (material.glowFalloff > 0.0) {
    if (dist > totalRadius) {
      discard;
    }
    // Quadratic falloff from center to edge → soft halo
    let t = dist / totalRadius;
    let alpha = (1.0 - t * t) * material.color.a;
    return vec4<f32>(material.color.rgb, alpha);
  }

  // ── Normal mode: solid circle/square with outline ──
  let outlineFraction = material.outlineWidth / (material.size + material.outlineWidth * 2.0);
  let innerRadius = totalRadius - outlineFraction;

  // Compute derivatives in uniform control flow (before any discard/branch)
  let aa = fwidth(dist);
  let squareDist = max(abs(centered.x), abs(centered.y));

  if (material.shape < 0.5) {
    // Circle SDF
    if (dist > totalRadius) {
      discard;
    }
    // Anti-alias edge with smooth transition
    let alpha = 1.0 - smoothstep(innerRadius - aa, innerRadius, dist);
    return mix(material.outlineColor, material.color, alpha);
  } else {
    // Square SDF
    if (squareDist > totalRadius) {
      discard;
    }
    if (squareDist > innerRadius) {
      return material.outlineColor;
    }
    return material.color;
  }
}
`;function Zn(o){return o.createBindGroupLayout({label:"point-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function jn(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=o,r=Zn(e),n=e.createShaderModule({label:"point-shader",code:Wn}),s=e.createPipelineLayout({label:"point-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"point-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"instance",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),materialBindGroupLayout:r}}const Xn=`

// ─── Bindings ───
${q}

struct LineMaterial {
  color: vec4<f32>,
  width: f32,
  // Dash pattern: 0=solid, 1=dash, 2=dot, 3=dash-dot
  dashStyle: f32,
  dashAnimationSpeed: f32,
  time: f32,
  // Custom dashArray — packed into 2 vec4s (up to 8 segments)
  dashSegments0: vec4<f32>,
  dashSegments1: vec4<f32>,
  // x=segment count (0=use dashStyle), y=total pattern length
  dashMeta: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: LineMaterial;

// ─── Vertex ───

// Each line segment uses 6 vertices (2 triangles forming a screen-space quad).
// Vertex buffer layout: [prevX, prevY, prevZ, currX, currY, currZ, nextX, nextY, nextZ, side, cumulDist]
// side: -1.0 or 1.0 (which side of the line)
// cumulDist: cumulative Mercator arc-length from polyline start
struct VertexInput {
  @location(0) prevPos: vec3<f32>,
  @location(1) currPos: vec3<f32>,
  @location(2) nextPos: vec3<f32>,
  @location(3) side: f32,
  @location(4) cumulDist: f32,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) lineDistance: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let clipCurr = camera.viewProjection * vec4<f32>(input.currPos.xy, 0.0, 1.0);
  let clipPrev = camera.viewProjection * vec4<f32>(input.prevPos.xy, 0.0, 1.0);
  let clipNext = camera.viewProjection * vec4<f32>(input.nextPos.xy, 0.0, 1.0);

  // Convert to screen space
  let screenCurr = clipCurr.xy / clipCurr.w * camera.viewport * 0.5;
  let screenPrev = clipPrev.xy / clipPrev.w * camera.viewport * 0.5;
  let screenNext = clipNext.xy / clipNext.w * camera.viewport * 0.5;

  // Direction vectors
  let dirPrev = normalize(screenCurr - screenPrev);
  let dirNext = normalize(screenNext - screenCurr);

  // Miter direction (average of two normals)
  let normalPrev = vec2<f32>(-dirPrev.y, dirPrev.x);
  let normalNext = vec2<f32>(-dirNext.y, dirNext.x);

  var miter: vec2<f32>;
  let hasPrev = length(input.currPos - input.prevPos) > 0.0001;
  let hasNext = length(input.nextPos - input.currPos) > 0.0001;

  if (hasPrev && hasNext) {
    miter = normalize(normalPrev + normalNext);
    // Miter length correction
    let miterLen = 1.0 / max(dot(miter, normalPrev), 0.1);
    miter = miter * min(miterLen, 3.0); // Cap miter to prevent spikes
  } else if (hasPrev) {
    miter = normalPrev;
  } else {
    miter = normalNext;
  }

  // Offset in screen space
  let halfWidth = material.width * 0.5;
  let offset = miter * halfWidth * input.side;

  // Back to clip space
  let screenPos = screenCurr + offset;
  let ndcPos = screenPos / (camera.viewport * 0.5);

  // Cumulative arc-length → screen-space via pixels-per-unit ratio
  let mercLen = length(input.currPos.xy - input.prevPos.xy);
  let screenLen = length(screenCurr - screenPrev);
  let ppu = select(1.0, screenLen / mercLen, mercLen > 0.0001);

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(ndcPos * clipCurr.w, clipCurr.z, clipCurr.w);
  out.lineDistance = input.cumulDist * ppu;
  return out;
}

// ─── Fragment ───

fn getDashSegment(i: i32) -> f32 {
  if (i < 4) { return material.dashSegments0[i]; }
  return material.dashSegments1[i - 4];
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let dist = input.lineDistance + material.dashAnimationSpeed * material.time;

  // Custom dashArray takes priority when dashMeta.x > 0
  let segCount = i32(material.dashMeta.x);
  if (segCount > 0) {
    let total = material.dashMeta.y;
    let d = ((dist % total) + total) % total; // wrap positive
    var cumul = 0.0;
    for (var i = 0; i < 8; i++) {
      if (i >= segCount) { break; }
      cumul += getDashSegment(i);
      if (d < cumul) {
        if (i % 2 == 1) { discard; } // odd index = gap
        break;
      }
    }
    return material.color;
  }

  // Built-in dash patterns (screen-space units)
  if (material.dashStyle > 0.5 && material.dashStyle < 1.5) {
    // Dash: 10px on, 6px off
    let pattern = dist % 16.0;
    if (pattern > 10.0) { discard; }
  } else if (material.dashStyle > 1.5 && material.dashStyle < 2.5) {
    // Dot: 3px on, 3px off
    let pattern = dist % 6.0;
    if (pattern > 3.0) { discard; }
  } else if (material.dashStyle > 2.5) {
    // Dash-dot: 10px on, 4px off, 3px on, 4px off
    let pattern = dist % 21.0;
    if ((pattern > 10.0 && pattern < 14.0) || pattern > 17.0) { discard; }
  }

  return material.color;
}
`;function $n(o){return o.createBindGroupLayout({label:"line-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Yn(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=o,r=$n(e),n=e.createShaderModule({label:"line-shader",code:Xn}),s=e.createPipelineLayout({label:"line-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"line-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:44,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x3"},{shaderLocation:3,offset:36,format:"float32"},{shaderLocation:4,offset:40,format:"float32"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),materialBindGroupLayout:r}}function at(o){switch(o){case"solid":return 0;case"dash":return 1;case"dot":return 2;case"dash-dot":return 3}}const Kn=`

// ─── Bindings ───
${q}

struct PolygonMaterial {
  color: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: PolygonMaterial;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  // Surface family contract: flat 2D polygons clamp to the map plane.
  out.clipPosition = camera.viewProjection * vec4<f32>(input.position.xy, 0.0, 1.0);
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return material.color;
}
`;function qn(o){return o.createBindGroupLayout({label:"polygon-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Qn(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=o,r=qn(e),n=e.createShaderModule({label:"polygon-shader",code:Kn}),s=e.createPipelineLayout({label:"polygon-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"polygon-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:o.depthCompare??"always"},multisample:{count:o.sampleCount??L}}),materialBindGroupLayout:r}}const Jn=`

// ─── Bindings ───
${q}

struct PickingUniforms {
  // Feature ID encoded as color: R = id & 0xFF, G = (id >> 8) & 0xFF, B = (id >> 16) & 0xFF
  // A = layer index
  featureColor: vec4<f32>,
};

@group(1) @binding(0) var<uniform> picking: PickingUniforms;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  // Picking must mirror flat surface rendering: clamp 2D surfaces to z=0.
  out.clipPosition = camera.viewProjection * vec4<f32>(input.position.xy, 0.0, 1.0);
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return picking.featureColor;
}
`;function es(o){return o.createBindGroupLayout({label:"picking-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function ts(o){const{device:e,cameraBindGroupLayout:t,width:i,height:r}=o,n=es(e),s=e.createShaderModule({label:"picking-shader",code:Jn}),a=e.createPipelineLayout({label:"picking-pipeline-layout",bindGroupLayouts:[t,n]}),l=e.createRenderPipeline({label:"picking-pipeline",layout:a,vertex:{module:s,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:s,entryPoint:"fs_main",targets:[{format:"rgba8unorm"}]},primitive:{topology:"triangle-list"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"}}),c=e.createTexture({label:"picking-texture",size:{width:i,height:r},format:"rgba8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),d=e.createTexture({label:"picking-depth-texture",size:{width:i,height:r},format:o.depthFormat??"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT}),u=e.createBuffer({label:"picking-readback-buffer",size:256,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});return{pipeline:l,pickingBindGroupLayout:n,pickingTexture:c,depthTexture:d,readbackBuffer:u,width:i,height:r}}function is(o,e,t,i){return o===0&&e===0&&t===0&&i===0?null:{featureId:o|e<<8|t<<16,layerIndex:i}}const rs=`

// ─── Bindings ───
${q}

struct TextMaterial {
  color: vec4<f32>,
  haloColor: vec4<f32>,
  fontSize: f32,
  haloWidth: f32,
  // 0=center, 1=left, 2=right, 3=top, 4=bottom
  anchor: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: TextMaterial;
@group(1) @binding(1) var atlasSampler: sampler;
@group(1) @binding(2) var atlasTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexInput {
  // Per-instance: glyph position (world x, y, z)
  @location(0) position: vec3<f32>,
  // Per-instance: glyph UV rect in atlas (u0, v0, u1, v1)
  @location(1) uvRect: vec4<f32>,
  // Per-instance: glyph offset from anchor + size (offsetX, offsetY, width, height)
  @location(2) glyphOffset: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Billboard quad: 6 vertices (2 triangles) per glyph instance
@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  // Quad corners: 2 triangles (0,1,2) and (2,1,3)
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
  );

  let corner = quadOffsets[vid];

  // Interpolate UV from atlas rect
  let uv = vec2<f32>(
    mix(input.uvRect.x, input.uvRect.z, corner.x),
    mix(input.uvRect.y, input.uvRect.w, corner.y),
  );

  // Project center to clip space
  let clipCenter = camera.viewProjection * vec4<f32>(input.position, 1.0);

  // Screen-space offset for this glyph quad
  let pixelOffset = vec2<f32>(
    input.glyphOffset.x + corner.x * input.glyphOffset.z,
    input.glyphOffset.y + corner.y * input.glyphOffset.w,
  );

  let ndcOffset = vec2<f32>(
    pixelOffset.x * 2.0 / camera.viewport.x,
    pixelOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y - ndcOffset.y * clipCenter.w,
    clipCenter.z,
    clipCenter.w,
  );
  out.uv = uv;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // SDF distance sample (r channel, 0.5 = edge)
  let dist = textureSample(atlasTexture, atlasSampler, input.uv).r;

  // SDF threshold: inside glyph
  let edgeThreshold = 0.5;
  let aa = fwidth(dist) * 0.75;

  // Halo rendering
  let haloThreshold = edgeThreshold - material.haloWidth * 0.05;
  let haloAlpha = smoothstep(haloThreshold - aa, haloThreshold + aa, dist);
  let fillAlpha = smoothstep(edgeThreshold - aa, edgeThreshold + aa, dist);

  // Composite: halo behind fill
  let haloResult = vec4<f32>(material.haloColor.rgb, material.haloColor.a * haloAlpha);
  let fillResult = vec4<f32>(material.color.rgb, material.color.a * fillAlpha);

  // Alpha blend: fill over halo
  let alpha = fillResult.a + haloResult.a * (1.0 - fillResult.a);
  if (alpha < 0.01) {
    discard;
  }

  let rgb = (fillResult.rgb * fillResult.a + haloResult.rgb * haloResult.a * (1.0 - fillResult.a)) / alpha;
  return vec4<f32>(rgb, alpha);
}
`;function os(o){return o.createBindGroupLayout({label:"text-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function ns(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=o,r=os(e),n=e.createShaderModule({label:"text-shader",code:rs}),s=e.createPipelineLayout({label:"text-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"text-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:44,stepMode:"instance",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x4"},{shaderLocation:2,offset:28,format:"float32x4"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:o.depthCompare==="greater"?"greater-equal":"less-equal"},multisample:{count:o.sampleCount??L}}),l=e.createSampler({label:"text-atlas-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,materialBindGroupLayout:r,sampler:l}}const ss=`

// ─── Bindings ───

struct PostProcessUniforms {
  // Reciprocal of screen size (1/width, 1/height)
  rcpScreenSize: vec2<f32>,
  // FXAA quality: subpixel aliasing removal (0.0 = off, 1.0 = full)
  fxaaQuality: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> params: PostProcessUniforms;
@group(0) @binding(1) var sceneSampler: sampler;
@group(0) @binding(2) var sceneTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Full-screen quad: 4 vertices, triangle-strip
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0),
  );

  let pos = positions[vid];
  let uv = pos * 0.5 + vec2<f32>(0.5, 0.5);

  var out: VertexOutput;
  out.position = vec4<f32>(pos, 0.0, 1.0);
  // Flip Y for texture sampling (UV origin = top-left)
  out.uv = vec2<f32>(uv.x, 1.0 - uv.y);
  return out;
}

// ─── FXAA Fragment ───

// Luma hesapla (Rec. 709)
fn luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.299, 0.587, 0.114));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let rcpFrame = params.rcpScreenSize;

  // Center pixel
  let colorM = textureSample(sceneTexture, sceneSampler, uv);
  let lumaM = luminance(colorM.rgb);

  // Neighbor luma samples (NSWE)
  let lumaN = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(0.0, -rcpFrame.y)).rgb);
  let lumaS = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(0.0,  rcpFrame.y)).rgb);
  let lumaW = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(-rcpFrame.x, 0.0)).rgb);
  let lumaE = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>( rcpFrame.x, 0.0)).rgb);

  // Edge detection: max contrast
  let lumaMin = min(lumaM, min(min(lumaN, lumaS), min(lumaW, lumaE)));
  let lumaMax = max(lumaM, max(max(lumaN, lumaS), max(lumaW, lumaE)));
  let lumaRange = lumaMax - lumaMin;

  // Skip low contrast areas
  let edgeThreshold = 0.0625;
  let edgeThresholdMin = 0.0312;
  if (lumaRange < max(edgeThresholdMin, lumaMax * edgeThreshold)) {
    return colorM;
  }

  // Corner samples for better edge direction estimation
  let lumaNW = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(-rcpFrame.x, -rcpFrame.y)).rgb);
  let lumaNE = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>( rcpFrame.x, -rcpFrame.y)).rgb);
  let lumaSW = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(-rcpFrame.x,  rcpFrame.y)).rgb);
  let lumaSE = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>( rcpFrame.x,  rcpFrame.y)).rgb);

  // Subpixel aliasing test
  let lumaAvg = (lumaN + lumaS + lumaW + lumaE) * 0.25;
  let subpixelBlend = clamp(abs(lumaAvg - lumaM) / lumaRange, 0.0, 1.0);
  let subpixelAmount = smoothstep(0.0, 1.0, subpixelBlend) * smoothstep(0.0, 1.0, subpixelBlend) * params.fxaaQuality;

  // Determine edge direction (horizontal vs vertical)
  let edgeH = abs(lumaN + lumaS - 2.0 * lumaM) * 2.0 +
              abs(lumaNE + lumaSE - 2.0 * lumaE) +
              abs(lumaNW + lumaSW - 2.0 * lumaW);
  let edgeV = abs(lumaE + lumaW - 2.0 * lumaM) * 2.0 +
              abs(lumaNE + lumaNW - 2.0 * lumaN) +
              abs(lumaSE + lumaSW - 2.0 * lumaS);
  let isHorizontal = edgeH >= edgeV;

  // Blend direction
  var blendDir: vec2<f32>;
  if (isHorizontal) {
    let gradN = abs(lumaN - lumaM);
    let gradS = abs(lumaS - lumaM);
    if (gradN >= gradS) {
      blendDir = vec2<f32>(0.0, -rcpFrame.y);
    } else {
      blendDir = vec2<f32>(0.0, rcpFrame.y);
    }
  } else {
    let gradW = abs(lumaW - lumaM);
    let gradE = abs(lumaE - lumaM);
    if (gradW >= gradE) {
      blendDir = vec2<f32>(-rcpFrame.x, 0.0);
    } else {
      blendDir = vec2<f32>(rcpFrame.x, 0.0);
    }
  }

  // Simple 2-tap blend along edge
  let blendedColor = textureSample(sceneTexture, sceneSampler, uv + blendDir * 0.5);

  // Mix with subpixel amount
  return mix(colorM, blendedColor, subpixelAmount);
}
`;function as(o){return o.createBindGroupLayout({label:"post-process-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function ls(o){const{device:e,colorFormat:t}=o,i=as(e),r=e.createShaderModule({label:"post-process-shader",code:ss}),n=e.createPipelineLayout({label:"post-process-pipeline-layout",bindGroupLayouts:[i]}),s=e.createRenderPipeline({label:"post-process-pipeline",layout:n,vertex:{module:r,entryPoint:"vs_main"},fragment:{module:r,entryPoint:"fs_main",targets:[{format:t}]},primitive:{topology:"triangle-strip",stripIndexFormat:void 0},multisample:{count:o.sampleCount??L}}),a=e.createSampler({label:"post-process-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:s,bindGroupLayout:i,sampler:a}}const Di=512,Ri=4096,Y=1,ce=4;class cs{sprites=new Map;shelves=[];_width;_height;data;dirty=!1;device=null;texture=null;constructor(e){this._width=Di,this._height=Di,this.data=new Uint8Array(this._width*this._height*ce),this.device=e??null}get width(){return this._width}get height(){return this._height}get spriteCount(){return this.sprites.size}get isDirty(){return this.dirty}addSprite(e,t,i,r){const n=this.sprites.get(e);if(n)return n;const s=i+Y*2,a=r+Y*2;let l=!1,c=0,d=0;for(const x of this.shelves)if(x.height>=a&&x.nextX+s<=this._width){c=x.nextX,d=x.y,x.nextX+=s,l=!0;break}if(!l){if((this.shelves.length>0?this.shelves[this.shelves.length-1].y+this.shelves[this.shelves.length-1].height:0)+a>this._height&&!this.grow())return null;const v=this.shelves.length>0?this.shelves[this.shelves.length-1].y+this.shelves[this.shelves.length-1].height:0;if(v+a>this._height)return null;const y={y:v,height:a,nextX:s};this.shelves.push(y),c=0,d=v}for(let x=0;x<r;x++)for(let v=0;v<i;v++){const y=(x*i+v)*ce,m=((d+Y+x)*this._width+(c+Y+v))*ce;this.data[m]=t[y],this.data[m+1]=t[y+1],this.data[m+2]=t[y+2],this.data[m+3]=t[y+3]}const u=(c+Y)/this._width,h=(d+Y)/this._height,f=(c+Y+i)/this._width,p=(d+Y+r)/this._height,g={uv:[u,h,f,p],width:i,height:r,x:c+Y,y:d+Y};return this.sprites.set(e,g),this.dirty=!0,g}getSprite(e){return this.sprites.get(e)}getTexture(){return this.device?((!this.texture||this.dirty)&&this.uploadToGPU(),this.texture):null}getData(){return this.data}grow(){const e=Math.min(this._width*2,Ri),t=Math.min(this._height*2,Ri);if(e===this._width&&t===this._height)return!1;const i=new Uint8Array(e*t*ce);for(let r=0;r<this._height;r++)for(let n=0;n<this._width;n++){const s=(r*this._width+n)*ce,a=(r*e+n)*ce;i[a]=this.data[s],i[a+1]=this.data[s+1],i[a+2]=this.data[s+2],i[a+3]=this.data[s+3]}this._width=e,this._height=t,this.data=i;for(const[,r]of this.sprites)r.uv[0]=r.x/this._width,r.uv[1]=r.y/this._height,r.uv[2]=(r.x+r.width)/this._width,r.uv[3]=(r.y+r.height)/this._height;return this.texture&&(this.texture.destroy(),this.texture=null),this.dirty=!0,!0}uploadToGPU(){this.device&&(this.texture&&(this.texture.width!==this._width||this.texture.height!==this._height)&&(this.texture.destroy(),this.texture=null),this.texture||(this.texture=this.device.createTexture({label:"sprite-atlas-texture",size:{width:this._width,height:this._height},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST})),this.device.queue.writeTexture({texture:this.texture},this.data.buffer,{bytesPerRow:this._width*ce},{width:this._width,height:this._height}),this.dirty=!1)}destroy(){this.texture?.destroy(),this.texture=null,this.sprites.clear(),this.shelves=[],this.dirty=!1}}const us=`

// ─── Constants ───
${de}
${Ue}

// ─── Bindings ───

struct PointMaterial {
  color: vec4<f32>,
  outlineColor: vec4<f32>,
  size: f32,
  outlineWidth: f32,
  // 0 = circle, 1 = square
  shape: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: PointMaterial;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) clipDot: f32,
};

@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let offset = quadOffsets[vid];
  let uv = offset + vec2<f32>(0.5, 0.5);

  // EPSG:3857 → Mercator [0..1] → Angular → Sphere
  let merc01 = epsg3857ToMerc01(input.position);
  let angular = mercatorToAngular(merc01);
  let baseSphere = angularToSphere(angular.x, angular.y);
  let altFrac = altitudeOffset(input.position.z);
  let spherePos = baseSphere * (1.0 + altFrac);

  // Globe clip space
  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  globeClip.z = globeClippingZ(baseSphere) * globeClip.w;

  var clipCenter: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipCenter = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipCenter = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  } else {
    let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
    clipCenter = mix(flatClip, globeClip, camera.projectionTransition);
  }
  let clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Billboard offset in screen space
  let pixelSize = material.size + material.outlineWidth * 2.0;
  let screenOffset = offset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  // Shader-level depth offset: points render in front of lines
  const LAYER_DEPTH_OFFSET: f32 = 0.0008;
  let adjustedZ = clipCenter.z - LAYER_DEPTH_OFFSET * clipCenter.w;
  let clampedZ = min(adjustedZ, clipCenter.w * 0.9999);
  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clampedZ,
    clipCenter.w,
  );
  out.uv = uv;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Horizon discard
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  let centered = input.uv - vec2<f32>(0.5, 0.5);
  let totalRadius = 0.5;
  let outlineFraction = material.outlineWidth / (material.size + material.outlineWidth * 2.0);
  let innerRadius = totalRadius - outlineFraction;

  let dist = length(centered);
  let aa = fwidth(dist);
  let squareDist = max(abs(centered.x), abs(centered.y));

  if (material.shape < 0.5) {
    // Circle SDF
    if (dist > totalRadius) {
      discard;
    }
    let alpha = 1.0 - smoothstep(innerRadius - aa, innerRadius, dist);
    return mix(material.outlineColor, material.color, alpha);
  } else {
    // Square SDF
    if (squareDist > totalRadius) {
      discard;
    }
    if (squareDist > innerRadius) {
      return material.outlineColor;
    }
    return material.color;
  }
}
`;function hs(o){return o.createBindGroupLayout({label:"globe-point-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function ds(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=o,r=hs(e),n=e.createShaderModule({label:"globe-point-shader",code:us}),s=e.createPipelineLayout({label:"globe-point-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"globe-point-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"instance",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),materialBindGroupLayout:r}}const fs=`

// ─── Constants ───
${de}
${Ue}

// ─── Bindings ───

struct LineMaterial {
  color: vec4<f32>,
  width: f32,
  dashStyle: f32,
  dashAnimationSpeed: f32,
  time: f32,
  dashSegments0: vec4<f32>,
  dashSegments1: vec4<f32>,
  dashMeta: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: LineMaterial;

fn projectToClip(pos: vec3<f32>) -> vec4<f32> {
  let merc01 = epsg3857ToMerc01(pos);
  let angular = mercatorToAngular(merc01);
  let baseSphere = angularToSphere(angular.x, angular.y);
  let altFrac = altitudeOffset(pos.z);
  let spherePos = baseSphere * (1.0 + altFrac);

  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  globeClip.z = globeClippingZ(baseSphere) * globeClip.w;

  if (camera.projectionTransition >= 0.999) {
    return globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    return camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  }
  let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  return mix(flatClip, globeClip, camera.projectionTransition);
}

// ─── Vertex ───

struct VertexInput {
  @location(0) prevPos: vec3<f32>,
  @location(1) currPos: vec3<f32>,
  @location(2) nextPos: vec3<f32>,
  @location(3) side: f32,
  @location(4) cumulDist: f32,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) lineDistance: f32,
  @location(1) clipDot: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let clipCurr = projectToClip(input.currPos);
  let clipPrev = projectToClip(input.prevPos);
  let clipNext = projectToClip(input.nextPos);

  // Convert to screen space
  let screenCurr = clipCurr.xy / clipCurr.w * camera.viewport * 0.5;
  let screenPrev = clipPrev.xy / clipPrev.w * camera.viewport * 0.5;
  let screenNext = clipNext.xy / clipNext.w * camera.viewport * 0.5;

  // Direction vectors
  let dirPrev = normalize(screenCurr - screenPrev);
  let dirNext = normalize(screenNext - screenCurr);

  // Miter direction
  let normalPrev = vec2<f32>(-dirPrev.y, dirPrev.x);
  let normalNext = vec2<f32>(-dirNext.y, dirNext.x);

  var miter: vec2<f32>;
  let hasPrev = length(input.currPos - input.prevPos) > 0.0001;
  let hasNext = length(input.nextPos - input.currPos) > 0.0001;

  if (hasPrev && hasNext) {
    miter = normalize(normalPrev + normalNext);
    let miterLen = 1.0 / max(dot(miter, normalPrev), 0.1);
    miter = miter * min(miterLen, 3.0);
  } else if (hasPrev) {
    miter = normalPrev;
  } else {
    miter = normalNext;
  }

  let halfWidth = material.width * 0.5;
  let offset = miter * halfWidth * input.side;
  let screenPos = screenCurr + offset;
  let ndcPos = screenPos / (camera.viewport * 0.5);

  // Cumulative arc-length → screen-space via pixels-per-unit ratio
  let mercLen = length(input.currPos.xy - input.prevPos.xy);
  let screenLen = length(screenCurr - screenPrev);
  let ppu = select(1.0, screenLen / mercLen, mercLen > 0.0001);

  // Horizon dot for current position
  let merc01 = epsg3857ToMerc01(input.currPos);
  let angular = mercatorToAngular(merc01);
  let spherePos = angularToSphere(angular.x, angular.y);
  let clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  var out: VertexOutput;
  // Shader-level depth offset: lines render in front of polygons
  const LAYER_DEPTH_OFFSET: f32 = 0.0005;
  let adjustedZ = clipCurr.z - LAYER_DEPTH_OFFSET * clipCurr.w;
  let clampedZ = min(adjustedZ, clipCurr.w * 0.9999);
  out.clipPosition = vec4<f32>(ndcPos * clipCurr.w, clampedZ, clipCurr.w);
  out.lineDistance = input.cumulDist * ppu;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

fn getDashSegment(i: i32) -> f32 {
  if (i < 4) { return material.dashSegments0[i]; }
  return material.dashSegments1[i - 4];
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Horizon discard
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  let dist = input.lineDistance + material.dashAnimationSpeed * material.time;

  // Custom dashArray takes priority
  let segCount = i32(material.dashMeta.x);
  if (segCount > 0) {
    let total = material.dashMeta.y;
    let d = ((dist % total) + total) % total;
    var cumul = 0.0;
    for (var i = 0; i < 8; i++) {
      if (i >= segCount) { break; }
      cumul += getDashSegment(i);
      if (d < cumul) {
        if (i % 2 == 1) { discard; }
        break;
      }
    }
    return material.color;
  }

  // Built-in dash patterns
  if (material.dashStyle > 0.5 && material.dashStyle < 1.5) {
    let pattern = dist % 16.0;
    if (pattern > 10.0) { discard; }
  } else if (material.dashStyle > 1.5 && material.dashStyle < 2.5) {
    let pattern = dist % 6.0;
    if (pattern > 3.0) { discard; }
  } else if (material.dashStyle > 2.5) {
    let pattern = dist % 21.0;
    if ((pattern > 10.0 && pattern < 14.0) || pattern > 17.0) { discard; }
  }

  return material.color;
}
`;function ps(o){return o.createBindGroupLayout({label:"globe-line-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function ms(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=o,r=ps(e),n=e.createShaderModule({label:"globe-line-shader",code:fs}),s=e.createPipelineLayout({label:"globe-line-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"globe-line-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:44,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x3"},{shaderLocation:3,offset:36,format:"float32"},{shaderLocation:4,offset:40,format:"float32"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),materialBindGroupLayout:r}}const gs=`

// ─── Constants ───
${de}
${Ue}

// ─── Bindings ───

struct PolygonMaterial {
  color: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: PolygonMaterial;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) clipDot: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let merc01 = epsg3857ToMerc01(input.position);
  let angular = mercatorToAngular(merc01);
  let baseSphere = angularToSphere(angular.x, angular.y);
  let altFrac = altitudeOffset(input.position.z);
  let spherePos = baseSphere * (1.0 + altFrac);

  // Globe clip space
  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  globeClip.z = globeClippingZ(baseSphere) * globeClip.w;

  let clipDot = dot(baseSphere, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Shader-level depth offset: polygons render in front of tiles
  const LAYER_DEPTH_OFFSET: f32 = 0.0003;
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipPos = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  } else {
    let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }
  clipPos.z -= LAYER_DEPTH_OFFSET * clipPos.w;
  clipPos.z = min(clipPos.z, clipPos.w * 0.9999);

  var out: VertexOutput;
  out.clipPosition = clipPos;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Horizon discard
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  return material.color;
}
`;function xs(o){return o.createBindGroupLayout({label:"globe-polygon-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function vs(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=o,r=xs(e),n=e.createShaderModule({label:"globe-polygon-shader",code:gs}),s=e.createPipelineLayout({label:"globe-polygon-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"globe-polygon-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:o.depthCompare??"always"},multisample:{count:o.sampleCount??L}}),materialBindGroupLayout:r}}function ys(o,e=32){const t=e+1,i=t*t,r=new Float32Array(i*2);for(let h=0;h<t;h++)for(let f=0;f<t;f++){const p=(h*t+f)*2;r[p]=f/e,r[p+1]=h/e}const s=e*e*6,l=i>65535?new Uint32Array(s):new Uint16Array(s);let c=0;for(let h=0;h<e;h++)for(let f=0;f<e;f++){const p=h*t+f,g=p+1,x=(h+1)*t+f,v=x+1;l[c++]=p,l[c++]=x,l[c++]=g,l[c++]=g,l[c++]=x,l[c++]=v}const d=o.createBuffer({label:"subdivision-vertex-buffer",size:r.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});o.queue.writeBuffer(d,0,r);const u=o.createBuffer({label:"subdivision-index-buffer",size:l.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});return o.queue.writeBuffer(u,0,l),{vertexBuffer:d,indexBuffer:u,indexCount:s,vertexCount:i,subdivisions:e}}const $e=[0,1,1,.35],Ye=[1,1,.3,.92],Ke=[1,.4,0,.85],_s=3,bs=2;function Ps(o){const e=o+1,t=e*e,r=2*o*e*2,s=t>65535?new Uint32Array(r):new Uint16Array(r);let a=0;for(let l=0;l<e;l++)for(let c=0;c<o;c++)s[a++]=l*e+c,s[a++]=l*e+c+1;for(let l=0;l<e;l++)for(let c=0;c<o;c++)s[a++]=c*e+l,s[a++]=(c+1)*e+l;return{data:s,count:r}}function ws(o,e=32){const t=ys(o,e),{data:i,count:r}=Ps(e),n=o.createBuffer({label:"tile-debug-wireframe-index",size:i.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});return o.queue.writeBuffer(n,0,i.buffer),{vertexBuffer:t.vertexBuffer,wireframeIndexBuffer:n,wireframeIndexCount:r,vertexCount:t.vertexCount,subdivisions:e}}function Cs(o){const e=new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),t=o.createBuffer({label:"tile-debug-quad",size:e.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return o.queue.writeBuffer(t,0,e),t}const Wt=`
struct TileDebugUniforms {
  extent: vec4<f32>,
  gridColor: vec4<f32>,
  dotColor: vec4<f32>,
  borderColor: vec4<f32>,
  params: vec4<f32>,
  heightMode: vec4<f32>,
  terrainUv: vec4<f32>,
};
@group(1) @binding(0) var<uniform> tile: TileDebugUniforms;
`,Zt=`
@group(2) @binding(0) var heightMap: texture_2d<f32>;
@group(2) @binding(1) var heightSampler: sampler;

// Manual bilinear height sampling (r32float needs unfilterable-float)
fn sampleHeight(uv: vec2<f32>) -> f32 {
  let dims = vec2<f32>(textureDimensions(heightMap, 0));
  let tc = uv * max(dims - vec2(1.0), vec2(0.0));
  let tc0 = vec2<i32>(floor(tc));
  let f = fract(tc);
  let maxC = vec2<i32>(dims) - 1;
  let h00 = textureLoad(heightMap, clamp(tc0, vec2(0), maxC), 0).r;
  let h10 = textureLoad(heightMap, clamp(tc0 + vec2(1, 0), vec2(0), maxC), 0).r;
  let h01 = textureLoad(heightMap, clamp(tc0 + vec2(0, 1), vec2(0), maxC), 0).r;
  let h11 = textureLoad(heightMap, clamp(tc0 + vec2(1, 1), vec2(0), maxC), 0).r;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}
`,jt=`
const EARTH_RADIUS_METERS: f32 = 6378137.0;

fn terrainUvForTileUv(tileUv: vec2<f32>) -> vec2<f32> {
  return tile.terrainUv.xy + tileUv * tile.terrainUv.zw;
}

fn heightAtUV(uv: vec2<f32>) -> f32 {
  if (tile.heightMode.x >= 0.5) {
    return sampleHeight(terrainUvForTileUv(uv)) / EARTH_RADIUS_METERS;
  }
  return sampleHeight(vec2<f32>(
    mix(tile.extent.x, tile.extent.z, uv.x),
    mix(tile.extent.y, tile.extent.w, uv.y)
  ));
}
`;function Xt(o){return o?`
const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;
struct GlobeCameraUniforms {
  viewProjection: mat4x4<f32>,
  flatViewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  projectionTransition: f32,
  globeRadius: f32,
  clippingPlane: vec4<f32>,
};
@group(0) @binding(0) var<uniform> camera: GlobeCameraUniforms;
fn mercatorToAngular(merc: vec2<f32>) -> vec2<f32> {
  let lon = merc.x * TWO_PI - PI;
  let lat = atan(exp(PI - merc.y * TWO_PI)) * 2.0 - PI * 0.5;
  return vec2<f32>(lon, lat);
}
fn angularToSphere(lon: f32, lat: f32) -> vec3<f32> {
  let cosLat = cos(lat);
  return vec3<f32>(cosLat * sin(lon), sin(lat), cosLat * cos(lon));
}
fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}
`:`
struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
};
@group(0) @binding(0) var<uniform> camera: CameraUniforms;
`}function $t(o){return o?`
struct ProjResult {
  clipPos: vec4<f32>,
  clipDot: f32,
};
fn projectUV(uv: vec2<f32>, height: f32) -> ProjResult {
  let mx = mix(tile.extent.x, tile.extent.z, uv.x);
  let my = mix(tile.extent.y, tile.extent.w, uv.y);
  let ang = mercatorToAngular(vec2<f32>(mx, my));
  let sp_base = angularToSphere(ang.x, ang.y);
  let exag = tile.params.z;
  let sp = sp_base * (1.0 + height * exag);
  var gc = camera.viewProjection * vec4<f32>(sp, 1.0);
  gc.z = globeClippingZ(sp_base) * gc.w;
  let cd = dot(sp_base, camera.clippingPlane.xyz) + camera.clippingPlane.w;
  var cp: vec4<f32>;
  if (camera.projectionTransition >= 0.999) { cp = gc; }
  else if (camera.projectionTransition <= 0.001) {
    var fc = camera.flatViewProjection * vec4<f32>(mx, my, height * exag, 1.0);
    cp = fc;
  } else {
    var fc = camera.flatViewProjection * vec4<f32>(mx, my, height * exag, 1.0);
    cp = mix(fc, gc, camera.projectionTransition);
  }
  cp.z -= 0.0005 * cp.w;
  cp.z = min(cp.z, cp.w * 0.9999);
  var r: ProjResult;
  r.clipPos = cp;
  r.clipDot = cd;
  return r;
}
`:`
struct ProjResult {
  clipPos: vec4<f32>,
  clipDot: f32,
};
fn projectUV(uv: vec2<f32>, height: f32) -> ProjResult {
  let wx = mix(tile.extent.x, tile.extent.z, uv.x);
  let wy = mix(tile.extent.y, tile.extent.w, uv.y);
  let exag = tile.params.z;
  var r: ProjResult;
  r.clipPos = camera.viewProjection * vec4<f32>(wx, wy, 0.0, 0.0) + vec4<f32>(0.0, 0.0, 0.0, 1.0);
  r.clipPos.y += height * exag * r.clipPos.w;
  r.clipDot = 1.0;
  return r;
}
`}function Yt(o){return o?`
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }
`:""}function Ms(o){return Xt(o)+Wt+Zt+$t(o)+jt+`
struct VOut { @builtin(position) position: vec4<f32>, @location(0) clipDot: f32 };

@vertex fn vs_main(@builtin(vertex_index) vid: u32, @location(0) uv: vec2<f32>) -> VOut {
  let h = heightAtUV(uv);
  let p = projectUV(uv, h);
  var o: VOut;
  o.position = p.clipPos;
  o.clipDot = p.clipDot;
  return o;
}
@fragment fn fs_main(input: VOut) -> @location(0) vec4<f32> {
  ${Yt(o)}
  return tile.gridColor;
}
`}function Ss(o){return Xt(o)+Wt+Zt+$t(o)+jt+`
struct VOut {
  @builtin(position) position: vec4<f32>,
  @location(0) clipDot: f32,
  @location(1) local: vec2<f32>,
};

@vertex fn vs_main(
  @location(0) corner: vec2<f32>,
  @location(1) instUV: vec2<f32>,
  @builtin(instance_index) iid: u32,
) -> VOut {
  let h = heightAtUV(instUV);
  let p = projectUV(instUV, h);
  var cp = p.clipPos;
  let sz = tile.params.x;
  cp.x += corner.x * sz * 2.0 / camera.viewport.x * cp.w;
  cp.y -= corner.y * sz * 2.0 / camera.viewport.y * cp.w;
  var o: VOut;
  o.position = cp;
  o.clipDot = p.clipDot;
  o.local = corner;
  return o;
}
@fragment fn fs_main(input: VOut) -> @location(0) vec4<f32> {
  ${Yt(o)}
  if (length(input.local) > 1.0) { discard; }
  return tile.dotColor;
}
`}function Ts(o){return Xt(o)+Wt+Zt+$t(o)+jt+`
struct VOut { @builtin(position) position: vec4<f32>, @location(0) clipDot: f32 };

@vertex fn vs_main(@builtin(vertex_index) vid: u32) -> VOut {
  // 4 edges: bottom, right, top, left
  var su = array<f32,4>(0.0, 1.0, 1.0, 0.0);
  var sv = array<f32,4>(0.0, 0.0, 1.0, 1.0);
  var eu = array<f32,4>(1.0, 1.0, 0.0, 0.0);
  var ev = array<f32,4>(0.0, 1.0, 1.0, 0.0);

  let edge = vid / 6u;
  let vi = vid % 6u;

  // t: 0=start, 1=end. side: -1 or +1
  var ts = array<f32,6>(0.0, 1.0, 0.0, 1.0, 1.0, 0.0);
  var si = array<f32,6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);
  let t = ts[vi];
  let side = si[vi];

  let startUV = vec2<f32>(su[edge], sv[edge]);
  let endUV   = vec2<f32>(eu[edge], ev[edge]);
  let uv = mix(startUV, endUV, t);

  let h     = heightAtUV(uv);
  let hS    = heightAtUV(startUV);
  let hE    = heightAtUV(endUV);
  let p     = projectUV(uv, h);
  let pStart = projectUV(startUV, hS);
  let pEnd   = projectUV(endUV, hE);

  // Screen-space edge direction → perpendicular
  let s0 = pStart.clipPos.xy / pStart.clipPos.w;
  let s1 = pEnd.clipPos.xy / pEnd.clipPos.w;
  let edgeDir = normalize(s1 - s0);
  let normal = vec2<f32>(-edgeDir.y, edgeDir.x);

  let hw = tile.params.y; // half-width in pixels
  let offset = normal * side * hw * 2.0 / camera.viewport;

  var cp = p.clipPos;
  cp.x += offset.x * cp.w;
  cp.y += offset.y * cp.w;

  var o: VOut;
  o.position = cp;
  o.clipDot = p.clipDot;
  return o;
}
@fragment fn fs_main(input: VOut) -> @location(0) vec4<f32> {
  ${Yt(o)}
  return tile.borderColor;
}
`}function Bs(o){return o.createBindGroupLayout({label:"tile-debug-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Fs(o){return o.createBindGroupLayout({label:"tile-debug-height-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.VERTEX,sampler:{type:"non-filtering"}}]})}const Gs={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}};function zi(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=o,r=o.globe??!1,n=Bs(e),s=Fs(e),a=e.createSampler({label:"tile-debug-height-sampler",magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),l=e.createPipelineLayout({label:`tile-debug-${r?"globe":"2d"}-layout`,bindGroupLayouts:[i,n,s]}),c={format:o.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:r?o.depthCompare??"less":"always"},d={format:t,blend:Gs},u={count:o.sampleCount??L},h=e.createShaderModule({label:"dbg-wireframe",code:Ms(r)}),f=e.createRenderPipeline({label:"dbg-wireframe",layout:l,vertex:{module:h,entryPoint:"vs_main",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:h,entryPoint:"fs_main",targets:[d]},primitive:{topology:"line-list"},depthStencil:c,multisample:u}),p=e.createShaderModule({label:"dbg-dot",code:Ss(r)}),g=e.createRenderPipeline({label:"dbg-dot",layout:l,vertex:{module:p,entryPoint:"vs_main",buffers:[{arrayStride:8,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]},{arrayStride:8,stepMode:"instance",attributes:[{shaderLocation:1,offset:0,format:"float32x2"}]}]},fragment:{module:p,entryPoint:"fs_main",targets:[d]},primitive:{topology:"triangle-list"},depthStencil:c,multisample:u}),x=e.createShaderModule({label:"dbg-border",code:Ts(r)}),v=e.createRenderPipeline({label:"dbg-border",layout:l,vertex:{module:x,entryPoint:"vs_main",buffers:[]},fragment:{module:x,entryPoint:"fs_main",targets:[d]},primitive:{topology:"triangle-list"},depthStencil:c,multisample:u}),y=ws(e,32),m=Cs(e),{texture:_,bindGroup:w}=br(e,s);return{wireframePipeline:f,dotPipeline:g,borderPipeline:v,bindGroupLayout:n,heightBindGroupLayout:s,heightSampler:a,mesh:y,quadBuffer:m,zeroHeightTexture:_,zeroHeightBindGroup:w}}const Sr=Math.atan(Math.sinh(Math.PI)),qe=Math.cos(Sr),Ai=Math.sin(Sr),Es=`

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;

// ─── Bindings ───
${Ie}

struct PoleCapUniforms {
  color: vec4<f32>,
};

@group(1) @binding(0) var<uniform> poleCap: PoleCapUniforms;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) clipDot: f32,
};

fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var globeClip = camera.viewProjection * vec4<f32>(input.position, 1.0);
  globeClip.z = globeClippingZ(input.position) * globeClip.w;

  let clipDot = dot(input.position, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  var out: VertexOutput;
  out.position = globeClip;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  if (input.clipDot < -0.01) {
    discard;
  }
  return poleCap.color;
}
`;function Ls(o,e=64){const t=2*(e+1),i=new Float32Array(t*3);i[0]=0,i[1]=1,i[2]=0;for(let u=0;u<e;u++){const h=u/e*2*Math.PI,f=(1+u)*3;i[f]=qe*Math.sin(h),i[f+1]=Ai,i[f+2]=qe*Math.cos(h)}const r=e+1,n=r*3;i[n]=0,i[n+1]=-1,i[n+2]=0;for(let u=0;u<e;u++){const h=u/e*2*Math.PI,f=(r+1+u)*3;i[f]=qe*Math.sin(h),i[f+1]=-Ai,i[f+2]=qe*Math.cos(h)}const s=2*e*3,a=new Uint16Array(s);let l=0;for(let u=0;u<e;u++)a[l++]=0,a[l++]=1+u,a[l++]=1+(u+1)%e;for(let u=0;u<e;u++)a[l++]=r,a[l++]=r+1+(u+1)%e,a[l++]=r+1+u;const c=o.createBuffer({label:"pole-cap-vertex-buffer",size:i.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});o.queue.writeBuffer(c,0,i);const d=o.createBuffer({label:"pole-cap-index-buffer",size:a.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});return o.queue.writeBuffer(d,0,a),{vertexBuffer:c,indexBuffer:d,indexCount:s,vertexCount:t}}function Ds(o){return o.createBindGroupLayout({label:"pole-cap-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Rs(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=o,r=o.segments??64,n=Ds(e),s=e.createShaderModule({label:"pole-cap-shader",code:Es}),a=e.createPipelineLayout({label:"pole-cap-pipeline-layout",bindGroupLayouts:[i,n]}),l=Ls(e,r);return{pipeline:e.createRenderPipeline({label:"pole-cap-pipeline",layout:a,vertex:{module:s,entryPoint:"vs_main",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:s,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),poleCapBindGroupLayout:n,mesh:l}}const zs=1.15,As=`

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;

// ─── Bindings ───
${Ie}

struct AtmosphereUniforms {
  colorInner: vec4<f32>,
  colorOuter: vec4<f32>,
  strength: f32,
  falloff: f32,
  _pad0: f32,
  _pad1: f32,
};

@group(1) @binding(0) var<uniform> atmosphere: AtmosphereUniforms;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.clipPosition = camera.viewProjection * vec4<f32>(input.position, 1.0);
  out.worldPos = input.position;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Normalize worldPos to project onto true sphere surface.
  // Linear interpolation between mesh vertices creates chords;
  // normalizing gives the exact spherical direction per-fragment.
  let sphereDir = normalize(input.worldPos);

  // Compute clipDot per-fragment (not interpolated) for smooth horizon
  let clipDot = dot(sphereDir, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Discard back hemisphere
  if (clipDot < -0.15) {
    discard;
  }

  // Fresnel-like edge glow: view direction vs sphere normal
  let cameraDir = normalize(camera.clippingPlane.xyz);
  let facing = abs(dot(sphereDir, cameraDir));
  let edgeFactor = 1.0 - facing;

  // Glow intensity with configurable falloff
  let intensity = pow(edgeFactor, atmosphere.falloff);

  // Boost and clamp
  let boosted = clamp(intensity * 2.0, 0.0, 1.0);

  // Color gradient: inner (near globe edge) → outer (limb)
  let color = mix(atmosphere.colorInner, atmosphere.colorOuter, edgeFactor);

  // Final alpha: glow × strength × projectionTransition
  let alpha = boosted * atmosphere.strength * camera.projectionTransition;

  // Smooth horizon fade (per-fragment, not interpolated → no polygon edges)
  let horizonFade = smoothstep(-0.15, 0.05, clipDot);
  let finalAlpha = alpha * horizonFade;

  if (finalAlpha < 0.002) {
    discard;
  }

  return vec4<f32>(color.rgb, finalAlpha);
}
`;function Is(o,e=4){const t=zs;let i=[0,t,0,0,-t,0,t,0,0,-t,0,0,0,0,t,0,0,-t],r=[0,4,2,0,2,5,0,5,3,0,3,4,1,2,4,1,5,2,1,3,5,1,4,3];const n=new Map;function s(u,h){const f=u<h?`${u}_${h}`:`${h}_${u}`,p=n.get(f);if(p!==void 0)return p;const g=i[u*3],x=i[u*3+1],v=i[u*3+2],y=i[h*3],m=i[h*3+1],_=i[h*3+2];let w=(g+y)*.5,P=(x+m)*.5,M=(v+_)*.5;const b=Math.sqrt(w*w+P*P+M*M);w=w/b*t,P=P/b*t,M=M/b*t;const C=i.length/3;return i.push(w,P,M),n.set(f,C),C}for(let u=0;u<e;u++){const h=[];n.clear();for(let f=0;f<r.length;f+=3){const p=r[f],g=r[f+1],x=r[f+2],v=s(p,g),y=s(g,x),m=s(x,p);h.push(p,v,m,g,y,v,x,m,y,v,y,m)}r=h}const a=new Float32Array(i),l=i.length/3>65535?new Uint32Array(r):new Uint16Array(r),c=o.createBuffer({label:"atmosphere-vertex-buffer",size:a.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});o.queue.writeBuffer(c,0,a);const d=o.createBuffer({label:"atmosphere-index-buffer",size:l.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});return o.queue.writeBuffer(d,0,l),{vertexBuffer:c,indexBuffer:d,indexCount:r.length,vertexCount:i.length/3}}function Us(o){return o.createBindGroupLayout({label:"atmosphere-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function ks(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=o,r=Us(e),n=e.createShaderModule({label:"atmosphere-shader",code:As}),s=e.createPipelineLayout({label:"atmosphere-pipeline-layout",bindGroupLayouts:[i,r]}),a=Is(e,o.subdivisions??4);return{pipeline:e.createRenderPipeline({label:"atmosphere-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"front"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:"always"},multisample:{count:o.sampleCount??L}}),atmosphereBindGroupLayout:r,mesh:a}}const Vs=52,Os=4,Ns=`
${Ie}

struct SkyBackgroundUniforms {
  inverseGlobeViewProjection: mat4x4<f32>,
  inverseFlatViewProjection: mat4x4<f32>,
  horizonColor: vec4<f32>,
  zenithColor: vec4<f32>,
  spaceColor: vec4<f32>,
  horizonBlend: f32,
  verticalFalloff: f32,
  starIntensity: f32,
  starDensity: f32,
  starSeed: f32,
  sunAltitude: f32,
  sunAzimuth: f32,
  syncWithLighting: f32,
};

struct SkyVolumetricUniforms {
  cloudCoverage: f32,
  cloudOpacity: f32,
  cloudLayerHeight: f32,
  _pad0: f32,
};

@group(1) @binding(0) var<uniform> skyBackground: SkyBackgroundUniforms;
@group(1) @binding(1) var<uniform> skyVolumetrics: SkyVolumetricUniforms;

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) ndc: vec2<f32>,
};

const PI: f32 = 3.14159265358979323846;
const ATMOSPHERE_RAYLEIGH_COEFFICIENT: vec3<f32> = vec3<f32>(5.5e-6, 13.0e-6, 28.4e-6);
const ATMOSPHERE_MIE_COEFFICIENT: vec3<f32> = vec3<f32>(21.0e-6, 21.0e-6, 21.0e-6);
const ATMOSPHERE_RAYLEIGH_SCALE_HEIGHT: f32 = 10000.0;
const ATMOSPHERE_MIE_SCALE_HEIGHT: f32 = 3200.0;
const ATMOSPHERE_MIE_ANISOTROPY: f32 = 0.9;
const THREE_OVER_SIXTEEN_PI: f32 = 0.05968310365946075;
const ONE_OVER_FOUR_PI: f32 = 0.07957747154594767;
const SUN_CUTOFF_ANGLE: f32 = 1.6110731556870734;
const SUN_STEEPNESS: f32 = 1.5;
const SUN_ILLUMINANCE: f32 = 1000.0;

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn degToRad(value: f32) -> f32 {
  return value * PI / 180.0;
}

fn safeNormalize(value: vec3<f32>, fallback: vec3<f32>) -> vec3<f32> {
  let lenSq = dot(value, value);
  if (lenSq <= 0.000001) {
    return fallback;
  }
  return value * inverseSqrt(lenSq);
}

fn hash13(inputValue: vec3<f32>) -> f32 {
  var p3 = fract(inputValue * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn directionToSkyUv(rayDir: vec3<f32>) -> vec2<f32> {
  let dir = safeNormalize(rayDir, vec3<f32>(0.0, 1.0, 0.0));
  let phi = atan2(dir.z, dir.x);
  let theta = acos(clamp(dir.y, -1.0, 1.0));
  return vec2<f32>(phi / (2.0 * PI) + 0.5, theta / PI);
}

fn unprojectWorldPosition(inverseViewProjection: mat4x4<f32>, ndc: vec2<f32>, clipDepth: f32) -> vec3<f32> {
  let clipPosition = vec4<f32>(ndc, clipDepth, 1.0);
  let worldPosition = inverseViewProjection * clipPosition;
  let safeW = select(-1.0, 1.0, worldPosition.w >= 0.0) * max(abs(worldPosition.w), 0.0001);
  return worldPosition.xyz / safeW;
}

fn computeRayDirection(inverseViewProjection: mat4x4<f32>, ndc: vec2<f32>) -> vec3<f32> {
  let nearWorld = unprojectWorldPosition(inverseViewProjection, ndc, 0.0);
  let farWorld = unprojectWorldPosition(inverseViewProjection, ndc, 1.0);
  return normalize(farWorld - nearWorld);
}

fn computeSkyRayDirection(ndc: vec2<f32>) -> vec3<f32> {
  let globeRay = computeRayDirection(skyBackground.inverseGlobeViewProjection, ndc);
  if (camera.projectionTransition >= 0.999) {
    return globeRay;
  }

  let flatRay = computeRayDirection(skyBackground.inverseFlatViewProjection, ndc);
  if (camera.projectionTransition <= 0.001) {
    return flatRay;
  }

  return normalize(mix(flatRay, globeRay, camera.projectionTransition));
}

fn computeSkyUp() -> vec3<f32> {
  let globeUp = normalize(camera.cameraWorld.xyz);
  if (camera.projectionTransition >= 0.999) {
    return globeUp;
  }

  let flatUp = vec3<f32>(0.0, 0.0, 1.0);
  if (camera.projectionTransition <= 0.001) {
    return flatUp;
  }

  return normalize(mix(flatUp, globeUp, camera.projectionTransition));
}

fn computeSkyEast(localUp: vec3<f32>) -> vec3<f32> {
  let primaryNorth = vec3<f32>(0.0, 1.0, 0.0);
  let fallbackNorth = vec3<f32>(0.0, 0.0, 1.0);
  let east = cross(primaryNorth, localUp);
  if (dot(east, east) > 0.000001) {
    return normalize(east);
  }
  return safeNormalize(cross(fallbackNorth, localUp), vec3<f32>(1.0, 0.0, 0.0));
}

fn computeSunDirection(localUp: vec3<f32>, sunAltitude: f32, sunAzimuth: f32) -> vec3<f32> {
  let east = computeSkyEast(localUp);
  let north = safeNormalize(cross(localUp, east), vec3<f32>(0.0, 1.0, 0.0));
  let altitude = degToRad(sunAltitude);
  let azimuth = degToRad(sunAzimuth);
  let horizontalMagnitude = cos(altitude);

  return normalize(
    east * (sin(azimuth) * horizontalMagnitude) +
    north * (cos(azimuth) * horizontalMagnitude) +
    localUp * sin(altitude)
  );
}

fn rayleighPhase(cosTheta: f32) -> f32 {
  return THREE_OVER_SIXTEEN_PI * (1.0 + cosTheta * cosTheta);
}

fn hgPhase(cosTheta: f32, g: f32) -> f32 {
  let g2 = g * g;
  let inverse = 1.0 / pow(max(0.0001, 1.0 - 2.0 * g * cosTheta + g2), 1.5);
  return ONE_OVER_FOUR_PI * ((1.0 - g2) * inverse);
}

fn sunIntensity(zenithAngleCos: f32) -> f32 {
  let clamped = clamp(zenithAngleCos, -1.0, 1.0);
  return SUN_ILLUMINANCE * max(
    0.0,
    1.0 - exp(-((SUN_CUTOFF_ANGLE - acos(clamped)) / SUN_STEEPNESS)),
  );
}

fn opticalAirMass(viewZenithCos: f32) -> f32 {
  let zenithAngle = acos(max(0.0, viewZenithCos));
  let horizonTerm = max(0.001, 93.885 - (zenithAngle * 180.0 / PI));
  return 1.0 / max(0.05, cos(zenithAngle) + 0.15 * pow(horizonTerm, -1.253));
}

fn computeAtmosphericScattering(rayDir: vec3<f32>, localUp: vec3<f32>, sunDir: vec3<f32>) -> vec3<f32> {
  let sunZenithCos = dot(sunDir, localUp);
  let sunE = sunIntensity(sunZenithCos);
  let sunFade = 1.0 - clamp(1.0 - exp(sunZenithCos / 0.18), 0.0, 1.0);
  let rayleighStrength = max(0.12, 1.0 - (1.0 - sunFade) * 0.85);

  let betaR = ATMOSPHERE_RAYLEIGH_COEFFICIENT * rayleighStrength;
  let betaM = ATMOSPHERE_MIE_COEFFICIENT;

  let airMass = opticalAirMass(dot(localUp, rayDir));
  let sR = ATMOSPHERE_RAYLEIGH_SCALE_HEIGHT * airMass;
  let sM = ATMOSPHERE_MIE_SCALE_HEIGHT * airMass;
  let extinction = exp(-(betaR * sR + betaM * sM));

  let cosTheta = dot(rayDir, sunDir);
  let betaRTheta = betaR * rayleighPhase(cosTheta);
  let betaMTheta = betaM * hgPhase(cosTheta, ATMOSPHERE_MIE_ANISOTROPY);
  let scattering = (betaRTheta + betaMTheta) / max(betaR + betaM, vec3<f32>(0.000001));

  var skyLight = pow(sunE * scattering * (1.0 - extinction), vec3<f32>(1.35));
  let duskMix = clamp(pow(1.0 - max(sunZenithCos, 0.0), 5.0), 0.0, 1.0);
  let duskScatter = pow(sunE * scattering * extinction, vec3<f32>(0.5));
  skyLight *= mix(vec3<f32>(1.0), duskScatter, duskMix);

  return clamp(skyLight * 0.04, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn starLayer(rayDir: vec3<f32>, scale: f32, threshold: f32, seedOffset: f32) -> f32 {
  let uv = directionToSkyUv(rayDir) * scale;
  let seededUv = uv + vec2<f32>(
    skyBackground.starSeed * (0.73 + seedOffset),
    skyBackground.starSeed * (1.11 + seedOffset * 0.37),
  );
  let cell = floor(seededUv);
  let local = fract(seededUv) - 0.5;
  let star = hash13(vec3<f32>(cell, seedOffset));
  let sparkle = hash13(vec3<f32>(cell + 11.7, seedOffset + 13.1));
  let thresholded = smoothstep(threshold, 1.0, star);
  let radius = mix(0.52, 0.16, sparkle);
  let dist = length(local);
  let halo = smoothstep(radius, 0.0, dist);
  return thresholded * pow(halo, mix(2.8, 1.1, sparkle)) * mix(0.8, 1.5, sparkle);
}

fn starField(rayDir: vec3<f32>) -> f32 {
  let primaryScale = mix(90.0, 240.0, skyBackground.starDensity);
  let secondaryScale = mix(180.0, 520.0, skyBackground.starDensity);
  let thresholdA = mix(0.975, 0.88, skyBackground.starDensity);
  let thresholdB = mix(0.99, 0.94, skyBackground.starDensity);
  let wideStars = starLayer(rayDir, primaryScale, thresholdA, 1.0);
  let denseStars = starLayer(rayDir, secondaryScale, thresholdB, 7.0);
  return wideStars * 1.35 + denseStars;
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var out: VertexOutput;
  let positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  let position = positions[vertexIndex];
  out.clipPosition = vec4<f32>(position, 0.0, 1.0);
  out.ndc = position;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let rayDir = computeSkyRayDirection(input.ndc);
  let localUp = computeSkyUp();
  let altitude = dot(rayDir, localUp);
  let horizonWidth = mix(0.015, 0.62, pow(skyBackground.horizonBlend, 0.8));
  let aboveHorizon = smoothstep(-horizonWidth, horizonWidth, altitude);
  let falloffNorm = saturate((skyBackground.verticalFalloff - 0.4) / 2.0);
  let altitude01 = saturate(max(altitude, 0.0));
  let blendLift = mix(0.0, 0.22, skyBackground.horizonBlend);
  let liftedAltitude = saturate((altitude01 + blendLift) / (1.0 + blendLift));
  let zenithFactor = pow(liftedAltitude, mix(0.18, 2.75, falloffNorm));
  let spaceFactor = pow(zenithFactor, mix(0.8, 2.2, falloffNorm));
  let horizonBand = 1.0 - smoothstep(0.0, horizonWidth, abs(altitude));
  let horizonEnvelope = pow(
    1.0 - saturate((max(altitude, 0.0) + 0.02) / (0.08 + skyBackground.horizonBlend * 0.92)),
    mix(4.2, 0.95, skyBackground.horizonBlend),
  );
  let hazeEnvelope = pow(1.0 - altitude01, mix(0.45, 3.2, falloffNorm));

  let lightingEnabled = skyBackground.syncWithLighting > 0.5;
  let effectiveSunAltitude = select(32.0, skyBackground.sunAltitude, lightingEnabled);
  let effectiveSunAzimuth = select(135.0, skyBackground.sunAzimuth, lightingEnabled);
  let dayFactor = select(1.0, smoothstep(-6.0, 20.0, effectiveSunAltitude), lightingEnabled);
  let nightFactor = select(0.0, 1.0 - smoothstep(-12.0, 2.0, effectiveSunAltitude), lightingEnabled);
  let duskFactor = select(0.18, saturate(1.0 - smoothstep(12.0, 58.0, effectiveSunAltitude)), lightingEnabled);
  let sunDir = computeSunDirection(localUp, effectiveSunAltitude, effectiveSunAzimuth);

  var baseGradient = mix(skyBackground.horizonColor.rgb, skyBackground.zenithColor.rgb, zenithFactor);
  baseGradient = mix(baseGradient, skyBackground.spaceColor.rgb, spaceFactor * mix(0.08, 0.62, nightFactor));
  baseGradient = mix(
    baseGradient,
    mix(skyBackground.horizonColor.rgb, baseGradient, altitude01),
    skyBackground.horizonBlend * (0.22 + hazeEnvelope * 0.48),
  );
  baseGradient = mix(
    baseGradient,
    mix(skyBackground.horizonColor.rgb, skyBackground.zenithColor.rgb, zenithFactor * 0.5),
    horizonEnvelope * mix(0.25, 0.82, skyBackground.horizonBlend),
  );
  baseGradient = mix(
    baseGradient,
    skyBackground.horizonColor.rgb,
    skyBackground.horizonBlend * hazeEnvelope * 0.42,
  );

  let scattering = computeAtmosphericScattering(rayDir, localUp, sunDir);
  var daySky = mix(baseGradient, scattering + baseGradient * 0.22, 0.82);
  daySky = mix(daySky, daySky + skyBackground.horizonColor.rgb * 0.28, horizonEnvelope * 0.45);

  let sunFacing = saturate(dot(rayDir, sunDir));
  let sunGlow = vec3<f32>(1.0, 0.74, 0.42) *
    pow(sunFacing, mix(96.0, 12.0, duskFactor)) *
    mix(0.04, 0.42, duskFactor) *
    (1.0 - nightFactor * 0.75);
  let warmHorizon = vec3<f32>(1.0, 0.58, 0.26) *
    horizonBand *
    pow(saturate(sunFacing * 0.5 + 0.5), 3.0) *
    0.28 *
    duskFactor *
    (1.0 - nightFactor);
  daySky += warmHorizon + sunGlow;

  var nightGradient = mix(
    skyBackground.spaceColor.rgb,
    mix(skyBackground.spaceColor.rgb, skyBackground.zenithColor.rgb, 0.18),
    aboveHorizon * 0.4,
  );
  nightGradient = mix(nightGradient, skyBackground.horizonColor.rgb * 0.18, horizonEnvelope * 0.35);

  var color = mix(nightGradient, daySky, dayFactor);
  color = mix(skyBackground.spaceColor.rgb, color, mix(0.22, 1.0, aboveHorizon));
  color = mix(
    color,
    skyBackground.horizonColor.rgb,
    (horizonBand * 0.14 + horizonEnvelope * 0.32 + hazeEnvelope * skyBackground.horizonBlend * 0.28) * (1.0 - nightFactor * 0.6),
  );
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));

  let twilightVisibility = smoothstep(30.0, -6.0, effectiveSunAltitude);
  let daySuppression = mix(0.95, 0.45, skyBackground.starIntensity);
  let starVisibility = aboveHorizon *
    max(0.0, max(nightFactor, twilightVisibility) - dayFactor * daySuppression) *
    mix(0.6, 2.4, skyBackground.starIntensity) *
    mix(0.7, 1.9, skyBackground.starDensity);
  let stars = starField(rayDir) * starVisibility * 2.2;

  // Placeholder for future volumetric clouds without changing the v1 API shape.
  let cloudDimmer = 1.0 - skyVolumetrics.cloudOpacity * 0.0;
  color = color * cloudDimmer + vec3<f32>(stars);

  return vec4<f32>(color, 1.0);
}
`;function Hs(o){return o.createBindGroupLayout({label:"sky-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Ws(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=o,r=Hs(e),n=e.createShaderModule({label:"sky-shader",code:Ns}),s=e.createPipelineLayout({label:"sky-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"sky-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main"},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t}]},primitive:{topology:"triangle-list",cullMode:"none"},multisample:{count:o.sampleCount??L}}),skyBindGroupLayout:r}}const Zs=`

// ─── Bindings ───
${q}

struct IconMaterial {
  tintColor: vec4<f32>,
  uvRect: vec4<f32>,
  size: f32,
  rotation: f32,
  bgRadius: f32,
  outlineWidth: f32,
  bgColor: vec4<f32>,
  outlineColor: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: IconMaterial;
@group(1) @binding(1) var iconSampler: sampler;
@group(1) @binding(2) var iconTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexInput {
  // Per-instance: point center position (x, y, z)
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Billboard quad: 6 vertices (2 triangles) per point instance
@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  // Quad corners: 2 triangles (0,1,2) and (2,1,3)
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let offset = quadOffsets[vid];

  // Apply rotation
  let rad = material.rotation * 3.14159265 / 180.0;
  let cosR = cos(rad);
  let sinR = sin(rad);
  let rotatedOffset = vec2<f32>(
    offset.x * cosR - offset.y * sinR,
    offset.x * sinR + offset.y * cosR,
  );

  // Raw UV for fragment shader (0-1 across quad)
  let uv = offset + vec2<f32>(0.5, 0.5);

  // Project center to clip space
  let clipCenter = camera.viewProjection * vec4<f32>(input.position.xy, 0.0, 1.0);

  // Billboard: expand quad for background circle if present
  var pixelSize = material.size;
  if (material.bgRadius > 0.0) {
    pixelSize = max(material.size, material.bgRadius * 2.0 + material.outlineWidth * 2.0);
  }
  let screenOffset = rotatedOffset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clipCenter.z,
    clipCenter.w,
  );
  out.uv = uv;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let centered = input.uv - vec2<f32>(0.5, 0.5);

  // ── No background: original icon-only path ──
  if (material.bgRadius <= 0.0) {
    let atlasUV = vec2<f32>(
      mix(material.uvRect.x, material.uvRect.z, input.uv.x),
      mix(material.uvRect.y, material.uvRect.w, input.uv.y),
    );
    let texColor = textureSample(iconTexture, iconSampler, atlasUV);
    if (texColor.a < 0.01) { discard; }
    return vec4<f32>(texColor.rgb * material.tintColor.rgb, texColor.a * material.tintColor.a);
  }

  // ── Background circle mode ──
  let totalSize = max(material.size, material.bgRadius * 2.0 + material.outlineWidth * 2.0);
  let pixelDist = length(centered) * totalSize;
  let outerEdge = material.bgRadius + material.outlineWidth;
  let aa = fwidth(pixelDist);

  // Sample icon texture unconditionally (uniform control flow)
  let iconLocalUV = clamp(centered * totalSize / material.size + vec2<f32>(0.5, 0.5), vec2<f32>(0.0), vec2<f32>(1.0));
  let atlasUV = vec2<f32>(
    mix(material.uvRect.x, material.uvRect.z, iconLocalUV.x),
    mix(material.uvRect.y, material.uvRect.w, iconLocalUV.y),
  );
  let texColor = textureSample(iconTexture, iconSampler, atlasUV);

  // Outside everything: discard
  if (pixelDist > outerEdge + aa) { discard; }

  // Outline ring (anti-aliased)
  if (pixelDist > material.bgRadius) {
    let outerAlpha = 1.0 - smoothstep(outerEdge - aa, outerEdge + aa, pixelDist);
    return vec4<f32>(material.outlineColor.rgb, material.outlineColor.a * outerAlpha);
  }

  // Background fill
  var result = material.bgColor;

  // Blend icon over background (only within icon bounds)
  let iconHalf = material.size * 0.5;
  let pixelPos = centered * totalSize;
  let inIcon = step(abs(pixelPos.x), iconHalf) * step(abs(pixelPos.y), iconHalf);
  let tinted = vec4<f32>(
    texColor.rgb * material.tintColor.rgb,
    texColor.a * material.tintColor.a * inIcon,
  );
  result = vec4<f32>(
    mix(result.rgb, tinted.rgb, tinted.a),
    result.a + tinted.a * (1.0 - result.a),
  );

  return result;
}
`;function js(o){return o.createBindGroupLayout({label:"icon-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Xs(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=o,r=js(e),n=e.createShaderModule({label:"icon-shader",code:Zs}),s=e.createPipelineLayout({label:"icon-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"icon-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"instance",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),l=e.createSampler({label:"icon-atlas-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,materialBindGroupLayout:r,sampler:l}}const $s=`

// ─── Constants ───
${de}
${Ue}

// ─── Bindings ───

struct IconMaterial {
  tintColor: vec4<f32>,
  uvRect: vec4<f32>,
  size: f32,
  rotation: f32,
  bgRadius: f32,
  outlineWidth: f32,
  bgColor: vec4<f32>,
  outlineColor: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: IconMaterial;
@group(1) @binding(1) var iconSampler: sampler;
@group(1) @binding(2) var iconTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) clipDot: f32,
};

@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let offset = quadOffsets[vid];

  // Apply rotation
  let rad = material.rotation * 3.14159265 / 180.0;
  let cosR = cos(rad);
  let sinR = sin(rad);
  let rotatedOffset = vec2<f32>(
    offset.x * cosR - offset.y * sinR,
    offset.x * sinR + offset.y * cosR,
  );

  // Raw UV for fragment shader (0-1 across quad)
  let uv = offset + vec2<f32>(0.5, 0.5);

  // EPSG:3857 → Mercator [0..1] → Angular → Sphere
  let merc01 = epsg3857ToMerc01(input.position);
  let angular = mercatorToAngular(merc01);
  let baseSphere = angularToSphere(angular.x, angular.y);

  // Altitude: Z is meters above sea level → convert to unit sphere fraction
  let altFrac = altitudeOffset(input.position.z);
  let spherePos = baseSphere * (1.0 + altFrac);

  // Globe clip space
  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  globeClip.z = globeClippingZ(baseSphere) * globeClip.w;

  var clipCenter: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipCenter = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipCenter = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
  } else {
    let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, altFrac, 1.0);
    clipCenter = mix(flatClip, globeClip, camera.projectionTransition);
  }
  let clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Billboard offset: expand for background circle if present
  var pixelSize = material.size;
  if (material.bgRadius > 0.0) {
    pixelSize = max(material.size, material.bgRadius * 2.0 + material.outlineWidth * 2.0);
  }
  let screenOffset = rotatedOffset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  // Shader-level depth offset: icons render in front of lines
  const LAYER_DEPTH_OFFSET: f32 = 0.0008;
  let adjustedZ = clipCenter.z - LAYER_DEPTH_OFFSET * clipCenter.w;
  let clampedZ = min(adjustedZ, clipCenter.w * 0.9999);

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clampedZ,
    clipCenter.w,
  );
  out.uv = uv;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Horizon discard
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  let centered = input.uv - vec2<f32>(0.5, 0.5);

  // ── No background: original icon-only path ──
  if (material.bgRadius <= 0.0) {
    let atlasUV = vec2<f32>(
      mix(material.uvRect.x, material.uvRect.z, input.uv.x),
      mix(material.uvRect.y, material.uvRect.w, input.uv.y),
    );
    let texColor = textureSample(iconTexture, iconSampler, atlasUV);
    if (texColor.a < 0.01) { discard; }
    return vec4<f32>(texColor.rgb * material.tintColor.rgb, texColor.a * material.tintColor.a);
  }

  // ── Background circle mode ──
  let totalSize = max(material.size, material.bgRadius * 2.0 + material.outlineWidth * 2.0);
  let pixelDist = length(centered) * totalSize;
  let outerEdge = material.bgRadius + material.outlineWidth;
  let aa = fwidth(pixelDist);

  // Sample icon texture unconditionally (uniform control flow)
  let iconLocalUV = clamp(centered * totalSize / material.size + vec2<f32>(0.5, 0.5), vec2<f32>(0.0), vec2<f32>(1.0));
  let atlasUV = vec2<f32>(
    mix(material.uvRect.x, material.uvRect.z, iconLocalUV.x),
    mix(material.uvRect.y, material.uvRect.w, iconLocalUV.y),
  );
  let texColor = textureSample(iconTexture, iconSampler, atlasUV);

  if (pixelDist > outerEdge + aa) { discard; }

  if (pixelDist > material.bgRadius) {
    let outerAlpha = 1.0 - smoothstep(outerEdge - aa, outerEdge + aa, pixelDist);
    return vec4<f32>(material.outlineColor.rgb, material.outlineColor.a * outerAlpha);
  }

  var result = material.bgColor;
  let iconHalf = material.size * 0.5;
  let pixelPos = centered * totalSize;
  let inIcon = step(abs(pixelPos.x), iconHalf) * step(abs(pixelPos.y), iconHalf);
  let tinted = vec4<f32>(
    texColor.rgb * material.tintColor.rgb,
    texColor.a * material.tintColor.a * inIcon,
  );
  result = vec4<f32>(
    mix(result.rgb, tinted.rgb, tinted.a),
    result.a + tinted.a * (1.0 - result.a),
  );

  return result;
}
`;function Ys(o){return o.createBindGroupLayout({label:"globe-icon-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Ks(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=o,r=Ys(e),n=e.createShaderModule({label:"globe-icon-shader",code:$s}),s=e.createPipelineLayout({label:"globe-icon-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"globe-icon-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"instance",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),l=e.createSampler({label:"globe-icon-atlas-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,materialBindGroupLayout:r,sampler:l}}function qs(o){const{device:e,colorFormat:t,depthFormat:i,cameraBindGroupLayout:r}=o,n=e.createBindGroupLayout({label:"custom-frame-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let s=null;o.hasCustomUniforms&&(s=e.createBindGroupLayout({label:"custom-user-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}));let a=null;o.hasTexture&&(a=e.createBindGroupLayout({label:"custom-texture-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]}));const l=[r,n];if(s&&l.push(s),a){if(!s){const p=e.createBindGroupLayout({label:"custom-empty-bind-group-layout",entries:[]});l.push(p)}l.push(a)}const c=e.createPipelineLayout({label:"custom-pipeline-layout",bindGroupLayouts:l}),d=o.vertexBufferLayouts.map(p=>({arrayStride:p.arrayStride,stepMode:p.stepMode??"vertex",attributes:p.attributes.map(g=>({shaderLocation:g.shaderLocation,offset:g.offset,format:g.format}))})),u=e.createShaderModule({label:"custom-shader-module",code:o.shaderSource}),h=o.blendState??{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}};return console.log("[CP5-DESC]",{topology:o.topology,colorFormat:t,depthFormat:i}),console.log("[CP5-BLEND]",JSON.stringify(h)),console.log("[CP5-DEPTH]",{depthWriteEnabled:!1,depthCompare:"always"}),console.log("[CP5-VB]",d.map(p=>({arrayStride:p.arrayStride,attrCount:Array.from(p.attributes).length}))),console.log("[CP5-BGL]",{groupCount:l.length,groups:l.map((p,g)=>`@group(${g})`)}),{pipeline:e.createRenderPipeline({label:"custom-render-pipeline",layout:c,vertex:{module:u,entryPoint:"vs_main",buffers:d},fragment:{module:u,entryPoint:"fs_main",targets:[{format:t,blend:h}]},primitive:{topology:o.topology},depthStencil:{format:i,depthWriteEnabled:!1,depthCompare:"always"},multisample:{count:o.sampleCount??L}}),frameBindGroupLayout:n,customBindGroupLayout:s,textureBindGroupLayout:a}}const Qs=`
// ─── Bindings ───
${q}

struct ModelMaterial {
  baseColorFactor: vec4<f32>,       // 0-15
  tintColor: vec4<f32>,             // 16-31
  emissiveFactor: vec3<f32>,        // 32-43
  metallic: f32,                    // 44-47
  roughness: f32,                   // 48-51
  hasBaseColorTex: f32,             // 52-55
  hasNormalTex: f32,                // 56-59
  hasMetallicRoughnessTex: f32,     // 60-63
  hasOcclusionTex: f32,             // 64-67
  hasEmissiveTex: f32,              // 68-71
  alphaCutoff: f32,                 // 72-75
  isUnlit: f32,                     // 76-79
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;
@group(1) @binding(1) var texSampler: sampler;
@group(1) @binding(2) var baseColorTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
@group(1) @binding(5) var occlusionTex: texture_2d<f32>;
@group(1) @binding(6) var emissiveTex: texture_2d<f32>;

// ─── Vertex Input ───

struct VertexInput {
  // Per-vertex (slot 0)
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) texcoord: vec2<f32>,
  // Per-instance (slot 1)
  @location(3) worldPos: vec3<f32>,
  @location(4) scaleHeading: vec2<f32>,   // scale, heading
  @location(5) pitchRollAnchor: vec3<f32>, // pitch, roll, anchorZ
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) vTexcoord: vec2<f32>,
  @location(2) vWorldPos: vec3<f32>,
};

// ─── Rotation Matrix from Euler angles (heading/pitch/roll in degrees) ───

fn degreesToRadians(deg: f32) -> f32 {
  return deg * 3.14159265358979 / 180.0;
}

fn eulerToRotationMatrix(heading: f32, pitch: f32, roll: f32) -> mat3x3<f32> {
  let h = degreesToRadians(heading);
  let p = degreesToRadians(pitch);
  let r = degreesToRadians(roll);

  let ch = cos(h); let sh = sin(h);
  let cp = cos(p); let sp = sin(p);
  let cr = cos(r); let sr = sin(r);

  // ZYX rotation order: heading(Z) * pitch(Y) * roll(X)
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

  let rotMat = eulerToRotationMatrix(heading, pitch, roll);
  let mercatorScale = mercatorMetersPerMeter(input.worldPos.y);
  let rotated = rotMat * (input.position * (scale * mercatorScale));

  // 2D orthographic mode clips positive world-space Z. Keep the model anchored
  // to the ground plane for projection, then map altitude + local height into
  // clip-space depth so elevated models remain visible.
  let projectedWorldPos = vec3<f32>(input.worldPos.x + rotated.x, input.worldPos.y + rotated.y, 0.0);
  let heightMeters = input.worldPos.z + anchorZ + rotated.z / max(mercatorScale, 0.01);
  let worldPos = vec3<f32>(projectedWorldPos.x, projectedWorldPos.y, heightMeters);

  output.clipPosition = camera.viewProjection * vec4<f32>(projectedWorldPos, 1.0);
  let absH = abs(heightMeters);
  let logH = log2(max(absH, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  output.clipPosition.z = max(0.0, normalizedZ - 0.001) * output.clipPosition.w;

  output.vNormal = normalize(rotMat * input.normal);
  output.vTexcoord = input.texcoord;
  output.vWorldPos = worldPos;

  return output;
}

// ─── PBR Helpers ───

const PI: f32 = 3.14159265358979;
const EARTH_RADIUS_M: f32 = 6378137.0;

// GGX/Trowbridge-Reitz Normal Distribution Function
fn distributionGGX(NdotH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let d = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 0.0001);
}

// Schlick-GGX Geometry function
fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

// Smith's method for combined geometry obstruction
fn geometrySmith(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
  return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

// Schlick Fresnel approximation
fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn mercatorMetersPerMeter(mercatorY: f32) -> f32 {
  let lat = atan(exp(mercatorY / EARTH_RADIUS_M)) * 2.0 - PI * 0.5;
  return 1.0 / max(cos(lat), 0.01);
}

// ─── Fragment: PBR ───

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  let uv = input.vTexcoord;

  // ── Base Color ──
  var baseColor = material.baseColorFactor;
  if (material.hasBaseColorTex > 0.5) {
    baseColor = baseColor * textureSample(baseColorTex, texSampler, uv);
  }
  baseColor = vec4<f32>(baseColor.rgb * material.tintColor.rgb, baseColor.a * material.tintColor.a);

  // Alpha test (MASK mode)
  if (material.alphaCutoff > 0.0 && baseColor.a < material.alphaCutoff) {
    discard;
  }

  // KHR_materials_unlit: skip all lighting
  if (material.isUnlit > 0.5) {
    return baseColor;
  }

  // ── Normal (flip for back-faces on double-sided materials) ──
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }
  if (material.hasNormalTex > 0.5) {
    let tangentNormal = textureSample(normalTex, texSampler, uv).rgb * 2.0 - 1.0;
    // Cotangent frame from screen-space derivatives
    let dpdx_val = dpdx(input.vWorldPos);
    let dpdy_val = dpdy(input.vWorldPos);
    let dudx = dpdx(uv);
    let dvdy = dpdy(uv);
    let T = normalize(dpdx_val * dvdy.y - dpdy_val * dudx.y);
    let B = normalize(cross(N, T));
    let TBN = mat3x3<f32>(T, B, N);
    N = normalize(TBN * tangentNormal);
  }

  // ── Metallic / Roughness ──
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g; // green channel = roughness
    metallic = metallic * mrSample.b;   // blue channel = metallic
  }
  roughness = clamp(roughness, 0.04, 1.0);

  // ── PBR Lighting ──
  let lightDir = normalize(vec3<f32>(0.5, 0.8, 0.6));
  let viewDir = normalize(vec3<f32>(0.0, 0.0, 1.0));
  let H = normalize(lightDir + viewDir);

  let NdotL = max(dot(N, lightDir), 0.0);
  let NdotV = max(dot(N, viewDir), 0.001);
  let NdotH = max(dot(N, H), 0.0);
  let HdotV = max(dot(H, viewDir), 0.0);

  // Dielectric/metallic F0
  let F0 = mix(vec3<f32>(0.04), baseColor.rgb, metallic);

  // Cook-Torrance BRDF
  let D = distributionGGX(NdotH, roughness);
  let G = geometrySmith(NdotV, NdotL, roughness);
  let F = fresnelSchlick(HdotV, F0);

  let specular = (D * G * F) / (4.0 * NdotV * NdotL + 0.0001);
  let kD = (vec3<f32>(1.0) - F) * (1.0 - metallic);
  let diffuse = kD * baseColor.rgb / PI;

  let radiance = vec3<f32>(1.0); // directional light color
  var color = (diffuse + specular) * radiance * NdotL;

  // Ambient
  color += 0.15 * baseColor.rgb;

  // ── Ambient Occlusion ──
  if (material.hasOcclusionTex > 0.5) {
    let ao = textureSample(occlusionTex, texSampler, uv).r;
    color = color * ao;
  }

  // ── Emissive ──
  var emissive = material.emissiveFactor;
  if (material.hasEmissiveTex > 0.5) {
    emissive = emissive * textureSample(emissiveTex, texSampler, uv).rgb;
  }
  color += emissive;

  return vec4<f32>(color, baseColor.a);
}
`;function Js(o){return o.createBindGroupLayout({label:"model-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function ea(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i,depthFormat:r,depthCompare:n}=o,s=Js(e),a=e.createPipelineLayout({label:"model-pipeline-layout",bindGroupLayouts:[i,s]}),l=e.createShaderModule({label:"model-shader",code:Qs}),c=e.createRenderPipeline({label:"model-pipeline",layout:a,vertex:{module:l,entryPoint:"vs_main",buffers:[{arrayStride:32,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]},{arrayStride:32,stepMode:"instance",attributes:[{shaderLocation:3,offset:0,format:"float32x3"},{shaderLocation:4,offset:12,format:"float32x2"},{shaderLocation:5,offset:20,format:"float32x3"}]}]},fragment:{module:l,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:r,depthWriteEnabled:!0,depthCompare:n??"less"},multisample:{count:o.sampleCount??L}}),d=e.createSampler({label:"model-sampler",magFilter:"linear",minFilter:"linear",mipmapFilter:"linear",addressModeU:"repeat",addressModeV:"repeat"});return{pipeline:c,materialBindGroupLayout:s,sampler:d}}const ta=`
// ─── Constants ───
${de}
${Ue}

// ─── Bindings ───

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
};

@group(1) @binding(0) var<uniform> material: ModelMaterial;
@group(1) @binding(1) var texSampler: sampler;
@group(1) @binding(2) var baseColorTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessTex: texture_2d<f32>;
@group(1) @binding(5) var occlusionTex: texture_2d<f32>;
@group(1) @binding(6) var emissiveTex: texture_2d<f32>;

// ─── Helpers ───

fn degreesToRadians(deg: f32) -> f32 {
  return deg * PI / 180.0;
}

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

// ─── Vertex ───

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
  @location(3) clipDot: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let scale = input.scaleHeading.x;
  let heading = input.scaleHeading.y;
  let pitch = input.pitchRollAnchor.x;
  let roll = input.pitchRollAnchor.y;
  let anchorZ = input.pitchRollAnchor.z;

  // Convert instance position to sphere
  let merc01 = epsg3857ToMerc01(input.worldPos);
  let angular = mercatorToAngular(merc01);
  let spherePos = angularToSphere(angular.x, angular.y);

  // Build LOCAL TANGENT FRAME at sphere position
  let up = normalize(spherePos);
  // Pole guard: if near pole, use X-axis instead of Y
  var refDir = vec3<f32>(0.0, 1.0, 0.0);
  if (abs(up.y) > 0.999) {
    refDir = vec3<f32>(1.0, 0.0, 0.0);
  }
  let east = normalize(cross(refDir, up));
  let north = cross(up, east);
  // Model local axes are x=east, y=north, z=up in mapgpu space.
  let tangentMatrix = mat3x3<f32>(east, north, up);

  // Rotation matrix (shared by globe and flat paths)
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);

  // ─── Globe path: tangent frame on unit sphere ───
  let globeScale = scale / EARTH_RADIUS_M;
  let localOffset = tangentMatrix * (rotMat * (input.position * globeScale));
  let totalAlt = input.worldPos.z + anchorZ;
  let altFrac = altitudeOffset(totalAlt);
  let globeFinal = spherePos * (1.0 + altFrac) + localOffset;

  var globeClip = camera.viewProjection * vec4<f32>(globeFinal, 1.0);
  // Depth strategy: shift the entire model's projected depth to align with
  // globeClippingZ ordering. The shift is CONSTANT per instance (computed
  // from instance center), so relative depth between vertices is preserved
  // perfectly — no floating-point cancellation, no amplification.
  let instanceCenter = spherePos * (1.0 + altFrac);
  let centerClip = camera.viewProjection * vec4<f32>(instanceCenter, 1.0);
  let centerNDC = centerClip.z / centerClip.w;
  let globeNDC = globeClippingZ(instanceCenter);
  let depthShift = globeNDC - centerNDC;
  globeClip.z = globeClip.z + depthShift * globeClip.w;

  // ─── Flat path: model vertex offset in Mercator [0..1] space ───
  let flatMercatorScale = 1.0 / max(cos(angular.y), 0.01);
  let flatRotated = rotMat * (input.position * scale);
  let flatLocalScale = flatMercatorScale / (2.0 * HALF_CIRCUMFERENCE);
  let flatMerc = vec3<f32>(
    merc01.x + flatRotated.x * flatLocalScale,
    merc01.y - flatRotated.y * flatLocalScale,
    altitudeOffset(input.worldPos.z) + (flatRotated.z + anchorZ) * flatLocalScale
  );
  var flatClip = camera.flatViewProjection * vec4<f32>(flatMerc, 1.0);
  // Keep projected depth for self-occlusion, apply small layer pull
  flatClip.z -= 0.001 * flatClip.w;

  const LAYER_DEPTH_OFFSET: f32 = 0.0003;

  // Blend based on projection transition
  var clipPos: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipPos = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipPos = flatClip;
  } else {
    clipPos = mix(flatClip, globeClip, camera.projectionTransition);
  }
  clipPos.z -= LAYER_DEPTH_OFFSET * clipPos.w;
  clipPos.z = min(clipPos.z, clipPos.w * 0.9999);

  output.clipPosition = clipPos;

  // Normal: globe tangent frame vs flat (match 2D mode in flat path)
  let globeNormal = normalize(tangentMatrix * (rotMat * input.normal));
  let flatNormal = normalize(rotMat * input.normal);
  if (camera.projectionTransition >= 0.999) {
    output.vNormal = globeNormal;
  } else if (camera.projectionTransition <= 0.001) {
    output.vNormal = flatNormal;
  } else {
    output.vNormal = normalize(mix(flatNormal, globeNormal, camera.projectionTransition));
  }
  output.vTexcoord = input.texcoord;
  output.vWorldPos = globeFinal;
  output.clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  return output;
}

// ─── PBR Helpers ───

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

// ─── Fragment: PBR ───

@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4<f32> {
  // Horizon occlusion
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }

  let uv = input.vTexcoord;

  // Base Color
  var baseColor = material.baseColorFactor;
  if (material.hasBaseColorTex > 0.5) {
    baseColor = baseColor * textureSample(baseColorTex, texSampler, uv);
  }
  baseColor = vec4<f32>(baseColor.rgb * material.tintColor.rgb, baseColor.a * material.tintColor.a);

  if (material.alphaCutoff > 0.0 && baseColor.a < material.alphaCutoff) { discard; }

  // KHR_materials_unlit: skip all lighting
  if (material.isUnlit > 0.5) { return baseColor; }

  // Normal (flip for back-faces on double-sided materials)
  var N = normalize(input.vNormal);
  if (!frontFacing) { N = -N; }

  // Metallic / Roughness
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g;
    metallic = metallic * mrSample.b;
  }
  roughness = clamp(roughness, 0.04, 1.0);

  // PBR Lighting — view direction computed per-pixel from globe position
  // (same pattern as globe-extrusion-pipeline: -worldPos = outward from globe center ≈ toward camera)
  let lightDir = normalize(vec3<f32>(0.5, 0.8, 0.6));
  let viewDir = normalize(-input.vWorldPos);
  let H = normalize(lightDir + viewDir);

  let NdotL = max(dot(N, lightDir), 0.0);
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

  var color = (diffuse + specular) * NdotL;
  color += 0.15 * baseColor.rgb;

  if (material.hasOcclusionTex > 0.5) {
    color = color * textureSample(occlusionTex, texSampler, uv).r;
  }

  var emissive = material.emissiveFactor;
  if (material.hasEmissiveTex > 0.5) {
    emissive = emissive * textureSample(emissiveTex, texSampler, uv).rgb;
  }
  color += emissive;

  return vec4<f32>(color, baseColor.a);
}
`;function ia(o){return o.createBindGroupLayout({label:"globe-model-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function ra(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i,depthFormat:r,depthCompare:n}=o,s=ia(e),a=e.createPipelineLayout({label:"globe-model-pipeline-layout",bindGroupLayouts:[i,s]}),l=e.createShaderModule({label:"globe-model-shader",code:ta}),c=e.createRenderPipeline({label:"globe-model-pipeline",layout:a,vertex:{module:l,entryPoint:"vs_main",buffers:[{arrayStride:32,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]},{arrayStride:32,stepMode:"instance",attributes:[{shaderLocation:3,offset:0,format:"float32x3"},{shaderLocation:4,offset:12,format:"float32x2"},{shaderLocation:5,offset:20,format:"float32x3"}]}]},fragment:{module:l,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:r,depthWriteEnabled:!0,depthCompare:n??"less"},multisample:{count:o.sampleCount??L}}),d=e.createSampler({label:"globe-model-sampler",magFilter:"linear",minFilter:"linear",mipmapFilter:"linear",addressModeU:"repeat",addressModeV:"repeat"});return{pipeline:c,materialBindGroupLayout:s,sampler:d}}class oa{_device;_models=new Map;constructor(e){this._device=e}upload(e,t){if(this._models.has(e))return;const i=t.primitives.map((r,n)=>this._uploadPrimitive(e,r.mesh,r.material,n));this._models.set(e,{primitives:i})}async uploadAsync(e,t){if(this._models.has(e))return;const i=[];for(let r=0;r<t.primitives.length;r++){const n=t.primitives[r],s=this._uploadPrimitive(e,n.mesh,n.material,r),a=[{field:"baseColorTexture",index:n.material.baseColorTextureIndex},{field:"normalTexture",index:n.material.normalTextureIndex},{field:"metallicRoughnessTexture",index:n.material.metallicRoughnessTextureIndex},{field:"occlusionTexture",index:n.material.occlusionTextureIndex},{field:"emissiveTexture",index:n.material.emissiveTextureIndex}];for(const l of a){if(l.index===void 0)continue;const c=n.imageData.get(l.index);if(c)try{const d=new ArrayBuffer(c.data.byteLength);new Uint8Array(d).set(c.data);const u=new Blob([d],{type:c.mimeType}),h=await createImageBitmap(u);s[l.field]=this._createTextureFromBitmap(h,`${e}-p${r}-${l.field}`),h.close()}catch{}}i.push(s)}this._models.set(e,{primitives:i})}get(e){return this._models.get(e)}has(e){return this._models.has(e)}destroy(){for(const e of this._models.values())for(const t of e.primitives)t.vertexBuffer.destroy(),t.indexBuffer.destroy(),t.baseColorTexture?.destroy(),t.normalTexture?.destroy(),t.metallicRoughnessTexture?.destroy(),t.occlusionTexture?.destroy(),t.emissiveTexture?.destroy();this._models.clear()}_uploadPrimitive(e,t,i,r){const s=new Float32Array(t.vertexCount*8);for(let x=0;x<t.vertexCount;x++){const v=x*8,y=x*3,m=x*3,_=x*2;s[v+0]=t.positions[y],s[v+1]=t.positions[y+1],s[v+2]=t.positions[y+2],s[v+3]=t.normals[m],s[v+4]=t.normals[m+1],s[v+5]=t.normals[m+2],s[v+6]=t.texcoords[_],s[v+7]=t.texcoords[_+1]}const a=`model-vertex-${e}${r>0?`-p${r}`:""}`,l=this._device.createBuffer({label:a,size:s.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0});new Float32Array(l.getMappedRange()).set(s),l.unmap();const c=t.indices,d=c instanceof Uint32Array?"uint32":"uint16",u=c.byteLength,h=Math.ceil(u/4)*4,f=`model-index-${e}${r>0?`-p${r}`:""}`,p=this._device.createBuffer({label:f,size:Math.max(h,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0}),g=p.getMappedRange(0,Math.max(h,4));return c instanceof Uint32Array?new Uint32Array(g).set(c):new Uint16Array(g).set(c),p.unmap(),{vertexBuffer:l,indexBuffer:p,indexFormat:d,indexCount:t.indexCount,vertexCount:t.vertexCount,material:i,baseColorTexture:null,normalTexture:null,metallicRoughnessTexture:null,occlusionTexture:null,emissiveTexture:null}}_createTextureFromBitmap(e,t){const i=this._device.createTexture({label:t,size:{width:e.width,height:e.height},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});return this._device.queue.copyExternalImageToTexture({source:e},{texture:i},{width:e.width,height:e.height}),i}}const Ii=1179937895,na=2,Ui=1313821514,ki=5130562,sa={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},aa={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};function Qe(o,e,t){const i=aa[o.type];if(i===void 0)throw new Error(`GLB: unknown accessor type "${o.type}"`);const r=sa[o.componentType];if(r===void 0)throw new Error(`GLB: unknown componentType ${o.componentType}`);const n=o.count*i;if(o.bufferView===void 0)return Vi(o.componentType,new ArrayBuffer(n*r),0,n);const s=e[o.bufferView];if(!s)throw new Error(`GLB: bufferView index ${o.bufferView} out of range`);const a=s.byteOffset??0,l=o.byteOffset??0,c=a+l,d=n*r,u=new ArrayBuffer(d);return new Uint8Array(u).set(t.subarray(c,c+d)),Vi(o.componentType,u,0,n)}function Vi(o,e,t,i){switch(o){case 5120:return new Int8Array(e,t,i);case 5121:return new Uint8Array(e,t,i);case 5122:return new Int16Array(e,t,i);case 5123:return new Uint16Array(e,t,i);case 5125:return new Uint32Array(e,t,i);case 5126:return new Float32Array(e,t,i);default:throw new Error(`GLB: unsupported componentType ${o}`)}}function Bt(o){if(o instanceof Float32Array)return o;const e=o,t=new Float32Array(e.length);for(let i=0;i<e.length;i++)t[i]=e[i];return t}function la(o,e,t,i,r){const[n,s,a,l]=i,c=n+n,d=s+s,u=a+a,h=n*c,f=n*d,p=n*u,g=s*d,x=s*u,v=a*u,y=l*c,m=l*d,_=l*u,w=1-(g+v),P=f-_,M=p+m,b=f+_,C=1-(h+v),S=x-y,T=p-m,B=x+y,F=1-(h+g),E=o.length/3;for(let G=0;G<E;G++){const D=G*3,V=o[D]*r[0],U=o[D+1]*r[1],k=o[D+2]*r[2];o[D]=w*V+P*U+M*k+t[0],o[D+1]=b*V+C*U+S*k+t[1],o[D+2]=T*V+B*U+F*k+t[2];const X=e[D],ee=e[D+1],Pe=e[D+2],ae=w*X+P*ee+M*Pe,fe=b*X+C*ee+S*Pe,we=T*X+B*ee+F*Pe,Ce=Math.sqrt(ae*ae+fe*fe+we*we)||1;e[D]=ae/Ce,e[D+1]=fe/Ce,e[D+2]=we/Ce}}function ca(o){const e=new Float32Array(o*3);for(let t=0;t<o;t++)e[t*3+2]=1;return e}function ua(o){return new Float32Array(o*2)}function ha(o){const e=new Uint32Array(o);for(let t=0;t<o;t++)e[t]=t;return e}const se={baseColorFactor:[1,1,1,1],metallicFactor:1,roughnessFactor:1,emissiveFactor:[0,0,0],alphaMode:"OPAQUE",alphaCutoff:.5,doubleSided:!1,unlit:!1};function da(o,e,t,i){const r=o.attributes.POSITION;if(r===void 0)throw new Error("GLB: primitive has no POSITION attribute");const n=e[r];if(!n)throw new Error(`GLB: POSITION accessor index ${r} out of range`);const s=Bt(Qe(n,t,i)),a=n.count;let l;const c=o.attributes.NORMAL;if(c!==void 0){const p=e[c];if(!p)throw new Error(`GLB: NORMAL accessor index ${c} out of range`);l=Bt(Qe(p,t,i))}else l=ca(a);let d;const u=o.attributes.TEXCOORD_0;if(u!==void 0){const p=e[u];if(!p)throw new Error(`GLB: TEXCOORD_0 accessor index ${u} out of range`);d=Bt(Qe(p,t,i))}else d=ua(a);let h,f;if(o.indices!==void 0){const p=e[o.indices];if(!p)throw new Error(`GLB: indices accessor index ${o.indices} out of range`);const g=Qe(p,t,i);if(g instanceof Uint16Array)h=g;else if(g instanceof Uint32Array)h=g;else{const x=g,v=new Uint32Array(x.length);for(let y=0;y<x.length;y++)v[y]=x[y];h=v}f=p.count}else h=ha(a),f=a;return{positions:s,normals:l,texcoords:d,indices:h,vertexCount:a,indexCount:f}}function fa(o,e){if(o===void 0||!e||!e[o])return{...se};const t=e[o],i=t.pbrMetallicRoughness,r=i?.baseColorFactor,n={baseColorFactor:r&&r.length>=4?[r[0],r[1],r[2],r[3]]:se.baseColorFactor,metallicFactor:i?.metallicFactor??se.metallicFactor,roughnessFactor:i?.roughnessFactor??se.roughnessFactor,emissiveFactor:t.emissiveFactor&&t.emissiveFactor.length>=3?[t.emissiveFactor[0],t.emissiveFactor[1],t.emissiveFactor[2]]:se.emissiveFactor,alphaMode:t.alphaMode??se.alphaMode,alphaCutoff:t.alphaCutoff??se.alphaCutoff,doubleSided:t.doubleSided??se.doubleSided,unlit:t.extensions?.KHR_materials_unlit!==void 0};return i?.baseColorTexture!==void 0&&(n.baseColorTextureIndex=i.baseColorTexture.index),i?.metallicRoughnessTexture!==void 0&&(n.metallicRoughnessTextureIndex=i.metallicRoughnessTexture.index),t.normalTexture!==void 0&&(n.normalTextureIndex=t.normalTexture.index),t.occlusionTexture!==void 0&&(n.occlusionTextureIndex=t.occlusionTexture.index),t.emissiveTexture!==void 0&&(n.emissiveTextureIndex=t.emissiveTexture.index),n}function pa(o,e,t,i){const r=e.textures;if(!r||!r[o])return;const n=r[o];if(n.source===void 0)return;const s=e.images;if(!s||!s[n.source])return;const a=s[n.source];if(a.bufferView===void 0)return;const l=t[a.bufferView];if(!l)return;const c=l.byteOffset??0,d=new Uint8Array(l.byteLength);return d.set(i.subarray(c,c+l.byteLength)),{data:d,mimeType:a.mimeType??"image/png"}}function ma(o){if(o.byteLength<12)throw new Error("GLB: data too small to contain a valid header");const e=new DataView(o),t=e.getUint32(0,!0);if(t!==Ii)throw new Error(`GLB: invalid magic 0x${t.toString(16).padStart(8,"0")}, expected 0x${Ii.toString(16).padStart(8,"0")}`);const i=e.getUint32(4,!0);if(i!==na)throw new Error(`GLB: unsupported version ${i}, only version 2 is supported`);const r=e.getUint32(8,!0);if(r>o.byteLength)throw new Error(`GLB: declared length ${r} exceeds buffer size ${o.byteLength}`);let n=12;if(n+8>r)throw new Error("GLB: missing JSON chunk header");const s=e.getUint32(n,!0),a=e.getUint32(n+4,!0);if(a!==Ui)throw new Error(`GLB: first chunk type 0x${a.toString(16)} is not JSON (0x${Ui.toString(16)})`);if(n+=8,n+s>r)throw new Error("GLB: JSON chunk extends beyond file");const l=new Uint8Array(o,n,s),c=new TextDecoder().decode(l),d=JSON.parse(c);n+=s;let u=new Uint8Array(0);if(n+8<=r){const h=e.getUint32(n,!0),f=e.getUint32(n+4,!0);if(f!==ki)throw new Error(`GLB: second chunk type 0x${f.toString(16)} is not BIN (0x${ki.toString(16)})`);if(n+=8,n+h>r)throw new Error("GLB: BIN chunk extends beyond file");u=new Uint8Array(o,n,h)}return Tr(d,u)}function ga(o,e){const t=o;let i=0;for(const a of e)i+=a.byteLength;const r=new Uint8Array(i),n=[];let s=0;for(const a of e)n.push(s),r.set(new Uint8Array(a),s),s+=a.byteLength;if(t.bufferViews)for(const a of t.bufferViews){const l=n[a.buffer]??0;a.byteOffset=(a.byteOffset??0)+l,a.buffer=0}return Tr(t,r)}function Ft(o,e,t,i,r,n){const s=[];for(const a of o.primitives){const l=da(a,e,t,i),c=fa(a.material,r.materials);if(n){const h=n.translation??[0,0,0],f=n.rotation??[0,0,0,1],p=n.scale??[1,1,1];(n.translation||n.rotation||n.scale)&&la(l.positions,l.normals,h,f,p)}const d=new Map,u=[c.baseColorTextureIndex,c.normalTextureIndex,c.metallicRoughnessTextureIndex,c.occlusionTextureIndex,c.emissiveTextureIndex];for(const h of u)if(h!==void 0&&!d.has(h)){const f=pa(h,r,t,i);f&&d.set(h,f)}s.push({mesh:l,material:c,imageData:d,name:n?.name??o.name})}return s}function Tr(o,e){if(!o.meshes||o.meshes.length===0)throw new Error("GLB: no meshes found in JSON");const t=o.accessors??[],i=o.bufferViews??[],r=[];if(o.nodes&&o.nodes.length>0){const n=new Set;for(const s of o.nodes){if(s.mesh===void 0)continue;const a=o.meshes[s.mesh];a&&(n.add(s.mesh),r.push(...Ft(a,t,i,e,o,s)))}for(let s=0;s<o.meshes.length;s++)n.has(s)||r.push(...Ft(o.meshes[s],t,i,e,o))}else for(const n of o.meshes)r.push(...Ft(n,t,i,e,o));if(r.length===0)throw new Error("GLB: no primitives found");return{primitives:r}}const Gt=20037508342789244e-9;function xa(o,e,t,i,r){const n=o.length/2;if(n===0)return{entries:[],membership:[]};const s=e>0?e:60,a=2*Gt/(256*Math.pow(2,t)),l=s*a,c=l*l,d=i[0]-l,u=i[1]-l,h=i[2]+l,f=i[3]+l,p=new Map;for(let b=0;b<n;b++){const C=o[b*2],S=o[b*2+1];if(C<d||C>h||S<u||S>f)continue;const T=Math.floor((C+Gt)/l),B=Math.floor((S+Gt)/l);if(!Number.isFinite(T)||!Number.isFinite(B))continue;const F=`${T},${B}`;let E=p.get(F);E||(E={cellX:T,cellY:B,sumX:0,sumY:0,count:0,members:[]},p.set(F,E)),E.sumX+=C,E.sumY+=S,E.count++,E.members.push(b)}if(p.size===0)return{entries:[],membership:[]};const g=Array.from(p.values());g.sort((b,C)=>b.cellY-C.cellY||b.cellX-C.cellX);const x=new Map;for(let b=0;b<g.length;b++){const C=g[b];x.set(`${C.cellX},${C.cellY}`,b)}const v=new va(g.length),y=new Float64Array(g.length),m=new Float64Array(g.length);for(let b=0;b<g.length;b++){const C=g[b];y[b]=C.sumX/C.count,m[b]=C.sumY/C.count}for(let b=0;b<g.length;b++){const C=g[b];for(let S=C.cellY-1;S<=C.cellY+1;S++)for(let T=C.cellX-1;T<=C.cellX+1;T++){if(T<C.cellX||T===C.cellX&&S<=C.cellY)continue;const B=x.get(`${T},${S}`);if(B===void 0||B<=b)continue;const F=y[b]-y[B],E=m[b]-m[B];F*F+E*E<=c&&v.union(b,B)}}const _=new Map;for(let b=0;b<g.length;b++){const C=v.find(b),S=g[b];let T=_.get(C);T||(T={sumX:0,sumY:0,count:0,members:[],minMember:1/0},_.set(C,T)),T.sumX+=S.sumX,T.sumY+=S.sumY,T.count+=S.count,T.members.push(...S.members);for(const B of S.members)B<T.minMember&&(T.minMember=B)}const w=Array.from(_.values());w.sort((b,C)=>b.minMember-C.minMember);const P=[],M=[];for(const b of w){if(b.count>=r){const S=b.sumX/b.count,T=b.sumY/b.count,B=b.members.slice().sort((E,G)=>E-G);let F=0;F=1,b.count>=100?F|=4:b.count>=10&&(F|=2),P.push({posX:S,posY:T,count:b.count,flags:F}),M.push(B);continue}const C=b.members.slice().sort((S,T)=>S-T);for(const S of C){const T=o[S*2],B=o[S*2+1];P.push({posX:T,posY:B,count:1,flags:0}),M.push([S])}}return{entries:P,membership:M}}class va{parent;rank;constructor(e){this.parent=new Int32Array(e),this.rank=new Uint8Array(e);for(let t=0;t<e;t++)this.parent[t]=t}find(e){let t=e;for(;this.parent[t]!==t;)t=this.parent[t];let i=e;for(;this.parent[i]!==i;){const r=this.parent[i];this.parent[i]=t,i=r}return t}union(e,t){let i=this.find(e),r=this.find(t);if(i===r)return;const n=this.rank[i],s=this.rank[r];n<s&&([i,r]=[r,i]),this.parent[r]=i,n===s&&(this.rank[i]=n+1)}}function ya(o){const e=new Float32Array(o.length*4),t=new Uint32Array(e.buffer);for(let i=0;i<o.length;i++){const r=o[i],n=i*4;e[n]=r.posX,e[n+1]=r.posY,t[n+2]=r.count,t[n+3]=r.flags}return e}const _a=`

${q}

struct ClusterOutput {
  posX: f32,
  posY: f32,
  count: u32,
  flags: u32,
};

struct ClusterMaterial {
  clusterFillSmall: vec4<f32>,
  clusterFillMedium: vec4<f32>,
  clusterFillLarge: vec4<f32>,
  clusterStroke: vec4<f32>,
  clusterText: vec4<f32>,
  pointFill: vec4<f32>,
  pointStroke: vec4<f32>,
  pointSize: f32,
  pointStrokeWidth: f32,
  clusterBaseSize: f32,
  clusterGrowRate: f32,
  clusterStrokeWidth: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(1) @binding(0) var<storage, read> clusters: array<ClusterOutput>;
@group(1) @binding(1) var<uniform> material: ClusterMaterial;
@group(1) @binding(2) var digitAtlasTex: texture_2d<f32>;
@group(1) @binding(3) var digitSampler: sampler;

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) @interpolate(flat) instanceIdx: u32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let inst = clusters[iid];
  let isCluster = (inst.flags & 1u) != 0u;

  var pixelSize: f32;
  if (isCluster) {
    let tier = min(f32((inst.flags >> 1u) & 3u), 2.0);
    pixelSize = material.clusterBaseSize + material.clusterGrowRate * tier;
  } else {
    pixelSize = material.pointSize;
  }

  let offset = quadOffsets[vid];
  let uv = offset + vec2<f32>(0.5, 0.5);

  let clipCenter = camera.viewProjection * vec4<f32>(inst.posX, inst.posY, 0.0, 1.0);

  let screenOffset = offset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clipCenter.z,
    clipCenter.w,
  );
  out.uv = uv;
  out.instanceIdx = iid;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let inst = clusters[input.instanceIdx];
  let isCluster = (inst.flags & 1u) != 0u;

  let centered = input.uv - vec2<f32>(0.5, 0.5);
  let dist = length(centered);

  // ── Uniform control flow zone ──────────────────────────────────
  // fwidth + textureSample MUST be called before any non-uniform branch.
  let aa = fwidth(dist);

  // Digit atlas UV (computed unconditionally; result ignored for points)
  let count = inst.count;
  let digitCount = getDigitCount(count);
  let digitCountF = f32(max(digitCount, 1u));
  let textHeight = 0.54;
  let maxTotalWidth = 0.78;
  let naturalDigitWidth = textHeight * 0.52;
  let digitWidth = min(naturalDigitWidth, maxTotalWidth / digitCountF);
  let totalWidth = digitCountF * digitWidth;
  let startU = 0.5 - totalWidth * 0.5;
  let localU = input.uv.x;
  let localV = input.uv.y;
  let rawDigitIdx = (localU - startU) / digitWidth;
  let digitIdx = u32(max(rawDigitIdx, 0.0));
  let safeDigitIdx = min(digitIdx, max(digitCount, 1u) - 1u);
  let digit = getDigitAt(count, digitCount, safeDigitIdx);
  let withinU = fract(max(rawDigitIdx, 0.0));
  let vMin = 0.5 - textHeight * 0.5;
  let vMax = 0.5 + textHeight * 0.5;
  let withinV = clamp((localV - vMin) / textHeight, 0.0, 1.0);
  // Remove side-bearings inside each digit cell to tighten inter-digit spacing.
  let glyphCropMin = 0.18;
  let glyphCropMax = 0.82;
  let atlasDigitU = glyphCropMin + withinU * (glyphCropMax - glyphCropMin);
  let atlasU = (f32(digit) + atlasDigitU) / 10.0;
  let atlasV = withinV;
  let texColor = textureSample(digitAtlasTex, digitSampler, vec2<f32>(atlasU, atlasV));
  // ── End uniform zone ───────────────────────────────────────────

  // SDF circle — discard outside radius (uniform: depends only on UV)
  if (dist > 0.5) {
    discard;
  }

  // ── Non-uniform branching (safe — special ops already computed) ──
  if (!isCluster) {
    let strokeFrac = clamp(material.pointStrokeWidth / max(material.pointSize, 1.0), 0.0, 0.49);
    let inner = 0.5 - strokeFrac;
    let fillMix = 1.0 - smoothstep(inner - aa, inner, dist);
    let edgeAlpha = 1.0 - smoothstep(0.5 - aa, 0.5, dist);
    let color = mix(material.pointStroke, material.pointFill, fillMix);
    return vec4<f32>(color.rgb, color.a * edgeAlpha);
  }

  // Cluster circle — tier fill + stroke
  let tier = (inst.flags >> 1u) & 3u;
  var fillColor: vec4<f32>;
  if (tier >= 2u) {
    fillColor = material.clusterFillLarge;
  } else if (tier >= 1u) {
    fillColor = material.clusterFillMedium;
  } else {
    fillColor = material.clusterFillSmall;
  }

  let clusterTier = min(f32((inst.flags >> 1u) & 3u), 2.0);
  let clusterPixelSize = material.clusterBaseSize + material.clusterGrowRate * clusterTier;
  let strokeFrac = clamp(material.clusterStrokeWidth / max(clusterPixelSize, 1.0), 0.0, 0.49);
  let inner = 0.5 - strokeFrac;
  let fillMix = 1.0 - smoothstep(inner - aa, inner, dist);
  let edgeAlpha = 1.0 - smoothstep(0.5 - aa, 0.5, dist);
  let circleColor = mix(material.clusterStroke, fillColor, fillMix);

  let inDigitRegion = step(vMin, localV) * step(localV, vMax)
                    * step(startU, localU) * step(localU, startU + totalWidth)
                    * step(f32(digitIdx), f32(digitCount) - 0.5);
  let textAlpha = texColor.a * inDigitRegion * material.clusterText.a;

  let finalColor = mix(circleColor.rgb, material.clusterText.rgb, textAlpha);
  return vec4<f32>(finalColor, circleColor.a * edgeAlpha);
}

// ─── Digit Helpers ───

fn getDigitCount(n: u32) -> u32 {
  if (n >= 100000u) { return 6u; }
  if (n >= 10000u) { return 5u; }
  if (n >= 1000u) { return 4u; }
  if (n >= 100u) { return 3u; }
  if (n >= 10u) { return 2u; }
  return 1u;
}

fn getDigitAt(n: u32, digitCount: u32, idx: u32) -> u32 {
  // idx 0 = most significant digit
  var divisor = 1u;
  for (var i = 0u; i < digitCount - 1u - idx; i = i + 1u) {
    divisor = divisor * 10u;
  }
  return (n / divisor) % 10u;
}
`;function ba(o){return o.createBindGroupLayout({label:"cluster-render-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{}}]})}function Pa(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=o,r=ba(e),n=e.createShaderModule({label:"cluster-render-shader",code:_a}),s=e.createPipelineLayout({label:"cluster-render-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"cluster-render-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),l=e.createSampler({label:"cluster-digit-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,renderBindGroupLayout:r,sampler:l}}const wa=`

${de}

struct ClusterOutput {
  posX: f32,
  posY: f32,
  count: u32,
  flags: u32,
};

struct ClusterMaterial {
  clusterFillSmall: vec4<f32>,
  clusterFillMedium: vec4<f32>,
  clusterFillLarge: vec4<f32>,
  clusterStroke: vec4<f32>,
  clusterText: vec4<f32>,
  pointFill: vec4<f32>,
  pointStroke: vec4<f32>,
  pointSize: f32,
  pointStrokeWidth: f32,
  clusterBaseSize: f32,
  clusterGrowRate: f32,
  clusterStrokeWidth: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(1) @binding(0) var<storage, read> clusters: array<ClusterOutput>;
@group(1) @binding(1) var<uniform> material: ClusterMaterial;
@group(1) @binding(2) var digitAtlasTex: texture_2d<f32>;
@group(1) @binding(3) var digitSampler: sampler;

// Base depth offset. Large clusters need extra lift to avoid intersecting
// curved globe depth near the horizon (prevents "half-circle" clipping).
const LAYER_DEPTH_OFFSET_BASE: f32 = 0.001;

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) @interpolate(flat) instanceIdx: u32,
  @location(2) clipDot: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let inst = clusters[iid];
  let isCluster = (inst.flags & 1u) != 0u;

  var pixelSize: f32;
  if (isCluster) {
    let tier = min(f32((inst.flags >> 1u) & 3u), 2.0);
    pixelSize = material.clusterBaseSize + material.clusterGrowRate * tier;
  } else {
    pixelSize = material.pointSize;
  }

  let offset = quadOffsets[vid];
  let uv = offset + vec2<f32>(0.5, 0.5);

  // EPSG:3857 → Mercator [0..1] → angular → sphere
  let merc01 = epsg3857ToMerc01(vec3<f32>(inst.posX, inst.posY, 0.0));
  let ang = mercatorToAngular(merc01);
  let spherePos = angularToSphere(ang.x, ang.y);

  // Horizon dot product (passed to fragment for discard)
  let clipDot = dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  // Globe clip position
  var globeClip = camera.viewProjection * vec4<f32>(spherePos, 1.0);
  let clipZ = globeClippingZ(spherePos);
  globeClip.z = clipZ * globeClip.w;

  // Flat clip position (for transition blend)
  let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, 0.0, 1.0);

  // Blend based on projection transition
  var clipCenter: vec4<f32>;
  if (camera.projectionTransition >= 0.999) {
    clipCenter = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    clipCenter = flatClip;
  } else {
    clipCenter = mix(flatClip, globeClip, camera.projectionTransition);
  }

  // Depth offset + clamping (match other globe pipelines)
  // Size-aware offset keeps bigger billboards fully in front of globe depth.
  let layerDepthOffset = LAYER_DEPTH_OFFSET_BASE + pixelSize * 0.00006;
  let adjustedZ = clipCenter.z - layerDepthOffset * clipCenter.w;
  let clampedZ = min(adjustedZ, clipCenter.w * 0.9999);

  // Billboard offset in screen space
  let screenOffset = offset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clampedZ,
    clipCenter.w,
  );
  out.uv = uv;
  out.instanceIdx = iid;
  out.clipDot = clipDot;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let inst = clusters[input.instanceIdx];
  let isCluster = (inst.flags & 1u) != 0u;

  let centered = input.uv - vec2<f32>(0.5, 0.5);
  let dist = length(centered);

  // ── Uniform control flow zone ──────────────────────────────────
  // fwidth + textureSample MUST be called before any non-uniform branch.
  let aa = fwidth(dist);

  // Digit atlas UV (computed unconditionally; result ignored for points)
  let count = inst.count;
  let digitCount = getDigitCount(count);
  let digitCountF = f32(max(digitCount, 1u));
  let textHeight = 0.54;
  let maxTotalWidth = 0.78;
  let naturalDigitWidth = textHeight * 0.52;
  let digitWidth = min(naturalDigitWidth, maxTotalWidth / digitCountF);
  let totalWidth = digitCountF * digitWidth;
  let startU = 0.5 - totalWidth * 0.5;
  let localU = input.uv.x;
  let localV = input.uv.y;
  let rawDigitIdx = (localU - startU) / digitWidth;
  let digitIdx = u32(max(rawDigitIdx, 0.0));
  let safeDigitIdx = min(digitIdx, max(digitCount, 1u) - 1u);
  let digit = getDigitAt(count, digitCount, safeDigitIdx);
  let withinU = fract(max(rawDigitIdx, 0.0));
  let vMin = 0.5 - textHeight * 0.5;
  let vMax = 0.5 + textHeight * 0.5;
  let withinV = clamp((localV - vMin) / textHeight, 0.0, 1.0);
  // Remove side-bearings inside each digit cell to tighten inter-digit spacing.
  let glyphCropMin = 0.18;
  let glyphCropMax = 0.82;
  let atlasDigitU = glyphCropMin + withinU * (glyphCropMax - glyphCropMin);
  let atlasU = (f32(digit) + atlasDigitU) / 10.0;
  let atlasV = withinV;
  let texColor = textureSample(digitAtlasTex, digitSampler, vec2<f32>(atlasU, atlasV));
  // ── End uniform zone ───────────────────────────────────────────

  // Horizon culling — fragment discard (matching other globe pipelines)
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) {
    discard;
  }

  if (dist > 0.5) {
    discard;
  }

  // ── Non-uniform branching (safe — special ops already computed) ──
  if (!isCluster) {
    let strokeFrac = clamp(material.pointStrokeWidth / max(material.pointSize, 1.0), 0.0, 0.49);
    let inner = 0.5 - strokeFrac;
    let fillMix = 1.0 - smoothstep(inner - aa, inner, dist);
    let edgeAlpha = 1.0 - smoothstep(0.5 - aa, 0.5, dist);
    let color = mix(material.pointStroke, material.pointFill, fillMix);
    return vec4<f32>(color.rgb, color.a * edgeAlpha);
  }

  let tier = (inst.flags >> 1u) & 3u;
  var fillColor: vec4<f32>;
  if (tier >= 2u) {
    fillColor = material.clusterFillLarge;
  } else if (tier >= 1u) {
    fillColor = material.clusterFillMedium;
  } else {
    fillColor = material.clusterFillSmall;
  }

  let clusterTier = min(f32((inst.flags >> 1u) & 3u), 2.0);
  let clusterPixelSize = material.clusterBaseSize + material.clusterGrowRate * clusterTier;
  let strokeFrac = clamp(material.clusterStrokeWidth / max(clusterPixelSize, 1.0), 0.0, 0.49);
  let inner = 0.5 - strokeFrac;
  let fillMix = 1.0 - smoothstep(inner - aa, inner, dist);
  let edgeAlpha = 1.0 - smoothstep(0.5 - aa, 0.5, dist);
  let circleColor = mix(material.clusterStroke, fillColor, fillMix);

  let inDigitRegion = step(vMin, localV) * step(localV, vMax)
                    * step(startU, localU) * step(localU, startU + totalWidth)
                    * step(f32(digitIdx), f32(digitCount) - 0.5);
  let textAlpha = texColor.a * inDigitRegion * material.clusterText.a;

  let finalColor = mix(circleColor.rgb, material.clusterText.rgb, textAlpha);
  return vec4<f32>(finalColor, circleColor.a * edgeAlpha);
}

fn getDigitCount(n: u32) -> u32 {
  if (n >= 100000u) { return 6u; }
  if (n >= 10000u) { return 5u; }
  if (n >= 1000u) { return 4u; }
  if (n >= 100u) { return 3u; }
  if (n >= 10u) { return 2u; }
  return 1u;
}

fn getDigitAt(n: u32, digitCount: u32, idx: u32) -> u32 {
  var divisor = 1u;
  for (var i = 0u; i < digitCount - 1u - idx; i = i + 1u) {
    divisor = divisor * 10u;
  }
  return (n / divisor) % 10u;
}
`;function Ca(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=o,r=e.createBindGroupLayout({label:"cluster-globe-render-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{}}]}),n=e.createShaderModule({label:"cluster-globe-render-shader",code:wa}),s=e.createPipelineLayout({label:"cluster-globe-render-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"cluster-globe-render-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:"always"},multisample:{count:o.sampleCount??L}}),l=e.createSampler({label:"cluster-globe-digit-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,renderBindGroupLayout:r,sampler:l}}const Ma=`

// ─── Bindings ───
${q}
const ROOF_DEPTH_BIAS: f32 = 1e-4;
const WALL_DEPTH_BIAS: f32 = 2e-5;

struct ExtrusionMaterial {
  color: vec4<f32>,
  ambient: f32,
  debugMode: f32,
  animProgress: f32,
  animDuration: f32,
  waveOrigin: vec2<f32>,
  delayFactor: f32,
  bearing: f32,
  shininess: f32,
  specularStrength: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(1) @binding(0) var<uniform> material: ExtrusionMaterial;

fn easeOutCubic(t: f32) -> f32 {
  let inv = 1.0 - t;
  return 1.0 - inv * inv * inv;
}

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) centroid: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) debugData: vec3<f32>,
  @location(2) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.debugData = vec3<f32>(0.0, 0.0, 0.0);

  // XY comes in Mercator [0..1], convert back to EPSG:3857 for 2D camera
  let HALF_CIRCUMFERENCE: f32 = 20037508.34;
  let epsg = vec2<f32>(
    input.position.x * 2.0 * HALF_CIRCUMFERENCE - HALF_CIRCUMFERENCE,
    (1.0 - input.position.y) * 2.0 * HALF_CIRCUMFERENCE - HALF_CIRCUMFERENCE
  );

  // Oblique offset in EPSG:3857: shift roof by height to create 2.5D appearance.
  // Direction rotates with camera bearing so buildings lean consistently on screen.
  var h = input.position.z;

  // Grow animation: scale height by eased progress
  if (material.animDuration > 0.0) {
    let dist = distance(input.centroid, material.waveOrigin);
    let delay = dist * material.delayFactor;
    let rawT = clamp((material.animProgress - delay) / material.animDuration, 0.0, 1.0);
    let progress = easeOutCubic(rawT);
    h = h * progress;
  }

  // Rotation-aware oblique: offset direction follows camera bearing
  let obliqueMag: f32 = 0.5;
  let offsetDir = vec2<f32>(-sin(material.bearing), cos(material.bearing));
  let obliquePos = vec3<f32>(
    epsg.x + h * offsetDir.x * obliqueMag,
    epsg.y + h * offsetDir.y * obliqueMag,
    h,
  );

  out.clipPosition = camera.viewProjection * vec4<f32>(obliquePos, 1.0);
  out.worldPos = obliquePos;

  // Logarithmic depth remap: better distribution across height range.
  // Maps [0..1000+m] → [0.5..0.01] with log2 distribution so both
  // low (1-5m) and tall (500m+) buildings have adequate depth separation.
  let logH = log2(max(h, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  out.clipPosition.z = normalizedZ * out.clipPosition.w;

  // Roof triangles share their top edge positions with wall quads.
  // Bias them slightly toward the camera to avoid wall-vs-roof depth acne.
  if (input.normal.z > 0.5) {
    out.clipPosition.z -= ROOF_DEPTH_BIAS * out.clipPosition.w;
  }

  // Shared building edges can still generate coplanar wall depth ties.
  // Split ties deterministically by wall normal orientation.
  if (abs(input.normal.z) < 0.5) {
    let wallDot = input.normal.x * 0.70710677 + input.normal.y * 0.70710677;
    let wallDir = select(-1.0, 1.0, wallDot >= 0.0);
    out.clipPosition.z -= wallDir * WALL_DEPTH_BIAS * out.clipPosition.w;
  }

  // Debug data: normalizedZ, height in km, face type (0=wall, 0.5=floor, 1=roof)
  let faceType2d = select(0.0, select(0.5, 1.0, input.normal.z > 0.5), abs(input.normal.z) > 0.1);
  out.debugData = vec3<f32>(normalizedZ, h * 0.001, faceType2d);

  out.vNormal = input.normal;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Debug mode: visualize depth / height / face type as color
  if (material.debugMode > 0.5) {
    let depth = input.debugData.x;
    let faceType = input.debugData.z;
    // Depth gradient: green(far) → yellow → red(near camera)
    let t = clamp(1.0 - depth, 0.0, 1.0);
    var c = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), clamp(t * 2.0, 0.0, 1.0));
    c = mix(c, vec3<f32>(1.0, 0.0, 0.0), clamp(t * 2.0 - 1.0, 0.0, 1.0));
    if (faceType > 0.75) { c = mix(c, vec3<f32>(0.3, 0.3, 1.0), 0.4); }
    if (faceType > 0.25 && faceType < 0.75) { c = mix(c, vec3<f32>(0.8, 0.2, 0.8), 0.4); }
    return vec4<f32>(c, 0.9);
  }

  // Blinn-Phong directional lighting
  let lightDir = normalize(vec3<f32>(0.3, -0.5, 0.8));
  let normal = normalize(input.vNormal);
  let NdotL = max(dot(normal, lightDir), 0.0);

  // View direction: from above, rotated with camera bearing for consistent specular
  let viewDir = normalize(vec3<f32>(-sin(material.bearing), cos(material.bearing), 1.5));
  let halfDir = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfDir), 0.0);
  let specular = pow(NdotH, material.shininess) * material.specularStrength;

  let diffuse = (1.0 - material.ambient) * NdotL;
  let lit = material.ambient + diffuse + specular;
  let color = material.color.rgb * min(lit, 1.0);

  // Premultiplied alpha output
  return vec4<f32>(color * material.color.a, material.color.a);
}
`;function Sa(o){return o.createBindGroupLayout({label:"extrusion-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Ta(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=o,r=Sa(e),n=e.createShaderModule({label:"extrusion-shader",code:Ma}),s=e.createPipelineLayout({label:"extrusion-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"extrusion-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:32,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),materialBindGroupLayout:r}}function Ba(o){return o==="greater"||o==="greater-equal"?1:-1}function Fa(o){const e=Ba(o);return`

// ─── Bindings ───
${Ie}
${Cr}
const EARTH_RADIUS_M: f32 = 6378137.0;
const ROOF_DEPTH_BIAS: f32 = 1e-4;
const WALL_DEPTH_BIAS: f32 = 2e-5;
const EXTRUSION_SURFACE_BIAS: f32 = 5e-5;
const ROOF_DEPTH_BIAS_SIGN: f32 = ${e};
${Mr}

struct ExtrusionMaterial {
  color: vec4<f32>,
  ambient: f32,
  debugMode: f32,
  animProgress: f32,
  animDuration: f32,
  waveOrigin: vec2<f32>,
  delayFactor: f32,
  _reserved: f32,
  shininess: f32,
  specularStrength: f32,
  _pad1: f32,
  _pad2: f32,
  cameraPos: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: ExtrusionMaterial;

fn easeOutCubic(t: f32) -> f32 {
  let inv = 1.0 - t;
  return 1.0 - inv * inv * inv;
}

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) centroid: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) debugData: vec3<f32>,
  @location(2) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  var h = input.position.z;

  // Grow animation: scale height by eased progress
  if (material.animDuration > 0.0) {
    let dist = distance(input.centroid, material.waveOrigin);
    let delay = dist * material.delayFactor;
    let rawT = clamp((material.animProgress - delay) / material.animDuration, 0.0, 1.0);
    let progress = easeOutCubic(rawT);
    h = h * progress;
  }

  // XY already in Mercator [0..1] from CPU-side normalization
  let merc01 = input.position.xy;
  let ang = mercatorToAngular(merc01);
  let sphereBase = angularToSphere(ang.x, ang.y);

  // Radial height offset: position on sphere at (1 + h/R)
  let radius = 1.0 + h / EARTH_RADIUS_M;
  let worldPos = sphereBase * radius;
  out.worldPos = worldPos;

  // Globe tangent space: transform flat normal to globe space
  // East = d(sphere)/d(lon), North = d(sphere)/d(lat), Up = sphereBase
  let cosLat = cos(ang.y);
  let sinLat = sin(ang.y);
  let cosLon = cos(ang.x);
  let sinLon = sin(ang.x);

  let east = vec3<f32>(cosLon, 0.0, -sinLon);
  let north = vec3<f32>(-sinLat * sinLon, cosLat, -sinLat * cosLon);
  let up = sphereBase;

  // Transform flat normal (input.normal) to globe tangent space
  // flat.x → east, flat.y → north, flat.z → up
  let globeNormal = normalize(
    input.normal.x * east +
    input.normal.y * north +
    input.normal.z * up
  );
  out.vNormal = globeNormal;
  out.debugData = vec3<f32>(0.0, 0.0, 0.0);

  // Clip position (globe)
  // Height-aware depth: EXTRUSION_SURFACE_BIAS keeps all extrusion faces
  // above the globe surface in the depth buffer so wall depth bias
  // (which can be negative for some face orientations) never pushes
  // walls behind the raster tile surface.
  // heightBias adds per-vertex height offset for inter-face depth ordering.
  var globeClip = camera.viewProjection * vec4<f32>(worldPos, 1.0);
  let clipZ = globeClippingZ(sphereBase);
  let heightBias = h / EARTH_RADIUS_M;
  let effectiveClipZ = select(clipZ, min(clipZ + EXTRUSION_SURFACE_BIAS + heightBias, 0.9999), clipZ <= 1.0);
  globeClip.z = effectiveClipZ * globeClip.w;

  // Debug data: clipZ, height in km, face type (0=wall, 0.5=floor, 1=roof)
  let faceType = select(0.0, select(0.5, 1.0, input.normal.z > 0.5), abs(input.normal.z) > 0.1);
  out.debugData = vec3<f32>(clipZ, h * 0.001, faceType);

  // Flat/Mercator path: height scaled consistently with globe path (h / R).
  // Using EARTH_RADIUS_M (not circumference) gives ~6.28× taller buildings,
  // matching the globe path's visual scale and providing proper depth separation.
  let heightScale = h / EARTH_RADIUS_M;
  let flatPos = vec4<f32>(merc01.x, merc01.y, heightScale, 1.0);

  if (camera.projectionTransition >= 0.999) {
    out.clipPosition = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    out.clipPosition = camera.flatViewProjection * flatPos;
    // Flat VP has Scale(1,-1,1) Y-flip — correct normals to match
    out.vNormal = vec3<f32>(input.normal.x, -input.normal.y, input.normal.z);
    out.worldPos = flatPos.xyz;
  } else {
    var flatClip = camera.flatViewProjection * flatPos;
    out.clipPosition = mix(flatClip, globeClip, camera.projectionTransition);
    let flatNormal = vec3<f32>(input.normal.x, -input.normal.y, input.normal.z);
    out.vNormal = mix(flatNormal, globeNormal, camera.projectionTransition);
    out.worldPos = mix(flatPos.xyz, worldPos, camera.projectionTransition);
  }

  // Depth-aware roof bias:
  // - less/less-equal: negative Z moves closer to camera
  // - greater/greater-equal (reverse-Z): positive Z moves closer to camera
  if (input.normal.z > 0.5) {
    out.clipPosition.z += ROOF_DEPTH_BIAS_SIGN * ROOF_DEPTH_BIAS * out.clipPosition.w;
  }

  if (abs(input.normal.z) < 0.5) {
    let wallDot = input.normal.x * 0.70710677 + input.normal.y * 0.70710677;
    let wallDir = select(-1.0, 1.0, wallDot >= 0.0);
    out.clipPosition.z += ROOF_DEPTH_BIAS_SIGN * wallDir * WALL_DEPTH_BIAS * out.clipPosition.w;
  }

  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Debug mode: visualize clipZ / height / face type as color
  if (material.debugMode > 0.5) {
    let clipZ = input.debugData.x;
    let faceType = input.debugData.z;
    // Green(safe) → Yellow(mid) → Red(horizon risk)
    let t = clamp(clipZ, 0.0, 1.0);
    var c = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), clamp(t * 2.0, 0.0, 1.0));
    c = mix(c, vec3<f32>(1.0, 0.0, 0.0), clamp(t * 2.0 - 1.0, 0.0, 1.0));
    // Roof = blue tint, Floor = purple tint
    if (faceType > 0.75) { c = mix(c, vec3<f32>(0.3, 0.3, 1.0), 0.4); }
    if (faceType > 0.25 && faceType < 0.75) { c = mix(c, vec3<f32>(0.8, 0.2, 0.8), 0.4); }
    return vec4<f32>(c, 0.9);
  }

  // Blinn-Phong directional lighting
  let lightDir = normalize(vec3<f32>(0.3, -0.5, 0.8));
  let normal = normalize(input.vNormal);
  let NdotL = max(dot(normal, lightDir), 0.0);

  // View direction: globe path uses sphere-outward, flat path uses camera→point
  let globeViewDir = normalize(-input.worldPos);
  let flatViewDir = normalize(material.cameraPos.xyz - input.worldPos);
  let viewDir = normalize(mix(flatViewDir, globeViewDir, camera.projectionTransition));
  let halfDir = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfDir), 0.0);
  let specular = pow(NdotH, material.shininess) * material.specularStrength;

  let diffuse = (1.0 - material.ambient) * NdotL;
  let lit = material.ambient + diffuse + specular;
  let color = material.color.rgb * min(lit, 1.0);

  // Premultiplied alpha output
  return vec4<f32>(color * material.color.a, material.color.a);
}
`}function Ga(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=o,r=e.createBindGroupLayout({label:"globe-extrusion-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),n=e.createShaderModule({label:"globe-extrusion-shader",code:Fa(o.depthCompare)}),s=e.createPipelineLayout({label:"globe-extrusion-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"globe-extrusion-pipeline",layout:s,vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:32,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:o.depthFormat??"depth32float",depthWriteEnabled:!0,depthCompare:o.depthCompare??"greater"},multisample:{count:o.sampleCount??L}}),materialBindGroupLayout:r}}const Ea="modulepreload",La=function(o,e){return new URL(o,e).href},Oi={},Da=function(e,t,i){let r=Promise.resolve();if(t&&t.length>0){let s=function(d){return Promise.all(d.map(u=>Promise.resolve(u).then(h=>({status:"fulfilled",value:h}),h=>({status:"rejected",reason:h}))))};const a=document.getElementsByTagName("link"),l=document.querySelector("meta[property=csp-nonce]"),c=l?.nonce||l?.getAttribute("nonce");r=s(t.map(d=>{if(d=La(d,i),d in Oi)return;Oi[d]=!0;const u=d.endsWith(".css"),h=u?'[rel="stylesheet"]':"";if(!!i)for(let g=a.length-1;g>=0;g--){const x=a[g];if(x.href===d&&(!u||x.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${d}"]${h}`))return;const p=document.createElement("link");if(p.rel=u?"stylesheet":Ea,u||(p.as="script"),p.crossOrigin="",p.href=d,c&&p.setAttribute("nonce",c),document.head.appendChild(p),u)return new Promise((g,x)=>{p.addEventListener("load",g),p.addEventListener("error",()=>x(new Error(`Unable to preload CSS for ${d}`)))})}))}function n(s){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=s,window.dispatchEvent(a),!a.defaultPrevented)throw s}return r.then(s=>{for(const a of s||[])a.status==="rejected"&&n(a.reason);return e().catch(n)})};class Ra{constructor(e){this.ctx=e}pickingPipeline=null;ensurePickingPipeline(){if(!this.pickingPipeline){const e=this.ctx.canvas?.width||1,t=this.ctx.canvas?.height||1;this.pickingPipeline=ts({device:this.ctx.device,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,width:e,height:t,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc})}return this.pickingPipeline}async pick(e,t){if(!this.ctx.device||!this.ctx.cameraBindGroup||this.ctx.deviceLost)return null;const i=this.ensurePickingPipeline();if(e<0||e>=i.width||t<0||t>=i.height)return null;const r=this.ctx.device.createCommandEncoder({label:"picking-command-encoder"}),n=r.beginRenderPass({label:"picking-render-pass",colorAttachments:[{view:i.pickingTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:i.depthTexture.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});n.setPipeline(i.pipeline),n.setBindGroup(0,this.ctx.cameraBindGroup);let s=1;for(const p of this.ctx.pickingDrawCalls){const g=(s&255)/255,x=(s>>8&255)/255,v=(s>>16&255)/255,y=1/255,m=new Float32Array([g,x,v,y]),_=this.ctx.bufferPool.allocateWithData(m,GPUBufferUsage.UNIFORM,"transient"),w=this.ctx.device.createBindGroup({label:"picking-id-bind-group",layout:i.pickingBindGroupLayout,entries:[{binding:0,resource:{buffer:_}}]});n.setBindGroup(1,w),p.type==="points"?(n.setVertexBuffer(0,p.vertexBuffer),n.draw(p.vertexCount,p.instanceCount)):(n.setVertexBuffer(0,p.vertexBuffer),n.setIndexBuffer(p.indexBuffer,"uint32"),n.drawIndexed(p.indexCount)),s++}n.end(),r.copyTextureToBuffer({texture:i.pickingTexture,origin:{x:Math.floor(e),y:Math.floor(t)}},{buffer:i.readbackBuffer,bytesPerRow:256},{width:1,height:1}),this.ctx.device.queue.submit([r.finish()]),await i.readbackBuffer.mapAsync(GPUMapMode.READ);const a=new Uint8Array(i.readbackBuffer.getMappedRange(0,4)),l=a[0],c=a[1],d=a[2],u=a[3];i.readbackBuffer.unmap();const h=is(l,c,d,u);return h?{layerId:this.ctx.pickingDrawCalls[s-1]?.layerId??`layer-${h.layerIndex}`,featureId:h.featureId,screenX:e,screenY:t}:null}destroy(){this.pickingPipeline&&(this.pickingPipeline.pickingTexture.destroy(),this.pickingPipeline.depthTexture.destroy(),this.pickingPipeline.readbackBuffer.destroy(),this.pickingPipeline=null)}reset(){this.pickingPipeline=null}}const ue={enabled:!0,ambient:.5,diffuse:.85,shadowStrength:.2,shadowSoftness:.4,sunAzimuth:315,sunAltitude:45};class za{constructor(e){this.ctx=e}rasterPipeline=null;globeRasterPipeline=null;debugSuite2D=null;debugSuiteGlobe=null;initRasterPipeline(){this.ctx.device&&(this.rasterPipeline=Hn({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,sampleCount:this.ctx.sampleCount}))}ensureGlobeRasterPipeline(){return this.globeRasterPipeline||(this.ctx.ensureGlobeCameraResources(),this.globeRasterPipeline=Dn({device:this.ctx.device,colorFormat:this.ctx.colorFormat,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globeRasterPipeline}ensureDebugSuite2D(){return this.debugSuite2D||(this.debugSuite2D=zi({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,globe:!1,sampleCount:this.ctx.sampleCount})),this.debugSuite2D}ensureDebugSuiteGlobe(){return this.debugSuiteGlobe||(this.ctx.ensureGlobeCameraResources(),this.debugSuiteGlobe=zi({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,globe:!0,sampleCount:this.ctx.sampleCount})),this.debugSuiteGlobe}drawImagery(e){if(!this.ctx.device||!this.ctx.renderPass||!this.rasterPipeline||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const t=this.ctx.currentCamera?.position[0]??0,i=this.ctx.currentCamera?.position[1]??0,r=new Float32Array(8);r[0]=e.extent[0]-t,r[1]=e.extent[1]-i,r[2]=e.extent[2]-t,r[3]=e.extent[3]-i,r[4]=e.opacity,r[5]=e.filters?.brightness??1,r[6]=e.filters?.contrast??1,r[7]=e.filters?.saturate??1;const n=this.ctx.bufferPool.allocateWithData(r,GPUBufferUsage.UNIFORM,"transient"),s=this.ctx.device.createBindGroup({label:"raster-tile-bind-group",layout:this.rasterPipeline.rasterBindGroupLayout,entries:[{binding:0,resource:{buffer:n}},{binding:1,resource:this.rasterPipeline.sampler},{binding:2,resource:e.texture.createView()}]});this.ctx.renderPass.setPipeline(this.rasterPipeline.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,s),this.ctx.renderPass.draw(4),this.ctx.debugTileVertices&&this._drawDebugOverlay([e.extent[0]-t,e.extent[1]-i,e.extent[2]-t,e.extent[3]-i],!1)}drawGlobeTile(e){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const t=this.ensureGlobeRasterPipeline();this.ctx.ensureGlobeCameraWritten();const i=(e.heightMode??0)===1,r=e.terrainUvOffsetScale??[0,0,1,1],n=e.heightExaggeration??this.ctx.heightExaggeration,s={enabled:e.lighting3D?.enabled??ue.enabled,ambient:e.lighting3D?.ambient??ue.ambient,diffuse:e.lighting3D?.diffuse??ue.diffuse,shadowStrength:e.lighting3D?.shadowStrength??ue.shadowStrength,shadowSoftness:e.lighting3D?.shadowSoftness??ue.shadowSoftness,sunAzimuth:e.lighting3D?.sunAzimuth??ue.sunAzimuth,sunAltitude:e.lighting3D?.sunAltitude??ue.sunAltitude},a=new Float32Array(24);a[0]=e.mercatorExtent[0],a[1]=e.mercatorExtent[1],a[2]=e.mercatorExtent[2],a[3]=e.mercatorExtent[3],a[4]=e.opacity,a[5]=n,a[6]=i?1:0,a[7]=e.depthBias??0,a[8]=r[0],a[9]=r[1],a[10]=r[2],a[11]=r[3],a[12]=Math.max(0,Math.min(1,s.ambient)),a[13]=Math.max(0,Math.min(2,s.diffuse)),a[14]=Math.max(0,Math.min(1,s.shadowStrength)),a[15]=Math.max(0,Math.min(1,s.shadowSoftness)),a[16]=s.sunAzimuth,a[17]=Math.max(0,Math.min(89.9,s.sunAltitude)),a[18]=s.enabled?1:0,a[20]=e.filters?.brightness??1,a[21]=e.filters?.contrast??1,a[22]=e.filters?.saturate??1;const l=this.ctx.bufferPool.allocateWithData(a,GPUBufferUsage.UNIFORM,"transient"),c=this.ctx.device.createBindGroup({label:"globe-tile-bind-group",layout:t.globeTileBindGroupLayout,entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:t.sampler},{binding:2,resource:e.texture.createView()}]});let d=t.zeroHeightBindGroup;i?e.terrainHeightTexture&&(d=this.ctx.device.createBindGroup({label:"globe-terrain-height-bind-group",layout:t.heightBindGroupLayout,entries:[{binding:0,resource:e.terrainHeightTexture.createView()},{binding:1,resource:t.heightSampler}]})):d=this.ctx.heightBrush?.getBindGroup(this.ctx.device)??t.zeroHeightBindGroup,this.ctx.renderPass.setPipeline(t.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,c),this.ctx.renderPass.setBindGroup(2,d),this.ctx.renderPass.setVertexBuffer(0,t.subdivisionMesh.vertexBuffer),this.ctx.renderPass.setIndexBuffer(t.subdivisionMesh.indexBuffer,t.subdivisionMesh.vertexCount>65535?"uint32":"uint16"),this.ctx.renderPass.drawIndexed(t.subdivisionMesh.indexCount),this.ctx.debugTileVertices&&this._drawDebugOverlay(e.mercatorExtent,!0,{mode:i?1:0,exaggeration:n,terrainUvOffsetScale:r,terrainHeightTexture:e.terrainHeightTexture})}_drawDebugOverlay(e,t,i){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const r=t?this.ctx.globeCameraBindGroup:this.ctx.cameraBindGroup;if(!r)return;const n=t?this.ensureDebugSuiteGlobe():this.ensureDebugSuite2D(),s=new Float32Array(28);s[0]=e[0],s[1]=e[1],s[2]=e[2],s[3]=e[3],s[4]=$e[0],s[5]=$e[1],s[6]=$e[2],s[7]=$e[3],s[8]=Ye[0],s[9]=Ye[1],s[10]=Ye[2],s[11]=Ye[3],s[12]=Ke[0],s[13]=Ke[1],s[14]=Ke[2],s[15]=Ke[3],s[16]=_s,s[17]=bs,s[18]=i?.exaggeration??this.ctx.heightExaggeration,s[19]=n.mesh.subdivisions,s[20]=i?.mode??0,s[24]=i?.terrainUvOffsetScale[0]??0,s[25]=i?.terrainUvOffsetScale[1]??0,s[26]=i?.terrainUvOffsetScale[2]??1,s[27]=i?.terrainUvOffsetScale[3]??1;const a=this.ctx.bufferPool.allocateWithData(s,GPUBufferUsage.UNIFORM,"transient"),l=this.ctx.device.createBindGroup({label:"tile-debug-bind-group",layout:n.bindGroupLayout,entries:[{binding:0,resource:{buffer:a}}]});let c=n.zeroHeightBindGroup;t&&(i?.mode??0)===1?i?.terrainHeightTexture&&(c=this.ctx.device.createBindGroup({label:"tile-debug-terrain-height-bind-group",layout:n.heightBindGroupLayout,entries:[{binding:0,resource:i.terrainHeightTexture.createView()},{binding:1,resource:n.heightSampler}]})):c=this.ctx.heightBrush?.getBindGroup(this.ctx.device)??n.zeroHeightBindGroup;const u=this.ctx.renderPass,h=n.mesh.vertexCount>65535?"uint32":"uint16";u.setPipeline(n.wireframePipeline),u.setBindGroup(0,r),u.setBindGroup(1,l),u.setBindGroup(2,c),u.setVertexBuffer(0,n.mesh.vertexBuffer),u.setIndexBuffer(n.mesh.wireframeIndexBuffer,h),u.drawIndexed(n.mesh.wireframeIndexCount),u.setPipeline(n.borderPipeline),u.setBindGroup(0,r),u.setBindGroup(1,l),u.setBindGroup(2,c),u.draw(24),u.setPipeline(n.dotPipeline),u.setBindGroup(0,r),u.setBindGroup(1,l),u.setBindGroup(2,c),u.setVertexBuffer(0,n.quadBuffer),u.setVertexBuffer(1,n.mesh.vertexBuffer),u.draw(6,n.mesh.vertexCount)}destroy(){this.rasterPipeline=null,this.globeRasterPipeline=null,this.debugSuite2D=null,this.debugSuiteGlobe=null}reset(){this.rasterPipeline=null,this.globeRasterPipeline=null,this.debugSuite2D=null,this.debugSuiteGlobe=null}}function lt(o,e,t){const i=t.dashArray;if(!i||i.length===0)return;const r=Math.min(i.length,8);let n=0;for(let s=0;s<r;s++){const a=i[s]??0;o[e+s]=a,n+=a}o[e+8]=r,o[e+9]=n}function A(o,e,t,i,r,n){let s=e.get(t);const a=n||!s;if(!s){const l=o.bufferPool.allocate(i.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,"persistent");l.label=`${r}:${t}`,s={buffer:l,resourceId:`buf-${l.label??`${r}:${t}`}`},e.set(t,s)}return a&&o.device.queue.writeBuffer(s.buffer,0,i.buffer,i.byteOffset,i.byteLength),s}function I(o,e,t,i){return o.bindGroupCache?.getOrCreate({pipelineId:e,resourceIds:t},i)??i()}function N(o,e){for(const{buffer:t}of e.values())o.bufferPool?.release(t);e.clear()}class Br{textureResourceIds=new WeakMap;nextTextureResourceId=0;getResourceId(e,t){let i=this.textureResourceIds.get(e);if(!i){const r=e.label?`:${e.label}`:"";i=`tex-${t}-${++this.nextTextureResourceId}${r}`,this.textureResourceIds.set(e,i)}return i}}class Aa{constructor(e,t){this.ctx=e,this.getIconAtlas=t}globePointPipeline=null;globeLinePipeline=null;globePolygonPipeline=null;skyPipeline=null;poleCapPipeline=null;atmospherePipeline=null;globeIconPipeline=null;pointMaterials=new Map;lineMaterials=new Map;polygonMaterials=new Map;iconMaterials=new Map;skyBackgroundMaterials=new Map;skyVolumetricMaterials=new Map;atmosphereMaterials=new Map;poleCapMaterials=new Map;textureResourceRegistry=new Br;ensureGlobePointPipeline(){return this.globePointPipeline||(this.ctx.ensureGlobeCameraResources(),this.globePointPipeline=ds({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globePointPipeline}ensureGlobeLinePipeline(){return this.globeLinePipeline||(this.ctx.ensureGlobeCameraResources(),this.globeLinePipeline=ms({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globeLinePipeline}ensureGlobePolygonPipeline(){return this.globePolygonPipeline||(this.ctx.ensureGlobeCameraResources(),this.globePolygonPipeline=vs({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globePolygonPipeline}ensurePoleCapPipeline(){return this.poleCapPipeline||(this.ctx.ensureGlobeCameraResources(),this.poleCapPipeline=Rs({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.poleCapPipeline}ensureSkyPipeline(){return this.skyPipeline||(this.ctx.ensureGlobeCameraResources(),this.skyPipeline=Ws({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,sampleCount:this.ctx.sampleCount})),this.skyPipeline}ensureAtmospherePipeline(){return this.atmospherePipeline||(this.ctx.ensureGlobeCameraResources(),this.atmospherePipeline=ks({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,sampleCount:this.ctx.sampleCount})),this.atmospherePipeline}ensureGlobeIconPipeline(){return this.globeIconPipeline||(this.ctx.ensureGlobeCameraResources(),this.globeIconPipeline=Ks({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globeIconPipeline}drawSky(e,t=45,i=315){if(!this.ctx.device||!this.ctx.backgroundPass||!this.ctx.bufferPool||!this.ctx.currentCamera)return;const r=this.ensureSkyPipeline();this.ctx.ensureGlobeCameraWritten();const n=this.buildSkyRenderState(e,{sunAltitude:t,sunAzimuth:i}),s=this.createSkyBackgroundUniformData(n),a=this.createSkyVolumetricUniformData(n),l=A(this.ctx,this.skyBackgroundMaterials,"background",s,"sky-background-material",!0),c=A(this.ctx,this.skyVolumetricMaterials,"volumetric",a,"sky-volumetric-material",!0),d=I(this.ctx,"sky:default",[l.resourceId,c.resourceId],()=>this.ctx.device.createBindGroup({label:"sky-bind-group",layout:r.skyBindGroupLayout,entries:[{binding:0,resource:{buffer:l.buffer}},{binding:1,resource:{buffer:c.buffer}}]}));this.ctx.backgroundPass.setPipeline(r.pipeline),this.ctx.backgroundPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.backgroundPass.setBindGroup(1,d),this.ctx.backgroundPass.draw(3)}drawGlobePoints(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;if(t.type==="icon"&&t.src){this._drawGlobeIconPoints(e,t);return}const i=this.ensureGlobePointPipeline();if(this.ctx.ensureGlobeCameraWritten(),t.glowColor&&t.glowSize&&t.glowSize>0){const l=new Float32Array(12);l[0]=t.glowColor[0]/255,l[1]=t.glowColor[1]/255,l[2]=t.glowColor[2]/255,l[3]=t.glowColor[3]/255*.35,l[8]=t.size+t.glowSize*2,l[9]=0,l[10]=0,l[11]=1;const c=`glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`,d=A(this.ctx,this.pointMaterials,c,l,"globe-point-material",!1),u=I(this.ctx,`globe-point:${c}`,[d.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-point-glow-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:d.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,u),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}const r=new Float32Array(12);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255,r[4]=(t.outlineColor?.[0]??0)/255,r[5]=(t.outlineColor?.[1]??0)/255,r[6]=(t.outlineColor?.[2]??0)/255,r[7]=(t.outlineColor?.[3]??255)/255,r[8]=t.size,r[9]=t.outlineWidth??0,r[10]=0,r[11]=0;const n=[t.color.join(","),t.outlineColor?.join(",")??"",t.size,t.outlineWidth??0].join(":"),s=A(this.ctx,this.pointMaterials,n,r,"globe-point-material",!1),a=I(this.ctx,`globe-point:${n}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-point-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}drawGlobeLines(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const i=this.ensureGlobeLinePipeline();if(this.ctx.ensureGlobeCameraWritten(),t.glowColor&&t.glowWidth&&t.glowWidth>0){const l=new Float32Array(20);l[0]=t.glowColor[0]/255,l[1]=t.glowColor[1]/255,l[2]=t.glowColor[2]/255,l[3]=t.glowColor[3]/255*.35,l[4]=t.width+t.glowWidth*2,l[5]=at(t.style),l[6]=t.dashAnimationSpeed??0,l[7]=this.ctx.frameTime,lt(l,8,t);const c=["glow",t.glowColor.join(","),t.width,t.glowWidth,t.style,t.dashArray?.join(",")??"",t.dashAnimationSpeed??0].join(":"),d=A(this.ctx,this.lineMaterials,c,l,"globe-line-material",(t.dashAnimationSpeed??0)!==0),u=I(this.ctx,`globe-line:${c}`,[d.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-line-glow-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:d.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,u),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}const r=new Float32Array(20);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255,r[4]=t.width,r[5]=at(t.style),r[6]=t.dashAnimationSpeed??0,r[7]=this.ctx.frameTime,lt(r,8,t);const n=[t.color.join(","),t.width,t.style,t.dashArray?.join(",")??"",t.dashAnimationSpeed??0].join(":"),s=A(this.ctx,this.lineMaterials,n,r,"globe-line-material",(t.dashAnimationSpeed??0)!==0),a=I(this.ctx,`globe-line:${n}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-line-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}drawGlobePolygons(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const i=this.ensureGlobePolygonPipeline();this.ctx.ensureGlobeCameraWritten();const r=new Float32Array(4);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255;const n=t.color.join(","),s=A(this.ctx,this.polygonMaterials,n,r,"globe-polygon-material",!1),a=I(this.ctx,`globe-polygon:${n}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-polygon-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}drawPoleCaps(e){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const t=this.ensurePoleCapPipeline();this.ctx.ensureGlobeCameraWritten();const i=new Float32Array(4);i[0]=e[0],i[1]=e[1],i[2]=e[2],i[3]=e[3];const r=A(this.ctx,this.poleCapMaterials,"default",i,"pole-cap-material",!0),n=I(this.ctx,"pole-cap:default",[r.resourceId],()=>this.ctx.device.createBindGroup({label:"pole-cap-color-bind-group",layout:t.poleCapBindGroupLayout,entries:[{binding:0,resource:{buffer:r.buffer}}]}));this.ctx.renderPass.setPipeline(t.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,n),this.ctx.renderPass.setVertexBuffer(0,t.mesh.vertexBuffer),this.ctx.renderPass.setIndexBuffer(t.mesh.indexBuffer,"uint16"),this.ctx.renderPass.drawIndexed(t.mesh.indexCount)}drawAtmosphere(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const i=this.ensureAtmospherePipeline();this.ctx.ensureGlobeCameraWritten();const r=new Float32Array(12),n=t?.colorInner??[.35,.55,1,1];r[0]=n[0],r[1]=n[1],r[2]=n[2],r[3]=n[3];const s=t?.colorOuter??[.6,.85,1,1];r[4]=s[0],r[5]=s[1],r[6]=s[2],r[7]=s[3],r[8]=e*(t?.strength??1),r[9]=t?.falloff??1.5;const a=A(this.ctx,this.atmosphereMaterials,"default",r,"atmosphere-material",!0),l=I(this.ctx,"atmosphere:default",[a.resourceId],()=>this.ctx.device.createBindGroup({label:"atmosphere-bind-group",layout:i.atmosphereBindGroupLayout,entries:[{binding:0,resource:{buffer:a.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,l),this.ctx.renderPass.setVertexBuffer(0,i.mesh.vertexBuffer),this.ctx.renderPass.setIndexBuffer(i.mesh.indexBuffer,i.mesh.vertexCount>65535?"uint32":"uint16"),this.ctx.renderPass.drawIndexed(i.mesh.indexCount)}_drawGlobeIconPoints(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const i=this.getIconAtlas(),r=i.getSprite(t.src);if(!r)return;const n=i.getTexture();if(!n)return;if(this.ctx.ensureGlobeCameraWritten(),t.glowColor&&t.glowSize&&t.glowSize>0){const p=this.ensureGlobePointPipeline(),g=new Float32Array(12);g[0]=t.glowColor[0]/255,g[1]=t.glowColor[1]/255,g[2]=t.glowColor[2]/255,g[3]=t.glowColor[3]/255*.35,g[8]=t.size+t.glowSize*2,g[9]=0,g[10]=0,g[11]=1;const x=`icon-glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`,v=A(this.ctx,this.pointMaterials,x,g,"globe-point-material",!1),y=I(this.ctx,`globe-icon-glow:${x}`,[v.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-icon-glow-bind-group",layout:p.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:v.buffer}}]}));this.ctx.renderPass.setPipeline(p.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,y),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}const s=this.ensureGlobeIconPipeline(),a=new Float32Array(20);a[0]=t.color[0]/255,a[1]=t.color[1]/255,a[2]=t.color[2]/255,a[3]=t.color[3]/255,a[4]=r.uv[0],a[5]=r.uv[1],a[6]=r.uv[2],a[7]=r.uv[3],a[8]=t.size,a[9]=t.rotation??0,a[10]=(t.backgroundSize??0)/2,a[11]=t.outlineWidth??0;const l=t.backgroundColor;a[12]=l?l[0]/255:0,a[13]=l?l[1]/255:0,a[14]=l?l[2]/255:0,a[15]=l?l[3]/255:0;const c=t.outlineColor;a[16]=c?c[0]/255:0,a[17]=c?c[1]/255:0,a[18]=c?c[2]/255:0,a[19]=c?c[3]/255:0;const d=[t.src??"",t.color.join(","),t.size,t.rotation??0,t.backgroundColor?.join(",")??"",t.backgroundSize??0,t.outlineColor?.join(",")??"",t.outlineWidth??0,r.uv.join(",")].join(":"),u=A(this.ctx,this.iconMaterials,d,a,"globe-icon-material",!1),h=this.textureResourceRegistry.getResourceId(n,"sprite-atlas-texture"),f=I(this.ctx,`globe-icon:${d}`,[u.resourceId,h],()=>this.ctx.device.createBindGroup({label:"globe-icon-material-bind-group",layout:s.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:u.buffer}},{binding:1,resource:s.sampler},{binding:2,resource:n.createView()}]}));this.ctx.renderPass.setPipeline(s.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,f),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}destroy(){this.globePointPipeline=null,this.globeLinePipeline=null,this.globePolygonPipeline=null,this.skyPipeline=null,this.poleCapPipeline=null,this.atmospherePipeline=null,this.globeIconPipeline=null,N(this.ctx,this.pointMaterials),N(this.ctx,this.lineMaterials),N(this.ctx,this.polygonMaterials),N(this.ctx,this.iconMaterials),N(this.ctx,this.skyBackgroundMaterials),N(this.ctx,this.skyVolumetricMaterials),N(this.ctx,this.atmosphereMaterials),N(this.ctx,this.poleCapMaterials)}reset(){this.destroy()}buildSkyRenderState(e,t){return{background:e,sunAltitude:t.sunAltitude,sunAzimuth:t.sunAzimuth,clouds:null}}createSkyBackgroundUniformData(e){const t=this.ctx.currentCamera,i=Ia(t),r=Ua(t),n=new Float32Array(Vs);return n.set(i,0),n.set(r,16),n.set(e.background.horizonColor,32),n.set(e.background.zenithColor,36),n.set(e.background.spaceColor,40),n[44]=e.background.horizonBlend,n[45]=e.background.verticalFalloff,n[46]=e.background.starIntensity,n[47]=e.background.starDensity,n[48]=e.background.starSeed,n[49]=e.sunAltitude,n[50]=e.sunAzimuth,n[51]=e.background.syncWithLighting?1:0,n}createSkyVolumetricUniformData(e){const t=new Float32Array(Os);return t[0]=e.clouds?.coverage??0,t[1]=e.clouds?.opacity??0,t[2]=e.clouds?.layerHeight??0,t}}function Ia(o){const e=st(o.projectionMatrix,o.viewMatrix);return Fr(e)}function Ua(o){return o.flatViewProjectionMatrix?Fr(o.flatViewProjectionMatrix):Gr()}function Fr(o){return zn(o)??Gr()}function Gr(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}class ka{constructor(e,t){this.ctx=e,this.getIconAtlas=t}pointPipeline=null;linePipeline=null;polygonPipeline=null;textPipeline=null;postProcessPipeline=null;iconPipeline=null;pointMaterials=new Map;lineMaterials=new Map;polygonMaterials=new Map;textMaterials=new Map;iconMaterials=new Map;postProcessMaterials=new Map;textureResourceRegistry=new Br;ensurePointPipeline(){return this.pointPipeline||(this.pointPipeline=jn({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.pointPipeline}ensureLinePipeline(){return this.linePipeline||(this.linePipeline=Yn({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.linePipeline}ensurePolygonPipeline(){return this.polygonPipeline||(this.polygonPipeline=Qn({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.polygonPipeline}ensureTextPipeline(){return this.textPipeline||(this.textPipeline=ns({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.textPipeline}ensurePostProcessPipeline(){return this.postProcessPipeline||(this.postProcessPipeline=ls({device:this.ctx.device,colorFormat:this.ctx.colorFormat,sampleCount:this.ctx.sampleCount})),this.postProcessPipeline}ensureIconPipeline(){return this.iconPipeline||(this.iconPipeline=Xs({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.iconPipeline}drawPoints(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;if(t.type==="icon"&&t.src){this._drawIconPoints(e,t);return}const i=this.ensurePointPipeline();if(t.glowColor&&t.glowSize&&t.glowSize>0){const l=new Float32Array(12);l[0]=t.glowColor[0]/255,l[1]=t.glowColor[1]/255,l[2]=t.glowColor[2]/255,l[3]=t.glowColor[3]/255*.35,l[8]=t.size+t.glowSize*2,l[9]=0,l[10]=0,l[11]=1;const c=`glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`,d=A(this.ctx,this.pointMaterials,c,l,"point-material",!1),u=I(this.ctx,`point:${c}`,[d.resourceId],()=>this.ctx.device.createBindGroup({label:"point-glow-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:d.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,u),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}const r=new Float32Array(12);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255,r[4]=(t.outlineColor?.[0]??0)/255,r[5]=(t.outlineColor?.[1]??0)/255,r[6]=(t.outlineColor?.[2]??0)/255,r[7]=(t.outlineColor?.[3]??255)/255,r[8]=t.size,r[9]=t.outlineWidth??0,r[10]=(t.type==="simple-marker",0),r[11]=0;const n=[t.color.join(","),t.outlineColor?.join(",")??"",t.size,t.outlineWidth??0].join(":"),s=A(this.ctx,this.pointMaterials,n,r,"point-material",!1),a=I(this.ctx,`point:${n}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"point-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}drawLines(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const i=this.ensureLinePipeline();if(t.glowColor&&t.glowWidth&&t.glowWidth>0){const l=new Float32Array(20);l[0]=t.glowColor[0]/255,l[1]=t.glowColor[1]/255,l[2]=t.glowColor[2]/255,l[3]=t.glowColor[3]/255*.35,l[4]=t.width+t.glowWidth*2,l[5]=at(t.style),l[6]=t.dashAnimationSpeed??0,l[7]=this.ctx.frameTime,lt(l,8,t);const c=["glow",t.glowColor.join(","),t.width,t.glowWidth,t.style,t.dashArray?.join(",")??"",t.dashAnimationSpeed??0].join(":"),d=A(this.ctx,this.lineMaterials,c,l,"line-material",(t.dashAnimationSpeed??0)!==0),u=I(this.ctx,`line:${c}`,[d.resourceId],()=>this.ctx.device.createBindGroup({label:"line-glow-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:d.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,u),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}const r=new Float32Array(20);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255,r[4]=t.width,r[5]=at(t.style),r[6]=t.dashAnimationSpeed??0,r[7]=this.ctx.frameTime,lt(r,8,t);const n=[t.color.join(","),t.width,t.style,t.dashArray?.join(",")??"",t.dashAnimationSpeed??0].join(":"),s=A(this.ctx,this.lineMaterials,n,r,"line-material",(t.dashAnimationSpeed??0)!==0),a=I(this.ctx,`line:${n}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"line-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount),this.ctx.pickingDrawCalls.push({type:"indexed",vertexBuffer:e.vertexBuffer,indexBuffer:e.indexBuffer,indexCount:e.indexCount,layerId:this.ctx.currentLayerId})}drawPolygons(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const i=this.ensurePolygonPipeline(),r=new Float32Array(4);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255;const n=t.color.join(","),s=A(this.ctx,this.polygonMaterials,n,r,"polygon-material",!1),a=I(this.ctx,`polygon:${n}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"polygon-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount),this.ctx.pickingDrawCalls.push({type:"indexed",vertexBuffer:e.vertexBuffer,indexBuffer:e.indexBuffer,indexCount:e.indexCount,layerId:this.ctx.currentLayerId})}drawText(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const i=this.ensureTextPipeline(),r=new Float32Array(12);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255,r[4]=(t.haloColor?.[0]??0)/255,r[5]=(t.haloColor?.[1]??0)/255,r[6]=(t.haloColor?.[2]??0)/255,r[7]=(t.haloColor?.[3]??255)/255,r[8]=t.fontSize,r[9]=t.haloWidth??0;const n={center:0,left:1,right:2,top:3,bottom:4};r[10]=n[t.anchor]??0,r[11]=0;const s=[t.color.join(","),t.haloColor?.join(",")??"",t.fontSize,t.haloWidth??0,t.anchor].join(":"),a=A(this.ctx,this.textMaterials,s,r,"text-material",!1),l=this.ctx.placeholderTexture,c=this.textureResourceRegistry.getResourceId(l,"placeholder-texture"),d=I(this.ctx,`text:${s}`,[a.resourceId,c],()=>this.ctx.device.createBindGroup({label:"text-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:a.buffer}},{binding:1,resource:i.sampler},{binding:2,resource:l.createView()}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,d),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}drawPostProcess(e){if(!this.ctx.device||!this.ctx.context||!this.ctx.bufferPool)return;const t=this.ensurePostProcessPipeline(),i=this.ctx.canvas?.width||1,r=this.ctx.canvas?.height||1,n=new Float32Array(4);n[0]=1/i,n[1]=1/r,n[2]=.75,n[3]=0;const s=A(this.ctx,this.postProcessMaterials,"default",n,"post-process-material",!0),a=this.textureResourceRegistry.getResourceId(e,"post-process-scene"),l=I(this.ctx,`post-process:${i}x${r}`,[s.resourceId,a],()=>this.ctx.device.createBindGroup({label:"post-process-bind-group",layout:t.bindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}},{binding:1,resource:t.sampler},{binding:2,resource:e.createView()}]})),c=this.ctx.device.createCommandEncoder({label:"post-process-encoder"}),d=this.ctx.context.getCurrentTexture().createView(),u=c.beginRenderPass({label:"post-process-pass",colorAttachments:[{view:d,loadOp:"load",storeOp:"store"}]});u.setPipeline(t.pipeline),u.setBindGroup(0,l),u.draw(4),u.end(),this.ctx.device.queue.submit([c.finish()])}_drawIconPoints(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const i=this.getIconAtlas(),r=i.getSprite(t.src);if(!r)return;const n=i.getTexture();if(!n)return;if(t.glowColor&&t.glowSize&&t.glowSize>0){const p=this.ensurePointPipeline(),g=new Float32Array(12);g[0]=t.glowColor[0]/255,g[1]=t.glowColor[1]/255,g[2]=t.glowColor[2]/255,g[3]=t.glowColor[3]/255*.35,g[8]=t.size+t.glowSize*2,g[9]=0,g[10]=0,g[11]=1;const x=`icon-glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`,v=A(this.ctx,this.pointMaterials,x,g,"point-material",!1),y=I(this.ctx,`icon-glow:${x}`,[v.resourceId],()=>this.ctx.device.createBindGroup({label:"icon-glow-bind-group",layout:p.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:v.buffer}}]}));this.ctx.renderPass.setPipeline(p.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,y),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}const s=this.ensureIconPipeline(),a=new Float32Array(20);a[0]=t.color[0]/255,a[1]=t.color[1]/255,a[2]=t.color[2]/255,a[3]=t.color[3]/255,a[4]=r.uv[0],a[5]=r.uv[1],a[6]=r.uv[2],a[7]=r.uv[3],a[8]=t.size,a[9]=t.rotation??0,a[10]=(t.backgroundSize??0)/2,a[11]=t.outlineWidth??0;const l=t.backgroundColor;a[12]=l?l[0]/255:0,a[13]=l?l[1]/255:0,a[14]=l?l[2]/255:0,a[15]=l?l[3]/255:0;const c=t.outlineColor;a[16]=c?c[0]/255:0,a[17]=c?c[1]/255:0,a[18]=c?c[2]/255:0,a[19]=c?c[3]/255:0;const d=[t.src??"",t.color.join(","),t.size,t.rotation??0,t.backgroundColor?.join(",")??"",t.backgroundSize??0,t.outlineColor?.join(",")??"",t.outlineWidth??0,r.uv.join(",")].join(":"),u=A(this.ctx,this.iconMaterials,d,a,"icon-material",!1),h=this.textureResourceRegistry.getResourceId(n,"sprite-atlas-texture"),f=I(this.ctx,`icon:${d}`,[u.resourceId,h],()=>this.ctx.device.createBindGroup({label:"icon-material-bind-group",layout:s.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:u.buffer}},{binding:1,resource:s.sampler},{binding:2,resource:n.createView()}]}));this.ctx.renderPass.setPipeline(s.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,f),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}loadIcon(e,t){if(!this.ctx.device)return;const i=this.getIconAtlas(),n=new OffscreenCanvas(t.width,t.height).getContext("2d");n.drawImage(t,0,0);const s=n.getImageData(0,0,t.width,t.height),a=new Uint8Array(s.data.buffer);i.addSprite(e,a,t.width,t.height)}destroy(){this.pointPipeline=null,this.linePipeline=null,this.polygonPipeline=null,this.textPipeline=null,this.postProcessPipeline=null,this.iconPipeline=null,N(this.ctx,this.pointMaterials),N(this.ctx,this.lineMaterials),N(this.ctx,this.polygonMaterials),N(this.ctx,this.textMaterials),N(this.ctx,this.iconMaterials),N(this.ctx,this.postProcessMaterials)}reset(){this.destroy()}}class Va{constructor(e){this.ctx=e}modelPipeline=null;globeModelPipeline=null;modelManager=null;ensureModelPipeline(){return this.modelPipeline||(this.modelPipeline=ea({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.modelPipeline}ensureGlobeModelPipeline(){return this.globeModelPipeline||(this.ctx.ensureGlobeCameraResources(),this.globeModelPipeline=ra({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globeModelPipeline}ensureModelManager(){return this.modelManager||(this.modelManager=new oa(this.ctx.device)),this.modelManager}async loadModel(e,t){if(!this.ctx.device)return;const i=this.ensureModelManager();if(i.has(e))return;const r=t instanceof ArrayBuffer?ma(t):ga(t.json,t.buffers);r.primitives.some(s=>s.imageData.size>0)?await i.uploadAsync(e,r):i.upload(e,r)}drawModels(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const r=this.ensureModelManager().get(t.modelId);if(!r)return;const n=this.ensureModelPipeline(),s=t.tintColor??[255,255,255,255];for(const a of r.primitives){const l=this._createMaterialBindGroup(a,s,n.materialBindGroupLayout,n.sampler);this.ctx.renderPass.setPipeline(n.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,l),this.ctx.renderPass.setVertexBuffer(0,a.vertexBuffer),this.ctx.renderPass.setVertexBuffer(1,e.instanceBuffer),this.ctx.renderPass.setIndexBuffer(a.indexBuffer,a.indexFormat),this.ctx.renderPass.drawIndexed(a.indexCount,e.instanceCount)}}drawGlobeModels(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const r=this.ensureModelManager().get(t.modelId);if(!r)return;const n=this.ensureGlobeModelPipeline();this.ctx.ensureGlobeCameraWritten();const s=t.tintColor??[255,255,255,255];for(const a of r.primitives){const l=this._createMaterialBindGroup(a,s,n.materialBindGroupLayout,n.sampler);this.ctx.renderPass.setPipeline(n.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,l),this.ctx.renderPass.setVertexBuffer(0,a.vertexBuffer),this.ctx.renderPass.setVertexBuffer(1,e.instanceBuffer),this.ctx.renderPass.setIndexBuffer(a.indexBuffer,a.indexFormat),this.ctx.renderPass.drawIndexed(a.indexCount,e.instanceCount)}}destroy(){this.modelPipeline=null,this.globeModelPipeline=null,this.modelManager?.destroy(),this.modelManager=null}reset(){this.modelPipeline=null,this.globeModelPipeline=null,this.modelManager?.destroy(),this.modelManager=null}_createMaterialBindGroup(e,t,i,r){const n=e.material,s=this.ctx.placeholderTexture,a=new Float32Array(20);a[0]=n.baseColorFactor[0],a[1]=n.baseColorFactor[1],a[2]=n.baseColorFactor[2],a[3]=n.baseColorFactor[3],a[4]=t[0]/255,a[5]=t[1]/255,a[6]=t[2]/255,a[7]=t[3]/255,a[8]=n.emissiveFactor[0],a[9]=n.emissiveFactor[1],a[10]=n.emissiveFactor[2],a[11]=n.metallicFactor,a[12]=n.roughnessFactor,a[13]=e.baseColorTexture?1:0,a[14]=e.normalTexture?1:0,a[15]=e.metallicRoughnessTexture?1:0,a[16]=e.occlusionTexture?1:0,a[17]=e.emissiveTexture?1:0,a[18]=n.alphaMode==="MASK"?n.alphaCutoff:0,a[19]=n.unlit?1:0;const l=this.ctx.bufferPool.allocateWithData(a,GPUBufferUsage.UNIFORM,"transient");return this.ctx.device.createBindGroup({label:"model-material-bind-group",layout:i,entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:r},{binding:2,resource:(e.baseColorTexture??s).createView()},{binding:3,resource:(e.normalTexture??s).createView()},{binding:4,resource:(e.metallicRoughnessTexture??s).createView()},{binding:5,resource:(e.occlusionTexture??s).createView()},{binding:6,resource:(e.emissiveTexture??s).createView()}]})}}class Oa{constructor(e){this.ctx=e}customPipelines=new Map;customPipelineErrors=new Set;_customDrawDbgCount=0;drawCustom(e){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool||this.customPipelineErrors.has(e.pipelineKey))return;e.useGlobeCamera&&!this.ctx.globeCameraBindGroupLayout&&this.ctx.ensureGlobeCameraResources();let t=this.customPipelines.get(e.pipelineKey);if(t)this._customDrawDbgCount<3&&console.log("[CP3-PIPE]",{pipelineKey:e.pipelineKey,cached:!0,useGlobeCamera:e.useGlobeCamera});else try{const l=e.useGlobeCamera&&this.ctx.globeCameraBindGroupLayout?this.ctx.globeCameraBindGroupLayout:this.ctx.cameraBindGroupLayout;this._customDrawDbgCount<3&&(console.log("[CP3-PIPE]",{pipelineKey:e.pipelineKey,cached:!1,useGlobeCamera:e.useGlobeCamera}),console.log("[CP3-CAM]",{globeLayout:!!(e.useGlobeCamera&&this.ctx.globeCameraBindGroupLayout),camLayoutLabel:l.label??"n/a"}),console.log("[CP3-BLEND]",JSON.stringify(e.blendState))),t=qs({device:this.ctx.device,colorFormat:this.ctx.colorFormat,depthFormat:this.ctx.depthConfig.format,cameraBindGroupLayout:l,shaderSource:e.shaderSource,vertexBufferLayouts:e.vertexBufferLayouts,topology:e.topology??"triangle-list",hasCustomUniforms:e.customUniforms!==null,hasTexture:e.textures.length>0,blendState:e.blendState,sampleCount:this.ctx.sampleCount}),this.customPipelines.set(e.pipelineKey,t)}catch(l){console.error(`[mapgpu] Custom pipeline creation failed for key "${e.pipelineKey}":`,l),console.error("[CP3-ERR]",l),this.customPipelineErrors.add(e.pipelineKey);return}const i=this.ctx.bufferPool.allocateWithData(e.frameUniforms,GPUBufferUsage.UNIFORM,"transient"),r=this.ctx.device.createBindGroup({label:"custom-frame-bind-group",layout:t.frameBindGroupLayout,entries:[{binding:0,resource:{buffer:i}}]});let n=null;if(e.customUniforms&&t.customBindGroupLayout){const l=e.customUniforms instanceof Float32Array?e.customUniforms:new Float32Array(e.customUniforms),c=this.ctx.bufferPool.allocateWithData(l,GPUBufferUsage.UNIFORM,"transient");n=this.ctx.device.createBindGroup({label:"custom-user-bind-group",layout:t.customBindGroupLayout,entries:[{binding:0,resource:{buffer:c}}]})}let s=null;if(e.textures.length>0&&t.textureBindGroupLayout){const l=e.textures[0],c=this.ctx.device.createSampler(l.sampler??{magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});s=this.ctx.device.createBindGroup({label:"custom-texture-bind-group",layout:t.textureBindGroupLayout,entries:[{binding:0,resource:c},{binding:1,resource:l.texture.createView()}]})}this.ctx.renderPass.setPipeline(t.pipeline),e.useGlobeCamera&&this.ctx.globeCameraBindGroup?(this.ctx.ensureGlobeCameraWritten(),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup)):this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,r);let a=2;if(t.customBindGroupLayout&&(n&&this.ctx.renderPass.setBindGroup(a,n),a++),t.textureBindGroupLayout){if(!t.customBindGroupLayout){const l=this.ctx.device.createBindGroupLayout({label:"custom-empty-placeholder",entries:[]}),c=this.ctx.device.createBindGroup({label:"custom-empty-bind-group",layout:l,entries:[]});this.ctx.renderPass.setBindGroup(2,c),a=3}s&&this.ctx.renderPass.setBindGroup(a,s)}this._customDrawDbgCount<3&&(console.log("[CP4-BIND]",{group0:e.useGlobeCamera?"globe":"flat",group1_frameSize:e.frameUniforms.byteLength,group2_customSize:e.customUniforms?(e.customUniforms instanceof ArrayBuffer,e.customUniforms.byteLength):null,group3_texture:e.textures.length>0?"yes":null}),console.log("[CP4-VB]",{bufferCount:e.vertexBuffers.length,bufferSizes:e.vertexBuffers.map(l=>l.size)}),console.log("[CP4-IB]",{hasIndex:!!e.indexBuffer,indexCount:e.indexCount,indexFormat:e.indexFormat}));for(let l=0;l<e.vertexBuffers.length;l++)this.ctx.renderPass.setVertexBuffer(l,e.vertexBuffers[l]);e.indexBuffer?(this.ctx.renderPass.setIndexBuffer(e.indexBuffer,e.indexFormat??"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount??0,e.instanceCount??1),this._customDrawDbgCount<3&&console.log("[CP4-DRAW]",{type:"drawIndexed",indexCount:e.indexCount??0,instanceCount:e.instanceCount??1})):(this.ctx.renderPass.draw(e.vertexCount??0,e.instanceCount??1),this._customDrawDbgCount<3&&console.log("[CP4-DRAW]",{type:"draw",vertexCount:e.vertexCount??0,instanceCount:e.instanceCount??1})),this._customDrawDbgCount<3&&this._customDrawDbgCount++}destroy(){this.customPipelines.clear(),this.customPipelineErrors.clear()}reset(){this.customPipelines.clear(),this.customPipelineErrors.clear()}}class Na{constructor(e){this.ctx=e}renderPipeline2D=null;renderPipelineGlobe=null;layerStates=new Map;digitAtlasTexture=null;setSource(e,t,i){if(!this.ctx.device)return;const r=this.layerStates.get(e);if(r&&r.sourceVersion===i)return;r?.sourceBuffer.destroy();const n=this.ctx.device.createBuffer({label:`cluster-source-${e}`,size:Math.max(t.byteLength,4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST,mappedAtCreation:!0});new Float32Array(n.getMappedRange()).set(t),n.unmap();const s=r?.countersBuffer??this.ctx.device.createBuffer({label:`cluster-counters-${e}`,size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.INDIRECT});this.layerStates.set(e,{sourceBuffer:n,sourcePoints:t,pointCount:t.length/2,sourceVersion:i,outputBuffer:r?.outputBuffer??null,outputCapacity:r?.outputCapacity??0,countersBuffer:s,lastResult:null,lastZoom:-1,lastExtentKey:"",lastClusterRadius:-1,lastMinClusterPoints:-1})}drawClusters(e,t,i,r,n,s,a){const l=this.layerStates.get(e);if(!l||!this.ctx.device||!this.ctx.renderPass||l.pointCount===0)return;this.digitAtlasTexture||(this.digitAtlasTexture=this._createDigitAtlas());const c=`${s[0]},${s[1]},${s[2]},${s[3]}`,d=Math.max(0,Math.floor(n)),u=d,h=Math.round(i*100);(!l.lastResult||l.lastZoom!==u||l.lastExtentKey!==c||l.lastClusterRadius!==h||l.lastMinClusterPoints!==r)&&(l.lastResult=xa(l.sourcePoints,i,d,s,r),l.lastZoom=u,l.lastExtentKey=c,l.lastClusterRadius=h,l.lastMinClusterPoints=r);const f=l.lastResult,p=f.entries.length;if(p===0)return;const g=ya(f.entries);if(!l.outputBuffer||l.outputCapacity<p){l.outputBuffer?.destroy();const m=Math.max(p,64);l.outputBuffer=this.ctx.device.createBuffer({label:`cluster-output-${e}`,size:m*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),l.outputCapacity=m}this.ctx.device.queue.writeBuffer(l.outputBuffer,0,g.buffer);const x=new Uint32Array([6,p,0,0]);this.ctx.device.queue.writeBuffer(l.countersBuffer,0,x.buffer);const v=new Float32Array(36);v[0]=t.clusterFillSmall[0]/255,v[1]=t.clusterFillSmall[1]/255,v[2]=t.clusterFillSmall[2]/255,v[3]=t.clusterFillSmall[3]/255,v[4]=t.clusterFillMedium[0]/255,v[5]=t.clusterFillMedium[1]/255,v[6]=t.clusterFillMedium[2]/255,v[7]=t.clusterFillMedium[3]/255,v[8]=t.clusterFillLarge[0]/255,v[9]=t.clusterFillLarge[1]/255,v[10]=t.clusterFillLarge[2]/255,v[11]=t.clusterFillLarge[3]/255,v[12]=t.clusterStroke[0]/255,v[13]=t.clusterStroke[1]/255,v[14]=t.clusterStroke[2]/255,v[15]=t.clusterStroke[3]/255,v[16]=t.clusterText[0]/255,v[17]=t.clusterText[1]/255,v[18]=t.clusterText[2]/255,v[19]=t.clusterText[3]/255,v[20]=t.pointFill[0]/255,v[21]=t.pointFill[1]/255,v[22]=t.pointFill[2]/255,v[23]=t.pointFill[3]/255,v[24]=t.pointStroke[0]/255,v[25]=t.pointStroke[1]/255,v[26]=t.pointStroke[2]/255,v[27]=t.pointStroke[3]/255,v[28]=t.pointSize,v[29]=t.pointStrokeWidth,v[30]=t.clusterBaseSize,v[31]=t.clusterGrowRate,v[32]=t.clusterStrokeWidth,v[33]=0,v[34]=0,v[35]=0;const y=this.ctx.bufferPool.allocateWithData(v,GPUBufferUsage.UNIFORM,"transient");a?this._drawGlobe(l,y):this._draw2D(l,y)}_draw2D(e,t){if(!this.ctx.device||!this.ctx.renderPass)return;this.renderPipeline2D||(this.renderPipeline2D=Pa({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount}));const i=this.ctx.device.createBindGroup({label:"cluster-render-bind-group",layout:this.renderPipeline2D.renderBindGroupLayout,entries:[{binding:0,resource:{buffer:e.outputBuffer}},{binding:1,resource:{buffer:t}},{binding:2,resource:this.digitAtlasTexture.createView()},{binding:3,resource:this.renderPipeline2D.sampler}]});this.ctx.renderPass.setPipeline(this.renderPipeline2D.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,i),this.ctx.renderPass.drawIndirect(e.countersBuffer,0)}_drawGlobe(e,t){if(!this.ctx.device||!this.ctx.renderPass)return;this.ctx.ensureGlobeCameraResources(),this.ctx.ensureGlobeCameraWritten(),this.renderPipelineGlobe||(this.renderPipelineGlobe=Ca({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount}));const i=this.ctx.device.createBindGroup({label:"cluster-globe-render-bind-group",layout:this.renderPipelineGlobe.renderBindGroupLayout,entries:[{binding:0,resource:{buffer:e.outputBuffer}},{binding:1,resource:{buffer:t}},{binding:2,resource:this.digitAtlasTexture.createView()},{binding:3,resource:this.renderPipelineGlobe.sampler}]});this.ctx.renderPass.setPipeline(this.renderPipelineGlobe.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,i),this.ctx.renderPass.drawIndirect(e.countersBuffer,0)}_createDigitAtlas(){let r;if(typeof OffscreenCanvas<"u"){const a=new OffscreenCanvas(640,64).getContext("2d");a.clearRect(0,0,640,64),a.font='700 46px "Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif',a.textAlign="center",a.textBaseline="middle",a.lineJoin="round",a.lineCap="round",a.lineWidth=7,a.strokeStyle="rgba(4, 10, 20, 0.92)",a.fillStyle="white";for(let u=0;u<10;u++){const h=u*64+32,f=64*.52,p=String(u);a.strokeText(p,h,f),a.fillText(p,h,f)}const l=a.getImageData(0,0,640,64),c=new Uint8Array(l.data.buffer);r=new Uint8Array(c.length);const d=640*4;for(let u=0;u<64;u++){const h=u*d,f=(63-u)*d;r.set(c.subarray(h,h+d),f)}}else r=this._createBitmapDigitAtlas(640,64,64);const n=this.ctx.device.createTexture({label:"cluster-digit-atlas",size:{width:640,height:64},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.ctx.device.queue.writeTexture({texture:n},r.buffer,{bytesPerRow:640*4},{width:640,height:64}),n}_createBitmapDigitAtlas(e,t,i){const r=new Uint8Array(e*t*4),n=[[14,17,19,21,25,17,14],[4,12,4,4,4,4,14],[14,17,1,6,8,16,31],[14,17,1,6,1,17,14],[2,6,10,18,31,2,2],[31,16,30,1,1,17,14],[6,8,16,30,17,17,14],[31,1,2,4,8,8,8],[14,17,17,14,17,17,14],[14,17,17,15,1,2,12]],s=Math.max(3,Math.floor(i/9)),a=5*s,l=7*s;for(let c=0;c<10;c++){const d=n[c],h=c*i+Math.floor((i-a)/2),f=Math.floor((t-l)/2);for(let p=0;p<7;p++){const g=d[p];for(let x=0;x<5;x++)if(g&1<<4-x)for(let v=0;v<s;v++)for(let y=0;y<s;y++){const m=h+x*s+y,_=f+p*s+v,w=t-1-_;if(m<e&&w>=0&&w<t){const P=(w*e+m)*4;r[P]=255,r[P+1]=255,r[P+2]=255,r[P+3]=255}}}}return r}destroy(){for(const e of this.layerStates.values())e.sourceBuffer.destroy(),e.outputBuffer?.destroy(),e.countersBuffer.destroy();this.layerStates.clear(),this.digitAtlasTexture?.destroy(),this.digitAtlasTexture=null,this.renderPipeline2D=null,this.renderPipelineGlobe=null}}class Ha{constructor(e){this.ctx=e}extrusionPipeline=null;globeExtrusionPipeline=null;extrusionMaterials=new Map;globeExtrusionMaterials=new Map;animState=new Map;animCompleted=new Set;ensureExtrusionPipeline(){return this.extrusionPipeline||(this.extrusionPipeline=Ta({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.extrusionPipeline}ensureGlobeExtrusionPipeline(){return this.globeExtrusionPipeline||(this.ctx.ensureGlobeCameraResources(),this.globeExtrusionPipeline=Ga({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globeExtrusionPipeline}drawExtrusion(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const i=this.ensureExtrusionPipeline(),r=this._createMaterialResource(this.extrusionMaterials,t,"extrusion-material",e),n=this.getOrCreateBindGroup(`extrusion:${t.color.join(",")}:${t.ambient??.35}`,[r.resourceId],()=>this.ctx.device.createBindGroup({label:"extrusion-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:r.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,n),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}drawGlobeExtrusion(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const i=this.ensureGlobeExtrusionPipeline();this.ctx.ensureGlobeCameraWritten();const r=this._createMaterialResource(this.globeExtrusionMaterials,t,"globe-extrusion-material",e,!0),n=this.getOrCreateBindGroup(`globe-extrusion:${t.color.join(",")}:${t.ambient??.35}`,[r.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-extrusion-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:r.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,n),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}_createMaterialResource(e,t,i,r,n=!1){const s=this.ctx.extrusionDebugMode?1:0,a=t.animation,l=a?(a.duration??800)/1e3:0,c=a?.delayFactor??2,d=this.ctx.currentCamera;let u=0;d&&(u=Math.atan2(d.viewMatrix[1],d.viewMatrix[0]));let h=0,f=.5,p=.5;const g=r.id??`buf:${r.vertexBuffer.label??String(this.animState.size)}`;let x=l;if(l>0&&this.animCompleted.has(g)&&(x=0),x>0){let P=this.animState.get(g);if(!P){if(d){const b=2003750834e-2;f=(d.position[0]+b)/(2*b),p=1-(d.position[1]+b)/(2*b)}P={startTime:this.ctx.frameTime,origin:[f,p]},this.animState.set(g,P)}h=this.ctx.frameTime-P.startTime,f=P.origin[0],p=P.origin[1];const M=1.4142*c;h<x+M?this.ctx.needsContinuousRender=!0:this.animCompleted.add(g)}const v=x>0&&this.ctx.needsContinuousRender,y=t.color.join(","),m=v?`${i}:anim:${g}:${y}:${this.ctx.frameTime}`:[y,t.ambient??.35,s].join(":"),_=n?20:16,w=new Float32Array(_);return w[0]=t.color[0]/255,w[1]=t.color[1]/255,w[2]=t.color[2]/255,w[3]=t.color[3]/255,w[4]=t.ambient??.35,w[5]=s,w[6]=h,w[7]=x,w[8]=f,w[9]=p,w[10]=c,w[11]=n?0:u,w[12]=t.shininess??32,w[13]=t.specularStrength??.15,n&&d?.cameraMerc01&&(w[16]=d.cameraMerc01[0],w[17]=d.cameraMerc01[1],w[18]=d.cameraMerc01[2]),this.getOrCreateMaterialResource(e,m,w,i)}getOrCreateMaterialResource(e,t,i,r){let n=e.get(t);if(!n){const s=this.ctx.bufferPool.allocate(i.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,"persistent");s.label=`${r}:${t}`,n={buffer:s,resourceId:`buf-${s.label??`${r}:${t}`}`},e.set(t,n)}return this.ctx.device.queue.writeBuffer(n.buffer,0,i.buffer,i.byteOffset,i.byteLength),n}getOrCreateBindGroup(e,t,i){return this.ctx.bindGroupCache?.getOrCreate({pipelineId:e,resourceIds:t},i)??i()}releaseMaterials(e){for(const{buffer:t}of e.values())this.ctx.bufferPool?.release(t);e.clear()}destroy(){this.extrusionPipeline=null,this.globeExtrusionPipeline=null,this.releaseMaterials(this.extrusionMaterials),this.releaseMaterials(this.globeExtrusionMaterials),this.animState.clear(),this.animCompleted.clear()}}const Wa=`

${q}

struct Mesh3DMaterial {
  color: vec4<f32>,         // RGBA 0-1 (premultiplied in fragment)
  ambient: f32,
  shininess: f32,
  specularStrength: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: Mesh3DMaterial;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // XY comes in Mercator [0..1], convert to EPSG:3857 for 2D camera
  let HALF: f32 = 20037508.34;
  let epsg = vec2<f32>(
    input.position.x * 2.0 * HALF - HALF,
    (1.0 - input.position.y) * 2.0 * HALF - HALF
  );

  // Height (metres) + oblique 2.5D offset for visible 3D effect in top-down view
  let h = input.position.z;
  let obliqueMag: f32 = 0.5;
  let worldPos = vec3<f32>(
    epsg.x + h * obliqueMag,
    epsg.y + h * obliqueMag,
    h,
  );

  out.clipPosition = camera.viewProjection * vec4<f32>(worldPos, 1.0);
  out.worldPos = worldPos;
  out.vNormal = input.normal;

  // Logarithmic depth remap — matches extrusion pipeline.
  let absH = abs(h);
  let logH = log2(max(absH, 0.1) + 1.0);
  let logMax = log2(1001.0);
  let normalizedZ = clamp(0.5 - logH / (2.0 * logMax), 0.01, 0.99);
  out.clipPosition.z = normalizedZ * out.clipPosition.w;

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let N = normalize(in.vNormal);
  let L = normalize(vec3<f32>(0.3, 0.8, 0.5)); // fixed directional light
  let V = normalize(vec3<f32>(0.0, 0.0, 1.0)); // approximate view direction
  let H = normalize(L + V); // Blinn half-vector

  // Diffuse
  let diff = max(dot(N, L), 0.0);

  // Specular (Blinn-Phong)
  let spec = pow(max(dot(N, H), 0.0), material.shininess) * material.specularStrength;

  let lighting = material.ambient + diff * (1.0 - material.ambient) + spec;
  let baseColor = material.color.rgb * lighting;
  let alpha = material.color.a;

  // Premultiplied alpha output
  return vec4<f32>(baseColor * alpha, alpha);
}
`;function Za(o){return o.createBindGroupLayout({label:"mesh3d-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Ni(o){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=o,r=Za(e),n=e.createShaderModule({label:"mesh3d-shader",code:Wa});return{pipeline:e.createRenderPipeline({label:"mesh3d-pipeline",layout:e.createPipelineLayout({label:"mesh3d-pipeline-layout",bindGroupLayouts:[i,r]}),vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:24,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:o.depthWriteEnabled??!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),materialBindGroupLayout:r}}const ja=`

${de}

const EARTH_RADIUS_M: f32 = 6378137.0;

struct Mesh3DMaterial {
  color: vec4<f32>,
  ambient: f32,
  shininess: f32,
  specularStrength: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: Mesh3DMaterial;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
  @location(1) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // XY in Mercator [0..1], Z = height (metres)
  let merc01 = input.position.xy;
  let ang = mercatorToAngular(merc01);
  let sphereBase = angularToSphere(ang.x, ang.y);

  // Radial height: position on sphere at (1 + h/R)
  let h = input.position.z;
  let radius = 1.0 + h / EARTH_RADIUS_M;
  let worldPos = sphereBase * radius;

  // Horizon clipping
  let clipZ = globeClippingZ(sphereBase);
  if clipZ < -0.01 {
    out.clipPosition = vec4<f32>(0.0, 0.0, -2.0, 1.0); // behind camera
    return out;
  }

  var globeClip = camera.viewProjection * vec4<f32>(worldPos, 1.0);

  // Depth: use globe clipping Z + height bias (matches extrusion pattern)
  let heightBias = abs(h) / EARTH_RADIUS_M;
  let effectiveClipZ = select(clipZ, min(clipZ + 0.0001 + heightBias, 0.9999), clipZ <= 1.0);
  globeClip.z = effectiveClipZ * globeClip.w;

  // Flat path for transition zone
  let heightScale = h / EARTH_RADIUS_M;
  let flatPos = vec4<f32>(merc01.x, merc01.y, heightScale, 1.0);

  if (camera.projectionTransition >= 0.999) {
    out.clipPosition = globeClip;
  } else if (camera.projectionTransition <= 0.001) {
    out.clipPosition = camera.flatViewProjection * flatPos;
  } else {
    var flatClip = camera.flatViewProjection * flatPos;
    out.clipPosition = mix(flatClip, globeClip, camera.projectionTransition);
  }

  out.worldPos = worldPos;

  // Transform normals to globe tangent space
  let cosLat = cos(ang.y);
  let sinLat = sin(ang.y);
  let cosLon = cos(ang.x);
  let sinLon = sin(ang.x);
  let east = vec3<f32>(cosLon, 0.0, -sinLon);
  let north = vec3<f32>(-sinLat * sinLon, cosLat, -sinLat * cosLon);
  let up = sphereBase;

  out.vNormal = normalize(
    input.normal.x * east +
    input.normal.y * up +
    input.normal.z * north
  );

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let N = normalize(in.vNormal);
  let L = normalize(vec3<f32>(0.3, 0.8, 0.5));
  let V = normalize(-in.worldPos);
  let H = normalize(L + V);

  let diff = max(dot(N, L), 0.0);
  let spec = pow(max(dot(N, H), 0.0), material.shininess) * material.specularStrength;
  let lighting = material.ambient + diff * (1.0 - material.ambient) + spec;
  let baseColor = material.color.rgb * lighting;
  let alpha = material.color.a;

  return vec4<f32>(baseColor * alpha, alpha);
}
`;function Hi(o){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=o,r=e.createBindGroupLayout({label:"globe-mesh3d-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),n=e.createShaderModule({label:"globe-mesh3d-shader",code:ja});return{pipeline:e.createRenderPipeline({label:"globe-mesh3d-pipeline",layout:e.createPipelineLayout({label:"globe-mesh3d-pipeline-layout",bindGroupLayouts:[i,r]}),vertex:{module:n,entryPoint:"vs_main",buffers:[{arrayStride:24,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}]},fragment:{module:n,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:o.depthFormat??"depth24plus",depthWriteEnabled:o.depthWriteEnabled??!0,depthCompare:o.depthCompare??"less"},multisample:{count:o.sampleCount??L}}),materialBindGroupLayout:r}}const Xa=32;class $a{constructor(e){this.ctx=e}_pipeline=null;_transparentPipeline=null;_globePipeline=null;_transparentGlobePipeline=null;_materials=new Map;_globeMaterials=new Map;_ensurePipeline(){return this._pipeline||(this._pipeline=Ni({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,depthWriteEnabled:!0,sampleCount:this.ctx.sampleCount})),this._pipeline}_ensureTransparentPipeline(){return this._transparentPipeline||(this._transparentPipeline=Ni({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,depthWriteEnabled:!1,sampleCount:this.ctx.sampleCount})),this._transparentPipeline}_ensureGlobePipeline(){return this._globePipeline||(this.ctx.ensureGlobeCameraResources(),this._globePipeline=Hi({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,depthWriteEnabled:!0,sampleCount:this.ctx.sampleCount})),this._globePipeline}_ensureTransparentGlobePipeline(){return this._transparentGlobePipeline||(this.ctx.ensureGlobeCameraResources(),this._transparentGlobePipeline=Hi({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,depthWriteEnabled:!1,sampleCount:this.ctx.sampleCount})),this._transparentGlobePipeline}drawMesh3D(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup)return;const i=t.color[3]<255?this._ensureTransparentPipeline():this._ensurePipeline(),r=this._getOrCreateMaterial(this._materials,t,i.materialBindGroupLayout);this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,r.bindGroup),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}drawGlobeMesh3D(e,t){if(!this.ctx.device||!this.ctx.renderPass)return;const i=t.color[3]<255?this._ensureTransparentGlobePipeline():this._ensureGlobePipeline();this.ctx.ensureGlobeCameraWritten();const r=this._getOrCreateMaterial(this._globeMaterials,t,i.materialBindGroupLayout);this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,r.bindGroup),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}_getOrCreateMaterial(e,t,i){const r=`${t.color.join(",")}:${t.ambient??.35}:${t.shininess??32}:${t.specularStrength??.15}`;let n=e.get(r);if(n)return n;const s=new Float32Array(8);s[0]=t.color[0]/255,s[1]=t.color[1]/255,s[2]=t.color[2]/255,s[3]=t.color[3]/255,s[4]=t.ambient??.35,s[5]=t.shininess??32,s[6]=t.specularStrength??.15,s[7]=0;const a=this.ctx.device.createBuffer({label:"mesh3d-material",size:Xa,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.ctx.device.queue.writeBuffer(a,0,s);const l=this.ctx.device.createBindGroup({label:"mesh3d-material-bind-group",layout:i,entries:[{binding:0,resource:{buffer:a}}]});return n={buffer:a,bindGroup:l},e.set(r,n),n}destroy(){for(const e of this._materials.values())e.buffer.destroy();for(const e of this._globeMaterials.values())e.buffer.destroy();this._materials.clear(),this._globeMaterials.clear(),this._pipeline=null,this._transparentPipeline=null,this._globePipeline=null,this._transparentGlobePipeline=null}}class ml{ctx=new kn;_capabilities=null;textureManager=null;bindGroupCache=null;iconAtlas=null;pickingDelegate=null;rasterDelegate=null;globeDelegate=null;vectorDelegate=null;modelDelegate=null;_gltf2Renderer=null;customDelegate=null;clusterDelegate=null;extrusionDelegate=null;mesh3dDelegate=null;loadedModelSources=new Map;loadedModelV2Sources=new Map;_clearColor={r:.05,g:.05,b:.1,a:1};get capabilities(){if(!this._capabilities)throw new Error("[mapgpu] RenderEngine not initialized. Call init() first.");return this._capabilities}get depthConfig(){return this.ctx.depthConfig}get needsContinuousRender(){return this.ctx.needsContinuousRender}ensureIconAtlas(){return this.iconAtlas||(this.iconAtlas=new cs(this.ctx.device)),this.iconAtlas}async init(e,t){this.ctx.canvas=e,this.ctx.depthConfig=t??Vt;const i=await wn();if(!i.device||!i.adapter)return this._capabilities={mode:i.mode,features:i.features,limits:i.limits},this._capabilities;this.ctx.device=i.device,this.ctx.device.lost.then(n=>{n.reason!=="destroyed"&&(this.ctx.deviceLost=!0,console.error(`[mapgpu] GPU device lost: ${n.reason} — ${n.message}`))}),this.ctx.device.addEventListener("uncapturederror",n=>{console.error("[mapgpu] GPU VALIDATION ERROR:",n.error.message)}),this.ctx.context=e.getContext("webgpu"),this.ctx.colorFormat=navigator.gpu.getPreferredCanvasFormat(),this.ctx.context.configure({device:this.ctx.device,format:this.ctx.colorFormat,alphaMode:"premultiplied"}),this.ctx.bufferPool=new Mn(this.ctx.device),this.textureManager=new Sn(this.ctx.device),this.bindGroupCache=new Tn,this.ctx.bindGroupCache=this.bindGroupCache,this.ctx.cameraBuffer=this.ctx.bufferPool.allocate(In,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,"persistent"),this.ctx.cameraBindGroupLayout=On(this.ctx.device),this.ctx.cameraBindGroup=this.ctx.device.createBindGroup({label:"camera-bind-group",layout:this.ctx.cameraBindGroupLayout,entries:[{binding:0,resource:{buffer:this.ctx.cameraBuffer}}]}),this.ctx.msaaColorTexture=this.ctx.device.createTexture({label:"msaa-color-texture",size:{width:e.width||1,height:e.height||1},format:this.ctx.colorFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT,sampleCount:this.ctx.sampleCount}),this.ctx.depthTexture=this.ctx.device.createTexture({label:"main-depth-texture",size:{width:e.width||1,height:e.height||1},format:this.ctx.depthConfig.format,usage:GPUTextureUsage.RENDER_ATTACHMENT,sampleCount:this.ctx.sampleCount}),this.ctx.placeholderTexture=this.ctx.device.createTexture({label:"placeholder-texture",size:{width:1,height:1},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.ctx.device.queue.writeTexture({texture:this.ctx.placeholderTexture},new Uint8Array([255,255,255,255]),{bytesPerRow:4},{width:1,height:1});const r=()=>this.ensureIconAtlas();if(this.pickingDelegate=new Ra(this.ctx),this.rasterDelegate=new za(this.ctx),this.globeDelegate=new Aa(this.ctx,r),this.vectorDelegate=new ka(this.ctx,r),this.modelDelegate=new Va(this.ctx),this.ctx.device){const{Gltf2Renderer:n}=await Da(async()=>{const{Gltf2Renderer:s}=await import("./gltf2-renderer-BAyODqGI.js");return{Gltf2Renderer:s}},[],import.meta.url);this._gltf2Renderer=new n(this.ctx.device)}return this.customDelegate=new Oa(this.ctx),this.clusterDelegate=new Na(this.ctx),this.extrusionDelegate=new Ha(this.ctx),this.mesh3dDelegate=new $a(this.ctx),this.rasterDelegate.initRasterPipeline(),this._capabilities={mode:i.mode,features:i.features,limits:i.limits},await this.restoreLoadedModels(),this._capabilities}setClearColor(e,t,i,r){this._clearColor={r:e,g:t,b:i,a:r}}setDebugTileVertices(e){this.ctx.debugTileVertices=e}setExtrusionDebug(e){this.ctx.extrusionDebugMode=e}setLighting(e){this.ctx.lightConfig=e}applyDebugBrush(e,t,i,r,n){if(this.ctx.device){if(!this.ctx.heightBrush){const s=Fn(this.ctx.device);this.ctx.heightBrush=new Bn(this.ctx.device,s)}this.ctx.heightBrush.apply(e,t,i,r,n)}}clearDebugBrush(){this.ctx.heightBrush?.clear()}setHeightExaggeration(e){this.ctx.heightExaggeration=e}beginFrame(e){if(!this.ctx.device||!this.ctx.context||this.ctx.deviceLost)return;this.ctx.frameTime+=1/60,this.ctx.needsContinuousRender=!1,this.ctx.pickingDrawCalls=[],this.ctx.currentCamera=e;const t=st(e.projectionMatrix,e.viewMatrix),i=e.position,r=st(t,An(i[0]??0,i[1]??0,i[2]??0)),n=new Float32Array(40);n.set(t,0),n[16]=e.viewportWidth,n[17]=e.viewportHeight,n.set(r,20),n[36]=i[0]??0,n[37]=i[1]??0,n[38]=i[2]??0,this.ctx.device.queue.writeBuffer(this.ctx.cameraBuffer,0,n.buffer),this.ctx.globeCameraBuffer&&e.projectionTransition!==void 0&&this.ctx.writeGlobeCamera(e),this.ctx.heightBrush?.flush(this.ctx.device);const s=this.ctx.canvas?.width||1,a=this.ctx.canvas?.height||1;this.ctx.depthTexture&&(this.ctx.depthTexture.width!==s||this.ctx.depthTexture.height!==a)&&(this.ctx.depthTexture.destroy(),this.ctx.depthTexture=this.ctx.device.createTexture({label:"main-depth-texture",size:{width:s,height:a},format:this.ctx.depthConfig.format,usage:GPUTextureUsage.RENDER_ATTACHMENT,sampleCount:this.ctx.sampleCount}),this.ctx.msaaColorTexture&&(this.ctx.msaaColorTexture.destroy(),this.ctx.msaaColorTexture=this.ctx.device.createTexture({label:"msaa-color-texture",size:{width:s,height:a},format:this.ctx.colorFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT,sampleCount:this.ctx.sampleCount}))),this.ctx.commandEncoder=this.ctx.device.createCommandEncoder({label:"frame-command-encoder"}),this.ctx.swapChainView=this.ctx.context.getCurrentTexture().createView(),this.ctx.msaaColorView=this.ctx.msaaColorTexture?.createView()??null,this.ctx.depthView=this.ctx.depthTexture?.createView()??null,this.ctx.backgroundPass=null,this.ctx.renderPass=null}ensureBackgroundRenderPass(){!this.ctx.commandEncoder||this.ctx.backgroundPass||this.ctx.renderPass||!this.ctx.swapChainView||(this.ctx.backgroundPass=this.ctx.commandEncoder.beginRenderPass({label:"background-render-pass",colorAttachments:[this.ctx.msaaColorView?{view:this.ctx.msaaColorView,resolveTarget:this.ctx.swapChainView,clearValue:this._clearColor,loadOp:"clear",storeOp:"store"}:{view:this.ctx.swapChainView,clearValue:this._clearColor,loadOp:"clear",storeOp:"store"}]}))}ensureSceneRenderPass(){if(!this.ctx.commandEncoder||this.ctx.renderPass||!this.ctx.swapChainView)return;const e=this.ctx.backgroundPass!==null;this.ctx.backgroundPass&&(this.ctx.backgroundPass.end(),this.ctx.backgroundPass=null),this.ctx.renderPass=this.ctx.commandEncoder.beginRenderPass({label:"main-render-pass",colorAttachments:[this.ctx.msaaColorView?{view:this.ctx.msaaColorView,resolveTarget:this.ctx.swapChainView,clearValue:this._clearColor,loadOp:e?"load":"clear",storeOp:"discard"}:{view:this.ctx.swapChainView,clearValue:this._clearColor,loadOp:e?"load":"clear",storeOp:"store"}],depthStencilAttachment:this.ctx.depthView?{view:this.ctx.depthView,depthClearValue:this.ctx.depthConfig.clearValue,depthLoadOp:"clear",depthStoreOp:"store"}:void 0})}drawImagery(e){this.ensureSceneRenderPass(),this.rasterDelegate?.drawImagery(e)}drawGlobeTile(e){this.ensureSceneRenderPass(),this.rasterDelegate?.drawGlobeTile(e)}drawPoleCaps(e){this.ensureSceneRenderPass(),this.globeDelegate?.drawPoleCaps(e)}drawSky(e,t,i){this.ensureBackgroundRenderPass(),this.globeDelegate?.drawSky(e,t,i)}drawAtmosphere(e,t){this.ensureSceneRenderPass(),this.globeDelegate?.drawAtmosphere(e,t)}drawGlobePoints(e,t){this.ensureSceneRenderPass(),this.globeDelegate?.drawGlobePoints(e,t)}drawGlobeLines(e,t){this.ensureSceneRenderPass(),this.globeDelegate?.drawGlobeLines(e,t)}drawGlobePolygons(e,t){this.ensureSceneRenderPass(),this.globeDelegate?.drawGlobePolygons(e,t)}drawPoints(e,t){this.ensureSceneRenderPass(),this.vectorDelegate?.drawPoints(e,t)}drawLines(e,t){this.ensureSceneRenderPass(),this.vectorDelegate?.drawLines(e,t)}drawPolygons(e,t){this.ensureSceneRenderPass(),this.vectorDelegate?.drawPolygons(e,t)}drawText(e,t){this.ensureSceneRenderPass(),this.vectorDelegate?.drawText(e,t)}drawPostProcess(e){this.ensureSceneRenderPass(),this.vectorDelegate?.drawPostProcess(e)}drawCustom(e){this.ensureSceneRenderPass(),this.customDelegate?.drawCustom(e)}async loadModel(e,t){this.loadedModelSources.set(e,Wi(t)),await this.modelDelegate?.loadModel(e,t)}drawModels(e,t){if(this.ensureSceneRenderPass(),this._gltf2Renderer?.has(t.modelId)){this.drawModelsV2(e,t);return}this.modelDelegate?.drawModels(e,t)}drawGlobeModels(e,t){if(this.ensureSceneRenderPass(),this._gltf2Renderer?.has(t.modelId)){this.drawGlobeModelsV2(e,t);return}this.modelDelegate?.drawGlobeModels(e,t)}async loadModelV2(e,t){this.loadedModelV2Sources.set(e,Zi(t)),await this._gltf2Renderer?.loadModel(e,t)}getModelMetadata(e){return this._gltf2Renderer?(this._gltf2Renderer.syncAnimationState(e,this.ctx.frameTime),this._gltf2Renderer.getModelMetadata(e)):null}resolveModelBounds(e){return this._gltf2Renderer?(this._gltf2Renderer.syncAnimationState(e.modelId,this.ctx.frameTime),this._gltf2Renderer.resolveModelBounds(e)):null}getModelGroundAnchorUnitsV2(e){return this.getModelMetadata(e)?.groundAnchorLocalZ??null}getModelBoundingBoxV2(e){return this.getModelMetadata(e)?.localBounds??null}drawModelsV2(e,t){this.ensureSceneRenderPass(),!(!this._gltf2Renderer||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.cameraBindGroupLayout)&&(this._gltf2Renderer.isAnimated(t.modelId)&&(this.ctx.needsContinuousRender=!0),this._gltf2Renderer.drawFlat(this.ctx.renderPass,e,this.ctx.cameraBindGroup,this.ctx.cameraBindGroupLayout,this.ctx.colorFormat,this.ctx.depthConfig.format,t.modelId,this.ctx.frameTime))}drawGlobeModelsV2(e,t){this.ensureSceneRenderPass(),!(!this._gltf2Renderer||!this.ctx.renderPass||!this.ctx.globeCameraBindGroup||!this.ctx.globeCameraBindGroupLayout)&&(this._gltf2Renderer.isAnimated(t.modelId)&&(this.ctx.needsContinuousRender=!0),this._gltf2Renderer.drawGlobe(this.ctx.renderPass,e,this.ctx.globeCameraBindGroup,this.ctx.globeCameraBindGroupLayout,this.ctx.colorFormat,this.ctx.depthConfig.format,t.modelId,this.ctx.frameTime))}drawExtrusion(e,t){this.ensureSceneRenderPass(),this.extrusionDelegate?.drawExtrusion(e,t)}drawGlobeExtrusion(e,t){this.ensureSceneRenderPass(),this.extrusionDelegate?.drawGlobeExtrusion(e,t)}drawMesh3D(e,t){this.ensureSceneRenderPass(),this.mesh3dDelegate?.drawMesh3D(e,t)}drawGlobeMesh3D(e,t){this.ensureSceneRenderPass(),this.mesh3dDelegate?.drawGlobeMesh3D(e,t)}setClusterSource(e,t,i){this.clusterDelegate?.setSource(e,t,i)}drawClusters(e,t,i,r,n,s,a){this.ensureSceneRenderPass(),this.clusterDelegate?.drawClusters(e,t,i,r,n,s,a)}loadIcon(e,t){this.vectorDelegate?.loadIcon(e,t)}setCurrentLayerId(e){this.ctx.currentLayerId=e}setPickingEnabled(e){this.ctx.pickingEnabled=e}async pick(e,t){return this.ctx.pickingEnabled?this.pickingDelegate?.pick(e,t)??null:null}endFrame(){if(!this.ctx.device||!this.ctx.commandEncoder)return;!this.ctx.backgroundPass&&!this.ctx.renderPass&&this.ensureBackgroundRenderPass(),this.ctx.backgroundPass&&(this.ctx.backgroundPass.end(),this.ctx.backgroundPass=null),this.ctx.renderPass&&(this.ctx.renderPass.end(),this.ctx.renderPass=null);const e=this.ctx.commandEncoder.finish();this.ctx.device.queue.submit([e]),this.ctx.commandEncoder=null,this.ctx.swapChainView=null,this.ctx.msaaColorView=null,this.ctx.depthView=null,this.ctx.bufferPool?.releaseTransient()}createTexture(e){if(!this.textureManager)throw new Error("[mapgpu] RenderEngine not initialized.");return this.textureManager.createFromImageBitmap(e)}createTextureFromVideo(e){if(!this.textureManager)throw new Error("[mapgpu] RenderEngine not initialized.");return this.textureManager.createFromVideoElement(e)}updateTextureFromVideo(e,t){if(!this.textureManager)throw new Error("[mapgpu] RenderEngine not initialized.");this.textureManager.updateFromVideoElement(e,t)}createBuffer(e,t){if(!this.ctx.bufferPool)throw new Error("[mapgpu] RenderEngine not initialized.");return this.ctx.bufferPool.allocateWithData(e,t,"persistent")}writeBuffer(e,t,i){this.ctx.device&&this.ctx.device.queue.writeBuffer(e,t,i.buffer,i.byteOffset,i.byteLength)}releaseBuffer(e){this.ctx.bufferPool?.release(e),this.bindGroupCache?.invalidate(`buf-${e.label??"unknown"}`)}releaseTexture(e){this.textureManager?.release(e),this.bindGroupCache?.invalidate(`tex-${e.label??"unknown"}`)}createFloat32Texture(e,t,i){if(!this.textureManager)throw new Error("RenderEngine not initialized");return this.textureManager.createFromFloat32(e,t,i)}createUint8Texture(e,t,i){if(!this.textureManager)throw new Error("RenderEngine not initialized");return this.textureManager.createFromUint8(e,t,i)}createRGBA8Texture(e,t,i){if(!this.textureManager)throw new Error("RenderEngine not initialized");return this.textureManager.createFromRGBA8(e,t,i)}getMemoryAccounting(){const e=this.ctx.bufferPool?.getMemoryAccounting()??{persistentBufferBytes:0,transientBufferBytes:0},t=this.textureManager?.textureBytes??0;return{persistentBufferBytes:e.persistentBufferBytes,transientBufferBytes:e.transientBufferBytes,textureBytes:t,totalTrackedBytes:e.persistentBufferBytes+e.transientBufferBytes+t}}async recover(e){if(!this.ctx.canvas)throw new Error("[mapgpu] Cannot recover: no canvas reference.");this.pickingDelegate?.destroy(),this.rasterDelegate?.destroy(),this.globeDelegate?.destroy(),this.vectorDelegate?.destroy(),this.modelDelegate?.destroy(),this._gltf2Renderer?.destroy(),this.customDelegate?.destroy(),this.clusterDelegate?.destroy(),this.extrusionDelegate?.destroy(),this.pickingDelegate=null,this.rasterDelegate=null,this.globeDelegate=null,this.vectorDelegate=null,this.modelDelegate=null,this._gltf2Renderer=null,this.customDelegate=null,this.clusterDelegate=null,this.extrusionDelegate=null,this.ctx.bufferPool?.destroy(),this.ctx.bufferPool=null,this.textureManager=null,this.bindGroupCache=null,this.ctx.bindGroupCache=null,this.iconAtlas=null,this.ctx.globeCameraBuffer=null,this.ctx.globeCameraBindGroup=null,this.ctx.globeCameraBindGroupLayout=null,this.ctx.cameraBuffer=null,this.ctx.cameraBindGroup=null,this.ctx.cameraBindGroupLayout=null,this.ctx.commandEncoder=null,this.ctx.backgroundPass=null,this.ctx.renderPass=null,this.ctx.depthTexture=null,this.ctx.msaaColorTexture=null,this.ctx.swapChainView=null,this.ctx.msaaColorView=null,this.ctx.depthView=null,this.ctx.placeholderTexture=null,this.ctx.device=null,this.ctx.context=null,this.ctx.deviceLost=!1,this.ctx.pickingDrawCalls=[],await this.init(this.ctx.canvas,e??this.ctx.depthConfig)}destroy(){this.ctx.renderPass=null,this.ctx.backgroundPass=null,this.ctx.swapChainView=null,this.ctx.msaaColorView=null,this.ctx.depthView=null,this.ctx.commandEncoder=null,this.ctx.bufferPool?.destroy(),this.ctx.bufferPool=null,this.textureManager?.destroy(),this.textureManager=null,this.bindGroupCache?.clear(),this.bindGroupCache=null,this.ctx.bindGroupCache=null,this.pickingDelegate?.destroy(),this.rasterDelegate?.destroy(),this.globeDelegate?.destroy(),this.vectorDelegate?.destroy(),this.modelDelegate?.destroy(),this._gltf2Renderer?.destroy(),this.customDelegate?.destroy(),this.clusterDelegate?.destroy(),this.extrusionDelegate?.destroy(),this.pickingDelegate=null,this.rasterDelegate=null,this.globeDelegate=null,this.vectorDelegate=null,this.modelDelegate=null,this._gltf2Renderer=null,this.customDelegate=null,this.clusterDelegate=null,this.extrusionDelegate=null,this.iconAtlas=null,this.ctx.globeCameraBuffer=null,this.ctx.globeCameraBindGroup=null,this.ctx.globeCameraBindGroupLayout=null,this.ctx.depthTexture?.destroy(),this.ctx.depthTexture=null,this.ctx.msaaColorTexture?.destroy(),this.ctx.msaaColorTexture=null,this.ctx.placeholderTexture?.destroy(),this.ctx.placeholderTexture=null,this.ctx.cameraBuffer=null,this.ctx.cameraBindGroup=null,this.ctx.cameraBindGroupLayout=null,this.ctx.context?.unconfigure(),this.ctx.context=null,this.ctx.device?.destroy(),this.ctx.device=null,this._capabilities=null,this.ctx.canvas=null,this.ctx.deviceLost=!1,this.ctx.pickingDrawCalls=[],this.loadedModelSources.clear(),this.loadedModelV2Sources.clear()}async restoreLoadedModels(){if(this.modelDelegate)for(const[e,t]of this.loadedModelSources)await this.modelDelegate.loadModel(e,Wi(t));if(this._gltf2Renderer)for(const[e,t]of this.loadedModelV2Sources)await this._gltf2Renderer.loadModel(e,Zi(t))}}function Wi(o){return o instanceof ArrayBuffer?o.slice(0):{json:Ya(o.json),buffers:o.buffers.map(e=>e.slice(0))}}function Zi(o){return typeof o=="string"?o:o.slice(0)}function Ya(o){return typeof structuredClone=="function"?structuredClone(o):JSON.parse(JSON.stringify(o))}let ji=0;function Ka(o){return ji+=1,`${o}-${ji}`}class qa{id;_visible;_opacity;_loaded=!1;_destroyed=!1;minScale;maxScale;zIndex;interactive;blendMode;filters;_fullExtent;eventBus=new be;constructor(e={}){this.id=e.id??Ka("layer"),this._visible=e.visible??!0,this._opacity=e.opacity??1,this.minScale=e.minScale,this.maxScale=e.maxScale,this.zIndex=e.zIndex,this.interactive=e.interactive??!0,this.blendMode=e.blendMode??"normal",this.filters=e.filters}get visible(){return this._visible}set visible(e){this._visible!==e&&(this._visible=e,this.eventBus.emit("visibility-change",e))}get opacity(){return this._opacity}set opacity(e){const t=Math.max(0,Math.min(1,e));this._opacity!==t&&(this._opacity=t,this.eventBus.emit("opacity-change",t))}get loaded(){return this._loaded}setLoaded(e){this._loaded=e}get fullExtent(){return this._fullExtent}async load(){if(!this._loaded){if(this._destroyed)throw new Error(`Layer "${this.id}" has been destroyed and cannot be loaded.`);try{await this.onLoad(),this._loaded=!0,this.eventBus.emit("load",void 0)}catch(e){const t={code:"LAYER_LOAD_FAILED",message:e instanceof Error?e.message:String(e),cause:e instanceof Error?e:new Error(String(e))};throw this.eventBus.emit("error",t),e}}}refresh(){this.eventBus.emit("refresh",void 0)}redraw(){this.eventBus.emit("refresh",void 0)}destroy(){this._destroyed||(this._destroyed=!0,this._loaded=!1,this.eventBus.removeAll())}on(e,t){this.eventBus.on(e,t)}off(e,t){this.eventBus.off(e,t)}}class gl extends qa{type="raster-tile";urlTemplate;tms;subdomains;minZoom;maxZoom;attribution;subdomainIndex=0;constructor(e){if(super(e),!e.urlTemplate)throw new Error("RasterTileLayer requires a urlTemplate option.");this.urlTemplate=e.urlTemplate,this.tms=e.tms??!1,this.subdomains=e.subdomains??[],this.minZoom=e.minZoom??0,this.maxZoom=e.maxZoom??22,this.attribution=e.attribution,this._fullExtent={minX:-180,minY:-85.0511287798,maxX:180,maxY:85.0511287798}}async onLoad(){this.validateTemplate()}validateTemplate(){const e=this.urlTemplate.includes("{z}"),t=this.urlTemplate.includes("{x}"),i=this.urlTemplate.includes("{y}");if(!e||!t||!i)throw new Error("RasterTileLayer urlTemplate must contain {z}, {x}, and {y} placeholders.");if(this.urlTemplate.includes("{s}")&&this.subdomains.length===0)throw new Error("RasterTileLayer urlTemplate contains {s} but no subdomains were provided.")}getTileUrl(e,t,i){let r=this.urlTemplate;const n=this.tms?(1<<e)-1-i:i;if(r=r.replace("{z}",String(e)),r=r.replace("{x}",String(t)),r=r.replace("{y}",String(n)),this.subdomains.length>0&&r.includes("{s}")){const s=this.subdomains[this.subdomainIndex%this.subdomains.length];this.subdomainIndex=(this.subdomainIndex+1)%this.subdomains.length,r=r.replace("{s}",s)}return r}isZoomValid(e){return e>=this.minZoom&&e<=this.maxZoom}get fullExtent(){return this._fullExtent}}const kt=65536*65536,Xi=1/kt,Qa=12,$i=typeof TextDecoder>"u"?null:new TextDecoder("utf-8"),Et=0,Je=1,Be=2,et=5;class xl{constructor(e=new Uint8Array(16)){this.buf=ArrayBuffer.isView(e)?e:new Uint8Array(e),this.dataView=new DataView(this.buf.buffer),this.pos=0,this.type=0,this.length=this.buf.length}readFields(e,t,i=this.length){for(;this.pos<i;){const r=this.readVarint(),n=r>>3,s=this.pos;this.type=r&7,e(n,t,this),this.pos===s&&this.skip(r)}return t}readMessage(e,t){return this.readFields(e,t,this.readVarint()+this.pos)}readFixed32(){const e=this.dataView.getUint32(this.pos,!0);return this.pos+=4,e}readSFixed32(){const e=this.dataView.getInt32(this.pos,!0);return this.pos+=4,e}readFixed64(){const e=this.dataView.getUint32(this.pos,!0)+this.dataView.getUint32(this.pos+4,!0)*kt;return this.pos+=8,e}readSFixed64(){const e=this.dataView.getUint32(this.pos,!0)+this.dataView.getInt32(this.pos+4,!0)*kt;return this.pos+=8,e}readFloat(){const e=this.dataView.getFloat32(this.pos,!0);return this.pos+=4,e}readDouble(){const e=this.dataView.getFloat64(this.pos,!0);return this.pos+=8,e}readVarint(e){const t=this.buf;let i,r;return r=t[this.pos++],i=r&127,r<128||(r=t[this.pos++],i|=(r&127)<<7,r<128)||(r=t[this.pos++],i|=(r&127)<<14,r<128)||(r=t[this.pos++],i|=(r&127)<<21,r<128)?i:(r=t[this.pos],i|=(r&15)<<28,Ja(i,e,this))}readVarint64(){return this.readVarint(!0)}readSVarint(){const e=this.readVarint();return e%2===1?(e+1)/-2:e/2}readBoolean(){return!!this.readVarint()}readString(){const e=this.readVarint()+this.pos,t=this.pos;return this.pos=e,e-t>=Qa&&$i?$i.decode(this.buf.subarray(t,e)):dl(this.buf,t,e)}readBytes(){const e=this.readVarint()+this.pos,t=this.buf.subarray(this.pos,e);return this.pos=e,t}readPackedVarint(e=[],t){const i=this.readPackedEnd();for(;this.pos<i;)e.push(this.readVarint(t));return e}readPackedSVarint(e=[]){const t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readSVarint());return e}readPackedBoolean(e=[]){const t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readBoolean());return e}readPackedFloat(e=[]){const t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readFloat());return e}readPackedDouble(e=[]){const t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readDouble());return e}readPackedFixed32(e=[]){const t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readFixed32());return e}readPackedSFixed32(e=[]){const t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readSFixed32());return e}readPackedFixed64(e=[]){const t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readFixed64());return e}readPackedSFixed64(e=[]){const t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readSFixed64());return e}readPackedEnd(){return this.type===Be?this.readVarint()+this.pos:this.pos+1}skip(e){const t=e&7;if(t===Et)for(;this.buf[this.pos++]>127;);else if(t===Be)this.pos=this.readVarint()+this.pos;else if(t===et)this.pos+=4;else if(t===Je)this.pos+=8;else throw new Error(`Unimplemented type: ${t}`)}writeTag(e,t){this.writeVarint(e<<3|t)}realloc(e){let t=this.length||16;for(;t<this.pos+e;)t*=2;if(t!==this.length){const i=new Uint8Array(t);i.set(this.buf),this.buf=i,this.dataView=new DataView(i.buffer),this.length=t}}finish(){return this.length=this.pos,this.pos=0,this.buf.subarray(0,this.length)}writeFixed32(e){this.realloc(4),this.dataView.setInt32(this.pos,e,!0),this.pos+=4}writeSFixed32(e){this.realloc(4),this.dataView.setInt32(this.pos,e,!0),this.pos+=4}writeFixed64(e){this.realloc(8),this.dataView.setInt32(this.pos,e&-1,!0),this.dataView.setInt32(this.pos+4,Math.floor(e*Xi),!0),this.pos+=8}writeSFixed64(e){this.realloc(8),this.dataView.setInt32(this.pos,e&-1,!0),this.dataView.setInt32(this.pos+4,Math.floor(e*Xi),!0),this.pos+=8}writeVarint(e){if(e=+e||0,e>268435455||e<0){el(e,this);return}this.realloc(4),this.buf[this.pos++]=e&127|(e>127?128:0),!(e<=127)&&(this.buf[this.pos++]=(e>>>=7)&127|(e>127?128:0),!(e<=127)&&(this.buf[this.pos++]=(e>>>=7)&127|(e>127?128:0),!(e<=127)&&(this.buf[this.pos++]=e>>>7&127)))}writeSVarint(e){this.writeVarint(e<0?-e*2-1:e*2)}writeBoolean(e){this.writeVarint(+e)}writeString(e){e=String(e),this.realloc(e.length*4),this.pos++;const t=this.pos;this.pos=fl(this.buf,e,this.pos);const i=this.pos-t;i>=128&&Yi(t,i,this),this.pos=t-1,this.writeVarint(i),this.pos+=i}writeFloat(e){this.realloc(4),this.dataView.setFloat32(this.pos,e,!0),this.pos+=4}writeDouble(e){this.realloc(8),this.dataView.setFloat64(this.pos,e,!0),this.pos+=8}writeBytes(e){const t=e.length;this.writeVarint(t),this.realloc(t);for(let i=0;i<t;i++)this.buf[this.pos++]=e[i]}writeRawMessage(e,t){this.pos++;const i=this.pos;e(t,this);const r=this.pos-i;r>=128&&Yi(i,r,this),this.pos=i-1,this.writeVarint(r),this.pos+=r}writeMessage(e,t,i){this.writeTag(e,Be),this.writeRawMessage(t,i)}writePackedVarint(e,t){t.length&&this.writeMessage(e,rl,t)}writePackedSVarint(e,t){t.length&&this.writeMessage(e,ol,t)}writePackedBoolean(e,t){t.length&&this.writeMessage(e,al,t)}writePackedFloat(e,t){t.length&&this.writeMessage(e,nl,t)}writePackedDouble(e,t){t.length&&this.writeMessage(e,sl,t)}writePackedFixed32(e,t){t.length&&this.writeMessage(e,ll,t)}writePackedSFixed32(e,t){t.length&&this.writeMessage(e,cl,t)}writePackedFixed64(e,t){t.length&&this.writeMessage(e,ul,t)}writePackedSFixed64(e,t){t.length&&this.writeMessage(e,hl,t)}writeBytesField(e,t){this.writeTag(e,Be),this.writeBytes(t)}writeFixed32Field(e,t){this.writeTag(e,et),this.writeFixed32(t)}writeSFixed32Field(e,t){this.writeTag(e,et),this.writeSFixed32(t)}writeFixed64Field(e,t){this.writeTag(e,Je),this.writeFixed64(t)}writeSFixed64Field(e,t){this.writeTag(e,Je),this.writeSFixed64(t)}writeVarintField(e,t){this.writeTag(e,Et),this.writeVarint(t)}writeSVarintField(e,t){this.writeTag(e,Et),this.writeSVarint(t)}writeStringField(e,t){this.writeTag(e,Be),this.writeString(t)}writeFloatField(e,t){this.writeTag(e,et),this.writeFloat(t)}writeDoubleField(e,t){this.writeTag(e,Je),this.writeDouble(t)}writeBooleanField(e,t){this.writeVarintField(e,+t)}}function Ja(o,e,t){const i=t.buf;let r,n;if(n=i[t.pos++],r=(n&112)>>4,n<128||(n=i[t.pos++],r|=(n&127)<<3,n<128)||(n=i[t.pos++],r|=(n&127)<<10,n<128)||(n=i[t.pos++],r|=(n&127)<<17,n<128)||(n=i[t.pos++],r|=(n&127)<<24,n<128)||(n=i[t.pos++],r|=(n&1)<<31,n<128))return xe(o,r,e);throw new Error("Expected varint not more than 10 bytes")}function xe(o,e,t){return t?e*4294967296+(o>>>0):(e>>>0)*4294967296+(o>>>0)}function el(o,e){let t,i;if(o>=0?(t=o%4294967296|0,i=o/4294967296|0):(t=~(-o%4294967296),i=~(-o/4294967296),t^4294967295?t=t+1|0:(t=0,i=i+1|0)),o>=18446744073709552e3||o<-18446744073709552e3)throw new Error("Given varint doesn't fit into 10 bytes");e.realloc(10),tl(t,i,e),il(i,e)}function tl(o,e,t){t.buf[t.pos++]=o&127|128,o>>>=7,t.buf[t.pos++]=o&127|128,o>>>=7,t.buf[t.pos++]=o&127|128,o>>>=7,t.buf[t.pos++]=o&127|128,o>>>=7,t.buf[t.pos]=o&127}function il(o,e){const t=(o&7)<<4;e.buf[e.pos++]|=t|((o>>>=3)?128:0),o&&(e.buf[e.pos++]=o&127|((o>>>=7)?128:0),o&&(e.buf[e.pos++]=o&127|((o>>>=7)?128:0),o&&(e.buf[e.pos++]=o&127|((o>>>=7)?128:0),o&&(e.buf[e.pos++]=o&127|((o>>>=7)?128:0),o&&(e.buf[e.pos++]=o&127)))))}function Yi(o,e,t){const i=e<=16383?1:e<=2097151?2:e<=268435455?3:Math.floor(Math.log(e)/(Math.LN2*7));t.realloc(i);for(let r=t.pos-1;r>=o;r--)t.buf[r+i]=t.buf[r]}function rl(o,e){for(let t=0;t<o.length;t++)e.writeVarint(o[t])}function ol(o,e){for(let t=0;t<o.length;t++)e.writeSVarint(o[t])}function nl(o,e){for(let t=0;t<o.length;t++)e.writeFloat(o[t])}function sl(o,e){for(let t=0;t<o.length;t++)e.writeDouble(o[t])}function al(o,e){for(let t=0;t<o.length;t++)e.writeBoolean(o[t])}function ll(o,e){for(let t=0;t<o.length;t++)e.writeFixed32(o[t])}function cl(o,e){for(let t=0;t<o.length;t++)e.writeSFixed32(o[t])}function ul(o,e){for(let t=0;t<o.length;t++)e.writeFixed64(o[t])}function hl(o,e){for(let t=0;t<o.length;t++)e.writeSFixed64(o[t])}function dl(o,e,t){let i="",r=e;for(;r<t;){const n=o[r];let s=null,a=n>239?4:n>223?3:n>191?2:1;if(r+a>t)break;let l,c,d;a===1?n<128&&(s=n):a===2?(l=o[r+1],(l&192)===128&&(s=(n&31)<<6|l&63,s<=127&&(s=null))):a===3?(l=o[r+1],c=o[r+2],(l&192)===128&&(c&192)===128&&(s=(n&15)<<12|(l&63)<<6|c&63,(s<=2047||s>=55296&&s<=57343)&&(s=null))):a===4&&(l=o[r+1],c=o[r+2],d=o[r+3],(l&192)===128&&(c&192)===128&&(d&192)===128&&(s=(n&15)<<18|(l&63)<<12|(c&63)<<6|d&63,(s<=65535||s>=1114112)&&(s=null))),s===null?(s=65533,a=1):s>65535&&(s-=65536,i+=String.fromCharCode(s>>>10&1023|55296),s=56320|s&1023),i+=String.fromCharCode(s),r+=a}return i}function fl(o,e,t){for(let i=0,r,n;i<e.length;i++){if(r=e.charCodeAt(i),r>55295&&r<57344)if(n)if(r<56320){o[t++]=239,o[t++]=191,o[t++]=189,n=r;continue}else r=n-55296<<10|r-56320|65536,n=null;else{r>56319||i+1===e.length?(o[t++]=239,o[t++]=191,o[t++]=189):n=r;continue}else n&&(o[t++]=239,o[t++]=191,o[t++]=189,n=null);r<128?o[t++]=r:(r<2048?o[t++]=r>>6|192:(r<65536?o[t++]=r>>12|224:(o[t++]=r>>18|240,o[t++]=r>>12&63|128),o[t++]=r>>6&63|128),o[t++]=r&63|128)}return t}export{$ as E,qa as L,pl as M,xl as P,ml as R,q as W,Da as _,gl as a,be as b,st as c,de as d,Ue as e,L as f,xa as g,H as l,qt as m,ma as p,Lt as r};
