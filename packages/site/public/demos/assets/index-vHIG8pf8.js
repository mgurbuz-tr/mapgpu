(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const s of o.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&i(s)}).observe(document,{childList:!0,subtree:!0});function t(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(r){if(r.ep)return;r.ep=!0;const o=t(r);fetch(r.href,o)}})();const Ie={format:"depth24plus",compareFunc:"less",clearValue:1};function ze(n){return typeof n.vertexShader=="string"&&typeof n.fragmentShader=="string"&&typeof n.getVertexBuffers=="function"&&typeof n.getDrawCommand=="function"}function oi(n){return typeof n.getTileUrl=="function"&&"minZoom"in n&&"maxZoom"in n}function se(n){return typeof n.getFeatures=="function"}function Oe(n){return typeof n.requestTile=="function"&&typeof n.getReadyHeightTile=="function"&&typeof n.getReadyHillshadeTile=="function"&&"minZoom"in n&&"maxZoom"in n&&"exaggeration"in n}function Ut(n){return typeof n.getSourcePoints3857=="function"&&"clusterRadius"in n}function At(n){return typeof n.updatePositions=="function"&&"pointCount"in n}class Q{listeners=new Map;on(e,t){this.listeners.has(e)||this.listeners.set(e,new Set),this.listeners.get(e).add(t)}off(e,t){this.listeners.get(e)?.delete(t)}emit(e,t){const i=this.listeners.get(e);if(i)for(const r of i)try{r(t)}catch(o){console.error(`Event handler error [${String(e)}]:`,o)}}once(e,t){const i=(r=>{this.off(e,i),t(r)});this.on(e,i)}removeAll(e){e?this.listeners.delete(e):this.listeners.clear()}}const ye=6378137,Ye=85.0511287798066;function q(n,e){const t=Math.max(-Ye,Math.min(Ye,e)),i=n*Math.PI*ye/180,r=t*Math.PI/180,o=Math.log(Math.tan(Math.PI/4+r/2))*ye;return[i,o]}function Ke(n,e){const t=n/ye*(180/Math.PI),i=(Math.atan(Math.exp(e/ye))-Math.PI/4)*(360/Math.PI);return[t,i]}class ni{_layers=[];_events=new Q;get layers(){return this._layers}add(e){if(this._layers.some(i=>i.id===e.id))return;const t=this._layers.length;this._layers.push(e),this._events.emit("layer-add",{layer:e,index:t})}remove(e){const t=this._layers.findIndex(r=>r.id===e.id);if(t===-1)return;const[i]=this._layers.splice(t,1);return i&&this._events.emit("layer-remove",{layer:i,index:t}),i}findLayerById(e){return this._layers.find(t=>t.id===e)}reorder(e,t){const i=this._layers.findIndex(o=>o.id===e.id);if(i===-1)return;const r=Math.max(0,Math.min(this._layers.length-1,t));i!==r&&(this._layers.splice(i,1),this._layers.splice(r,0,e),this._events.emit("layer-reorder",{layer:e,fromIndex:i,toIndex:r}))}removeAll(){for(;this._layers.length>0;){const e=this._layers.pop();e&&this._events.emit("layer-remove",{layer:e,index:this._layers.length})}}on(e,t){this._events.on(e,t)}off(e,t){this._events.off(e,t)}destroy(){this.removeAll(),this._events.removeAll()}}const si=20037508342789244e-9;class ai{_center;_zoom;_rotation;_minZoom;_maxZoom;_viewportWidth;_viewportHeight;_dirty=!0;_viewMatrix=new Float32Array(16);_projectionMatrix=new Float32Array(16);constructor(e={}){this._center=e.center??[0,0],this._zoom=e.zoom??0,this._rotation=e.rotation??0,this._minZoom=e.minZoom??0,this._maxZoom=e.maxZoom??24,this._viewportWidth=e.viewportWidth??800,this._viewportHeight=e.viewportHeight??600,this._clampZoom(),this._updateMatrices()}get center(){return[this._center[0],this._center[1]]}get zoom(){return this._zoom}get rotation(){return this._rotation}get minZoom(){return this._minZoom}get maxZoom(){return this._maxZoom}get viewportWidth(){return this._viewportWidth}get viewportHeight(){return this._viewportHeight}get dirty(){return this._dirty}setCenter(e){this._center=[e[0],e[1]],this._dirty=!0,this._updateMatrices()}setZoom(e){this._zoom=e,this._clampZoom(),this._dirty=!0,this._updateMatrices()}setRotation(e){this._rotation=e,this._dirty=!0,this._updateMatrices()}setViewport(e,t){this._viewportWidth=e,this._viewportHeight=t,this._dirty=!0,this._updateMatrices()}zoomIn(){this.setZoom(this._zoom+1)}zoomOut(){this.setZoom(this._zoom-1)}clearDirty(){this._dirty=!1}get viewMatrix(){return this._viewMatrix}get projectionMatrix(){return this._projectionMatrix}getExtent(){const e=this._getResolution(),t=this._viewportWidth/2*e,i=this._viewportHeight/2*e;if(this._rotation===0)return{minX:this._center[0]-t,minY:this._center[1]-i,maxX:this._center[0]+t,maxY:this._center[1]+i,spatialReference:"EPSG:3857"};const r=Math.cos(this._rotation),o=Math.sin(this._rotation),s=[[-t,-i],[t,-i],[t,i],[-t,i]];let a=1/0,l=1/0,c=-1/0,h=-1/0;for(const[u,d]of s){const p=u*r-d*o+this._center[0],f=u*o+d*r+this._center[1];a=Math.min(a,p),l=Math.min(l,f),c=Math.max(c,p),h=Math.max(h,f)}return{minX:a,minY:l,maxX:c,maxY:h,spatialReference:"EPSG:3857"}}screenToMap(e,t){const i=this._getResolution();let r=(e-this._viewportWidth/2)*i,o=(this._viewportHeight/2-t)*i;if(this._rotation!==0){const s=Math.cos(-this._rotation),a=Math.sin(-this._rotation),l=r*s-o*a,c=r*a+o*s;r=l,o=c}return[this._center[0]+r,this._center[1]+o]}mapToScreen(e,t){const i=this._getResolution();let r=e-this._center[0],o=t-this._center[1];if(this._rotation!==0){const l=Math.cos(this._rotation),c=Math.sin(this._rotation),h=r*l-o*c,u=r*c+o*l;r=h,o=u}const s=r/i+this._viewportWidth/2,a=this._viewportHeight/2-o/i;return[s,a]}_getResolution(){return si*2/(256*Math.pow(2,this._zoom))}_clampZoom(){this._zoom=Math.max(this._minZoom,Math.min(this._maxZoom,this._zoom))}_updateMatrices(){const e=this._getResolution(),t=this._viewportWidth/2*e,i=this._viewportHeight/2*e,r=this._projectionMatrix;r.fill(0),r[0]=1/t,r[5]=1/i,r[10]=-1,r[15]=1;const o=this._viewMatrix,s=Math.cos(-this._rotation),a=Math.sin(-this._rotation),l=-this._center[0],c=-this._center[1];o.fill(0),o[0]=s,o[1]=a,o[4]=-a,o[5]=s,o[10]=1,o[12]=s*l+-a*c,o[13]=a*l+s*c,o[15]=1}}class li{_layers=new Map;_events=new Q;_currentZoom=0;async addLayer(e){if(this._layers.has(e.id))return;const t={layer:e,loading:!1,loadError:null,dirty:!0,effectivelyVisible:this._isVisibleAtZoom(e,this._currentZoom)};this._layers.set(e.id,t),await this._loadLayer(t)}removeLayer(e){const t=this._layers.get(e);t&&(t.layer.destroy(),this._layers.delete(e))}removeAll(){for(const e of this._layers.values())e.layer.destroy();this._layers.clear()}getLayer(e){return this._layers.get(e)?.layer}getLayerIds(){return Array.from(this._layers.keys())}setCurrentZoom(e){this._currentZoom=e;for(const[t,i]of this._layers){const r=i.effectivelyVisible;i.effectivelyVisible=this._isVisibleAtZoom(i.layer,e),r!==i.effectivelyVisible&&(this._events.emit("layer-visibility-change",{layerId:t,visible:i.effectivelyVisible}),i.dirty=!0)}}isLayerVisible(e){const t=this._layers.get(e);return t?t.effectivelyVisible:!1}markDirty(e){const t=this._layers.get(e);t&&(t.dirty=!0,this._events.emit("layer-dirty",{layerId:e}))}getDirtyLayers(){const e=[];for(const[t,i]of this._layers)i.dirty&&i.effectivelyVisible&&e.push(t);return e}clearDirty(e){const t=this._layers.get(e);t&&(t.dirty=!1)}clearAllDirty(){for(const e of this._layers.values())e.dirty=!1}hasAnyDirty(){for(const e of this._layers.values())if(e.dirty&&e.effectivelyVisible)return!0;return!1}on(e,t){this._events.on(e,t)}off(e,t){this._events.off(e,t)}destroy(){this.removeAll(),this._events.removeAll()}async _loadLayer(e){if(!(e.layer.loaded||e.loading)){e.loading=!0;try{await e.layer.load(),e.loading=!1,e.dirty=!0,this._events.emit("layer-loaded",{layerId:e.layer.id})}catch(t){e.loading=!1;const i={kind:"layer-load-failed",layerId:e.layer.id,cause:t instanceof Error?t:new Error(String(t))};e.loadError=i,this._events.emit("layer-load-error",{layerId:e.layer.id,error:i})}}}_isVisibleAtZoom(e,t){if(!e.visible)return!1;const i=559082264028717e-6/Math.pow(2,t);return!(e.minScale!==void 0&&e.minScale>0&&i>e.minScale||e.maxScale!==void 0&&e.maxScale>0&&i<e.maxScale)}}const V=20037508342789244e-9,qe=85.0511287798066;class ci{_maxConcurrent;_tileSize;constructor(e={}){this._maxConcurrent=e.maxConcurrent??6,this._tileSize=e.tileSize??256}get maxConcurrent(){return this._maxConcurrent}get tileSize(){return this._tileSize}getTilesForExtent(e,t){const i=Math.max(0,Math.round(t)),r=Math.pow(2,i),s=V*2/r,a=Math.max(0,Math.floor((e.minX+V)/s)),l=Math.min(r-1,Math.floor((e.maxX+V)/s)),c=Math.max(0,Math.floor((V-e.maxY)/s)),h=Math.min(r-1,Math.floor((V-e.minY)/s)),u=(e.minX+e.maxX)/2,d=(e.minY+e.maxY)/2,p=[];for(let f=c;f<=h;f++)for(let g=a;g<=l;g++){const x=this.tileToExtent(i,g,f),v=(x.minX+x.maxX)/2,y=(x.minY+x.maxY)/2,m=v-u,_=y-d,b=m*m+_*_;p.push({z:i,x:g,y:f,priority:b})}return p.sort((f,g)=>f.priority-g.priority),p}tileToExtent(e,t,i){const r=Math.pow(2,e),o=V*2/r,s=t*o-V,a=V-i*o,l=s+o,c=a-o;return{minX:s,minY:c,maxX:l,maxY:a,spatialReference:"EPSG:3857"}}lonLatToTile(e,t,i){const r=Math.max(0,Math.round(i)),o=Math.pow(2,r),s=Math.max(-qe,Math.min(qe,t)),a=Math.floor((e+180)/360*o),l=s*Math.PI/180,c=Math.floor((1-Math.log(Math.tan(l)+1/Math.cos(l))/Math.PI)/2*o);return{z:r,x:Math.max(0,Math.min(o-1,a)),y:Math.max(0,Math.min(o-1,c))}}clipToConcurrentLimit(e){return e.slice(0,this._maxConcurrent)}}class ui{_running=!1;_dirty=!0;_rafId=null;_firstFrame=!0;_lastTimestamp=0;_frameNumber=0;_skippedFrames=0;_fps=0;_frameDurationMs=0;_targetFps;_minFrameInterval;_fpsAccumulator=0;_fpsFrameCount=0;_fpsLastUpdate=0;_renderEngine=null;_cameraStateProvider=null;_frameCallbacks=new Set;_preFrameCallbacks=new Set;_requestAnimationFrame;_cancelAnimationFrame;constructor(e={},t,i){this._targetFps=e.targetFps??60,this._minFrameInterval=this._targetFps>0?1e3/this._targetFps:0,this._requestAnimationFrame=t??(r=>requestAnimationFrame(r)),this._cancelAnimationFrame=i??(r=>cancelAnimationFrame(r))}setRenderEngine(e){this._renderEngine=e}setCameraStateProvider(e){this._cameraStateProvider=e}onFrame(e){this._frameCallbacks.add(e)}offFrame(e){this._frameCallbacks.delete(e)}onPreFrame(e){this._preFrameCallbacks.add(e)}offPreFrame(e){this._preFrameCallbacks.delete(e)}markDirty(){this._dirty=!0}get isDirty(){return this._dirty}get running(){return this._running}start(){this._running||(this._running=!0,this._firstFrame=!0,this._lastTimestamp=0,this._fpsLastUpdate=0,this._scheduleFrame())}stop(){this._running=!1,this._rafId!==null&&(this._cancelAnimationFrame(this._rafId),this._rafId=null)}getStats(){return{fps:this._fps,frameDurationMs:this._frameDurationMs,totalFrames:this._frameNumber,skippedFrames:this._skippedFrames}}destroy(){this.stop(),this._renderEngine=null,this._cameraStateProvider=null,this._frameCallbacks.clear(),this._preFrameCallbacks.clear()}_scheduleFrame(){this._running&&(this._rafId=this._requestAnimationFrame(e=>{this._tick(e)}))}_tick(e){if(!this._running)return;if(this._firstFrame){this._firstFrame=!1,this._lastTimestamp=e,this._fpsLastUpdate=e,this._scheduleFrame();return}const t=e-this._lastTimestamp;if(this._minFrameInterval>0&&t<this._minFrameInterval){this._scheduleFrame();return}if(this._lastTimestamp=e,!this._dirty){this._skippedFrames++,this._scheduleFrame();return}this._dirty=!1,this._frameNumber++,this._frameDurationMs=t,this._fpsFrameCount++,this._fpsAccumulator+=t,e-this._fpsLastUpdate>=1e3&&(this._fps=this._fpsAccumulator>0?this._fpsFrameCount/this._fpsAccumulator*1e3:0,this._fpsFrameCount=0,this._fpsAccumulator=0,this._fpsLastUpdate=e);for(const i of this._preFrameCallbacks)try{i(t,this._frameNumber)}catch(r){console.error("RenderLoop pre-frame callback error:",r)}if(this._renderEngine&&this._cameraStateProvider){const i=this._cameraStateProvider();this._renderEngine.beginFrame(i)}for(const i of this._frameCallbacks)try{i(t,this._frameNumber)}catch(r){console.error("RenderLoop frame callback error:",r)}this._renderEngine&&(this._renderEngine.endFrame(),this._renderEngine.needsContinuousRender&&(this._dirty=!0)),this._scheduleFrame()}}class hi{_undoStack=[];_redoStack=[];_maxHistorySize;_events=new Q;constructor(e={}){this._maxHistorySize=e.maxHistorySize??50}execute(e){for(e.execute(),this._undoStack.push(e),this._redoStack=[];this._undoStack.length>this._maxHistorySize;)this._undoStack.shift();this._events.emit("command-executed",{command:e})}undo(){const e=this._undoStack.pop();return e?(e.undo(),this._redoStack.push(e),this._events.emit("command-undone",{command:e}),!0):!1}redo(){const e=this._redoStack.pop();return e?(e.execute(),this._undoStack.push(e),this._events.emit("command-redone",{command:e}),!0):!1}get canUndo(){return this._undoStack.length>0}get canRedo(){return this._redoStack.length>0}get undoCount(){return this._undoStack.length}get redoCount(){return this._redoStack.length}clear(){this._undoStack=[],this._redoStack=[]}on(e,t){this._events.on(e,t)}off(e,t){this._events.off(e,t)}destroy(){this.clear(),this._events.removeAll()}}function di(n){return{m0:n[0]??0,m1:n[1]??0,m2:n[2]??0,m3:n[3]??0,m4:n[4]??0,m5:n[5]??0,m6:n[6]??0,m7:n[7]??0,m8:n[8]??0,m9:n[9]??0,m10:n[10]??0,m11:n[11]??0,m12:n[12]??0,m13:n[13]??0,m14:n[14]??0,m15:n[15]??0}}function fi(n){const{m0:e,m1:t,m2:i,m3:r,m4:o,m5:s,m6:a,m7:l,m8:c,m9:h,m10:u,m11:d,m12:p,m13:f,m14:g,m15:x}=di(n);return[Y({a:r+e,b:l+o,c:d+c,d:x+p}),Y({a:r-e,b:l-o,c:d-c,d:x-p}),Y({a:r+t,b:l+s,c:d+h,d:x+f}),Y({a:r-t,b:l-s,c:d-h,d:x-f}),Y({a:i,b:a,c:u,d:g}),Y({a:r-i,b:l-a,c:d-u,d:x-g})]}function Y(n){const e=Math.sqrt(n.a*n.a+n.b*n.b+n.c*n.c);return e<1e-15?n:{a:n.a/e,b:n.b/e,c:n.c/e,d:n.d/e}}const pi=async n=>{const e=await fetch(n,{mode:"cors"});if(!e.ok)throw new Error(`Tile fetch failed: ${e.status} ${n}`);const t=await e.blob();return createImageBitmap(t)};class mi{_tileScheduler;_maxCacheEntries;_maxConcurrent;_fetcher;_cache=new Map;_inFlight=new Map;_renderEngine=null;onDirty=null;_destroyed=!1;constructor(e){this._tileScheduler=e.tileScheduler,this._maxCacheEntries=e.maxCacheEntries??512,this._maxConcurrent=e.maxConcurrent??6,this._fetcher=e.fetcher??pi}setRenderEngine(e){this._renderEngine=e}getReadyTiles(e,t,i){if(this._destroyed)return[];const r=Date.now(),o=new Set,s=[],a=[];for(let l=0;l<i.length;l++){const c=i[l],h=Math.max(c.minZoom,Math.min(c.maxZoom,Math.round(t))),u=this._tileScheduler.getTilesForExtent(e,h);for(const d of u){const p=`${l}/${d.z}/${d.x}/${d.y}`,f=this._cache.get(p);if(f)f.lastUsed=r,a.push({texture:f.texture,extent:f.extent,opacity:f.opacity,filters:c.filters});else{this._startFetch(p,l,c,d.z,d.x,d.y);let g=d.z-1,x=Math.floor(d.x/2),v=Math.floor(d.y/2);for(;g>=c.minZoom;){const y=`${l}/${g}/${x}/${v}`,m=this._cache.get(y);if(m){o.has(y)||(o.add(y),m.lastUsed=r,s.push({texture:m.texture,extent:m.extent,opacity:m.opacity,filters:c.filters}));break}g--,x=Math.floor(x/2),v=Math.floor(v/2)}}}}return this._evictIfNeeded(),[...s,...a]}getReadyTilesForCoords(e,t){if(this._destroyed)return[];const i=Date.now(),r=new Set,o=[],s=[];for(let a=0;a<t.length;a++){const l=t[a];for(const c of e){if(Math.max(l.minZoom,Math.min(l.maxZoom,c.z))!==c.z)continue;const u=`${a}/${c.z}/${c.x}/${c.y}`,d=this._cache.get(u);if(d)d.lastUsed=i,s.push({texture:d.texture,extent:d.extent,opacity:d.opacity,filters:l.filters});else{this._startFetch(u,a,l,c.z,c.x,c.y);let p=c.z-1,f=Math.floor(c.x/2),g=Math.floor(c.y/2);for(;p>=l.minZoom;){const x=`${a}/${p}/${f}/${g}`,v=this._cache.get(x);if(v){r.has(x)||(r.add(x),v.lastUsed=i,o.push({texture:v.texture,extent:v.extent,opacity:v.opacity,filters:l.filters}));break}p--,f=Math.floor(f/2),g=Math.floor(g/2)}}}}return this._evictIfNeeded(),[...o,...s]}invalidateAll(){if(!this._destroyed){for(const e of this._cache.values())this._renderEngine?.releaseTexture(e.texture);this._cache.clear(),this._inFlight.clear()}}destroy(){this._destroyed=!0;for(const e of this._cache.values())this._renderEngine&&this._renderEngine.releaseTexture(e.texture);this._cache.clear(),this._inFlight.clear(),this._renderEngine=null,this.onDirty=null}get cacheSize(){return this._cache.size}get inFlightCount(){return this._inFlight.size}_startFetch(e,t,i,r,o,s){if(this._inFlight.has(e)||this._inFlight.size>=this._maxConcurrent)return;const a=i.getTileUrl(r,o,s),l=this._fetchAndCache(e,a,i,r,o,s);this._inFlight.set(e,l),l.finally(()=>{this._inFlight.delete(e)})}async _fetchAndCache(e,t,i,r,o,s){try{const a=await this._fetcher(t);if(this._destroyed||!this._renderEngine)return;const l=this._renderEngine.createTexture(a),c=this._tileScheduler.tileToExtent(r,o,s),h=[c.minX,c.minY,c.maxX,c.maxY];this._cache.set(e,{texture:l,extent:h,opacity:i.opacity,lastUsed:Date.now()}),this.onDirty?.()}catch{}}_evictIfNeeded(){if(this._cache.size<=this._maxCacheEntries)return;const e=[...this._cache.entries()].sort((i,r)=>i[1].lastUsed-r[1].lastUsed),t=this._cache.size-this._maxCacheEntries;for(let i=0;i<t;i++){const[r,o]=e[i];this._renderEngine&&this._renderEngine.releaseTexture(o.texture),this._cache.delete(r)}}}class gi{_maxHeightCacheEntries;_maxHillshadeCacheEntries;_maxConcurrent;_heightCache=new Map;_hillshadeCache=new Map;_inFlight=new Map;_renderEngine=null;_destroyed=!1;_activeLayerId=null;onDirty=null;constructor(e={}){this._maxHeightCacheEntries=e.maxHeightCacheEntries??256,this._maxHillshadeCacheEntries=e.maxHillshadeCacheEntries??256,this._maxConcurrent=e.maxConcurrent??8}setRenderEngine(e){this._renderEngine=e}setActiveLayer(e){this._activeLayerId!==e&&(this._activeLayerId=e,this._pruneCachesForActiveLayer())}requestTiles(e,t){if(!this._destroyed){this.setActiveLayer(e.id);for(const i of t){const r=this._normalizeRequestCoord(e,i);if(!r)continue;const{z:o,x:s,y:a}=r;this._materializeHeightIfReady(e,o,s,a),this._materializeHillshadeIfReady(e,o,s,a),this._startRequest(e,o,s,a)}}}getReadyHeightTile(e,t,i,r){if(this._destroyed||t<e.minZoom)return null;this.setActiveLayer(e.id);let o=t,s=i,a=r;if(o>e.maxZoom){const c=1<<o-e.maxZoom;s=Math.floor(s/c),a=Math.floor(a/c),o=e.maxZoom}for(;o>=e.minZoom;){const l=this._getOrMaterializeHeight(e,o,s,a);if(l)return l.lastUsed=Date.now(),{texture:l.texture,sourceCoord:l.coord,uvOffsetScale:this._computeUvOffsetScale(t,i,r,l.coord.z,l.coord.x,l.coord.y)};o-=1,s=Math.floor(s/2),a=Math.floor(a/2)}return null}getReadyHillshadeTile(e,t,i,r){if(this._destroyed||t<e.minZoom)return null;this.setActiveLayer(e.id);let o=t,s=i,a=r;if(o>e.maxZoom){const c=1<<o-e.maxZoom;s=Math.floor(s/c),a=Math.floor(a/c),o=e.maxZoom}for(;o>=e.minZoom;){const l=this._getOrMaterializeHillshade(e,o,s,a);if(l)return l.lastUsed=Date.now(),{texture:l.texture,sourceCoord:l.coord};o-=1,s=Math.floor(s/2),a=Math.floor(a/2)}return null}invalidateLayer(e){if(!this._destroyed){this._invalidateCachesForLayer(e);for(const t of this._inFlight.keys())this._layerIdFromKey(t)===e&&this._inFlight.delete(t)}}invalidateAll(){this._destroyed||(this._releaseCache(this._heightCache),this._releaseCache(this._hillshadeCache),this._inFlight.clear())}destroy(){this._destroyed||(this._destroyed=!0,this._releaseCache(this._heightCache),this._releaseCache(this._hillshadeCache),this._inFlight.clear(),this._renderEngine=null,this.onDirty=null,this._activeLayerId=null)}get heightCacheSize(){return this._heightCache.size}get hillshadeCacheSize(){return this._hillshadeCache.size}get inFlightCount(){return this._inFlight.size}_startRequest(e,t,i,r){const o=this._cacheKey(e.id,t,i,r);if(this._inFlight.has(o)||this._inFlight.size>=this._maxConcurrent)return;const s=Promise.resolve().then(async()=>{if(await e.requestTile(t,i,r),this._destroyed||this._activeLayerId!==e.id)return;const a=this._materializeHeightIfReady(e,t,i,r),l=this._materializeHillshadeIfReady(e,t,i,r);(a||l)&&this.onDirty?.()}).catch(()=>{}).finally(()=>{this._inFlight.delete(o)});this._inFlight.set(o,s)}_normalizeRequestCoord(e,t){if(t.z<e.minZoom)return null;if(t.z<=e.maxZoom)return t;const r=1<<t.z-e.maxZoom;return{z:e.maxZoom,x:Math.floor(t.x/r),y:Math.floor(t.y/r)}}_cacheKey(e,t,i,r){return`${e}|${t}/${i}/${r}`}_layerIdFromKey(e){const t=e.indexOf("|");return t<0?e:e.slice(0,t)}_materializeHeightIfReady(e,t,i,r){return this._getOrMaterializeHeight(e,t,i,r)!==null}_materializeHillshadeIfReady(e,t,i,r){return this._getOrMaterializeHillshade(e,t,i,r)!==null}_getOrMaterializeHeight(e,t,i,r){const o=this._cacheKey(e.id,t,i,r),s=this._heightCache.get(o);if(s)return s;if(!this._renderEngine)return null;const a=e.getReadyHeightTile(t,i,r);if(!a)return null;const l=this._createHeightEntry(a);return this._heightCache.set(o,l),this._evictIfNeeded(this._heightCache,this._maxHeightCacheEntries),l}_getOrMaterializeHillshade(e,t,i,r){const o=this._cacheKey(e.id,t,i,r),s=this._hillshadeCache.get(o);if(s)return s;if(!this._renderEngine)return null;const a=e.getReadyHillshadeTile(t,i,r);if(!a)return null;const l=this._createHillshadeEntry(a);return this._hillshadeCache.set(o,l),this._evictIfNeeded(this._hillshadeCache,this._maxHillshadeCacheEntries),l}_createHeightEntry(e){if(!this._renderEngine)throw new Error("TerrainTileManager render engine is not set");return{texture:this._renderEngine.createFloat32Texture(e.data,e.width,e.height),coord:{z:e.z,x:e.x,y:e.y},lastUsed:Date.now()}}_createHillshadeEntry(e){if(!this._renderEngine)throw new Error("TerrainTileManager render engine is not set");let t=e.data;return e.data.length===e.width*e.height&&(t=this._expandGrayToRgba(e.data)),{texture:this._renderEngine.createRGBA8Texture(t,e.width,e.height),coord:{z:e.z,x:e.x,y:e.y},lastUsed:Date.now()}}_expandGrayToRgba(e){const t=new Uint8Array(e.length*4);for(let i=0;i<e.length;i++){const r=e[i]??0,o=i*4;t[o]=r,t[o+1]=r,t[o+2]=r,t[o+3]=255}return t}_computeUvOffsetScale(e,t,i,r,o,s){if(r>=e)return[0,0,1,1];const l=1<<e-r,c=1/l,h=(t-o*l)*c,u=(i-s*l)*c;return[h,u,c,c]}_evictIfNeeded(e,t){if(!this._renderEngine||e.size<=t)return;const i=[...e.entries()].sort((o,s)=>o[1].lastUsed-s[1].lastUsed),r=e.size-t;for(let o=0;o<r;o++){const s=i[o];if(!s)break;e.delete(s[0]),this._renderEngine.releaseTexture(s[1].texture)}}_pruneCachesForActiveLayer(){if(this._renderEngine){for(const e of[...this._heightCache.keys()]){if(this._layerIdFromKey(e)===this._activeLayerId)continue;const t=this._heightCache.get(e);t&&(this._heightCache.delete(e),this._renderEngine.releaseTexture(t.texture))}for(const e of[...this._hillshadeCache.keys()]){if(this._layerIdFromKey(e)===this._activeLayerId)continue;const t=this._hillshadeCache.get(e);t&&(this._hillshadeCache.delete(e),this._renderEngine.releaseTexture(t.texture))}}}_invalidateCachesForLayer(e){if(this._renderEngine){for(const t of[...this._heightCache.keys()]){if(this._layerIdFromKey(t)!==e)continue;const i=this._heightCache.get(t);i&&(this._heightCache.delete(t),this._renderEngine.releaseTexture(i.texture))}for(const t of[...this._hillshadeCache.keys()]){if(this._layerIdFromKey(t)!==e)continue;const i=this._hillshadeCache.get(t);i&&(this._hillshadeCache.delete(t),this._renderEngine.releaseTexture(i.texture))}}}_releaseCache(e){if(this._renderEngine)for(const t of e.values())this._renderEngine.releaseTexture(t.texture);e.clear()}}class xi{_element;_camera;_onDirty;_onViewChange;_panEnabled;_zoomEnabled;_keyboardEnabled;_doubleClickZoom;_zoomSpeed;_inertiaDuration;_dragging=!1;_lastPointerX=0;_lastPointerY=0;_activePointerId=null;_pointers=new Map;_lastPinchDist=0;_lastPinchCenterX=0;_lastPinchCenterY=0;_velocityX=0;_velocityY=0;_lastMoveTime=0;_inertiaRafId=null;_lastClickTime=0;_lastClickX=0;_lastClickY=0;_onPointerDown;_onPointerMove;_onPointerUp;_onWheel;_onKeyDown;_onContextMenu;_destroyed=!1;constructor(e,t,i,r,o={}){this._element=e,this._camera=t,this._onDirty=i,this._onViewChange=r,this._panEnabled=o.pan??!0,this._zoomEnabled=o.zoom??!0,this._keyboardEnabled=o.keyboard??!0,this._doubleClickZoom=o.doubleClickZoom??!0,this._zoomSpeed=o.zoomSpeed??1,this._inertiaDuration=o.inertiaDuration??300,this._onPointerDown=this._handlePointerDown.bind(this),this._onPointerMove=this._handlePointerMove.bind(this),this._onPointerUp=this._handlePointerUp.bind(this),this._onWheel=this._handleWheel.bind(this),this._onKeyDown=this._handleKeyDown.bind(this),this._onContextMenu=s=>s.preventDefault(),this._attach()}destroy(){this._destroyed||(this._destroyed=!0,this._stopInertia(),this._detach())}_attach(){const e=this._element;e.addEventListener("pointerdown",this._onPointerDown),e.addEventListener("pointermove",this._onPointerMove),e.addEventListener("pointerup",this._onPointerUp),e.addEventListener("pointercancel",this._onPointerUp),e.addEventListener("wheel",this._onWheel,{passive:!1}),e.addEventListener("contextmenu",this._onContextMenu),this._keyboardEnabled&&(e.getAttribute("tabindex")||e.setAttribute("tabindex","0"),e.addEventListener("keydown",this._onKeyDown)),e.style.touchAction="none"}_detach(){const e=this._element;e.removeEventListener("pointerdown",this._onPointerDown),e.removeEventListener("pointermove",this._onPointerMove),e.removeEventListener("pointerup",this._onPointerUp),e.removeEventListener("pointercancel",this._onPointerUp),e.removeEventListener("wheel",this._onWheel),e.removeEventListener("contextmenu",this._onContextMenu),e.removeEventListener("keydown",this._onKeyDown)}_handlePointerDown(e){if(this._destroyed)return;const t=e.target;if(!(t&&t!==this._element&&t.tagName!=="CANVAS"))if(this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this._element.setPointerCapture(e.pointerId),this._stopInertia(),this._pointers.size===1){if(!this._panEnabled)return;if(this._dragging=!0,this._activePointerId=e.pointerId,this._lastPointerX=e.clientX,this._lastPointerY=e.clientY,this._velocityX=0,this._velocityY=0,this._lastMoveTime=performance.now(),this._doubleClickZoom){const i=performance.now(),r=i-this._lastClickTime,o=e.clientX-this._lastClickX,s=e.clientY-this._lastClickY;if(r<300&&Math.abs(o)<5&&Math.abs(s)<5){this._handleDoubleClick(e.clientX,e.clientY),this._lastClickTime=0;return}this._lastClickTime=i,this._lastClickX=e.clientX,this._lastClickY=e.clientY}}else this._pointers.size===2&&(this._dragging=!1,this._initPinch())}_handlePointerMove(e){if(this._destroyed)return;if(this._pointers.has(e.pointerId)&&this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this._pointers.size===2&&this._zoomEnabled){this._handlePinchMove();return}if(!this._dragging||e.pointerId!==this._activePointerId)return;const t=e.clientX-this._lastPointerX,i=e.clientY-this._lastPointerY;if(t===0&&i===0)return;const r=this._getResolution(),o=-t*r,s=i*r,a=this._camera.rotation;let l=o,c=s;if(a!==0){const p=Math.cos(-a),f=Math.sin(-a);l=o*p-s*f,c=o*f+s*p}const h=this._camera.center;this._camera.setCenter([h[0]+l,h[1]+c]);const u=performance.now(),d=u-this._lastMoveTime;d>0&&(this._velocityX=l/d,this._velocityY=c/d),this._lastMoveTime=u,this._lastPointerX=e.clientX,this._lastPointerY=e.clientY,this._notifyChange()}_handlePointerUp(e){if(!this._destroyed){this._pointers.delete(e.pointerId);try{this._element.releasePointerCapture(e.pointerId)}catch{}if(this._pointers.size<2&&(this._lastPinchDist=0),this._pointers.size===1){const[t,i]=[...this._pointers.entries()][0];this._dragging=!0,this._activePointerId=t,this._lastPointerX=i.x,this._lastPointerY=i.y;return}e.pointerId===this._activePointerId&&(this._dragging=!1,this._activePointerId=null,this._inertiaDuration>0&&this._panEnabled&&Math.sqrt(this._velocityX*this._velocityX+this._velocityY*this._velocityY)>.001&&this._startInertia())}}_handleWheel(e){if(this._destroyed||!this._zoomEnabled)return;e.preventDefault();let t=e.deltaY;e.deltaMode===1&&(t*=16),e.deltaMode===2&&(t*=100);const i=-t*.002*this._zoomSpeed,r=this._camera.zoom+i,o=this._element.getBoundingClientRect(),s=e.clientX-o.left,a=e.clientY-o.top;this._zoomToPoint(s,a,r),this._notifyChange()}_handleKeyDown(e){if(this._destroyed)return;const t=e.target;if(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT")return;const r=100*this._getResolution();switch(e.key){case"+":case"=":if(!this._zoomEnabled)return;e.preventDefault(),this._camera.setZoom(this._camera.zoom+1),this._notifyChange();break;case"-":case"_":if(!this._zoomEnabled)return;e.preventDefault(),this._camera.setZoom(this._camera.zoom-1),this._notifyChange();break;case"ArrowLeft":if(!this._panEnabled)return;e.preventDefault(),this._camera.setCenter([this._camera.center[0]-r,this._camera.center[1]]),this._notifyChange();break;case"ArrowRight":if(!this._panEnabled)return;e.preventDefault(),this._camera.setCenter([this._camera.center[0]+r,this._camera.center[1]]),this._notifyChange();break;case"ArrowUp":if(!this._panEnabled)return;e.preventDefault(),this._camera.setCenter([this._camera.center[0],this._camera.center[1]+r]),this._notifyChange();break;case"ArrowDown":if(!this._panEnabled)return;e.preventDefault(),this._camera.setCenter([this._camera.center[0],this._camera.center[1]-r]),this._notifyChange();break}}_handleDoubleClick(e,t){if(!this._zoomEnabled)return;const i=this._element.getBoundingClientRect(),r=e-i.left,o=t-i.top;this._zoomToPoint(r,o,this._camera.zoom+1),this._notifyChange()}_initPinch(){const e=[...this._pointers.values()];if(e.length<2)return;const t=e[0],i=e[1];this._lastPinchDist=Math.hypot(i.x-t.x,i.y-t.y),this._lastPinchCenterX=(t.x+i.x)/2,this._lastPinchCenterY=(t.y+i.y)/2}_handlePinchMove(){const e=[...this._pointers.values()];if(e.length<2)return;const t=e[0],i=e[1],r=Math.hypot(i.x-t.x,i.y-t.y),o=(t.x+i.x)/2,s=(t.y+i.y)/2;if(this._lastPinchDist>0){const a=r/this._lastPinchDist,l=Math.log2(a),c=this._camera.zoom+l,h=this._element.getBoundingClientRect(),u=o-h.left,d=s-h.top;if(this._zoomToPoint(u,d,c),this._panEnabled){const p=this._getResolution(),f=-(o-this._lastPinchCenterX)*p,g=(s-this._lastPinchCenterY)*p,x=this._camera.center;this._camera.setCenter([x[0]+f,x[1]+g])}this._notifyChange()}this._lastPinchDist=r,this._lastPinchCenterX=o,this._lastPinchCenterY=s}_startInertia(){const e=performance.now(),t=this._velocityX,i=this._velocityY,r=this._inertiaDuration,o=()=>{if(this._destroyed||this._dragging)return;const s=performance.now()-e;if(s>=r){this._inertiaRafId=null;return}const a=s/r,l=1-a*a,c=16,h=t*c*l,u=i*c*l,d=this._camera.center;this._camera.setCenter([d[0]+h,d[1]+u]),this._notifyChange(),this._inertiaRafId=requestAnimationFrame(o)};this._inertiaRafId=requestAnimationFrame(o)}_stopInertia(){this._inertiaRafId!==null&&(cancelAnimationFrame(this._inertiaRafId),this._inertiaRafId=null)}_zoomToPoint(e,t,i){const r=this._camera.screenToMap(e,t);this._camera.setZoom(i);const o=this._camera.screenToMap(e,t),s=this._camera.center;this._camera.setCenter([s[0]+(r[0]-o[0]),s[1]+(r[1]-o[1])])}_getResolution(){return 20037508342789244e-9*2/(256*Math.pow(2,this._camera.zoom))}_notifyChange(){this._onDirty(),this._onViewChange()}}function vi(n,e,t=2){const i=e&&e.length,r=i?e[0]*t:n.length;let o=It(n,0,r,t,!0);const s=[];if(!o||o.next===o.prev)return s;let a,l,c;if(i&&(o=Ci(n,e,o,t)),n.length>80*t){a=n[0],l=n[1];let h=a,u=l;for(let d=t;d<r;d+=t){const p=n[d],f=n[d+1];p<a&&(a=p),f<l&&(l=f),p>h&&(h=p),f>u&&(u=f)}c=Math.max(h-a,u-l),c=c!==0?32767/c:0}return ae(o,s,t,a,l,c,0),s}function It(n,e,t,i,r){let o;if(r===Ri(n,e,t,i)>0)for(let s=e;s<t;s+=i)o=Je(s/i|0,n[s],n[s+1],o);else for(let s=t-i;s>=e;s-=i)o=Je(s/i|0,n[s],n[s+1],o);return o&&J(o,o.next)&&(ce(o),o=o.next),o}function X(n,e){if(!n)return n;e||(e=n);let t=n,i;do if(i=!1,!t.steiner&&(J(t,t.next)||E(t.prev,t,t.next)===0)){if(ce(t),t=e=t.prev,t===t.next)break;i=!0}else t=t.next;while(i||t!==e);return e}function ae(n,e,t,i,r,o,s){if(!n)return;!s&&o&&Bi(n,i,r,o);let a=n;for(;n.prev!==n.next;){const l=n.prev,c=n.next;if(o?yi(n,i,r,o):_i(n)){e.push(l.i,n.i,c.i),ce(n),n=c.next,a=c.next;continue}if(n=c,n===a){s?s===1?(n=bi(X(n),e),ae(n,e,t,i,r,o,2)):s===2&&Pi(n,e,t,i,r,o):ae(X(n),e,t,i,r,o,1);break}}}function _i(n){const e=n.prev,t=n,i=n.next;if(E(e,t,i)>=0)return!1;const r=e.x,o=t.x,s=i.x,a=e.y,l=t.y,c=i.y,h=Math.min(r,o,s),u=Math.min(a,l,c),d=Math.max(r,o,s),p=Math.max(a,l,c);let f=i.next;for(;f!==e;){if(f.x>=h&&f.x<=d&&f.y>=u&&f.y<=p&&oe(r,a,o,l,s,c,f.x,f.y)&&E(f.prev,f,f.next)>=0)return!1;f=f.next}return!0}function yi(n,e,t,i){const r=n.prev,o=n,s=n.next;if(E(r,o,s)>=0)return!1;const a=r.x,l=o.x,c=s.x,h=r.y,u=o.y,d=s.y,p=Math.min(a,l,c),f=Math.min(h,u,d),g=Math.max(a,l,c),x=Math.max(h,u,d),v=Fe(p,f,e,t,i),y=Fe(g,x,e,t,i);let m=n.prevZ,_=n.nextZ;for(;m&&m.z>=v&&_&&_.z<=y;){if(m.x>=p&&m.x<=g&&m.y>=f&&m.y<=x&&m!==r&&m!==s&&oe(a,h,l,u,c,d,m.x,m.y)&&E(m.prev,m,m.next)>=0||(m=m.prevZ,_.x>=p&&_.x<=g&&_.y>=f&&_.y<=x&&_!==r&&_!==s&&oe(a,h,l,u,c,d,_.x,_.y)&&E(_.prev,_,_.next)>=0))return!1;_=_.nextZ}for(;m&&m.z>=v;){if(m.x>=p&&m.x<=g&&m.y>=f&&m.y<=x&&m!==r&&m!==s&&oe(a,h,l,u,c,d,m.x,m.y)&&E(m.prev,m,m.next)>=0)return!1;m=m.prevZ}for(;_&&_.z<=y;){if(_.x>=p&&_.x<=g&&_.y>=f&&_.y<=x&&_!==r&&_!==s&&oe(a,h,l,u,c,d,_.x,_.y)&&E(_.prev,_,_.next)>=0)return!1;_=_.nextZ}return!0}function bi(n,e){let t=n;do{const i=t.prev,r=t.next.next;!J(i,r)&&Ot(i,t,t.next,r)&&le(i,r)&&le(r,i)&&(e.push(i.i,t.i,r.i),ce(t),ce(t.next),t=n=r),t=t.next}while(t!==n);return X(t)}function Pi(n,e,t,i,r,o){let s=n;do{let a=s.next.next;for(;a!==s.prev;){if(s.i!==a.i&&Fi(s,a)){let l=Vt(s,a);s=X(s,s.next),l=X(l,l.next),ae(s,e,t,i,r,o,0),ae(l,e,t,i,r,o,0);return}a=a.next}s=s.next}while(s!==n)}function Ci(n,e,t,i){const r=[];for(let o=0,s=e.length;o<s;o++){const a=e[o]*i,l=o<s-1?e[o+1]*i:n.length,c=It(n,a,l,i,!1);c===c.next&&(c.steiner=!0),r.push(Ei(c))}r.sort(wi);for(let o=0;o<r.length;o++)t=Mi(r[o],t);return t}function wi(n,e){let t=n.x-e.x;if(t===0&&(t=n.y-e.y,t===0)){const i=(n.next.y-n.y)/(n.next.x-n.x),r=(e.next.y-e.y)/(e.next.x-e.x);t=i-r}return t}function Mi(n,e){const t=Si(n,e);if(!t)return e;const i=Vt(t,n);return X(i,i.next),X(t,t.next)}function Si(n,e){let t=e;const i=n.x,r=n.y;let o=-1/0,s;if(J(n,t))return t;do{if(J(n,t.next))return t.next;if(r<=t.y&&r>=t.next.y&&t.next.y!==t.y){const u=t.x+(r-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(u<=i&&u>o&&(o=u,s=t.x<t.next.x?t:t.next,u===i))return s}t=t.next}while(t!==e);if(!s)return null;const a=s,l=s.x,c=s.y;let h=1/0;t=s;do{if(i>=t.x&&t.x>=l&&i!==t.x&&zt(r<c?i:o,r,l,c,r<c?o:i,r,t.x,t.y)){const u=Math.abs(r-t.y)/(i-t.x);le(t,n)&&(u<h||u===h&&(t.x>s.x||t.x===s.x&&Ti(s,t)))&&(s=t,h=u)}t=t.next}while(t!==a);return s}function Ti(n,e){return E(n.prev,n,e.prev)<0&&E(e.next,n,n.next)<0}function Bi(n,e,t,i){let r=n;do r.z===0&&(r.z=Fe(r.x,r.y,e,t,i)),r.prevZ=r.prev,r.nextZ=r.next,r=r.next;while(r!==n);r.prevZ.nextZ=null,r.prevZ=null,Gi(r)}function Gi(n){let e,t=1;do{let i=n,r;n=null;let o=null;for(e=0;i;){e++;let s=i,a=0;for(let c=0;c<t&&(a++,s=s.nextZ,!!s);c++);let l=t;for(;a>0||l>0&&s;)a!==0&&(l===0||!s||i.z<=s.z)?(r=i,i=i.nextZ,a--):(r=s,s=s.nextZ,l--),o?o.nextZ=r:n=r,r.prevZ=o,o=r;i=s}o.nextZ=null,t*=2}while(e>1);return n}function Fe(n,e,t,i,r){return n=(n-t)*r|0,e=(e-i)*r|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function Ei(n){let e=n,t=n;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==n);return t}function zt(n,e,t,i,r,o,s,a){return(r-s)*(e-a)>=(n-s)*(o-a)&&(n-s)*(i-a)>=(t-s)*(e-a)&&(t-s)*(o-a)>=(r-s)*(i-a)}function oe(n,e,t,i,r,o,s,a){return!(n===s&&e===a)&&zt(n,e,t,i,r,o,s,a)}function Fi(n,e){return n.next.i!==e.i&&n.prev.i!==e.i&&!Li(n,e)&&(le(n,e)&&le(e,n)&&Di(n,e)&&(E(n.prev,n,e.prev)||E(n,e.prev,e))||J(n,e)&&E(n.prev,n,n.next)>0&&E(e.prev,e,e.next)>0)}function E(n,e,t){return(e.y-n.y)*(t.x-e.x)-(e.x-n.x)*(t.y-e.y)}function J(n,e){return n.x===e.x&&n.y===e.y}function Ot(n,e,t,i){const r=he(E(n,e,t)),o=he(E(n,e,i)),s=he(E(t,i,n)),a=he(E(t,i,e));return!!(r!==o&&s!==a||r===0&&ue(n,t,e)||o===0&&ue(n,i,e)||s===0&&ue(t,n,i)||a===0&&ue(t,e,i))}function ue(n,e,t){return e.x<=Math.max(n.x,t.x)&&e.x>=Math.min(n.x,t.x)&&e.y<=Math.max(n.y,t.y)&&e.y>=Math.min(n.y,t.y)}function he(n){return n>0?1:n<0?-1:0}function Li(n,e){let t=n;do{if(t.i!==n.i&&t.next.i!==n.i&&t.i!==e.i&&t.next.i!==e.i&&Ot(t,t.next,n,e))return!0;t=t.next}while(t!==n);return!1}function le(n,e){return E(n.prev,n,n.next)<0?E(n,e,n.next)>=0&&E(n,n.prev,e)>=0:E(n,e,n.prev)<0||E(n,n.next,e)<0}function Di(n,e){let t=n,i=!1;const r=(n.x+e.x)/2,o=(n.y+e.y)/2;do t.y>o!=t.next.y>o&&t.next.y!==t.y&&r<(t.next.x-t.x)*(o-t.y)/(t.next.y-t.y)+t.x&&(i=!i),t=t.next;while(t!==n);return i}function Vt(n,e){const t=Le(n.i,n.x,n.y),i=Le(e.i,e.x,e.y),r=n.next,o=e.prev;return n.next=e,e.prev=n,t.next=r,r.prev=t,i.next=t,t.prev=i,o.next=i,i.prev=o,i}function Je(n,e,t,i){const r=Le(n,e,t);return i?(r.next=i.next,r.prev=i,i.next.prev=r,i.next=r):(r.prev=r,r.next=r),r}function ce(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function Le(n,e,t){return{i:n,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Ri(n,e,t,i){let r=0;for(let o=e,s=t-i;o<t;o+=i)r+=(n[s]-n[o])*(n[o+1]+n[s+1]),s=o;return r}function kt(n,e,t=2){return vi(n,e??void 0,t)}function Qe(n,e,t,i){let r=0;for(let o=e,s=t-i;o<t;o+=i)r+=(n[s]-n[o])*(n[o+1]+n[s+1]),s=o;return r}function Ui(n,e,t,i){const r=e&&e.length>0,o=r?e[0]*t:n.length;let s=0;for(let l=0;l<i.length;l+=3){const c=i[l]*t,h=i[l+1]*t,u=i[l+2]*t;s+=Math.abs((n[c]-n[u])*(n[h+1]-n[c+1])-(n[c]-n[h])*(n[u+1]-n[c+1]))}let a=Math.abs(Qe(n,0,o,t));if(r)for(let l=0;l<e.length;l++){const c=e[l]*t,h=l<e.length-1?e[l+1]*t:n.length;a-=Math.abs(Qe(n,c,h,t))}return a===0&&s===0?0:Math.abs((s-a)/a)}const Nt=6378137,et=85.0511287798066;function De(n){return n*Math.PI*Nt/180}function Re(n){const t=Math.max(-et,Math.min(et,n))*Math.PI/180;return Math.log(Math.tan(Math.PI/4+t/2))*Nt}function N(n,e){return e==="EPSG:3857"?[n[0],n[1],n[2]??0]:[De(n[0]),Re(n[1]),n[2]??0]}class R{static pointsFromFeatures(e){const t=[];for(const r of e)R._extractPoints(r.geometry,t);if(t.length===0)return null;const i=t.length/3;return{vertices:new Float32Array(t),count:i}}static linesFromFeatures(e){const t=[];for(const i of e)R._extractLines(i.geometry,t);return t.length===0?null:R._buildLineBuffers(t)}static polygonsFromFeatures(e){const t=[],i=[];let r=0;for(const o of e)R._extractPolygons(o.geometry,t,i,r),r=t.length/3;return i.length===0?null:{vertices:new Float32Array(t),indices:new Uint32Array(i),indexCount:i.length}}static modelInstancesFromFeatures(e,t,i,r,o,s){const a=[];for(const l of e){const c=l.geometry;if(!c)continue;const h=l.attributes??{},u=h.scale??t,d=i??h.heading??0,p=r??h.pitch??0,f=o??h.roll??0,g=h.anchorZ??s;if(c.type==="Point"){const x=c.coordinates;a.push(De(x[0]),Re(x[1]),x[2]??0,u,d,p,f,g)}else if(c.type==="MultiPoint"){const x=c.coordinates;for(const v of x)a.push(De(v[0]),Re(v[1]),v[2]??0,u,d,p,f,g)}}return a.length===0?null:{instances:new Float32Array(a),count:a.length/8}}static _extractPoints(e,t){const i=e.coordinates;switch(e.type){case"Point":{const r=i,[o,s,a]=N(r,e.spatialReference);t.push(o,s,a);break}case"MultiPoint":{const r=i;for(const o of r){const[s,a,l]=N(o,e.spatialReference);t.push(s,a,l)}break}}}static _extractLines(e,t){const i=e.coordinates;switch(e.type){case"LineString":{const r=i,o=[];for(const s of r){const[a,l,c]=N(s,e.spatialReference);o.push(a,l,c)}o.length>=6&&t.push(o);break}case"MultiLineString":{const r=i;for(const o of r){const s=[];for(const a of o){const[l,c,h]=N(a,e.spatialReference);s.push(l,c,h)}s.length>=6&&t.push(s)}break}case"Polygon":{const r=i;for(const o of r){const s=[];for(const a of o){const[l,c,h]=N(a,e.spatialReference);s.push(l,c,h)}s.length>=6&&t.push(s)}break}case"MultiPolygon":{const r=i;for(const o of r)for(const s of o){const a=[];for(const l of s){const[c,h,u]=N(l,e.spatialReference);a.push(c,h,u)}a.length>=6&&t.push(a)}break}}}static _extractPolygons(e,t,i,r){const o=e.coordinates;switch(e.type){case"Polygon":{const s=o;R._triangulatePolygon(s,e.spatialReference,t,i,r);break}case"MultiPolygon":{const s=o;for(const a of s){const l=t.length/3;R._triangulatePolygon(a,e.spatialReference,t,i,l)}break}}}static _triangulatePolygon(e,t,i,r,o){const s=[],a=[];for(let h=0;h<e.length;h++){h>0&&a.push(s.length/2);const u=e[h];for(const d of u){const[p,f]=N(d,t);s.push(p,f)}}const l=kt(s,a.length>0?a:void 0,2),c=i.length/3;for(let h=0;h<s.length;h+=2)i.push(s[h],s[h+1],0);for(const h of l)r.push(c+h)}static _buildLineBuffers(e){let t=0,i=0;for(const c of e){const h=c.length/3;t+=h*2,i+=(h-1)*6}const r=new Float32Array(t*11),o=new Uint32Array(i);let s=0,a=0,l=0;for(const c of e){const h=c.length/3;let u=0;for(let d=0;d<h;d++){if(d>0){const x=(d-1)*3,v=d*3,y=c[v]-c[x],m=c[v+1]-c[x+1];u+=Math.sqrt(y*y+m*m)}const p=Math.max(0,d-1)*3,f=d*3,g=Math.min(h-1,d+1)*3;r[s++]=c[p],r[s++]=c[p+1],r[s++]=c[p+2],r[s++]=c[f],r[s++]=c[f+1],r[s++]=c[f+2],r[s++]=c[g],r[s++]=c[g+1],r[s++]=c[g+2],r[s++]=1,r[s++]=u,r[s++]=c[p],r[s++]=c[p+1],r[s++]=c[p+2],r[s++]=c[f],r[s++]=c[f+1],r[s++]=c[f+2],r[s++]=c[g],r[s++]=c[g+1],r[s++]=c[g+2],r[s++]=-1,r[s++]=u}for(let d=0;d<h-1;d++){const p=l+d*2,f=l+d*2+1,g=l+(d+1)*2,x=l+(d+1)*2+1;o[a++]=p,o[a++]=f,o[a++]=g,o[a++]=f,o[a++]=x,o[a++]=g}l+=h*2}return{vertices:r,indices:o,indexCount:i}}}const Ht=6378137,tt=85.0511287798066,ne=20037508342789244e-9,it=1e-7,Ai=1e-10,Ii=.001,zi=1e6/(2*ne);function Oi(n){return n*Math.PI*Ht/180}function Vi(n){const t=Math.max(-tt,Math.min(tt,n))*Math.PI/180;return Math.log(Math.tan(Math.PI/4+t/2))*Ht}function ki(n,e){return e==="EPSG:3857"?[n[0],n[1]]:[Oi(n[0]),Vi(n[1])]}function ie(n,e){return[(n+ne)/(2*ne),1-(e+ne)/(2*ne)]}function rt(n,e,t,i){return Math.abs(n-t)<=it&&Math.abs(e-i)<=it}function Ni(n,e){const t=[];for(const i of n){const[r,o]=ki(i,e);if(!Number.isFinite(r)||!Number.isFinite(o))continue;const s=t[t.length-1];s&&rt(s[0],s[1],r,o)||t.push([r,o])}if(t.length>1){const i=t[0],r=t[t.length-1];rt(i[0],i[1],r[0],r[1])&&t.pop()}return t}function Hi(n,e,t){const i=[],r=[];let o=0;for(const a of n){const l=a.geometry;if(!l)continue;const c=Number(a.attributes[e])||10,h=Number(a.attributes[t])||0;if(l.type==="Polygon"){const u=l.coordinates;o=ot(u,l.spatialReference,c,h,i,r,o)}else if(l.type==="MultiPolygon"){const u=l.coordinates;for(const d of u)o=ot(d,l.spatialReference,c,h,i,r,o)}}if(r.length===0)return null;const s=Wi(i,r,zi);if(s.length===0)return null;if(typeof globalThis<"u"&&globalThis.__MAPGPU_EXTRUSION_DEBUG){const a=i.length/8,l=s.length/3,c=r.length/3-l;let h=1/0,u=-1/0,d=1/0,p=-1/0,f=1/0,g=-1/0;for(let x=0;x<i.length;x+=8){const v=i[x],y=i[x+1],m=i[x+2];v<h&&(h=v),v>u&&(u=v),y<d&&(d=y),y>p&&(p=y),m<f&&(f=m),m>g&&(g=m)}console.log(`[Extrusion] features=${n.length} verts=${a} tris=${l} dropped=${c} xy=[${h.toFixed(6)}..${u.toFixed(6)}, ${d.toFixed(6)}..${p.toFixed(6)}] z=[${f.toFixed(1)}..${g.toFixed(1)}m]`)}return{vertices:new Float32Array(i),indices:new Uint32Array(s),indexCount:s.length}}function ot(n,e,t,i,r,o,s){if(!Number.isFinite(t)||!Number.isFinite(i))return s;const a=[],l=[],c=[],h=[];for(const y of n){const m=Ni(y,e);m.length>=3&&h.push(m)}if(h.length===0)return s;for(let y=0;y<h.length;y++){y>0&&l.push(a.length/2);const m=h[y],_=[];for(const b of m){const C=b[0],M=b[1];a.push(C,M),_.push([C,M])}c.push(_)}const u=c[0];let d=0,p=0;for(const y of u){const[m,_]=ie(y[0],y[1]);d+=m,p+=_}d/=u.length,p/=u.length;const f=kt(a,l.length>0?l:void 0,2);if(f.length>0){const y=Ui(a,l.length>0?l:void 0,2,f);y>.01&&console.warn(`[ExtrusionConverter] High earcut deviation: ${y.toFixed(4)} — polygon may have rendering artifacts`)}const g=s,x=a.length/2;for(let y=0;y<a.length;y+=2){const[m,_]=ie(a[y],a[y+1]);r.push(m,_,t),r.push(0,0,1),r.push(d,p)}for(const y of f)o.push(g+y);s+=x;const v=t-i>Ii;if(i>0&&v){const y=s;for(let m=0;m<a.length;m+=2){const[_,b]=ie(a[m],a[m+1]);r.push(_,b,i),r.push(0,0,-1),r.push(d,p)}for(let m=f.length-1;m>=0;m--)o.push(y+f[m]);s+=x}if(!v)return s;for(const y of c){const m=y.length;for(let _=0;_<m;_++){const b=y[_][0],C=y[_][1],M=y[(_+1)%m],P=M[0],T=M[1],w=P-b,S=T-C,B=Math.sqrt(w*w+S*S);if(B<Ai)continue;const G=S/B,L=-w/B,[$,te]=ie(b,C),[$e,je]=ie(P,T),j=s;r.push($,te,i,G,L,0,d,p),r.push($e,je,i,G,L,0,d,p),r.push($e,je,t,G,L,0,d,p),r.push($,te,t,G,L,0,d,p),o.push(j,j+1,j+2),o.push(j,j+2,j+3),s+=4}}return s}function Wi(n,e,t){const i=[],r=t*t,o=Math.floor(n.length/8);for(let s=0;s+2<e.length;s+=3){const a=e[s],l=e[s+1],c=e[s+2];if(a<0||l<0||c<0||a>=o||l>=o||c>=o)continue;const h=a*8,u=l*8,d=c*8,p=n[h],f=n[h+1],g=n[h+2],x=n[u],v=n[u+1],y=n[u+2],m=n[d],_=n[d+1],b=n[d+2];if(!Number.isFinite(p)||!Number.isFinite(f)||!Number.isFinite(g)||!Number.isFinite(x)||!Number.isFinite(v)||!Number.isFinite(y)||!Number.isFinite(m)||!Number.isFinite(_)||!Number.isFinite(b))continue;const C=(x-p)*(x-p)+(v-f)*(v-f),M=(m-x)*(m-x)+(_-v)*(_-v),P=(p-m)*(p-m)+(f-_)*(f-_);C>r||M>r||P>r||i.push(a,l,c)}return i}const Zi={type:"simple-marker",color:[66,133,244,255],size:8,outlineColor:[255,255,255,255],outlineWidth:1.5},Xi={type:"simple-line",color:[255,87,34,255],width:2,style:"solid"},$i={type:"simple-fill",color:[66,133,244,80],outlineColor:[33,33,33,255],outlineWidth:1},U=40,H=24;class ji{_engine;_buffers=new Map;_tileBuffers=new Map;_tileSlotToRenderKey=new Map;_tileScopes=new Map;_rendererKeys=new Map;_featureCounts=new Map;_lastZoomInt=-1;_zoomSensitiveLayers=new Set;_onInvalidate=null;constructor(e=null){this._engine=e}setOnInvalidate(e){this._onInvalidate=e}setRenderEngine(e){this._engine=e}getOrBuild(e,t,i,r){if(!this._engine||t.length===0)return null;if(r!==void 0){const h=Math.floor(r);if(h!==this._lastZoomInt){this._lastZoomInt=h;for(const u of this._zoomSensitiveLayers)this.invalidate(u)}}i?.zoomSensitive?this._zoomSensitiveLayers.add(e):this._zoomSensitiveLayers.delete(e);const o=i?Se(i):"",s=this._rendererKeys.get(e),a=this._featureCounts.get(e);s!==void 0&&(s!==o||a!==t.length)&&this.invalidate(e),this._rendererKeys.set(e,o),this._featureCounts.set(e,t.length);let l=this._buffers.get(e);if(l)return l;const c=r!==void 0?{zoom:r,resolution:0}:void 0;return l=this._build(t,i,c),this._buffers.set(e,l),l}getOrBuildTile(e,t){if(!this._engine||t.length===0)return null;const i=e.globe?"3d":"2d",r=e.renderer?Se(e.renderer):"",o=e.renderer?.zoomSensitive&&e.zoom!==void 0?Math.floor(e.zoom):-1,s=nt({layerId:e.layerId,tileKey:e.tileKey,rendererKey:r,zoomBucket:o,mode:i,source:"feature",version:e.version}),a=Me(e.layerId,i,e.tileKey),l=this._tileSlotToRenderKey.get(a);l&&l!==s&&this._invalidateTileEntry(l,!1);let c=this._tileBuffers.get(s);if(c)return this._registerTileSlot(e.layerId,i,a,s),c;const h=e.zoom!==void 0?{zoom:e.zoom,resolution:0}:void 0;return c=this._build(t,e.renderer,h),this._stampExtrusionIds(c,e.tileKey),this._tileBuffers.set(s,c),this._registerTileSlot(e.layerId,i,a,s),c}getOrBuildTileBinary(e,t){if(!this._engine||!Yi(t))return null;const i=e.globe?"3d":"2d",r=e.renderer?Se(e.renderer):"",o=e.renderer?.zoomSensitive&&e.zoom!==void 0?Math.floor(e.zoom):-1,s=nt({layerId:e.layerId,tileKey:e.tileKey,rendererKey:r,zoomBucket:o,mode:i,source:"binary",version:e.version}),a=Me(e.layerId,i,e.tileKey),l=this._tileSlotToRenderKey.get(a);l&&l!==s&&this._invalidateTileEntry(l,!1);let c=this._tileBuffers.get(s);return c?(this._registerTileSlot(e.layerId,i,a,s),c):(c=this._buildFromBinaryPayload(t),this._stampExtrusionIds(c,e.tileKey),this._tileBuffers.set(s,c),this._registerTileSlot(e.layerId,i,a,s),c)}has(e){return this._buffers.has(e)}invalidate(e){const t=this._buffers.get(e);t&&(this._releaseEntry(t),this._buffers.delete(e));for(const i of["2d","3d"]){const r=we(e,i),o=this._tileScopes.get(r);if(o)for(const s of[...o]){const a=this._tileSlotToRenderKey.get(s);a&&this._invalidateTileEntry(a,!1)}}this._rendererKeys.delete(e),this._featureCounts.delete(e),this._onInvalidate?.()}pruneTileEntries(e,t,i){const r=t?"3d":"2d",o=we(e,r),s=this._tileScopes.get(o);if(!s)return;const a=new Set;for(const l of i)a.add(Me(e,r,l));for(const l of[...s]){if(a.has(l))continue;const c=this._tileSlotToRenderKey.get(l);c&&this._invalidateTileEntry(c,!1)}}invalidateAll(){for(const e of[...this._buffers.keys()])this.invalidate(e);for(const e of[...this._tileBuffers.keys()])this._invalidateTileEntry(e,!1)}destroy(){this.invalidateAll();for(const e of[...this._tileBuffers.keys()])this._invalidateTileEntry(e,!1);this._engine=null}_stampExtrusionIds(e,t){for(const i of e.extrusionGroups)i.buffer.id=t}_buildFromBinaryPayload(e){const t={pointGroups:[],lineGroups:[],polygonGroups:[],modelGroups:[],extrusionGroups:[]};for(const i of e.pointGroups){if(i.count<=0)continue;const r=this._engine.createBuffer(i.vertices,U);t.pointGroups.push({buffer:{vertexBuffer:r,count:i.count},symbol:i.symbol})}for(const i of e.lineGroups){if(i.indexCount<=0)continue;const r=this._engine.createBuffer(i.vertices,U),o=this._engine.createBuffer(i.indices,H);t.lineGroups.push({buffer:{vertexBuffer:r,indexBuffer:o,indexCount:i.indexCount},symbol:i.symbol})}for(const i of e.polygonGroups){if(i.indexCount<=0)continue;const r=this._engine.createBuffer(i.vertices,U),o=this._engine.createBuffer(i.indices,H);t.polygonGroups.push({buffer:{vertexBuffer:r,indexBuffer:o,indexCount:i.indexCount},symbol:i.symbol})}for(const i of e.modelGroups){if(i.count<=0)continue;const r=this._engine.createBuffer(i.instances,U);t.modelGroups.push({buffer:{instanceBuffer:r,instanceCount:i.count},symbol:i.symbol})}for(const i of e.extrusionGroups){if(i.indexCount<=0)continue;const r=this._engine.createBuffer(i.vertices,U),o=this._engine.createBuffer(i.indices,H);t.extrusionGroups.push({buffer:{vertexBuffer:r,indexBuffer:o,indexCount:i.indexCount},symbol:i.symbol})}return t}_build(e,t,i){const r={pointGroups:[],lineGroups:[],polygonGroups:[],modelGroups:[],extrusionGroups:[]};if(!t||t.type==="simple"){const o=t?t.getSymbol(e[0],i):null;return this._buildSingleGroup(e,r,o),r}return this._buildMultiGroup(e,t,r,i),r}_buildSingleGroup(e,t,i){if(i&&Ue(i)){this._buildModelGroup(e,i,t);return}if(i&&pt(i)){this._buildExtrusionGroup(e,i,t);return}const r=i?ht(i)?i:st(i):{...Zi},o=i?dt(i)?i:at(i):{...Xi},s=i?ft(i)?i:lt(i):{...$i};this._buildPointGroup(e,r,t),this._buildLineGroup(e,o,t),this._buildPolygonGroup(e,s,t)}_buildMultiGroup(e,t,i,r){const o=new Map,s=new Map,a=new Map,l=new Map,c=new Map;for(const h of e){const u=h.geometry?.type;if(!u)continue;const d=t.getSymbol(h,r);if(d){if(pt(d)&&ut(u)){const p=K(d);let f=c.get(p);f||(f={symbol:d,features:[]},c.set(p,f)),f.features.push(h);continue}if(Ue(d)&&ct(u)){const p=K(d);let f=l.get(p);f||(f={symbol:d,features:[]},l.set(p,f)),f.features.push(h);continue}if(ct(u)){const p=ht(d)?d:st(d),f=K(p);let g=o.get(f);g||(g={symbol:p,features:[]},o.set(f,g)),g.features.push(h)}else if(Ki(u)){const p=dt(d)?d:at(d),f=K(p);let g=s.get(f);g||(g={symbol:p,features:[]},s.set(f,g)),g.features.push(h)}else if(ut(u)){const p=ft(d)?d:lt(d),f=K(p);let g=a.get(f);g||(g={symbol:p,features:[]},a.set(f,g)),g.features.push(h)}}}for(const{symbol:h,features:u}of o.values())this._buildPointGroup(u,h,i);for(const{symbol:h,features:u}of s.values())this._buildLineGroup(u,h,i);for(const{symbol:h,features:u}of a.values())this._buildPolygonGroup(u,h,i);for(const{symbol:h,features:u}of l.values())this._buildModelGroup(u,h,i);for(const{symbol:h,features:u}of c.values())this._buildExtrusionGroup(u,h,i)}_buildPointGroup(e,t,i){const r=R.pointsFromFeatures(e);if(r&&r.count>0){const o=this._engine.createBuffer(r.vertices,U);i.pointGroups.push({buffer:{vertexBuffer:o,count:r.count},symbol:t})}}_buildLineGroup(e,t,i){const r=R.linesFromFeatures(e);if(r&&r.indexCount>0){const o=this._engine.createBuffer(r.vertices,U),s=this._engine.createBuffer(r.indices,H);i.lineGroups.push({buffer:{vertexBuffer:o,indexBuffer:s,indexCount:r.indexCount},symbol:t})}}_buildPolygonGroup(e,t,i){const r=R.polygonsFromFeatures(e);if(r&&r.indexCount>0){const o=this._engine.createBuffer(r.vertices,U),s=this._engine.createBuffer(r.indices,H);i.polygonGroups.push({buffer:{vertexBuffer:o,indexBuffer:s,indexCount:r.indexCount},symbol:t});const a={type:"simple-line",color:t.outlineColor,width:t.outlineWidth,style:"solid",glowColor:t.outlineGlowColor,glowWidth:t.outlineGlowWidth},l=R.linesFromFeatures(e);if(l&&l.indexCount>0){const c=this._engine.createBuffer(l.vertices,U),h=this._engine.createBuffer(l.indices,H);i.lineGroups.push({buffer:{vertexBuffer:c,indexBuffer:h,indexCount:l.indexCount},symbol:a})}}}_buildExtrusionGroup(e,t,i){const r=Hi(e,t.heightField,t.minHeightField??"render_min_height");if(r&&r.indexCount>0){const o=this._engine.createBuffer(r.vertices,U),s=this._engine.createBuffer(r.indices,H);i.extrusionGroups.push({buffer:{vertexBuffer:o,indexBuffer:s,indexCount:r.indexCount},symbol:t})}}_buildModelGroup(e,t,i){const r=R.modelInstancesFromFeatures(e,t.scale??1,t.heading,t.pitch,t.roll,t.anchorZ??0);if(r&&r.count>0){const o=this._engine.createBuffer(r.instances,U);i.modelGroups.push({buffer:{instanceBuffer:o,instanceCount:r.count},symbol:t})}}_releaseEntry(e){if(this._engine){for(const t of e.pointGroups)this._engine.releaseBuffer(t.buffer.vertexBuffer);for(const t of e.lineGroups)this._engine.releaseBuffer(t.buffer.vertexBuffer),this._engine.releaseBuffer(t.buffer.indexBuffer);for(const t of e.polygonGroups)this._engine.releaseBuffer(t.buffer.vertexBuffer),this._engine.releaseBuffer(t.buffer.indexBuffer);for(const t of e.modelGroups)this._engine.releaseBuffer(t.buffer.instanceBuffer);for(const t of e.extrusionGroups)this._engine.releaseBuffer(t.buffer.vertexBuffer),this._engine.releaseBuffer(t.buffer.indexBuffer)}}_registerTileSlot(e,t,i,r){this._tileSlotToRenderKey.set(i,r);const o=we(e,t);let s=this._tileScopes.get(o);s||(s=new Set,this._tileScopes.set(o,s)),s.add(i)}_invalidateTileEntry(e,t){const i=this._tileBuffers.get(e);i&&(this._releaseEntry(i),this._tileBuffers.delete(e));for(const[r,o]of[...this._tileSlotToRenderKey.entries()])if(o===e){this._tileSlotToRenderKey.delete(r);for(const[s,a]of this._tileScopes)if(a.delete(r)){a.size===0&&this._tileScopes.delete(s);break}}t&&this._onInvalidate?.()}}function we(n,e){return`${n}@@${e}`}function Me(n,e,t){return`${n}@@${e}@@${t}`}function nt(n){return[n.layerId,n.tileKey,n.rendererKey,String(n.zoomBucket),n.mode,n.source,String(n.version)].join("::")}function Yi(n){return n.pointGroups.length>0||n.lineGroups.length>0||n.polygonGroups.length>0||n.modelGroups.length>0||n.extrusionGroups.length>0}function K(n){if(n.type==="simple-marker"){const e=n;return`m:${e.color}:${e.size}:${e.outlineColor??""}:${e.outlineWidth??0}:${e.glowColor??""}:${e.glowSize??0}`}if(n.type==="icon"){const e=n;return`i:${e.src??""}:${e.size}:${e.color}:${e.rotation??0}:${e.glowColor??""}:${e.glowSize??0}:${e.backgroundColor??""}:${e.backgroundSize??0}:${e.outlineColor??""}:${e.outlineWidth??0}`}if(n.type==="simple-line"){const e=n;return`l:${e.color}:${e.width}:${e.style}:${e.glowColor??""}:${e.glowWidth??0}`}if(n.type==="simple-fill"){const e=n;return`f:${e.color}:${e.outlineColor}:${e.outlineWidth}:${e.outlineGlowColor??""}:${e.outlineGlowWidth??0}`}if(n.type==="model"){const e=n;return`M:${e.modelId}:${e.scale??1}:${e.heading??0}:${e.pitch??0}:${e.roll??0}:${e.anchorZ??0}:${e.tintColor??""}`}if(n.type==="fill-extrusion"){const e=n;return`E:${e.color}:${e.heightField}:${e.minHeightField??""}:${e.ambient??.35}:${e.shininess??32}:${e.specularStrength??.15}`}return`?:${JSON.stringify(n)}`}function Se(n){const e=n.getSymbol({attributes:{},geometry:{type:"Point",coordinates:[0,0]},id:"__fp__"});return e?K(e):""}function Ve(n){return"color"in n?n.color:Ue(n)&&n.tintColor?n.tintColor:[128,128,128,255]}function st(n){const e=Ve(n),t="outlineColor"in n&&n.outlineColor?n.outlineColor:[e[0],e[1],e[2],255];return{type:"simple-marker",color:e,size:"size"in n?n.size:10,outlineColor:t,outlineWidth:"outlineWidth"in n?n.outlineWidth:1}}function at(n){const e=Ve(n);return{type:"simple-line",color:[e[0],e[1],e[2],255],width:"width"in n?n.width:"outlineWidth"in n?n.outlineWidth+1:2,style:"solid"}}function lt(n){const e=Ve(n);return{type:"simple-fill",color:[e[0],e[1],e[2],e[3]<255?e[3]:100],outlineColor:[e[0],e[1],e[2],255],outlineWidth:"outlineWidth"in n?n.outlineWidth:1}}function ct(n){return n==="Point"||n==="MultiPoint"}function Ki(n){return n==="LineString"||n==="MultiLineString"}function ut(n){return n==="Polygon"||n==="MultiPolygon"}function ht(n){return n.type==="simple-marker"||n.type==="icon"||n.type==="sdf-icon"}function dt(n){return n.type==="simple-line"}function ft(n){return n.type==="simple-fill"}function Ue(n){return n.type==="model"}function pt(n){return n.type==="fill-extrusion"}class qi{map;renderEngine=null;renderLoop;tileScheduler;tileManager;terrainManager;layerManager;bufferCache;canvas=null;container=null;resizeObserver=null;destroyed=!1;gpuReady=!1;constructor(){this.map=new ni,this.layerManager=new li,this.tileScheduler=new ci,this.tileManager=new mi({tileScheduler:this.tileScheduler}),this.terrainManager=new gi,this.renderLoop=new ui,this.bufferCache=new ji}createCanvas(e){const t=document.createElement("canvas");getComputedStyle(e).position==="static"&&(e.style.position="relative"),t.style.position="absolute",t.style.top="0",t.style.left="0",t.style.width="100%",t.style.height="100%",t.style.display="block";const r=typeof devicePixelRatio<"u"?devicePixelRatio:1,o=e.clientWidth||800,s=e.clientHeight||600;return t.width=Math.round(o*r),t.height=Math.round(s*r),e.appendChild(t),this.canvas=t,this.container=e,t}setupResizeObserver(e,t,i){typeof ResizeObserver>"u"||(this.resizeObserver=new ResizeObserver(r=>{if(!this.destroyed)for(const o of r){const{width:s,height:a}=o.contentRect;if(s===0||a===0)continue;const l=typeof devicePixelRatio<"u"?devicePixelRatio:1,c=Math.round(s*l),h=Math.round(a*l);(t.width!==c||t.height!==h)&&(t.width=c,t.height=h,i(s,a))}}),this.resizeObserver.observe(e))}async initGpu(e,t,i){this.renderEngine=e,this.bufferCache.setRenderEngine(e),this.tileManager.setRenderEngine(e),this.terrainManager.setRenderEngine(e),this.renderLoop.setRenderEngine(e);const r=await e.init(t,i);if(this.destroyed)throw new Error("View destroyed during GPU init");return this.gpuReady=!0,this.tileManager.onDirty=()=>{this.renderLoop.markDirty()},this.terrainManager.onDirty=()=>{this.renderLoop.markDirty()},this.bufferCache.setOnInvalidate(()=>{this.renderLoop.markDirty()}),r.mode!=="full-gpu"&&console.warn(`[mapgpu] GPU running in degraded mode: ${r.mode}`),r}destroy(){this.destroyed||(this.destroyed=!0,this.resizeObserver?.disconnect(),this.resizeObserver=null,this.bufferCache.destroy(),this.tileManager.destroy(),this.terrainManager.destroy(),this.renderLoop.destroy(),this.layerManager.destroy(),this.map.destroy(),this.canvas&&this.canvas.parentNode&&this.canvas.parentNode.removeChild(this.canvas),this.canvas=null,this.container=null)}}function Wt(n,e,t){let i=!0,r=null;const o=()=>{i=!1,r!==null&&(clearTimeout(r),r=null)};return{promise:new Promise(a=>{const l=Date.now(),c=()=>{if(!i||!t()){a();return}const h=Date.now()-l,u=Math.min(1,h/n),d=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;e(d),u>=1?(i=!1,r=null,a()):r=setTimeout(c,16)};c()}),cancel:o}}function Ji(n){return typeof n=="object"&&n!==null&&n.type==="vector-tile"&&typeof n.getVisibleRenderTiles=="function"}function Zt(n,e){const t=[],i=[],r=[],o=[],s=[],a=[],l=[],h=n.getLayerIds().map(u=>({id:u,layer:n.getLayer(u)})).filter(({layer:u})=>u!==void 0).sort((u,d)=>(u.layer.zIndex??0)-(d.layer.zIndex??0));for(const{id:u,layer:d}of h)if(!(!d||!d.visible||!d.loaded)){if(At(d)){a.push(u);continue}if(Ut(d)){s.push(u);continue}if(Oe(d)){i.push(u);continue}if(d.type==="vector-tile"){const p=e!==void 0?Math.floor(e):void 0;if(p!==void 0&&p<d.minZoom)continue;se(d)&&l.push(u);continue}if(oi(d)){if(e!==void 0&&(e<d.minZoom||e>d.maxZoom))continue;t.push({getTileUrl:(p,f,g)=>d.getTileUrl(p,f,g),opacity:d.opacity,minZoom:d.minZoom,maxZoom:d.maxZoom,filters:d.filters})}se(d)&&r.push(u),ze(d)&&o.push(u)}return{tileSources:t,terrainLayerIds:i,vectorLayerIds:r,customLayerIds:o,clusterLayerIds:s,dynamicPointLayerIds:a,vectorTileLayerIds:l}}function Xt(n,e,t,i){const r=t.getLayer(n);if(!r||!At(r)||!r.positionBuffer||r.pointCount===0)return;const o={vertexBuffer:r.positionBuffer,count:r.pointCount};i?e.drawGlobePoints(o,r.pointSymbol):e.drawPoints(o,r.pointSymbol)}function $t(n,e,t,i,r,o){const s=t.getLayer(n);if(!s||!se(s))return;e.setCurrentLayerId(n);const a=s.getFeatures();if(a.length===0)return;const l=i.getOrBuild(n,a,s.renderer,o);if(l)if(r){for(const c of l.polygonGroups)e.drawGlobePolygons(c.buffer,c.symbol);for(const c of l.lineGroups)e.drawGlobeLines(c.buffer,c.symbol);for(const c of l.pointGroups)e.drawGlobePoints(c.buffer,c.symbol);for(const c of l.modelGroups)e.drawGlobeModels(c.buffer,c.symbol);for(const c of l.extrusionGroups)e.drawGlobeExtrusion(c.buffer,c.symbol)}else{for(const c of l.polygonGroups)e.drawPolygons(c.buffer,c.symbol);for(const c of l.lineGroups)e.drawLines(c.buffer,c.symbol);for(const c of l.pointGroups)e.drawPoints(c.buffer,c.symbol);for(const c of l.modelGroups)e.drawModels(c.buffer,c.symbol);for(const c of l.extrusionGroups)e.drawExtrusion(c.buffer,c.symbol)}}function jt(n,e,t,i,r,o){const s=t.getLayer(n);if(!s||!Ji(s))return;e.setCurrentLayerId(n);const a=s.getVisibleRenderTiles();if(a.length===0){i.pruneTileEntries(n,r,[]);return}const l=new Set;for(const c of a){l.add(c.key);let h=r&&c.binaryPayload?i.getOrBuildTileBinary({layerId:n,tileKey:c.key,version:c.version,renderer:s.renderer,zoom:o,globe:r},c.binaryPayload):null;if(!h&&c.features.length>0&&(h=i.getOrBuildTile({layerId:n,tileKey:c.key,version:c.version,renderer:s.renderer,zoom:o,globe:r},c.features)),!!h)if(r){for(const u of h.polygonGroups)e.drawGlobePolygons(u.buffer,u.symbol);for(const u of h.lineGroups)e.drawGlobeLines(u.buffer,u.symbol);for(const u of h.pointGroups)e.drawGlobePoints(u.buffer,u.symbol);for(const u of h.modelGroups)e.drawGlobeModels(u.buffer,u.symbol);for(const u of h.extrusionGroups)e.drawGlobeExtrusion(u.buffer,u.symbol)}else{for(const u of h.polygonGroups)e.drawPolygons(u.buffer,u.symbol);for(const u of h.lineGroups)e.drawLines(u.buffer,u.symbol);for(const u of h.pointGroups)e.drawPoints(u.buffer,u.symbol);for(const u of h.modelGroups)e.drawModels(u.buffer,u.symbol);for(const u of h.extrusionGroups)e.drawExtrusion(u.buffer,u.symbol)}}i.pruneTileEntries(n,r,l)}function Yt(n,e,t,i,r){const o=t.getLayer(n);if(!o||!ze(o))return;const s=o.getDrawCommand(),a=o.getCustomUniforms(),l=o.getTextures(),c=i(o,a,l),h=a!==null,u=l.length>0,d=`custom:${n}:${o.vertexShader.length}:${o.fragmentShader.length}:${o.vertexBufferLayouts.length}:${String(h)}:${String(u)}${r?":globe":""}`,p=performance.now()/1e3,f=new Float32Array(4);f[0]=p,f[1]=.016,f[2]=0,f[3]=o.opacity;const g={pipelineKey:d,shaderSource:c,vertexBufferLayouts:o.vertexBufferLayouts,vertexBuffers:o.getVertexBuffers(),indexBuffer:o.getIndexBuffer(),indexFormat:s.indexFormat,frameUniforms:f,customUniforms:a,textures:l,vertexCount:s.vertexCount,instanceCount:s.instanceCount,indexCount:s.indexCount,topology:s.topology,blendState:o.blendState,...r?{useGlobeCamera:!0}:{}};e.drawCustom(g)}function Kt(n,e,t,i,r,o,s){const a=t.getLayer(n);if(!a||!Ut(a))return;s&&a.attachView(s);const l=a.getSourcePoints3857();!l||l.length===0||(e.setClusterSource(n,l,a.sourceVersion),e.drawClusters(n,a.clusterStyle,a.clusterRadius,a.clusterMinPoints,i,r,o))}class mt{type="2d";_camera;_interaction=null;_anim=null;_destroyed=!1;_markDirty=null;_onViewChange=null;constructor(e={}){const t=e.center??[0,0],[i,r]=q(t[0],t[1]);this._camera=new ai({center:[i,r],zoom:e.zoom??0,rotation:e.rotation?e.rotation*Math.PI/180:0,minZoom:e.minZoom,maxZoom:e.maxZoom,viewportWidth:e.viewportWidth??800,viewportHeight:e.viewportHeight??600})}setState(e){if(e.center){const[t,i]=q(e.center[0],e.center[1]);this._camera.setCenter([t,i])}e.zoom!==void 0&&this._camera.setZoom(e.zoom),e.rotation!==void 0&&this._camera.setRotation(e.rotation*Math.PI/180)}getState(){const e=this._camera.center,[t,i]=Ke(e[0],e[1]);return{center:[t,i],zoom:this._camera.zoom,pitch:0,bearing:0,rotation:this._camera.rotation*180/Math.PI}}getCameraState(){return{viewMatrix:this._camera.viewMatrix,projectionMatrix:this._camera.projectionMatrix,position:[this._camera.center[0],this._camera.center[1],0],viewportWidth:this._camera.viewportWidth,viewportHeight:this._camera.viewportHeight}}setViewport(e,t){this._camera.setViewport(e,t)}get camera(){return this._camera}goTo(e,t,i){if(this._destroyed)return Promise.reject(new Error("Mode disposed"));const r=e.duration??500;this.cancelAnimation();const o=e.center?q(e.center[0],e.center[1]):this._camera.center,s=e.zoom??this._camera.zoom,a=e.rotation!==void 0?e.rotation*Math.PI/180:this._camera.rotation;if(r<=0)return this._camera.setCenter(o),this._camera.setZoom(s),this._camera.setRotation(a),t(),i(),Promise.resolve();const l=this._camera.center,c=this._camera.zoom,h=this._camera.rotation;return this._anim=Wt(r,u=>{const d=l[0]+(o[0]-l[0])*u,p=l[1]+(o[1]-l[1])*u;this._camera.setCenter([d,p]),this._camera.setZoom(c+(s-c)*u),this._camera.setRotation(h+(a-h)*u),t(),i()},()=>!this._destroyed),this._anim.promise}cancelAnimation(){this._anim?.cancel(),this._anim=null}renderFrame(e){const{renderEngine:t,layerManager:i,tileManager:r,terrainManager:o,tileScheduler:s,bufferCache:a}=e,l=this._camera.getExtent(),c=Math.round(this._camera.zoom),h=Math.max(0,Math.floor(this._camera.zoom)),{tileSources:u,terrainLayerIds:d,vectorLayerIds:p,customLayerIds:f,clusterLayerIds:g,dynamicPointLayerIds:x,vectorTileLayerIds:v}=Zt(i,this._camera.zoom),y=this._resolveActiveTerrainLayer(i,d);o.setActiveLayer(y?.id??null);const m=s.getTilesForExtent(l,h).map(b=>({z:b.z,x:b.x,y:b.y}));y&&m.length>0&&o.requestTiles(y,m);let _=[];if(u.length>0){_=r.getReadyTiles(l,c,u);for(const b of _)t.drawImagery(b)}if(y){const b=new Set,C=(M,P,T)=>{const w=o.getReadyHillshadeTile(y,M,P,T);if(!w)return;const S=w.sourceCoord,B=`${S.z}/${S.x}/${S.y}`;b.has(B)||(b.add(B),t.drawImagery({texture:w.texture,extent:er(S.z,S.x,S.y),opacity:y.opacity}))};for(const M of m)C(M.z,M.x,M.y)}for(const b of v){const C=i.getLayer(b);if(!C||!("updateVisibleTiles"in C))continue;const M=C.maxZoom??c,P=Math.min(c,M),T=s.getTilesForExtent(l,P).map(w=>({z:w.z,x:w.x,y:w.y}));C.updateVisibleTiles(T,{renderMode:"2d",zoom:this._camera.zoom})}for(const b of v)jt(b,t,i,a,!1,this._camera.zoom);for(const b of p)$t(b,t,i,a,!1,this._camera.zoom);for(const b of f)Yt(b,t,i,(C,M,P)=>this._buildCustomShaderSource(C,M,P),!1);if(g.length>0){const b=[l.minX,l.minY,l.maxX,l.maxY],C=this._markDirty?{toMap:(M,P)=>this.toMap(M,P),toScreen:(M,P)=>this.toScreen(M,P),getZoom:()=>this._camera.zoom,getExtent:()=>[l.minX,l.minY,l.maxX,l.maxY],getViewportSize:()=>[this._camera.viewportWidth,this._camera.viewportHeight],goTo:M=>this.goTo(M,this._markDirty,this._onViewChange??(()=>{}))}:void 0;for(const M of g)Kt(M,t,i,this._camera.zoom,b,!1,C)}for(const b of x)Xt(b,t,i,!1)}_resolveActiveTerrainLayer(e,t){for(let i=t.length-1;i>=0;i--){const r=t[i];if(!r)continue;const o=e.getLayer(r);if(o&&Oe(o))return o}return null}_buildCustomShaderSource(e,t,i){if(e.rawMode===!0)return e.vertexShader+`
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
`+e.fragmentShader}attachInteraction(e,t,i,r){this._markDirty=t,this._onViewChange=i,r!==!1&&(this._interaction=new xi(e,this._camera,t,i,r))}toMap(e,t){const[i,r]=this._camera.screenToMap(e,t);return Ke(i,r)}toScreen(e,t){const[i,r]=q(e,t);return this._camera.mapToScreen(i,r)}dispose(){this._destroyed||(this._destroyed=!0,this.cancelAnimation(),this._interaction?.destroy(),this._interaction=null,this._onViewChange=null)}}const Ae=20037508342789244e-9,Qi=Ae*2;function er(n,e,t){const i=Math.pow(2,n),r=Qi/i,o=e*r-Ae,s=Ae-t*r,a=o+r,l=s-r;return[o,l,a,s]}const D=Math.PI/180,Te=180/Math.PI,tr=36.87;class ir{_center=[0,0];_zoom=2;_pitch=0;_bearing=0;_fov=tr;_viewportWidth=800;_viewportHeight=600;_viewMatrix=new Float32Array(16);_projectionMatrix=new Float32Array(16);_viewProjectionMatrix=new Float32Array(16);_flatViewProjectionMatrix=new Float32Array(16);_cameraPosition=[0,0,0];_clippingPlane=[0,0,1,0];_dirty=!0;constructor(e){e&&(e.center&&(this._center=[...e.center]),e.zoom!==void 0&&(this._zoom=e.zoom),e.pitch!==void 0&&(this._pitch=e.pitch),e.bearing!==void 0&&(this._bearing=e.bearing),e.fov!==void 0&&(this._fov=e.fov),e.viewportWidth!==void 0&&(this._viewportWidth=e.viewportWidth),e.viewportHeight!==void 0&&(this._viewportHeight=e.viewportHeight)),this.updateMatrices()}get center(){return[...this._center]}get zoom(){return this._zoom}get pitch(){return this._pitch}get bearing(){return this._bearing}get fov(){return this._fov}get viewportWidth(){return this._viewportWidth}get viewportHeight(){return this._viewportHeight}get viewMatrix(){return this._ensureClean(),this._viewMatrix}get projectionMatrix(){return this._ensureClean(),this._projectionMatrix}get viewProjectionMatrix(){return this._ensureClean(),this._viewProjectionMatrix}get flatViewProjectionMatrix(){return this._ensureClean(),this._flatViewProjectionMatrix}get cameraPosition(){return this._ensureClean(),[...this._cameraPosition]}get globeRadius(){return 512*Math.pow(2,this._zoom)/(2*Math.PI)}get cameraToCenterDistance(){const t=this._fov*D/2;return .5*this._viewportHeight/Math.tan(t)/this.globeRadius}get mercatorCameraDistance(){const e=512*Math.pow(2,this._zoom),t=this._fov*D;return .5*this._viewportHeight/Math.tan(t/2)/e}setCenter(e,t){if(!Number.isFinite(e)||!Number.isFinite(t))return;const i=e>=-180&&e<180?e:(e%360+540)%360-180;this._center=[i,Math.max(-85.051129,Math.min(85.051129,t))],this._dirty=!0}setZoom(e){this._zoom=Math.max(0,Math.min(22,e)),this._dirty=!0}setPitch(e){this._pitch=Math.max(0,Math.min(60,e)),this._dirty=!0}setBearing(e){this._bearing=(e%360+360)%360,this._dirty=!0}setViewport(e,t){this._viewportWidth=e,this._viewportHeight=t,this._dirty=!0}setFov(e){this._fov=Math.max(10,Math.min(90,e)),this._dirty=!0}_ensureClean(){this._dirty&&this.updateMatrices()}updateMatrices(){const e=this._fov*D,t=this._pitch*D,i=this._bearing*D,r=this._center[0]*D,o=this._center[1]*D,s=this._viewportWidth/this._viewportHeight,a=this.cameraToCenterDistance,[l,c]=this.computeNearFar();gt(this._projectionMatrix,e,s,l,c),rr(this._viewMatrix),de(this._viewMatrix,0,0,-a),Be(this._viewMatrix,-t),xt(this._viewMatrix,i),de(this._viewMatrix,0,0,-1),Be(this._viewMatrix,o),or(this._viewMatrix,-r),nr(this._viewProjectionMatrix,this._projectionMatrix,this._viewMatrix),this._computeCameraPosition(a,t,i,r,o),this._computeClippingPlane(a,t,i,r,o),this._computeFlatViewProjection(),this._dirty=!1}computeNearFar(){const e=this.cameraToCenterDistance,t=Math.max(.01,e*.5),i=e+2;return[t,i]}_computeFlatViewProjection(){const e=this._flatViewProjectionMatrix,t=this._center[1]*D,i=(this._center[0]+180)/360,r=(1-Math.log(Math.tan(t)+1/Math.cos(t))/Math.PI)/2,o=512*Math.pow(2,this._zoom),s=this._fov*D,a=this._pitch*D,l=this._bearing*D,c=this._viewportWidth/this._viewportHeight,u=.5*this._viewportHeight/Math.tan(s/2)/o,d=u*.05,p=u*200;gt(e,s,c,d,p),de(e,0,0,-u),Be(e,-a),e[4]=-e[4],e[5]=-e[5],e[6]=-e[6],e[7]=-e[7],xt(e,l),de(e,-i,-r,0)}_computeCameraPosition(e,t,i,r,o){let s=0,a=0,l=e;const c=Math.cos(t),h=Math.sin(t),u=a*c-l*h,d=a*h+l*c;a=u,l=d;const p=Math.cos(-i),f=Math.sin(-i),g=s*p-a*f,x=s*f+a*p;s=g,a=x,l+=1;const v=Math.cos(-o),y=Math.sin(-o),m=a*v-l*y,_=a*y+l*v;a=m,l=_;const b=Math.cos(r),C=Math.sin(r),M=s*b+l*C,P=-s*C+l*b;s=M,l=P,this._cameraPosition=[s,a,l]}_computeClippingPlane(e,t,i,r,o){const a=this._cameraPosition[0],l=this._cameraPosition[1],c=this._cameraPosition[2],h=Math.sqrt(a*a+l*l+c*c);if(h<=1){this._clippingPlane=[0,0,0,-1];return}const u=1/h,d=a/h,p=l/h,f=c/h;this._clippingPlane=[d,p,f,-u]}getClippingPlane(){return this._ensureClean(),[...this._clippingPlane]}screenToLonLat(e,t){this._ensureClean();const i=2*e/this._viewportWidth-1,r=1-2*t/this._viewportHeight,o=this._fov*D,s=Math.tan(o/2),a=this._viewportWidth/this._viewportHeight,l=[i*s*a,r*s,-1],c=this._pitch*D,h=this._bearing*D,u=this._center[0]*D,d=this._center[1]*D;let p=Math.sqrt(l[0]**2+l[1]**2+l[2]**2),f=l[0]/p,g=l[1]/p,x=l[2]/p;{const w=Math.cos(c),S=Math.sin(c),B=g*w-x*S,G=g*S+x*w;g=B,x=G}{const w=Math.cos(-h),S=Math.sin(-h),B=f*w-g*S,G=f*S+g*w;f=B,g=G}{const w=Math.cos(-d),S=Math.sin(-d),B=g*w-x*S,G=g*S+x*w;g=B,x=G}{const w=Math.cos(u),S=Math.sin(u),B=f*w+x*S,G=-f*S+x*w;f=B,x=G}const v=this._cameraPosition[0],y=this._cameraPosition[1],m=this._cameraPosition[2],_=sr(v,y,m,f,g,x,1);if(_===null)return null;const b=v+_*f,C=y+_*g,M=m+_*x,P=Math.asin(Math.max(-1,Math.min(1,C)))*Te;return[Math.atan2(b,M)*Te,P]}lonLatToScreen(e,t){this._ensureClean();const i=e*D,r=t*D,o=Math.cos(r),s=o*Math.sin(i),a=Math.sin(r),l=o*Math.cos(i),c=this._clippingPlane;if(s*c[0]+a*c[1]+l*c[2]+c[3]<0)return null;const h=this._viewProjectionMatrix,u=h[0]*s+h[4]*a+h[8]*l+h[12],d=h[1]*s+h[5]*a+h[9]*l+h[13],p=h[3]*s+h[7]*a+h[11]*l+h[15];if(p<=0)return null;const f=u/p,g=d/p,x=(f+1)*.5*this._viewportWidth,v=(1-g)*.5*this._viewportHeight;return[x,v]}lonLatToScreenFlat(e,t){this._ensureClean();const i=t*D,r=(e+180)/360,o=Math.sin(i),s=Math.max(-.9999,Math.min(.9999,o)),a=(1-Math.log((1+s)/(1-s))/(2*Math.PI))/2,l=this._flatViewProjectionMatrix,c=l[0]*r+l[4]*a+l[12],h=l[1]*r+l[5]*a+l[13],u=l[3]*r+l[7]*a+l[15];if(u<=0)return null;const d=c/u,p=h/u,f=(d+1)*.5*this._viewportWidth,g=(1-p)*.5*this._viewportHeight;return[f,g]}screenToLonLatFlat(e,t){this._ensureClean();const i=2*e/this._viewportWidth-1,r=1-2*t/this._viewportHeight,o=this._flatViewProjectionMatrix,s=o[0]-i*o[3],a=o[4]-i*o[7],l=i*o[15]-o[12],c=o[1]-r*o[3],h=o[5]-r*o[7],u=r*o[15]-o[13],d=s*h-a*c;if(Math.abs(d)<1e-12)return null;const p=(l*h-u*a)/d,f=(s*u-c*l)/d,g=p*360-180,v=(Math.atan(Math.exp(Math.PI-f*2*Math.PI))*2-Math.PI/2)*Te;return v<-85.051129||v>85.051129||g<-180||g>180?null:[g,v]}}function rr(n){n.fill(0),n[0]=1,n[5]=1,n[10]=1,n[15]=1}function gt(n,e,t,i,r){const o=1/Math.tan(e/2),s=1/(i-r);n.fill(0),n[0]=o/t,n[5]=o,n[10]=r*s,n[11]=-1,n[14]=i*r*s}function de(n,e,t,i){for(let r=0;r<4;r++){const o=n[12+r];n[12+r]=o+n[r]*e+n[4+r]*t+n[8+r]*i}}function Be(n,e){const t=Math.cos(e),i=Math.sin(e);for(let r=0;r<4;r++){const o=n[4+r],s=n[8+r];n[4+r]=o*t+s*i,n[8+r]=s*t-o*i}}function or(n,e){const t=Math.cos(e),i=Math.sin(e);for(let r=0;r<4;r++){const o=n[r],s=n[8+r];n[r]=o*t-s*i,n[8+r]=o*i+s*t}}function xt(n,e){const t=Math.cos(e),i=Math.sin(e);for(let r=0;r<4;r++){const o=n[r],s=n[4+r];n[r]=o*t+s*i,n[4+r]=s*t-o*i}}function nr(n,e,t){for(let i=0;i<4;i++)for(let r=0;r<4;r++){let o=0;for(let s=0;s<4;s++)o+=e[s*4+r]*t[i*4+s];n[i*4+r]=o}}function sr(n,e,t,i,r,o,s){const a=2*(n*i+e*r+t*o),l=n*n+e*e+t*t-s*s,c=a*a-4*l;if(c<0)return null;const h=Math.sqrt(c),u=(-a-h)/2,d=(-a+h)/2;return u>0?u:d>0?d:null}const ar=Math.PI/180,lr=180/Math.PI,vt=85.051129,_t=2*Math.PI;class cr{name="mercator";wrapsHorizontally=!0;project(e,t){const i=Math.max(-vt,Math.min(vt,t)),r=(e+180)/360,o=i*ar,s=.5-Math.log(Math.tan(Math.PI/4+o/2))/_t;return[r,s]}unproject(e,t){const i=e*360-180,o=(2*Math.atan(Math.exp((.5-t)*_t))-Math.PI/2)*lr;return[i,o]}}class A{name="globe";static TRANSITION_ZOOM_LOW=5;static TRANSITION_ZOOM_HIGH=6;_globeness=1;_mercator;constructor(){this._mercator=new cr}get globeness(){return this._globeness}get wrapsHorizontally(){return this._globeness<1}static globenessFromZoom(e){if(e<=A.TRANSITION_ZOOM_LOW)return 1;if(e>=A.TRANSITION_ZOOM_HIGH)return 0;const t=(e-A.TRANSITION_ZOOM_LOW)/(A.TRANSITION_ZOOM_HIGH-A.TRANSITION_ZOOM_LOW);return .5*(1+Math.cos(t*Math.PI))}setGlobeness(e){this._globeness=Math.max(0,Math.min(1,e))}updateFromZoom(e){this._globeness=A.globenessFromZoom(e)}project(e,t){return this._mercator.project(e,t)}unproject(e,t){return this._mercator.unproject(e,t)}static mercatorToAngular(e,t){const i=e*2*Math.PI-Math.PI,r=2*Math.atan(Math.exp(Math.PI-t*2*Math.PI))-Math.PI/2;return[i,r]}static angularToSphere(e,t){const i=Math.cos(t);return[i*Math.sin(e),Math.sin(t),i*Math.cos(e)]}static lonLatToSphere(e,t){const i=e*(Math.PI/180),r=t*(Math.PI/180);return A.angularToSphere(i,r)}}class be{planes;sphereCenter;sphereRadius;constructor(e,t,i){this.planes=e,this.sphereCenter=t,this.sphereRadius=i}static fromTile(e,t,i){const r=Math.pow(2,e),o=t/r,s=(t+1)/r,a=i/r,l=(i+1)/r,c=re(o,a),h=re(s,a),u=re(o,l),d=re(s,l),p=[(o+s)/2,(a+l)/2],f=re(p[0],p[1]),g=[fe(c,h,f),fe(h,d,f),fe(d,u,f),fe(u,c,f)],x={a:-f[0],b:-f[1],c:-f[2],d:1},v=[c,h,u,d].map(C=>C[0]*f[0]+C[1]*f[1]+C[2]*f[2]),y=Math.min(...v),m={a:f[0],b:f[1],c:f[2],d:-y},_=[...g,x,m],b=Math.max(pe(f,c),pe(f,h),pe(f,u),pe(f,d));return new be(_,f,b)}intersectsFrustum(e){for(const t of e)if(t.a*this.sphereCenter[0]+t.b*this.sphereCenter[1]+t.c*this.sphereCenter[2]+t.d<-this.sphereRadius)return!1;return!0}intersectsClippingPlane(e){return e[0]*this.sphereCenter[0]+e[1]*this.sphereCenter[1]+e[2]*this.sphereCenter[2]+e[3]>-this.sphereRadius}isVisible(e,t){return this.intersectsClippingPlane(t)&&this.intersectsFrustum(e)}}function re(n,e){const[t,i]=A.mercatorToAngular(n,e);return A.angularToSphere(t,i)}function fe(n,e,t){let i=n[1]*e[2]-n[2]*e[1],r=n[2]*e[0]-n[0]*e[2],o=n[0]*e[1]-n[1]*e[0];const s=Math.sqrt(i*i+r*r+o*o);return s<1e-15?{a:0,b:0,c:0,d:0}:(i/=s,r/=s,o/=s,i*t[0]+r*t[1]+o*t[2]<0&&(i=-i,r=-r,o=-o),{a:i,b:r,c:o,d:0})}function pe(n,e){const t=n[0]-e[0],i=n[1]-e[1],r=n[2]-e[2];return Math.sqrt(t*t+i*i+r*r)}class ur{_maxZoom;_minZoom;constructor(e){this._maxZoom=e?.maxZoom??22,this._minZoom=e?.minZoom??0}getTilesForGlobe(e,t){const i=Math.max(this._minZoom,Math.min(this._maxZoom,Math.floor(t))),r=fi(e.viewProjectionMatrix),o=e.getClippingPlane(),s=[];if(i===0)return be.fromTile(0,0,0).isVisible(r,o)&&s.push({z:0,x:0,y:0}),s;const a=this._minZoom,l=a===0?[{z:0,x:0,y:0}]:this._tilesAtZoom(a);for(const c of l)this._subdivide(c.z,c.x,c.y,i,r,o,s);return s}_subdivide(e,t,i,r,o,s,a){if(!be.fromTile(e,t,i).isVisible(o,s))return;if(e>=r){a.push({z:e,x:t,y:i});return}const c=e+1,h=t*2,u=i*2;this._subdivide(c,h,u,r,o,s,a),this._subdivide(c,h+1,u,r,o,s,a),this._subdivide(c,h,u+1,r,o,s,a),this._subdivide(c,h+1,u+1,r,o,s,a)}_tilesAtZoom(e){const t=Math.pow(2,e),i=[];for(let r=0;r<t;r++)for(let o=0;o<t;o++)i.push({z:e,x:r,y:o});return i}static tileForLonLat(e,t,i){const r=Math.floor(i),o=Math.pow(2,r),s=Math.floor((e+180)/360*o),a=t*(Math.PI/180),l=Math.floor((1-Math.log(Math.tan(a)+1/Math.cos(a))/Math.PI)/2*o);return{z:r,x:Math.max(0,Math.min(o-1,s)),y:Math.max(0,Math.min(o-1,l))}}static tileBounds(e,t,i){const r=Math.pow(2,e),o=t/r*360-180,s=(t+1)/r*360-180,a=yt(i,r),l=yt(i+1,r);return{west:o,east:s,north:a,south:l}}}function yt(n,e){return Math.atan(Math.sinh(Math.PI-2*Math.PI*n/e))*(180/Math.PI)}class hr{_element;_transform;_onDirty;_onViewChange;_panEnabled;_zoomEnabled;_keyboardEnabled;_doubleClickZoom;_pitchBearingEnabled;_zoomSpeed;_getGlobeness;_dragging=!1;_lastPointerX=0;_lastPointerY=0;_activePointerId=null;_dragButton=0;_pointers=new Map;_lastPinchDist=0;_lastClickTime=0;_onPointerDown;_onPointerMove;_onPointerUp;_onWheel;_onKeyDown;_onContextMenu;_destroyed=!1;constructor(e,t,i,r,o){this._element=e,this._transform=t,this._onDirty=i,this._onViewChange=r,this._panEnabled=o?.pan??!0,this._zoomEnabled=o?.zoom??!0,this._keyboardEnabled=o?.keyboard??!0,this._doubleClickZoom=o?.doubleClickZoom??!0,this._pitchBearingEnabled=o?.pitchBearing??!0,this._zoomSpeed=o?.zoomSpeed??1,this._getGlobeness=o?.getGlobeness??(()=>1),this._onPointerDown=this._handlePointerDown.bind(this),this._onPointerMove=this._handlePointerMove.bind(this),this._onPointerUp=this._handlePointerUp.bind(this),this._onWheel=this._handleWheel.bind(this),this._onKeyDown=this._handleKeyDown.bind(this),this._onContextMenu=s=>s.preventDefault(),e.addEventListener("pointerdown",this._onPointerDown),e.addEventListener("pointermove",this._onPointerMove),e.addEventListener("pointerup",this._onPointerUp),e.addEventListener("pointercancel",this._onPointerUp),e.addEventListener("wheel",this._onWheel,{passive:!1}),e.addEventListener("contextmenu",this._onContextMenu),this._keyboardEnabled&&(e.setAttribute("tabindex","0"),e.addEventListener("keydown",this._onKeyDown))}_handlePointerDown(e){if(this._destroyed)return;const t=e.target;if(!(t&&t!==this._element&&t.tagName!=="CANVAS"))if(this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this._pointers.size===1){if(this._dragging=!0,this._dragButton=e.button,this._activePointerId=e.pointerId,this._lastPointerX=e.clientX,this._lastPointerY=e.clientY,this._element.setPointerCapture(e.pointerId),this._doubleClickZoom&&e.button===0){const i=Date.now();i-this._lastClickTime<300&&this._handleDoubleClick(e),this._lastClickTime=i}}else this._pointers.size===2&&(this._lastPinchDist=this._getPinchDistance())}_handlePointerMove(e){if(this._destroyed)return;if(this._pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this._pointers.size===2&&this._zoomEnabled){const r=this._getPinchDistance();if(this._lastPinchDist>0){const o=r/this._lastPinchDist,s=Math.log2(o);this._transform.setZoom(this._transform.zoom+s),this._onDirty(),this._onViewChange()}this._lastPinchDist=r;return}if(!this._dragging||e.pointerId!==this._activePointerId)return;const t=e.clientX-this._lastPointerX,i=e.clientY-this._lastPointerY;if(this._lastPointerX=e.clientX,this._lastPointerY=e.clientY,this._dragButton===2&&this._pitchBearingEnabled){const r=t*.3,o=-i*.3;this._transform.setBearing(this._transform.bearing+r),this._transform.setPitch(this._transform.pitch+o),this._onDirty(),this._onViewChange()}else this._dragButton===0&&this._panEnabled&&this._handlePan(t,i)}_handlePointerUp(e){if(!this._destroyed){if(this._pointers.delete(e.pointerId),e.pointerId===this._activePointerId){this._dragging=!1,this._activePointerId=null;try{this._element.releasePointerCapture(e.pointerId)}catch{}}this._pointers.size<2&&(this._lastPinchDist=0)}}_handlePan(e,t){const i=180/(Math.pow(2,this._transform.zoom)*256),r=this._transform.center,o=this._transform.bearing*(Math.PI/180),s=Math.cos(o),a=Math.sin(o),l=e*s+t*a,c=-e*a+t*s,h=r[1]*(Math.PI/180),u=Math.max(.1,Math.cos(h)),d=r[0]-l*i/u,p=Math.max(-85.051129,Math.min(85.051129,r[1]+c*i));this._transform.setCenter(d,p),this._onDirty(),this._onViewChange()}_handleWheel(e){if(this._destroyed||!this._zoomEnabled)return;e.preventDefault();const t=-e.deltaY*.003*this._zoomSpeed,i=this._transform.zoom,r=i+t,o=typeof this._element.getBoundingClientRect=="function"?this._element.getBoundingClientRect():null,s=o?e.clientX-o.left:this._transform.viewportWidth/2,a=o?e.clientY-o.top:this._transform.viewportHeight/2,l=s-this._transform.viewportWidth/2,c=a-this._transform.viewportHeight/2;if(this._transform.setZoom(r),this._transform.zoom-i!==0&&(Math.abs(l)>.5||Math.abs(c)>.5)){const d=1-this._getGlobeness();if(d>.001){const p=this._transform.bearing*(Math.PI/180),f=Math.cos(p),g=Math.sin(p),x=l*f+c*g,v=-l*g+c*f,y=360/(Math.pow(2,i)*512),m=360/(Math.pow(2,this._transform.zoom)*512),_=this._transform.center,b=_[1]*(Math.PI/180),C=Math.max(.1,Math.cos(b)),M=x*(y-m)/C*d,P=-v*(y-m)*d;this._transform.setCenter(_[0]+M,Math.max(-85.051129,Math.min(85.051129,_[1]+P)))}}this._onDirty(),this._onViewChange()}_handleDoubleClick(e){this._zoomEnabled&&(this._transform.setZoom(this._transform.zoom+1),this._onDirty(),this._onViewChange())}_handleKeyDown(e){if(this._destroyed)return;const t=50,i=180/(Math.pow(2,this._transform.zoom)*256);switch(e.key){case"+":case"=":this._zoomEnabled&&(this._transform.setZoom(this._transform.zoom+.5),this._onDirty(),this._onViewChange());break;case"-":this._zoomEnabled&&(this._transform.setZoom(this._transform.zoom-.5),this._onDirty(),this._onViewChange());break;case"ArrowLeft":if(this._panEnabled){const r=this._transform.center;this._transform.setCenter(r[0]-t*i,r[1]),this._onDirty(),this._onViewChange()}break;case"ArrowRight":if(this._panEnabled){const r=this._transform.center;this._transform.setCenter(r[0]+t*i,r[1]),this._onDirty(),this._onViewChange()}break;case"ArrowUp":if(this._panEnabled){const r=this._transform.center;this._transform.setCenter(r[0],Math.min(85.051129,r[1]+t*i)),this._onDirty(),this._onViewChange()}break;case"ArrowDown":if(this._panEnabled){const r=this._transform.center;this._transform.setCenter(r[0],Math.max(-85.051129,r[1]-t*i)),this._onDirty(),this._onViewChange()}break}}_getPinchDistance(){const e=[...this._pointers.values()];if(e.length<2)return 0;const t=e[1].x-e[0].x,i=e[1].y-e[0].y;return Math.sqrt(t*t+i*i)}destroy(){this._destroyed||(this._destroyed=!0,this._element.removeEventListener("pointerdown",this._onPointerDown),this._element.removeEventListener("pointermove",this._onPointerMove),this._element.removeEventListener("pointerup",this._onPointerUp),this._element.removeEventListener("pointercancel",this._onPointerUp),this._element.removeEventListener("wheel",this._onWheel),this._element.removeEventListener("contextmenu",this._onContextMenu),this._element.removeEventListener("keydown",this._onKeyDown))}}const z=20037508342789244e-9;class bt{type="3d";_transform;_projection;_tileCovering;_interaction=null;_anim=null;_destroyed=!1;_markDirty=null;_onViewChange=null;constructor(e={}){this._transform=new ir({center:e.center??[0,0],zoom:e.zoom??2,pitch:e.pitch??0,bearing:e.bearing??0,viewportWidth:e.viewportWidth??800,viewportHeight:e.viewportHeight??600}),this._projection=new A,this._projection.updateFromZoom(this._transform.zoom),this._tileCovering=new ur}get transform(){return this._transform}get projection(){return this._projection}setState(e){e.center&&this._transform.setCenter(e.center[0],e.center[1]),e.zoom!==void 0&&(this._transform.setZoom(e.zoom),this._projection.updateFromZoom(e.zoom)),e.pitch!==void 0&&this._transform.setPitch(e.pitch),e.bearing!==void 0&&this._transform.setBearing(e.bearing)}getState(){return{center:this._transform.center,zoom:this._transform.zoom,pitch:this._transform.pitch,bearing:this._transform.bearing,rotation:0}}getCameraState(){const e=this._transform.center,t=e[1]*Math.PI/180,i=(e[0]+180)/360,r=(1-Math.log(Math.tan(t)+1/Math.cos(t))/Math.PI)/2;return{viewMatrix:this._transform.viewMatrix,projectionMatrix:this._transform.projectionMatrix,position:this._transform.cameraPosition,viewportWidth:this._transform.viewportWidth,viewportHeight:this._transform.viewportHeight,projectionTransition:this._projection.globeness,clippingPlane:this._transform.getClippingPlane(),globeRadius:1,flatViewProjectionMatrix:this._transform.flatViewProjectionMatrix,cameraMerc01:[i,r,this._transform.mercatorCameraDistance]}}setViewport(e,t){this._transform.setViewport(e,t)}goTo(e,t,i){if(this._destroyed)return Promise.reject(new Error("Mode disposed"));const r=e.duration??500;this.cancelAnimation();const o=e.center??this._transform.center,s=e.zoom??this._transform.zoom,a=e.pitch??this._transform.pitch,l=e.bearing??this._transform.bearing;if(r<=0)return this._transform.setCenter(o[0],o[1]),this._transform.setZoom(s),this._transform.setPitch(a),this._transform.setBearing(l),this._projection.updateFromZoom(this._transform.zoom),t(),i(),Promise.resolve();const c=this._transform.center,h=this._transform.zoom,u=this._transform.pitch,d=this._transform.bearing;return this._anim=Wt(r,p=>{this._transform.setCenter(c[0]+(o[0]-c[0])*p,c[1]+(o[1]-c[1])*p),this._transform.setZoom(h+(s-h)*p),this._transform.setPitch(u+(a-u)*p),this._transform.setBearing(d+(l-d)*p),this._projection.updateFromZoom(this._transform.zoom),t(),i()},()=>!this._destroyed),this._anim.promise}cancelAnimation(){this._anim?.cancel(),this._anim=null}renderFrame(e){const{renderEngine:t,layerManager:i,tileManager:r,terrainManager:o,bufferCache:s}=e;this._projection.updateFromZoom(this._transform.zoom);const a=Math.floor(this._transform.zoom),{tileSources:l,terrainLayerIds:c,vectorLayerIds:h,customLayerIds:u,clusterLayerIds:d,dynamicPointLayerIds:p,vectorTileLayerIds:f}=Zt(i,this._transform.zoom),g=this._resolveActiveTerrainLayer(i,c);if(o.setActiveLayer(g?.id??null),l.length===0&&h.length===0&&u.length===0&&d.length===0&&f.length===0)return;const x=this._projection.globeness;if(l.length>0){const v=x>=.5?this._tileCovering.getTilesForGlobe(this._transform,a):this._getTilesForFlat(a);g&&o.requestTiles(g,v),x>.01&&(t.drawAtmosphere(x),t.drawPoleCaps([.65,.78,.88,x]));const y=r.getReadyTilesForCoords(v,l);for(const m of y){const _=20037508342789244e-9,b=(m.extent[0]+_)/(2*_),C=(m.extent[2]+_)/(2*_),M=1-(m.extent[3]+_)/(2*_),P=1-(m.extent[1]+_)/(2*_),T=[b,M,C,P],w=dr(T),S=g&&w?o.getReadyHeightTile(g,w.z,w.x,w.y):null,B=g!==null;t.drawGlobeTile({texture:m.texture,mercatorExtent:T,opacity:m.opacity,filters:m.filters,terrainHeightTexture:S?.texture,terrainUvOffsetScale:S?.uvOffsetScale??[0,0,1,1],heightMode:B?1:0,heightExaggeration:B?g.exaggeration:void 0,lighting3D:B?g.lighting3D:void 0})}}else x>.01&&(t.drawAtmosphere(x),t.drawPoleCaps([.65,.78,.88,x]));for(const v of f){const y=i.getLayer(v);if(!y||!("updateVisibleTiles"in y))continue;const m=Math.floor(this._transform.zoom),_=y.maxZoom??m,b=Math.min(m,_),C=x>=.5?this._tileCovering.getTilesForGlobe(this._transform,b):this._getTilesForFlat(b);y.updateVisibleTiles(C,{renderMode:"3d",zoom:this._transform.zoom})}for(const v of f)jt(v,t,i,s,!0,this._transform.zoom);for(const v of h)$t(v,t,i,s,!0,this._transform.zoom);for(const v of u)Yt(v,t,i,(y,m,_)=>this._buildCustomShaderSource(y,m,_),!0);if(d.length>0){const v=this._fallbackClusterExtent3857(this._transform.center),y=this._computeClusterExtent3857()??v,m=this._markDirty?{toMap:(_,b)=>this.toMap(_,b),toScreen:(_,b)=>this.toScreen(_,b),getZoom:()=>this._transform.zoom,getExtent:()=>this._computeClusterExtent3857()??v,getViewportSize:()=>[this._transform.viewportWidth,this._transform.viewportHeight],goTo:_=>this.goTo(_,this._markDirty,this._onViewChange??(()=>{}))}:void 0;for(const _ of d)Kt(_,t,i,this._transform.zoom,y,!0,m)}for(const v of p)Xt(v,t,i,!0)}_resolveActiveTerrainLayer(e,t){for(let i=t.length-1;i>=0;i--){const r=t[i];if(!r)continue;const o=e.getLayer(r);if(o&&Oe(o))return o}return null}_computeClusterExtent3857(){const e=this._transform.viewportWidth,t=this._transform.viewportHeight;if(!(e>0)||!(t>0))return null;const i=Math.min(e*.08,64),r=Math.min(t*.08,64),o=i,s=e*.5,a=Math.max(o,e-i),l=r,c=t*.5,h=Math.max(l,t-r),u=[[o,l],[s,l],[a,l],[o,c],[s,c],[a,c],[o,h],[s,h],[a,h]],d=this.toMap(s,c)??this._transform.center;let p=1/0,f=1/0,g=-1/0,x=-1/0,v=0;for(const[b,C]of u){const M=this.toMap(b,C);if(!M)continue;const[P,T]=q(M[0],M[1]);p=Math.min(p,P),f=Math.min(f,T),g=Math.max(g,P),x=Math.max(x,T),v++}if(v<3||!isFinite(p)||!isFinite(f)||!isFinite(g)||!isFinite(x))return this._fallbackClusterExtent3857(d);const y=g-p,m=x-f;if(!(y>0)||!(m>0))return this._fallbackClusterExtent3857(d);const _=Math.max(y,m)*.08;return[Math.max(-z,p-_),Math.max(-z,f-_),Math.min(z,g+_),Math.min(z,x+_)]}_fallbackClusterExtent3857(e){const[t,i]=q(e[0],e[1]),r=2*z/(256*Math.pow(2,this._transform.zoom)),o=Math.max(r*this._transform.viewportWidth*.6,r*32),s=Math.max(r*this._transform.viewportHeight*.6,r*32);return[Math.max(-z,t-o),Math.max(-z,i-s),Math.min(z,t+o),Math.min(z,i+s)]}_buildCustomShaderSource(e,t,i){if(e.rawMode===!0)return e.vertexShader+`
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
`+e.fragmentShader}_getTilesForFlat(e){const t=Math.max(0,Math.min(22,Math.floor(e))),i=Math.pow(2,t),r=this._transform.center,o=r[1]*Math.PI/180,s=(Math.floor((r[0]+180)/360*i)%i+i)%i,a=Math.floor((1-Math.log(Math.tan(o)+1/Math.cos(o))/Math.PI)/2*i),l=1/Math.max(.3,Math.cos(this._transform.pitch*Math.PI/180)),c=Math.ceil(this._transform.viewportWidth/256/2)+1,h=Math.ceil(this._transform.viewportHeight/256/2*l)+1,u=[];for(let d=-h;d<=h;d++)for(let p=-c;p<=c;p++){const f=s+p,g=a+d;f>=0&&f<i&&g>=0&&g<i&&u.push({z:t,x:f,y:g})}return u}attachInteraction(e,t,i,r){if(this._markDirty=t,this._onViewChange=i,r===!1)return;const o={...r,getGlobeness:()=>this._projection.globeness};this._interaction=new hr(e,this._transform,t,()=>{this._projection.updateFromZoom(this._transform.zoom),i()},o)}toMap(e,t){const i=this._projection.globeness;if(i>=.999)return this._transform.screenToLonLat(e,t);if(i<=.001)return this._transform.screenToLonLatFlat(e,t);const r=this._transform.screenToLonLat(e,t),o=this._transform.screenToLonLatFlat(e,t);return o?r?[o[0]+(r[0]-o[0])*i,o[1]+(r[1]-o[1])*i]:o:r}toScreen(e,t){const i=this._projection.globeness;if(i>=.999)return this._transform.lonLatToScreen(e,t);if(i<=.001)return this._transform.lonLatToScreenFlat(e,t);const r=this._transform.lonLatToScreen(e,t),o=this._transform.lonLatToScreenFlat(e,t);return o?r?[o[0]+(r[0]-o[0])*i,o[1]+(r[1]-o[1])*i]:o:r}dispose(){this._destroyed||(this._destroyed=!0,this.cancelAnimation(),this._interaction?.destroy(),this._interaction=null,this._onViewChange=null)}}function dr(n){const e=n[2]-n[0];if(!(e>0))return null;const t=Math.floor(Math.log2(1/e)+1e-6);if(!Number.isFinite(t)||t<0)return null;const i=Math.pow(2,t);if(!(i>0))return null;const r=Math.max(0,Math.min(i-1,Math.floor(n[0]*i+1e-6))),o=Math.max(0,Math.min(i-1,Math.floor(n[1]*i+1e-6)));return{z:t,x:r,y:o}}class fr{_tools=new Map;_activeTool=null;_overlay=null;_events=new Q;_commands;_previewLayer=null;_wheelPassthrough;_destroyed=!1;_canvas=null;_container=null;_toMap=null;_toScreen=null;_getMode=null;_getZoom=null;_markDirty=null;_lastClickTime=0;_lastClickX=0;_lastClickY=0;_dblClickThreshold=300;_dblClickDistance=5;_boundPointerDown=null;_boundPointerMove=null;_boundPointerUp=null;_boundKeyDown=null;_boundWheel=null;_boundContextMenu=null;constructor(e={}){this._commands=new hi({maxHistorySize:e.maxHistorySize??50}),this._previewLayer=e.previewLayer??null,this._wheelPassthrough=e.wheelPassthrough??!0,this._commands.on("command-executed",()=>this._emitHistoryChange()),this._commands.on("command-undone",()=>this._emitHistoryChange()),this._commands.on("command-redone",()=>this._emitHistoryChange())}init(e){this._canvas=e.canvas,this._container=e.container,this._toMap=e.toMap,this._toScreen=e.toScreen,this._getMode=e.getMode,this._getZoom=e.getZoom,this._markDirty=e.markDirty}setPreviewLayer(e){this._previewLayer=e}get previewLayer(){return this._previewLayer}registerTool(e){if(this._tools.has(e.id))throw new Error(`Tool already registered: ${e.id}`);this._tools.set(e.id,e)}unregisterTool(e){const t=this._tools.get(e);t&&(this._activeTool===t&&this.deactivateTool(),t.destroy(),this._tools.delete(e))}getTool(e){return this._tools.get(e)}get tools(){return this._tools}activateTool(e){if(this._destroyed)return;const t=this._tools.get(e);if(!t)throw new Error(`Tool not found: ${e}`);if(this._activeTool&&this._activeTool!==t&&this.deactivateTool(),this._activeTool===t)return;this._ensureOverlay();const i=this._buildContext();if(!i){console.warn("[ToolManager] Cannot activate tool — view not initialized");return}this._activeTool=t,t.activate(i),this._overlay&&(this._overlay.style.pointerEvents="auto",this._overlay.style.cursor=t.cursor),this._events.emit("tool-activate",{toolId:e})}deactivateTool(){if(!this._activeTool)return;const e=this._activeTool.id;this._activeTool.deactivate(),this._activeTool=null,this._overlay&&(this._overlay.style.pointerEvents="none",this._overlay.style.cursor="default"),this._previewLayer?.clear(),this._markDirty?.(),this._events.emit("tool-deactivate",{toolId:e})}get activeTool(){return this._activeTool}get commands(){return this._commands}undo(){const e=this._commands.undo();return e&&this._markDirty?.(),e}redo(){const e=this._commands.redo();return e&&this._markDirty?.(),e}get canUndo(){return this._commands.canUndo}get canRedo(){return this._commands.canRedo}on(e,t){this._events.on(e,t)}off(e,t){this._events.off(e,t)}destroy(){if(!this._destroyed){this._destroyed=!0,this.deactivateTool();for(const e of this._tools.values())e.destroy();this._tools.clear(),this._removeOverlay(),this._commands.destroy(),this._events.removeAll(),this._previewLayer=null,this._canvas=null,this._container=null}}_ensureOverlay(){if(this._overlay||!this._container)return;const e=document.createElement("div");e.style.position="absolute",e.style.top="0",e.style.left="0",e.style.width="100%",e.style.height="100%",e.style.pointerEvents="none",e.style.zIndex="10",e.style.touchAction="none",e.setAttribute("data-mapgpu-tool-overlay","true"),getComputedStyle(this._container).position==="static"&&(this._container.style.position="relative"),this._container.appendChild(e),this._overlay=e,this._boundPointerDown=this._onPointerDown.bind(this),this._boundPointerMove=this._onPointerMove.bind(this),this._boundPointerUp=this._onPointerUp.bind(this),this._boundKeyDown=this._onKeyDown.bind(this),this._boundWheel=this._onWheel.bind(this),this._boundContextMenu=i=>i.preventDefault(),e.addEventListener("pointerdown",this._boundPointerDown),e.addEventListener("pointermove",this._boundPointerMove),e.addEventListener("pointerup",this._boundPointerUp),e.addEventListener("wheel",this._boundWheel,{passive:!1}),e.addEventListener("contextmenu",this._boundContextMenu),document.addEventListener("keydown",this._boundKeyDown)}_removeOverlay(){this._overlay&&(this._boundPointerDown&&this._overlay.removeEventListener("pointerdown",this._boundPointerDown),this._boundPointerMove&&this._overlay.removeEventListener("pointermove",this._boundPointerMove),this._boundPointerUp&&this._overlay.removeEventListener("pointerup",this._boundPointerUp),this._boundWheel&&this._overlay.removeEventListener("wheel",this._boundWheel),this._boundContextMenu&&this._overlay.removeEventListener("contextmenu",this._boundContextMenu),this._boundKeyDown&&document.removeEventListener("keydown",this._boundKeyDown),this._overlay.parentElement?.removeChild(this._overlay),this._overlay=null)}_onPointerDown(e){if(!this._activeTool||e.button!==0)return;const t=this._buildPointerEvent(e);this._activeTool.onPointerDown(t),this._syncCursor()}_onPointerMove(e){if(!this._activeTool)return;const t=this._buildPointerEvent(e);this._activeTool.onPointerMove(t),this._events.emit("cursor-move",{screenX:t.screenX,screenY:t.screenY,mapCoords:t.mapCoords}),this._syncCursor()}_onPointerUp(e){if(!this._activeTool||e.button!==0)return;const t=this._buildPointerEvent(e),i=Date.now(),r=Math.abs(t.screenX-this._lastClickX),o=Math.abs(t.screenY-this._lastClickY);i-this._lastClickTime<this._dblClickThreshold&&r<this._dblClickDistance&&o<this._dblClickDistance?(this._activeTool.onDoubleClick(t),this._lastClickTime=0):(this._activeTool.onPointerUp(t),this._lastClickTime=i,this._lastClickX=t.screenX,this._lastClickY=t.screenY),this._syncCursor()}_onKeyDown(e){if(this._activeTool){if((e.ctrlKey||e.metaKey)&&e.key==="z"&&!e.shiftKey){e.preventDefault(),this.undo();return}if((e.ctrlKey||e.metaKey)&&e.key==="z"&&e.shiftKey){e.preventDefault(),this.redo();return}if((e.ctrlKey||e.metaKey)&&e.key==="y"){e.preventDefault(),this.redo();return}if(e.key==="Escape"){e.preventDefault(),this._activeTool.cancel(),this._syncCursor();return}this._activeTool.onKeyDown(e)&&e.preventDefault()}}_onWheel(e){if(!this._wheelPassthrough||!this._container)return;const t=new WheelEvent("wheel",{deltaX:e.deltaX,deltaY:e.deltaY,deltaZ:e.deltaZ,deltaMode:e.deltaMode,clientX:e.clientX,clientY:e.clientY,screenX:e.screenX,screenY:e.screenY,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,bubbles:!0,cancelable:!0});this._overlay&&(this._overlay.style.pointerEvents="none",this._canvas?.dispatchEvent(t),queueMicrotask(()=>{this._overlay&&this._activeTool&&(this._overlay.style.pointerEvents="auto")})),e.preventDefault()}_buildPointerEvent(e){const t=this._canvas?.getBoundingClientRect(),i=t?e.clientX-t.left:e.offsetX,r=t?e.clientY-t.top:e.offsetY,o=this._toMap?this._toMap(i,r):null;return{screenX:i,screenY:r,mapCoords:o,originalEvent:e,button:e.button,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey||e.metaKey}}_buildContext(){return!this._canvas||!this._toMap||!this._toScreen||!this._getMode||!this._getZoom||!this._previewLayer||!this._markDirty?null:{toMap:this._toMap,toScreen:this._toScreen,canvas:this._canvas,mode:this._getMode(),zoom:this._getZoom(),previewLayer:this._previewLayer,commands:this._commands,markDirty:this._markDirty,emitEvent:(e,t)=>{this._events.emit(e,t)}}}_syncCursor(){this._overlay&&this._activeTool&&(this._overlay.style.cursor=this._activeTool.cursor)}_emitHistoryChange(){this._events.emit("history-change",{canUndo:this._commands.canUndo,canRedo:this._commands.canRedo})}}const pr={format:"depth32float",compareFunc:"less",clearValue:1};function Pt(n){return n==="3d"?pr:Ie}class Bn{get map(){return this._core.map}id;get type(){return this._mode.type}_core;_mode;_events=new Q;_ready=!1;_destroyed=!1;_readyResolve=null;_readyPromise;_interactionOptions;_animatedLayerCallbacks=new Map;_toolManager=null;_clickHandler=null;_pointerMoveHandler=null;constructor(e){this.id=`mapview-${Date.now()}`,this._core=new qi,this._interactionOptions=e.interaction??{};let t=null;if(typeof e.container=="string"){const s=document.querySelector(e.container);if(!s||!(s instanceof HTMLElement))throw new Error(`Container element not found: ${e.container}`);t=s}else t=e.container;t&&typeof document<"u"&&this._core.createCanvas(t);const i=t?.clientWidth||800,r=t?.clientHeight||600,o=e.mode??"2d";if(o==="3d"?this._mode=new bt({center:e.center,zoom:e.zoom,pitch:e.pitch,bearing:e.bearing,viewportWidth:i,viewportHeight:r}):this._mode=new mt({center:e.center,zoom:e.zoom,rotation:e.rotation,minZoom:e.minZoom,maxZoom:e.maxZoom,viewportWidth:i,viewportHeight:r}),this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._core.map.on("layer-add",({layer:s})=>{if(this._core.layerManager.addLayer(s),this._core.renderLoop.markDirty(),this._events.emit("layer-add",{layer:s}),s.on("refresh",()=>{this._core.bufferCache.invalidate(s.id),this._core.terrainManager.invalidateLayer(s.id),this._core.renderLoop.markDirty()}),s.on("visibility-change",()=>{this._core.renderLoop.markDirty()}),s.on("opacity-change",()=>{this._core.renderLoop.markDirty()}),ze(s)&&s.animated){const a=(l,c)=>this._core.renderLoop.markDirty();this._animatedLayerCallbacks.set(s.id,a),this._core.renderLoop.onPreFrame(a)}}),this._core.map.on("layer-remove",({layer:s})=>{this._core.layerManager.removeLayer(s.id),this._core.bufferCache.invalidate(s.id),this._core.terrainManager.invalidateLayer(s.id),this._core.renderLoop.markDirty(),this._events.emit("layer-remove",{layer:s});const a=this._animatedLayerCallbacks.get(s.id);a&&(this._core.renderLoop.offPreFrame(a),this._animatedLayerCallbacks.delete(s.id))}),e.renderEngine&&(this._core.renderEngine=e.renderEngine,this._core.bufferCache.setRenderEngine(e.renderEngine),this._core.tileManager.setRenderEngine(e.renderEngine),this._core.terrainManager.setRenderEngine(e.renderEngine),this._core.renderLoop.setRenderEngine(e.renderEngine),this._core.renderLoop.setCameraStateProvider(()=>this._mode.getCameraState()),o==="3d"&&e.renderEngine.setClearColor(0,0,0,1)),this._core.renderLoop.onFrame((s,a)=>{if(!this._core.gpuReady||!this._core.renderEngine)return;const l={renderEngine:this._core.renderEngine,layerManager:this._core.layerManager,tileManager:this._core.tileManager,terrainManager:this._core.terrainManager,tileScheduler:this._core.tileScheduler,bufferCache:this._core.bufferCache};this._mode.renderFrame(l);const c=this._core.renderLoop.getStats();this._events.emit("frame",{frameNumber:a,fps:c.fps})}),this._core.container&&this._core.canvas&&this._core.setupResizeObserver(this._core.container,this._core.canvas,(s,a)=>{this._mode.setViewport(s,a),this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._core.renderLoop.markDirty(),this._emitViewChange()}),this._core.container&&this._interactionOptions!==!1&&this._mode.attachInteraction(this._core.container,()=>this._core.renderLoop.markDirty(),()=>{this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._emitViewChange()},this._interactionOptions),this._core.container){let s=0,a=0,l=0;const c=5,h=500,u=this._core.container,d=f=>{const g=u.getBoundingClientRect();s=f.clientX-g.left,a=f.clientY-g.top,l=Date.now()},p=f=>{const g=u.getBoundingClientRect(),x=f.clientX-g.left,v=f.clientY-g.top,y=x-s,m=v-a,_=Date.now()-l;if(Math.sqrt(y*y+m*m)<c&&_<h){const b=this._mode.toMap(x,v);this._events.emit("click",{screenX:x,screenY:v,mapPoint:b})}};u.addEventListener("pointerdown",d),u.addEventListener("pointerup",p),this._clickHandler=()=>{u.removeEventListener("pointerdown",d),u.removeEventListener("pointerup",p)}}if(this._core.container){let s=!1;const a=this._core.container,l=c=>{s||(s=!0,requestAnimationFrame(()=>{s=!1;const h=a.getBoundingClientRect(),u=c.clientX-h.left,d=c.clientY-h.top,p=this._mode.toMap(u,d);this._events.emit("pointer-move",{screenX:u,screenY:d,mapPoint:p})}))};a.addEventListener("pointermove",l),this._pointerMoveHandler=()=>{a.removeEventListener("pointermove",l)}}this._readyPromise=new Promise(s=>{this._readyResolve=s}),e.renderEngine&&this._core.canvas?this._core.initGpu(e.renderEngine,this._core.canvas,Pt(o)).then(()=>{this._destroyed||(this._ready=!0,this._readyResolve?.(),this._events.emit("ready",void 0),this._core.renderLoop.start())},s=>{this._destroyed||(console.error("[mapgpu] GPU init failed:",s),this._ready=!0,this._readyResolve?.(),this._events.emit("error",{kind:"webgpu-not-supported",userAgent:typeof navigator<"u"?navigator.userAgent:"unknown"}),this._events.emit("ready",void 0))}):queueMicrotask(()=>{this._destroyed||(this._ready=!0,this._readyResolve?.(),this._events.emit("ready",void 0))})}get mode(){return this._mode.type}get center(){return this._mode.getState().center}get zoom(){return this._mode.getState().zoom}get pitch(){return this._mode.getState().pitch}get bearing(){return this._mode.getState().bearing}get rotation(){return this._mode.getState().rotation}get ready(){return this._ready}get gpuReady(){return this._core.gpuReady}get canvas(){return this._core.canvas}getViewState(){return this._mode.getState()}get toolManager(){return this._toolManager||(this._toolManager=new fr,this._core.canvas&&this._core.container&&this._toolManager.init({canvas:this._core.canvas,container:this._core.container,toMap:(e,t)=>this.toMap(e,t),toScreen:(e,t)=>this.toScreen(e,t),getMode:()=>this.mode,getZoom:()=>this.zoom,markDirty:()=>this._core.renderLoop.markDirty()})),this._toolManager}async switchTo(e){if(this._destroyed)throw new Error("View is destroyed");if(this._mode.type===e)return;const t=this._mode.getState(),i=this._mode.type;this._mode.dispose();const r=this._core.container?.clientWidth||800,o=this._core.container?.clientHeight||600;if(e==="3d"?(this._mode=new bt({center:t.center,zoom:t.zoom,pitch:t.pitch||0,bearing:t.bearing||0,viewportWidth:r,viewportHeight:o}),this._core.renderEngine?.setClearColor(0,0,0,1)):this._mode=new mt({center:t.center,zoom:t.zoom,rotation:t.rotation||0,viewportWidth:r,viewportHeight:o}),this._core.gpuReady&&this._core.renderEngine){const s=this._core.renderLoop.running;s&&this._core.renderLoop.stop(),await this._core.renderEngine.recover(Pt(e)),this._core.tileManager.invalidateAll(),this._core.terrainManager.invalidateAll(),s&&this._core.renderLoop.start()}this._core.renderLoop.setCameraStateProvider(()=>this._mode.getCameraState()),this._core.container&&this._interactionOptions!==!1&&this._mode.attachInteraction(this._core.container,()=>this._core.renderLoop.markDirty(),()=>{this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._emitViewChange()},this._interactionOptions),this._core.bufferCache.invalidateAll(),this._events.emit("mode-change",{from:i,to:e}),this._core.renderLoop.markDirty(),this._emitViewChange()}goTo(e){return this._destroyed?Promise.reject(new Error("View is destroyed")):this._mode.goTo(e,()=>this._core.renderLoop.markDirty(),()=>{this._core.layerManager.setCurrentZoom(this._mode.getState().zoom),this._emitViewChange()})}toMap(e,t){return this._mode.toMap(e,t)}toScreen(e,t){return this._mode.toScreen(e,t)}on(e,t){this._events.on(e,t)}off(e,t){this._events.off(e,t)}when(){return this._readyPromise}destroy(){this._destroyed||(this._destroyed=!0,this._mode.cancelAnimation(),this._mode.dispose(),this._toolManager?.destroy(),this._toolManager=null,this._clickHandler?.(),this._clickHandler=null,this._pointerMoveHandler?.(),this._pointerMoveHandler=null,this._core.destroy(),this._events.emit("destroy",void 0),this._events.removeAll(),this._readyResolve?.())}async loadIcon(e,t){let i;if(typeof t=="string"){const o=await(await fetch(t)).blob();i=await createImageBitmap(o)}else i=t;this._core.renderEngine&&this._core.renderEngine.loadIcon(e,i)}async loadModel(e,t){if(!this._core.renderEngine)return;if(t instanceof ArrayBuffer){await this._core.renderEngine.loadModel(e,t);return}const i=t;if(i.endsWith(".gltf")||i.includes(".gltf?")){const r=i.substring(0,i.lastIndexOf("/")+1),s=await(await fetch(i)).json(),a=s.buffers??[],l=await Promise.all(a.map(async c=>{if(!c.uri)return new ArrayBuffer(c.byteLength);const h=c.uri.startsWith("data:")?c.uri:r+c.uri;return(await fetch(h)).arrayBuffer()}));await this._core.renderEngine.loadModel(e,{json:s,buffers:l})}else{const o=await(await fetch(i)).arrayBuffer();await this._core.renderEngine.loadModel(e,o)}}getBounds(){const e=this._core.container?.clientWidth??0,t=this._core.container?.clientHeight??0;if(e===0||t===0)return null;const i=[this._mode.toMap(0,0),this._mode.toMap(e,0),this._mode.toMap(e,t),this._mode.toMap(0,t)].filter(l=>l!==null);if(i.length===0)return null;let r=1/0,o=1/0,s=-1/0,a=-1/0;for(const[l,c]of i)l<r&&(r=l),l>s&&(s=l),c<o&&(o=c),c>a&&(a=c);return{minX:r,minY:o,maxX:s,maxY:a,spatialReference:"EPSG:4326"}}async hitTest(e,t){if(!this._core.renderEngine)return[];const i=this._mode.toMap(e,t),r=await this._core.renderEngine.pick(e,t);if(r){const u=this._core.layerManager.getLayer(r.layerId);if(u&&u.interactive!==!1){let d;return se(u)&&(d=u.getFeatures().find(f=>f.id===r.featureId)),d||(d={id:r.featureId,geometry:{type:"Point",coordinates:[]},attributes:{}}),[{layer:u,feature:d,mapPoint:i}]}}if(!i)return[];const o=this._mode.getState().zoom,l=16*(360/(256*Math.pow(2,o))),c=[],h=this._core.layerManager.getLayerIds();for(const u of h){const d=this._core.layerManager.getLayer(u);if(!d||!d.visible||!d.loaded||d.interactive===!1||!se(d))continue;const p=d.getFeatures();let f=l,g;for(const x of p){const v=x.geometry;if(v){if(v.type==="Point"){const y=v.coordinates,m=y[0]-i[0],_=y[1]-i[1],b=Math.sqrt(m*m+_*_);b<f&&(f=b,g=x)}else if(v.type==="LineString"){const y=v.coordinates;for(let m=0;m<y.length-1;m++){const _=mr(i[0],i[1],y[m][0],y[m][1],y[m+1][0],y[m+1][1]);_<f&&(f=_,g=x)}}}}g&&c.push({layer:d,feature:g,mapPoint:i})}return c}async loadSvgIcon(e,t,i,r){let o;try{const s=new Blob([t],{type:"image/svg+xml"}),a=URL.createObjectURL(s);try{const l=await new Promise((u,d)=>{const p=new Image(i,r);p.onload=()=>u(p),p.onerror=f=>d(new Error(`SVG image load failed for "${e}": ${f}`)),p.src=a}),c=new OffscreenCanvas(i,r);c.getContext("2d").drawImage(l,0,0,i,r),o=await createImageBitmap(c)}finally{URL.revokeObjectURL(a)}}catch(s){throw console.error(`[mapgpu] loadSvgIcon("${e}") failed to decode SVG:`,s),s}await this.loadIcon(e,o)}set debugTileVertices(e){this._core.renderEngine?.setDebugTileVertices(e),this._core.renderLoop.markDirty()}get debugTileVertices(){return!1}set extrusionDebug(e){this._core.renderEngine?.setExtrusionDebug(e),typeof globalThis<"u"&&(globalThis.__MAPGPU_EXTRUSION_DEBUG=e),this._core.renderLoop.markDirty()}get extrusionDebug(){return typeof globalThis<"u"&&!!globalThis.__MAPGPU_EXTRUSION_DEBUG}applyDebugBrush(e,t,i,r,o){this._core.renderEngine?.applyDebugBrush(e,t,i,r,o),this._core.renderLoop.markDirty()}clearDebugBrush(){this._core.renderEngine?.clearDebugBrush(),this._core.renderLoop.markDirty()}setHeightExaggeration(e){this._core.renderEngine?.setHeightExaggeration(e),this._core.renderLoop.markDirty()}setLighting(e){this._core.renderEngine?.setLighting(e),this._core.renderLoop.markDirty()}_emitViewChange(){const e=this._mode.getState();this._events.emit("view-change",{center:e.center,zoom:e.zoom,pitch:e.pitch,bearing:e.bearing,rotation:e.rotation,mode:this._mode.type})}}function mr(n,e,t,i,r,o){const s=r-t,a=o-i,l=s*s+a*a;if(l===0)return Math.sqrt((n-t)**2+(e-i)**2);const c=Math.max(0,Math.min(1,((n-t)*s+(e-i)*a)/l)),h=t+c*s,u=i+c*a;return Math.sqrt((n-h)**2+(e-u)**2)}async function gr(){const n={mode:"cpu-degraded",features:{timestampQuery:!1,float32Filterable:!1,indirectFirstInstance:!1,shaderF16:!1},limits:{maxTextureDimension2D:0,maxBufferSize:0,maxStorageBufferBindingSize:0},adapter:null,device:null};if(typeof navigator>"u"||!navigator.gpu)return n;const e=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!e)return n;const t={timestampQuery:e.features.has("timestamp-query"),float32Filterable:e.features.has("float32-filterable"),indirectFirstInstance:e.features.has("indirect-first-instance"),shaderF16:e.features.has("shader-f16")},i={maxTextureDimension2D:e.limits.maxTextureDimension2D,maxBufferSize:e.limits.maxBufferSize,maxStorageBufferBindingSize:e.limits.maxStorageBufferBindingSize},r=[];t.timestampQuery&&r.push("timestamp-query"),t.float32Filterable&&r.push("float32-filterable");const o=await e.requestDevice({requiredFeatures:r});return o.lost.then(a=>{console.error(`[mapgpu] GPU device lost: ${a.reason} — ${a.message}`)}),{mode:xr(i),features:t,limits:i,adapter:e,device:o}}function xr(n){return n.maxTextureDimension2D<4096||n.maxBufferSize<256*1024*1024?"gpu-lite":"full-gpu"}class vr{device;tracked=new Map;persistentBytes=0;transientBytes=0;constructor(e){this.device=e}allocate(e,t,i="persistent"){const r=this.device.createBuffer({size:e,usage:t,mappedAtCreation:!1}),o={buffer:r,size:e,category:i};return this.tracked.set(r,o),i==="persistent"?this.persistentBytes+=e:this.transientBytes+=e,r}allocateWithData(e,t,i="persistent"){const r=this.device.createBuffer({size:e.byteLength,usage:t,mappedAtCreation:!0}),o=r.getMappedRange();new Uint8Array(o).set(new Uint8Array(e.buffer,e.byteOffset,e.byteLength)),r.unmap();const s={buffer:r,size:e.byteLength,category:i};return this.tracked.set(r,s),i==="persistent"?this.persistentBytes+=e.byteLength:this.transientBytes+=e.byteLength,r}release(e){const t=this.tracked.get(e);t&&(t.category==="persistent"?this.persistentBytes-=t.size:this.transientBytes-=t.size,this.tracked.delete(e),e.destroy())}releaseTransient(){for(const[e,t]of this.tracked)t.category==="transient"&&(this.transientBytes-=t.size,this.tracked.delete(e),e.destroy())}getMemoryAccounting(){return{persistentBufferBytes:this.persistentBytes,transientBufferBytes:this.transientBytes,textureBytes:0,totalTrackedBytes:this.persistentBytes+this.transientBytes}}destroy(){for(const[e]of this.tracked)e.destroy();this.tracked.clear(),this.persistentBytes=0,this.transientBytes=0}get trackedCount(){return this.tracked.size}}class _r{device;tracked=new Map;totalTextureBytes=0;constructor(e){this.device=e}createFromImageBitmap(e){const t=this.device.createTexture({size:{width:e.width,height:e.height},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});this.device.queue.copyExternalImageToTexture({source:e},{texture:t},{width:e.width,height:e.height});const i=e.width*e.height*4,r={texture:t,byteSize:i,lastAccessTime:performance.now()};return this.tracked.set(t,r),this.totalTextureBytes+=i,t}touch(e){const t=this.tracked.get(e);t&&(t.lastAccessTime=performance.now())}release(e){const t=this.tracked.get(e);t&&(this.totalTextureBytes-=t.byteSize,this.tracked.delete(e),e.destroy())}evict(e){if(this.totalTextureBytes<=e)return;const t=[...this.tracked.entries()].sort((i,r)=>i[1].lastAccessTime-r[1].lastAccessTime);for(const[i,r]of t){if(this.totalTextureBytes<=e)break;this.totalTextureBytes-=r.byteSize,this.tracked.delete(i),i.destroy()}}createFromFloat32(e,t,i){const r=this.device.createTexture({label:`r32float-${t}x${i}`,size:{width:t,height:i},format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});this.device.queue.writeTexture({texture:r},e.buffer,{bytesPerRow:t*4,rowsPerImage:i},{width:t,height:i});const o=t*i*4,s={texture:r,byteSize:o,lastAccessTime:performance.now()};return this.tracked.set(r,s),this.totalTextureBytes+=o,r}createFromUint8(e,t,i){const r=this.device.createTexture({label:`r8unorm-${t}x${i}`,size:{width:t,height:i},format:"r8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),o=Math.ceil(t/256)*256;if(o===t)this.device.queue.writeTexture({texture:r},e.buffer,{bytesPerRow:t,rowsPerImage:i},{width:t,height:i});else{const l=new Uint8Array(o*i);for(let c=0;c<i;c++)l.set(e.subarray(c*t,c*t+t),c*o);this.device.queue.writeTexture({texture:r},l.buffer,{bytesPerRow:o,rowsPerImage:i},{width:t,height:i})}const s=t*i,a={texture:r,byteSize:s,lastAccessTime:performance.now()};return this.tracked.set(r,a),this.totalTextureBytes+=s,r}createFromRGBA8(e,t,i){const r=this.device.createTexture({label:`rgba8unorm-${t}x${i}`,size:{width:t,height:i},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});this.device.queue.writeTexture({texture:r},e.buffer,{bytesPerRow:t*4,rowsPerImage:i},{width:t,height:i});const o=t*i*4,s={texture:r,byteSize:o,lastAccessTime:performance.now()};return this.tracked.set(r,s),this.totalTextureBytes+=o,r}get textureBytes(){return this.totalTextureBytes}get trackedCount(){return this.tracked.size}destroy(){for(const[e]of this.tracked)e.destroy();this.tracked.clear(),this.totalTextureBytes=0}}function Ct(n){return`${n.pipelineId}:${n.resourceIds.join(",")}`}class yr{cache=new Map;totalEstimatedBytes=0;resourceToKeys=new Map;getOrCreate(e,t){const i=Ct(e),r=this.cache.get(i);if(r)return r.bindGroup;const o=t(),s=64+e.resourceIds.length*8,a=new Set(e.resourceIds),l={bindGroup:o,key:i,estimatedBytes:s,resourceRefs:a};this.cache.set(i,l),this.totalEstimatedBytes+=s;for(const c of e.resourceIds){let h=this.resourceToKeys.get(c);h||(h=new Set,this.resourceToKeys.set(c,h)),h.add(i)}return o}invalidate(e){const t=this.resourceToKeys.get(e);if(t){for(const i of t){const r=this.cache.get(i);if(r){this.totalEstimatedBytes-=r.estimatedBytes;for(const o of r.resourceRefs)if(o!==e){const s=this.resourceToKeys.get(o);s&&(s.delete(i),s.size===0&&this.resourceToKeys.delete(o))}this.cache.delete(i)}}this.resourceToKeys.delete(e)}}has(e){return this.cache.has(Ct(e))}clear(){this.cache.clear(),this.resourceToKeys.clear(),this.totalEstimatedBytes=0}get size(){return this.cache.size}get estimatedBytes(){return this.totalEstimatedBytes}}class br{resolution;worldExtent;cpuHeightmap;gpuTexture;gpuSampler;bindGroup;dirty=!1;hasStrokes=!1;addTexel(e,t,i){if(e<0||t<0||e>=this.resolution||t>=this.resolution)return;const r=t*this.resolution+e;this.cpuHeightmap[r]=(this.cpuHeightmap[r]??0)+i}splatSubTexel(e,t,i){const r=e-.5,o=t-.5,s=Math.floor(r),a=Math.floor(o),l=r-s,c=o-a;this.addTexel(s,a,i*(1-l)*(1-c)),this.addTexel(s+1,a,i*l*(1-c)),this.addTexel(s,a+1,i*(1-l)*c),this.addTexel(s+1,a+1,i*l*c)}constructor(e,t,i){this.resolution=i?.resolution??512,this.worldExtent=i?.worldExtent??[0,0,1,1],this.cpuHeightmap=new Float32Array(this.resolution*this.resolution),this.gpuTexture=e.createTexture({label:"height-brush-texture",size:{width:this.resolution,height:this.resolution},format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.gpuSampler=e.createSampler({label:"height-brush-sampler",magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.bindGroup=e.createBindGroup({label:"height-brush-bind-group",layout:t,entries:[{binding:0,resource:this.gpuTexture.createView()},{binding:1,resource:this.gpuSampler}]})}apply(e,t,i,r,o=.8){const s=this.resolution,[a,l,c,h]=this.worldExtent,u=c-a,d=h-l,f=2-1.5*Math.max(0,Math.min(1,o)),g=(e-a)/u*s,x=(t-l)/d*s,v=i/u*s,y=i/d*s,m=Math.max(v,y);if(m<1){this.splatSubTexel(g,x,r),this.dirty=!0,this.hasStrokes=!0;return}const _=Math.max(0,Math.floor(x-m)),b=Math.min(s-1,Math.ceil(x+m)),C=Math.max(0,Math.floor(g-m)),M=Math.min(s-1,Math.ceil(g+m));for(let P=_;P<=b;P++)for(let T=C;T<=M;T++){const w=T+.5-g,S=P+.5-x,B=w*w+S*S,G=m*m;if(B<G){const L=1-Math.sqrt(B)/m,$=Math.pow(Math.max(0,L),f),te=P*s+T;this.cpuHeightmap[te]=(this.cpuHeightmap[te]??0)+r*$}}this.dirty=!0,this.hasStrokes=!0}flush(e){this.dirty&&(e.queue.writeTexture({texture:this.gpuTexture},this.cpuHeightmap.buffer,{bytesPerRow:this.resolution*4},{width:this.resolution,height:this.resolution}),this.dirty=!1)}getBindGroup(e){return this.hasStrokes?(this.flush(e),this.bindGroup):null}clear(){this.cpuHeightmap.fill(0),this.dirty=!0,this.hasStrokes=!1}destroy(){this.gpuTexture.destroy()}}function Pr(n){return n.createBindGroupLayout({label:"height-texture-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.VERTEX,sampler:{type:"non-filtering"}}]})}function qt(n,e){const t=n.createTexture({label:"zero-height-texture",size:{width:1,height:1},format:"r32float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});n.queue.writeTexture({texture:t},new Float32Array([0]).buffer,{bytesPerRow:4},{width:1,height:1});const i=n.createSampler({label:"zero-height-sampler",magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),r=n.createBindGroup({label:"zero-height-bind-group",layout:e,entries:[{binding:0,resource:t.createView()},{binding:1,resource:i}]});return{texture:t,bindGroup:r}}const Cr=`

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
  _pad0: f32,
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

  // Shader-level depth offset: tiles render in front of pole caps
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
`;function Jt(n){return n.createBindGroupLayout({label:"globe-camera-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function wr(n){return n.createBindGroupLayout({label:"globe-tile-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Mr(n){return n.createBindGroupLayout({label:"globe-raster-height-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:"non-filtering"}}]})}function Sr(n){const{device:e,colorFormat:t}=n,i=n.subdivisions??32,r=Jt(e),o=wr(e),s=Mr(e),a=e.createShaderModule({label:"globe-raster-shader",code:Cr}),l=e.createPipelineLayout({label:"globe-raster-pipeline-layout",bindGroupLayouts:[r,o,s]}),c=Tr(e,i),h=e.createRenderPipeline({label:"globe-raster-pipeline",layout:l,vertex:{module:a,entryPoint:"vs_main",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32"}]}]},fragment:{module:a,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"},multisample:{count:n.sampleCount??F}}),u=e.createSampler({label:"globe-tile-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),d=e.createSampler({label:"globe-height-sampler",magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),{texture:p,bindGroup:f}=qt(e,s);return{pipeline:h,globeCameraBindGroupLayout:r,globeTileBindGroupLayout:o,heightBindGroupLayout:s,sampler:u,heightSampler:d,subdivisionMesh:c,zeroHeightTexture:p,zeroHeightBindGroup:f}}function Tr(n,e=32){const t=e+1,i=t*t,r=[],o=new Uint32Array(i);for(let m=0;m<t;m++)for(let _=0;_<t;_++){const b=r.length/3;o[m*t+_]=b,r.push(_/e,m/e,0)}const s=[];for(let m=0;m<e;m++)for(let _=0;_<e;_++){const b=o[m*t+_],C=o[m*t+_+1],M=o[(m+1)*t+_],P=o[(m+1)*t+_+1];s.push(b,M,C),s.push(C,M,P)}const a=(m,_)=>{const b=r.length/3;return r.push(m,_,1),b},l=new Uint32Array(t),c=new Uint32Array(t),h=new Uint32Array(t),u=new Uint32Array(t);for(let m=0;m<t;m++){const _=m/e;l[m]=a(_,0),c[m]=a(1,_),h[m]=a(_,1),u[m]=a(0,_)}const d=(m,_,b,C)=>{s.push(m,b,_),s.push(_,b,C)};for(let m=0;m<e;m++)d(o[m],o[m+1],l[m],l[m+1]);for(let m=0;m<e;m++)d(o[m*t+e],o[(m+1)*t+e],c[m],c[m+1]);for(let m=0;m<e;m++)d(o[e*t+m],o[e*t+m+1],h[m],h[m+1]);for(let m=0;m<e;m++)d(o[m*t],o[(m+1)*t],u[m],u[m+1]);const p=new Float32Array(r),f=p.length/3,x=f>65535?new Uint32Array(s):new Uint16Array(s),v=n.createBuffer({label:"globe-subdivision-vertex-buffer",size:p.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(v,0,p);const y=n.createBuffer({label:"globe-subdivision-index-buffer",size:x.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});return n.queue.writeBuffer(y,0,x),{vertexBuffer:v,indexBuffer:y,indexCount:x.length,vertexCount:f,subdivisions:e}}function Qt(n,e){const t=new Float32Array(16);for(let i=0;i<4;i++)for(let r=0;r<4;r++){let o=0;for(let s=0;s<4;s++)o+=n[s*4+r]*e[i*4+s];t[i*4+r]=o}return t}const F=4,Br=80,Gr=160;class Er{device=null;context=null;colorFormat="bgra8unorm";canvas=null;bufferPool=null;bindGroupCache=null;depthConfig=Ie;depthTexture=null;cameraBuffer=null;cameraBindGroup=null;cameraBindGroupLayout=null;globeCameraBuffer=null;globeCameraBindGroup=null;globeCameraBindGroupLayout=null;commandEncoder=null;renderPass=null;currentCamera=null;frameTime=0;pickingEnabled=!0;pickingDrawCalls=[];currentLayerId="";placeholderTexture=null;sampleCount=F;msaaColorTexture=null;lightConfig=null;debugTileVertices=!1;extrusionDebugMode=!1;heightBrush=null;heightExaggeration=1;needsContinuousRender=!1;deviceLost=!1;ensureGlobeCameraResources(){this.globeCameraBuffer||!this.device||!this.bufferPool||(this.globeCameraBindGroupLayout=Jt(this.device),this.globeCameraBuffer=this.bufferPool.allocate(Gr,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,"persistent"),this.globeCameraBindGroup=this.device.createBindGroup({label:"globe-camera-bind-group",layout:this.globeCameraBindGroupLayout,entries:[{binding:0,resource:{buffer:this.globeCameraBuffer}}]}))}ensureGlobeCameraWritten(){if(this.currentCamera&&this.globeCameraBuffer&&this.device){const e=this.currentCamera,t=Qt(e.projectionMatrix,e.viewMatrix),i=new Float32Array(40);i.set(t,0),e.flatViewProjectionMatrix&&i.set(e.flatViewProjectionMatrix,16),i[32]=e.viewportWidth,i[33]=e.viewportHeight,i[34]=e.projectionTransition??1,i[35]=e.globeRadius??1,e.clippingPlane&&(i[36]=e.clippingPlane[0],i[37]=e.clippingPlane[1],i[38]=e.clippingPlane[2],i[39]=e.clippingPlane[3]),this.device.queue.writeBuffer(this.globeCameraBuffer,0,i.buffer)}}}const Fr=`

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

  // Map UV to tile extent world position
  let worldX = mix(tile.extent.x, tile.extent.z, uv.x);
  let worldY = mix(tile.extent.y, tile.extent.w, uv.y);
  let worldPos = vec4<f32>(worldX, worldY, 0.0, 1.0);

  var out: VertexOutput;
  out.position = camera.viewProjection * worldPos;
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
`;function Lr(n){return n.createBindGroupLayout({label:"camera-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]})}function Dr(n){return n.createBindGroupLayout({label:"raster-tile-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Rr(n){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=n,r=Dr(e),o=e.createShaderModule({label:"raster-shader",code:Fr}),s=e.createPipelineLayout({label:"raster-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"raster-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main"},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-strip",stripIndexFormat:void 0},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:"always"},multisample:{count:n.sampleCount??F}}),l=e.createSampler({label:"raster-tile-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,rasterBindGroupLayout:r,sampler:l}}const O=`
struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;`,Ce=`
struct GlobeCameraUniforms {
  viewProjection: mat4x4<f32>,
  flatViewProjection: mat4x4<f32>,
  viewport: vec2<f32>,
  projectionTransition: f32,
  globeRadius: f32,
  clippingPlane: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: GlobeCameraUniforms;`,ei=`
const PI: f32 = 3.14159265358979323846;
const TWO_PI: f32 = 6.28318530717958647692;
const HALF_CIRCUMFERENCE: f32 = 20037508.34;`,ti=`
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
}`,ee=Ce+`
`+ei+`
`+ti,Ur=`

// ─── Bindings ───
${O}

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
`;function Ar(n){return n.createBindGroupLayout({label:"point-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Ir(n){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=n,r=Ar(e),o=e.createShaderModule({label:"point-shader",code:Ur}),s=e.createPipelineLayout({label:"point-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"point-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"instance",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"},multisample:{count:n.sampleCount??F}}),materialBindGroupLayout:r}}const zr=`

// ─── Bindings ───
${O}

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
`;function Or(n){return n.createBindGroupLayout({label:"line-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Vr(n){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=n,r=Or(e),o=e.createShaderModule({label:"line-shader",code:zr}),s=e.createPipelineLayout({label:"line-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"line-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:44,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x3"},{shaderLocation:3,offset:36,format:"float32"},{shaderLocation:4,offset:40,format:"float32"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"},multisample:{count:n.sampleCount??F}}),materialBindGroupLayout:r}}function Pe(n){switch(n){case"solid":return 0;case"dash":return 1;case"dot":return 2;case"dash-dot":return 3}}const kr=`

// ─── Bindings ───
${O}

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
  out.clipPosition = camera.viewProjection * vec4<f32>(input.position, 1.0);
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return material.color;
}
`;function Nr(n){return n.createBindGroupLayout({label:"polygon-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Hr(n){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=n,r=Nr(e),o=e.createShaderModule({label:"polygon-shader",code:kr}),s=e.createPipelineLayout({label:"polygon-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"polygon-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:n.depthCompare??"always"},multisample:{count:n.sampleCount??F}}),materialBindGroupLayout:r}}const Wr=`

// ─── Bindings ───
${O}

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
  out.clipPosition = camera.viewProjection * vec4<f32>(input.position, 1.0);
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return picking.featureColor;
}
`;function Zr(n){return n.createBindGroupLayout({label:"picking-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Xr(n){const{device:e,cameraBindGroupLayout:t,width:i,height:r}=n,o=Zr(e),s=e.createShaderModule({label:"picking-shader",code:Wr}),a=e.createPipelineLayout({label:"picking-pipeline-layout",bindGroupLayouts:[t,o]}),l=e.createRenderPipeline({label:"picking-pipeline",layout:a,vertex:{module:s,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:s,entryPoint:"fs_main",targets:[{format:"rgba8unorm"}]},primitive:{topology:"triangle-list"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"}}),c=e.createTexture({label:"picking-texture",size:{width:i,height:r},format:"rgba8unorm",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),h=e.createTexture({label:"picking-depth-texture",size:{width:i,height:r},format:n.depthFormat??"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT}),u=e.createBuffer({label:"picking-readback-buffer",size:256,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});return{pipeline:l,pickingBindGroupLayout:o,pickingTexture:c,depthTexture:h,readbackBuffer:u,width:i,height:r}}function $r(n,e,t,i){return n===0&&e===0&&t===0&&i===0?null:{featureId:n|e<<8|t<<16,layerIndex:i}}const jr=`

// ─── Bindings ───
${O}

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
`;function Yr(n){return n.createBindGroupLayout({label:"text-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Kr(n){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=n,r=Yr(e),o=e.createShaderModule({label:"text-shader",code:jr}),s=e.createPipelineLayout({label:"text-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"text-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:44,stepMode:"instance",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x4"},{shaderLocation:2,offset:28,format:"float32x4"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:n.depthCompare==="greater"?"greater-equal":"less-equal"},multisample:{count:n.sampleCount??F}}),l=e.createSampler({label:"text-atlas-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,materialBindGroupLayout:r,sampler:l}}const qr=`

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
`;function Jr(n){return n.createBindGroupLayout({label:"post-process-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Qr(n){const{device:e,colorFormat:t}=n,i=Jr(e),r=e.createShaderModule({label:"post-process-shader",code:qr}),o=e.createPipelineLayout({label:"post-process-pipeline-layout",bindGroupLayouts:[i]}),s=e.createRenderPipeline({label:"post-process-pipeline",layout:o,vertex:{module:r,entryPoint:"vs_main"},fragment:{module:r,entryPoint:"fs_main",targets:[{format:t}]},primitive:{topology:"triangle-strip",stripIndexFormat:void 0},multisample:{count:n.sampleCount??F}}),a=e.createSampler({label:"post-process-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:s,bindGroupLayout:i,sampler:a}}const wt=512,Mt=4096,I=1,W=4;class eo{sprites=new Map;shelves=[];_width;_height;data;dirty=!1;device=null;texture=null;constructor(e){this._width=wt,this._height=wt,this.data=new Uint8Array(this._width*this._height*W),this.device=e??null}get width(){return this._width}get height(){return this._height}get spriteCount(){return this.sprites.size}get isDirty(){return this.dirty}addSprite(e,t,i,r){const o=this.sprites.get(e);if(o)return o;const s=i+I*2,a=r+I*2;let l=!1,c=0,h=0;for(const x of this.shelves)if(x.height>=a&&x.nextX+s<=this._width){c=x.nextX,h=x.y,x.nextX+=s,l=!0;break}if(!l){if((this.shelves.length>0?this.shelves[this.shelves.length-1].y+this.shelves[this.shelves.length-1].height:0)+a>this._height&&!this.grow())return null;const v=this.shelves.length>0?this.shelves[this.shelves.length-1].y+this.shelves[this.shelves.length-1].height:0;if(v+a>this._height)return null;const y={y:v,height:a,nextX:s};this.shelves.push(y),c=0,h=v}for(let x=0;x<r;x++)for(let v=0;v<i;v++){const y=(x*i+v)*W,m=((h+I+x)*this._width+(c+I+v))*W;this.data[m]=t[y],this.data[m+1]=t[y+1],this.data[m+2]=t[y+2],this.data[m+3]=t[y+3]}const u=(c+I)/this._width,d=(h+I)/this._height,p=(c+I+i)/this._width,f=(h+I+r)/this._height,g={uv:[u,d,p,f],width:i,height:r,x:c+I,y:h+I};return this.sprites.set(e,g),this.dirty=!0,g}getSprite(e){return this.sprites.get(e)}getTexture(){return this.device?((!this.texture||this.dirty)&&this.uploadToGPU(),this.texture):null}getData(){return this.data}grow(){const e=Math.min(this._width*2,Mt),t=Math.min(this._height*2,Mt);if(e===this._width&&t===this._height)return!1;const i=new Uint8Array(e*t*W);for(let r=0;r<this._height;r++)for(let o=0;o<this._width;o++){const s=(r*this._width+o)*W,a=(r*e+o)*W;i[a]=this.data[s],i[a+1]=this.data[s+1],i[a+2]=this.data[s+2],i[a+3]=this.data[s+3]}this._width=e,this._height=t,this.data=i;for(const[,r]of this.sprites)r.uv[0]=r.x/this._width,r.uv[1]=r.y/this._height,r.uv[2]=(r.x+r.width)/this._width,r.uv[3]=(r.y+r.height)/this._height;return this.texture&&(this.texture.destroy(),this.texture=null),this.dirty=!0,!0}uploadToGPU(){this.device&&(this.texture&&(this.texture.width!==this._width||this.texture.height!==this._height)&&(this.texture.destroy(),this.texture=null),this.texture||(this.texture=this.device.createTexture({label:"sprite-atlas-texture",size:{width:this._width,height:this._height},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST})),this.device.queue.writeTexture({texture:this.texture},this.data.buffer,{bytesPerRow:this._width*W},{width:this._width,height:this._height}),this.dirty=!1)}destroy(){this.texture?.destroy(),this.texture=null,this.sprites.clear(),this.shelves=[],this.dirty=!1}}const to=`

// ─── Constants ───
${ee}
const EARTH_RADIUS_M: f32 = 6371000.0;
const ALTITUDE_EXAG: f32 = 5.0;

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

// ─── Helpers ───

fn altitudeOffset(altMeters: f32) -> f32 {
  return altMeters / EARTH_RADIUS_M * ALTITUDE_EXAG;
}

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
`;function io(n){return n.createBindGroupLayout({label:"globe-point-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function ro(n){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=n,r=io(e),o=e.createShaderModule({label:"globe-point-shader",code:to}),s=e.createPipelineLayout({label:"globe-point-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"globe-point-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"instance",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"},multisample:{count:n.sampleCount??F}}),materialBindGroupLayout:r}}const oo=`

// ─── Constants ───
${ee}
const EARTH_RADIUS_M: f32 = 6371000.0;
const ALTITUDE_EXAG: f32 = 5.0;

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

// ─── Helpers ───

fn altitudeOffset(altMeters: f32) -> f32 {
  return altMeters / EARTH_RADIUS_M * ALTITUDE_EXAG;
}

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
`;function no(n){return n.createBindGroupLayout({label:"globe-line-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function so(n){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=n,r=no(e),o=e.createShaderModule({label:"globe-line-shader",code:oo}),s=e.createPipelineLayout({label:"globe-line-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"globe-line-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:44,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x3"},{shaderLocation:3,offset:36,format:"float32"},{shaderLocation:4,offset:40,format:"float32"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"},multisample:{count:n.sampleCount??F}}),materialBindGroupLayout:r}}const ao=`

// ─── Constants ───
${ee}
const EARTH_RADIUS_M: f32 = 6371000.0;
const ALTITUDE_EXAG: f32 = 5.0;

// ─── Bindings ───

struct PolygonMaterial {
  color: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: PolygonMaterial;

// ─── Helpers ───

fn altitudeOffset(altMeters: f32) -> f32 {
  return altMeters / EARTH_RADIUS_M * ALTITUDE_EXAG;
}

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
`;function lo(n){return n.createBindGroupLayout({label:"globe-polygon-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function co(n){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=n,r=lo(e),o=e.createShaderModule({label:"globe-polygon-shader",code:ao}),s=e.createPipelineLayout({label:"globe-polygon-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"globe-polygon-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:n.depthCompare??"always"},multisample:{count:n.sampleCount??F}}),materialBindGroupLayout:r}}function uo(n,e=32){const t=e+1,i=t*t,r=new Float32Array(i*2);for(let d=0;d<t;d++)for(let p=0;p<t;p++){const f=(d*t+p)*2;r[f]=p/e,r[f+1]=d/e}const s=e*e*6,l=i>65535?new Uint32Array(s):new Uint16Array(s);let c=0;for(let d=0;d<e;d++)for(let p=0;p<e;p++){const f=d*t+p,g=f+1,x=(d+1)*t+p,v=x+1;l[c++]=f,l[c++]=x,l[c++]=g,l[c++]=g,l[c++]=x,l[c++]=v}const h=n.createBuffer({label:"subdivision-vertex-buffer",size:r.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(h,0,r);const u=n.createBuffer({label:"subdivision-index-buffer",size:l.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});return n.queue.writeBuffer(u,0,l),{vertexBuffer:h,indexBuffer:u,indexCount:s,vertexCount:i,subdivisions:e}}const me=[0,1,1,.35],ge=[1,1,.3,.92],xe=[1,.4,0,.85],ho=3,fo=2;function po(n){const e=n+1,t=e*e,r=2*n*e*2,s=t>65535?new Uint32Array(r):new Uint16Array(r);let a=0;for(let l=0;l<e;l++)for(let c=0;c<n;c++)s[a++]=l*e+c,s[a++]=l*e+c+1;for(let l=0;l<e;l++)for(let c=0;c<n;c++)s[a++]=c*e+l,s[a++]=(c+1)*e+l;return{data:s,count:r}}function mo(n,e=32){const t=uo(n,e),{data:i,count:r}=po(e),o=n.createBuffer({label:"tile-debug-wireframe-index",size:i.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});return n.queue.writeBuffer(o,0,i.buffer),{vertexBuffer:t.vertexBuffer,wireframeIndexBuffer:o,wireframeIndexCount:r,vertexCount:t.vertexCount,subdivisions:e}}function go(n){const e=new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]),t=n.createBuffer({label:"tile-debug-quad",size:e.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});return n.queue.writeBuffer(t,0,e),t}const ke=`
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
`,Ne=`
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
`,He=`
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
`;function We(n){return n?`
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
`}function Ze(n){return n?`
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
  r.clipPos = camera.viewProjection * vec4<f32>(wx, wy, 0.0, 1.0);
  r.clipPos.y += height * exag * r.clipPos.w;
  r.clipDot = 1.0;
  return r;
}
`}function Xe(n){return n?`
  if (camera.projectionTransition > 0.01 && input.clipDot < -0.01) { discard; }
`:""}function xo(n){return We(n)+ke+Ne+Ze(n)+He+`
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
  ${Xe(n)}
  return tile.gridColor;
}
`}function vo(n){return We(n)+ke+Ne+Ze(n)+He+`
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
  ${Xe(n)}
  if (length(input.local) > 1.0) { discard; }
  return tile.dotColor;
}
`}function _o(n){return We(n)+ke+Ne+Ze(n)+He+`
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
  ${Xe(n)}
  return tile.borderColor;
}
`}function yo(n){return n.createBindGroupLayout({label:"tile-debug-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function bo(n){return n.createBindGroupLayout({label:"tile-debug-height-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,texture:{sampleType:"unfilterable-float"}},{binding:1,visibility:GPUShaderStage.VERTEX,sampler:{type:"non-filtering"}}]})}const Po={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}};function St(n){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=n,r=n.globe??!1,o=yo(e),s=bo(e),a=e.createSampler({label:"tile-debug-height-sampler",magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),l=e.createPipelineLayout({label:`tile-debug-${r?"globe":"2d"}-layout`,bindGroupLayouts:[i,o,s]}),c={format:n.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:r?n.depthCompare??"less":"always"},h={format:t,blend:Po},u={count:n.sampleCount??F},d=e.createShaderModule({label:"dbg-wireframe",code:xo(r)}),p=e.createRenderPipeline({label:"dbg-wireframe",layout:l,vertex:{module:d,entryPoint:"vs_main",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:d,entryPoint:"fs_main",targets:[h]},primitive:{topology:"line-list"},depthStencil:c,multisample:u}),f=e.createShaderModule({label:"dbg-dot",code:vo(r)}),g=e.createRenderPipeline({label:"dbg-dot",layout:l,vertex:{module:f,entryPoint:"vs_main",buffers:[{arrayStride:8,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]},{arrayStride:8,stepMode:"instance",attributes:[{shaderLocation:1,offset:0,format:"float32x2"}]}]},fragment:{module:f,entryPoint:"fs_main",targets:[h]},primitive:{topology:"triangle-list"},depthStencil:c,multisample:u}),x=e.createShaderModule({label:"dbg-border",code:_o(r)}),v=e.createRenderPipeline({label:"dbg-border",layout:l,vertex:{module:x,entryPoint:"vs_main",buffers:[]},fragment:{module:x,entryPoint:"fs_main",targets:[h]},primitive:{topology:"triangle-list"},depthStencil:c,multisample:u}),y=mo(e,32),m=go(e),{texture:_,bindGroup:b}=qt(e,s);return{wireframePipeline:p,dotPipeline:g,borderPipeline:v,bindGroupLayout:o,heightBindGroupLayout:s,heightSampler:a,mesh:y,quadBuffer:m,zeroHeightTexture:_,zeroHeightBindGroup:b}}const ii=Math.atan(Math.sinh(Math.PI)),ve=Math.cos(ii),Tt=Math.sin(ii),Co=`

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;

// ─── Bindings ───
${Ce}

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
`;function wo(n,e=64){const t=2*(e+1),i=new Float32Array(t*3);i[0]=0,i[1]=1,i[2]=0;for(let u=0;u<e;u++){const d=u/e*2*Math.PI,p=(1+u)*3;i[p]=ve*Math.sin(d),i[p+1]=Tt,i[p+2]=ve*Math.cos(d)}const r=e+1,o=r*3;i[o]=0,i[o+1]=-1,i[o+2]=0;for(let u=0;u<e;u++){const d=u/e*2*Math.PI,p=(r+1+u)*3;i[p]=ve*Math.sin(d),i[p+1]=-Tt,i[p+2]=ve*Math.cos(d)}const s=2*e*3,a=new Uint16Array(s);let l=0;for(let u=0;u<e;u++)a[l++]=0,a[l++]=1+u,a[l++]=1+(u+1)%e;for(let u=0;u<e;u++)a[l++]=r,a[l++]=r+1+(u+1)%e,a[l++]=r+1+u;const c=n.createBuffer({label:"pole-cap-vertex-buffer",size:i.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(c,0,i);const h=n.createBuffer({label:"pole-cap-index-buffer",size:a.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});return n.queue.writeBuffer(h,0,a),{vertexBuffer:c,indexBuffer:h,indexCount:s,vertexCount:t}}function Mo(n){return n.createBindGroupLayout({label:"pole-cap-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function So(n){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=n,r=n.segments??64,o=Mo(e),s=e.createShaderModule({label:"pole-cap-shader",code:Co}),a=e.createPipelineLayout({label:"pole-cap-pipeline-layout",bindGroupLayouts:[i,o]}),l=wo(e,r);return{pipeline:e.createRenderPipeline({label:"pole-cap-pipeline",layout:a,vertex:{module:s,entryPoint:"vs_main",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:s,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"},multisample:{count:n.sampleCount??F}}),poleCapBindGroupLayout:o,mesh:l}}const To=1.15,Bo=`

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;

// ─── Bindings ───
${Ce}

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
`;function Go(n,e=4){const t=To;let i=[0,t,0,0,-t,0,t,0,0,-t,0,0,0,0,t,0,0,-t],r=[0,4,2,0,2,5,0,5,3,0,3,4,1,2,4,1,5,2,1,3,5,1,4,3];const o=new Map;function s(u,d){const p=u<d?`${u}_${d}`:`${d}_${u}`,f=o.get(p);if(f!==void 0)return f;const g=i[u*3],x=i[u*3+1],v=i[u*3+2],y=i[d*3],m=i[d*3+1],_=i[d*3+2];let b=(g+y)*.5,C=(x+m)*.5,M=(v+_)*.5;const P=Math.sqrt(b*b+C*C+M*M);b=b/P*t,C=C/P*t,M=M/P*t;const T=i.length/3;return i.push(b,C,M),o.set(p,T),T}for(let u=0;u<e;u++){const d=[];o.clear();for(let p=0;p<r.length;p+=3){const f=r[p],g=r[p+1],x=r[p+2],v=s(f,g),y=s(g,x),m=s(x,f);d.push(f,v,m,g,y,v,x,m,y,v,y,m)}r=d}const a=new Float32Array(i),l=i.length/3>65535?new Uint32Array(r):new Uint16Array(r),c=n.createBuffer({label:"atmosphere-vertex-buffer",size:a.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(c,0,a);const h=n.createBuffer({label:"atmosphere-index-buffer",size:l.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});return n.queue.writeBuffer(h,0,l),{vertexBuffer:c,indexBuffer:h,indexCount:r.length,vertexCount:i.length/3}}function Eo(n){return n.createBindGroupLayout({label:"atmosphere-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function Fo(n){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=n,r=Eo(e),o=e.createShaderModule({label:"atmosphere-shader",code:Bo}),s=e.createPipelineLayout({label:"atmosphere-pipeline-layout",bindGroupLayouts:[i,r]}),a=Go(e,n.subdivisions??4);return{pipeline:e.createRenderPipeline({label:"atmosphere-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"front"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:"always"},multisample:{count:n.sampleCount??F}}),atmosphereBindGroupLayout:r,mesh:a}}const Lo=`

// ─── Bindings ───
${O}

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
`;function Do(n){return n.createBindGroupLayout({label:"icon-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Ro(n){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=n,r=Do(e),o=e.createShaderModule({label:"icon-shader",code:Lo}),s=e.createPipelineLayout({label:"icon-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"icon-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"instance",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"},multisample:{count:n.sampleCount??F}}),l=e.createSampler({label:"icon-atlas-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,materialBindGroupLayout:r,sampler:l}}const Uo=`

// ─── Constants ───
${ee}
const EARTH_RADIUS_M: f32 = 6371000.0;
const ALTITUDE_EXAG: f32 = 5.0;

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

// ─── Helpers ───

fn altitudeOffset(altMeters: f32) -> f32 {
  return altMeters / EARTH_RADIUS_M * ALTITUDE_EXAG;
}

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
`;function Ao(n){return n.createBindGroupLayout({label:"globe-icon-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Io(n){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=n,r=Ao(e),o=e.createShaderModule({label:"globe-icon-shader",code:Uo}),s=e.createPipelineLayout({label:"globe-icon-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"globe-icon-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:12,stepMode:"instance",attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"},multisample:{count:n.sampleCount??F}}),l=e.createSampler({label:"globe-icon-atlas-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,materialBindGroupLayout:r,sampler:l}}function zo(n){const{device:e,colorFormat:t,depthFormat:i,cameraBindGroupLayout:r}=n,o=e.createBindGroupLayout({label:"custom-frame-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]});let s=null;n.hasCustomUniforms&&(s=e.createBindGroupLayout({label:"custom-user-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}));let a=null;n.hasTexture&&(a=e.createBindGroupLayout({label:"custom-texture-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]}));const l=[r,o];if(s&&l.push(s),a){if(!s){const f=e.createBindGroupLayout({label:"custom-empty-bind-group-layout",entries:[]});l.push(f)}l.push(a)}const c=e.createPipelineLayout({label:"custom-pipeline-layout",bindGroupLayouts:l}),h=n.vertexBufferLayouts.map(f=>({arrayStride:f.arrayStride,stepMode:f.stepMode??"vertex",attributes:f.attributes.map(g=>({shaderLocation:g.shaderLocation,offset:g.offset,format:g.format}))})),u=e.createShaderModule({label:"custom-shader-module",code:n.shaderSource}),d=n.blendState??{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}};return console.log("[CP5-DESC]",{topology:n.topology,colorFormat:t,depthFormat:i}),console.log("[CP5-BLEND]",JSON.stringify(d)),console.log("[CP5-DEPTH]",{depthWriteEnabled:!1,depthCompare:"always"}),console.log("[CP5-VB]",h.map(f=>({arrayStride:f.arrayStride,attrCount:Array.from(f.attributes).length}))),console.log("[CP5-BGL]",{groupCount:l.length,groups:l.map((f,g)=>`@group(${g})`)}),{pipeline:e.createRenderPipeline({label:"custom-render-pipeline",layout:c,vertex:{module:u,entryPoint:"vs_main",buffers:h},fragment:{module:u,entryPoint:"fs_main",targets:[{format:t,blend:d}]},primitive:{topology:n.topology},depthStencil:{format:i,depthWriteEnabled:!1,depthCompare:"always"},multisample:{count:n.sampleCount??F}}),frameBindGroupLayout:o,customBindGroupLayout:s,textureBindGroupLayout:a}}const Oo=`
// ─── Bindings ───
${O}

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
  let rotated = rotMat * (input.position * scale);

  // Preserve Z for 3D model structure (visible when camera has pitch)
  let worldPos = input.worldPos + vec3<f32>(rotated.x, rotated.y, rotated.z + anchorZ);

  output.clipPosition = camera.viewProjection * vec4<f32>(worldPos, 1.0);
  // Remap depth for model self-occlusion: higher local Z = closer to top-down camera = lower clip Z
  let localZ = rotated.z + anchorZ;
  let normalizedZ = clamp(0.5 - localZ / (scale * 10.0), 0.01, 0.99);
  output.clipPosition.z = normalizedZ * output.clipPosition.w;

  output.vNormal = normalize(rotMat * input.normal);
  output.vTexcoord = input.texcoord;
  output.vWorldPos = worldPos;

  return output;
}

// ─── PBR Helpers ───

const PI: f32 = 3.14159265358979;

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

// ─── Fragment: PBR ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
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

  // ── Normal ──
  var N = normalize(input.vNormal);
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
`;function Vo(n){return n.createBindGroupLayout({label:"model-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function ko(n){const{device:e,colorFormat:t,cameraBindGroupLayout:i,depthFormat:r,depthCompare:o}=n,s=Vo(e),a=e.createPipelineLayout({label:"model-pipeline-layout",bindGroupLayouts:[i,s]}),l=e.createShaderModule({label:"model-shader",code:Oo}),c=e.createRenderPipeline({label:"model-pipeline",layout:a,vertex:{module:l,entryPoint:"vs_main",buffers:[{arrayStride:32,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]},{arrayStride:32,stepMode:"instance",attributes:[{shaderLocation:3,offset:0,format:"float32x3"},{shaderLocation:4,offset:12,format:"float32x2"},{shaderLocation:5,offset:20,format:"float32x3"}]}]},fragment:{module:l,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:r,depthWriteEnabled:!0,depthCompare:o??"less"},multisample:{count:n.sampleCount??F}}),h=e.createSampler({label:"model-sampler",magFilter:"linear",minFilter:"linear",mipmapFilter:"linear",addressModeU:"repeat",addressModeV:"repeat"});return{pipeline:c,materialBindGroupLayout:s,sampler:h}}const No=`
// ─── Constants ───
${ee}

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
  @location(2) clipDot: f32,
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
  let tangentMatrix = mat3x3<f32>(east, up, north);

  // Rotation matrix (shared by globe and flat paths)
  let rotMat = eulerToRotationMatrix(heading, pitch, roll);

  // ─── Globe path: tangent frame on unit sphere ───
  let globeScale = scale / 6378137.0;
  let localOffset = tangentMatrix * (rotMat * (input.position * globeScale));
  let anchorOffset = up * (anchorZ / 6378137.0);
  let globeFinal = spherePos + localOffset + anchorOffset;

  var globeClip = camera.viewProjection * vec4<f32>(globeFinal, 1.0);
  // Use horizon-aware base depth + local offset for model self-occlusion
  let baseDepth = globeClippingZ(spherePos);
  let modelUpOffset = dot(localOffset, up) * 10.0;
  globeClip.z = (baseDepth - modelUpOffset) * globeClip.w;

  // ─── Flat path: model vertex offset in Mercator [0..1] space ───
  let flatRotated = rotMat * (input.position * scale);
  let merc01Scale = 1.0 / (2.0 * HALF_CIRCUMFERENCE);
  let flatMerc = vec3<f32>(
    merc01.x + flatRotated.x * merc01Scale,
    merc01.y - flatRotated.y * merc01Scale,
    (flatRotated.z + anchorZ) * merc01Scale
  );
  var flatClip = camera.flatViewProjection * vec4<f32>(flatMerc, 1.0);
  // Remap depth for model self-occlusion: higher Z = closer to camera = lower clip Z
  let localZ = flatRotated.z + anchorZ;
  let normalizedZ = clamp(0.5 - localZ / (scale * 10.0), 0.01, 0.99);
  flatClip.z = normalizedZ * flatClip.w;

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
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
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

  // Normal
  var N = normalize(input.vNormal);

  // Metallic / Roughness
  var metallic = material.metallic;
  var roughness = material.roughness;
  if (material.hasMetallicRoughnessTex > 0.5) {
    let mrSample = textureSample(metallicRoughnessTex, texSampler, uv);
    roughness = roughness * mrSample.g;
    metallic = metallic * mrSample.b;
  }
  roughness = clamp(roughness, 0.04, 1.0);

  // PBR Lighting
  let lightDir = normalize(vec3<f32>(0.5, 0.8, 0.6));
  let viewDir = normalize(vec3<f32>(0.0, 0.0, 1.0));
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
`;function Ho(n){return n.createBindGroupLayout({label:"globe-model-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]})}function Wo(n){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i,depthFormat:r,depthCompare:o}=n,s=Ho(e),a=e.createPipelineLayout({label:"globe-model-pipeline-layout",bindGroupLayouts:[i,s]}),l=e.createShaderModule({label:"globe-model-shader",code:No}),c=e.createRenderPipeline({label:"globe-model-pipeline",layout:a,vertex:{module:l,entryPoint:"vs_main",buffers:[{arrayStride:32,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]},{arrayStride:32,stepMode:"instance",attributes:[{shaderLocation:3,offset:0,format:"float32x3"},{shaderLocation:4,offset:12,format:"float32x2"},{shaderLocation:5,offset:20,format:"float32x3"}]}]},fragment:{module:l,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:r,depthWriteEnabled:!0,depthCompare:o??"less"},multisample:{count:n.sampleCount??F}}),h=e.createSampler({label:"globe-model-sampler",magFilter:"linear",minFilter:"linear",mipmapFilter:"linear",addressModeU:"repeat",addressModeV:"repeat"});return{pipeline:c,materialBindGroupLayout:s,sampler:h}}class Zo{_device;_models=new Map;constructor(e){this._device=e}upload(e,t){if(this._models.has(e))return;const i=t.primitives.map((r,o)=>this._uploadPrimitive(e,r.mesh,r.material,o));this._models.set(e,{primitives:i})}async uploadAsync(e,t){if(this._models.has(e))return;const i=[];for(let r=0;r<t.primitives.length;r++){const o=t.primitives[r],s=this._uploadPrimitive(e,o.mesh,o.material,r),a=[{field:"baseColorTexture",index:o.material.baseColorTextureIndex},{field:"normalTexture",index:o.material.normalTextureIndex},{field:"metallicRoughnessTexture",index:o.material.metallicRoughnessTextureIndex},{field:"occlusionTexture",index:o.material.occlusionTextureIndex},{field:"emissiveTexture",index:o.material.emissiveTextureIndex}];for(const l of a){if(l.index===void 0)continue;const c=o.imageData.get(l.index);if(c)try{const h=new ArrayBuffer(c.data.byteLength);new Uint8Array(h).set(c.data);const u=new Blob([h],{type:c.mimeType}),d=await createImageBitmap(u);s[l.field]=this._createTextureFromBitmap(d,`${e}-p${r}-${l.field}`),d.close()}catch{}}i.push(s)}this._models.set(e,{primitives:i})}get(e){return this._models.get(e)}has(e){return this._models.has(e)}destroy(){for(const e of this._models.values())for(const t of e.primitives)t.vertexBuffer.destroy(),t.indexBuffer.destroy(),t.baseColorTexture?.destroy(),t.normalTexture?.destroy(),t.metallicRoughnessTexture?.destroy(),t.occlusionTexture?.destroy(),t.emissiveTexture?.destroy();this._models.clear()}_uploadPrimitive(e,t,i,r){const s=new Float32Array(t.vertexCount*8);for(let g=0;g<t.vertexCount;g++){const x=g*8,v=g*3,y=g*3,m=g*2;s[x+0]=t.positions[v],s[x+1]=t.positions[v+1],s[x+2]=t.positions[v+2],s[x+3]=t.normals[y],s[x+4]=t.normals[y+1],s[x+5]=t.normals[y+2],s[x+6]=t.texcoords[m],s[x+7]=t.texcoords[m+1]}const a=`model-vertex-${e}${r>0?`-p${r}`:""}`,l=this._device.createBuffer({label:a,size:s.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0});new Float32Array(l.getMappedRange()).set(s),l.unmap();const c=t.indices,h=c instanceof Uint32Array?"uint32":"uint16",u=c.byteLength,d=Math.ceil(u/4)*4,p=`model-index-${e}${r>0?`-p${r}`:""}`,f=this._device.createBuffer({label:p,size:Math.max(d,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0});return c instanceof Uint32Array?new Uint32Array(f.getMappedRange(0,c.byteLength)).set(c):new Uint16Array(f.getMappedRange(0,c.byteLength)).set(c),f.unmap(),{vertexBuffer:l,indexBuffer:f,indexFormat:h,indexCount:t.indexCount,vertexCount:t.vertexCount,material:i,baseColorTexture:null,normalTexture:null,metallicRoughnessTexture:null,occlusionTexture:null,emissiveTexture:null}}_createTextureFromBitmap(e,t){const i=this._device.createTexture({label:t,size:{width:e.width,height:e.height},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});return this._device.queue.copyExternalImageToTexture({source:e},{texture:i},{width:e.width,height:e.height}),i}}const Bt=1179937895,Xo=2,Gt=1313821514,Et=5130562,$o={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},jo={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};function _e(n,e,t){const i=jo[n.type];if(i===void 0)throw new Error(`GLB: unknown accessor type "${n.type}"`);const r=$o[n.componentType];if(r===void 0)throw new Error(`GLB: unknown componentType ${n.componentType}`);const o=n.count*i;if(n.bufferView===void 0)return Ft(n.componentType,new ArrayBuffer(o*r),0,o);const s=e[n.bufferView];if(!s)throw new Error(`GLB: bufferView index ${n.bufferView} out of range`);const a=s.byteOffset??0,l=n.byteOffset??0,c=a+l,h=o*r,u=new ArrayBuffer(h);return new Uint8Array(u).set(t.subarray(c,c+h)),Ft(n.componentType,u,0,o)}function Ft(n,e,t,i){switch(n){case 5120:return new Int8Array(e,t,i);case 5121:return new Uint8Array(e,t,i);case 5122:return new Int16Array(e,t,i);case 5123:return new Uint16Array(e,t,i);case 5125:return new Uint32Array(e,t,i);case 5126:return new Float32Array(e,t,i);default:throw new Error(`GLB: unsupported componentType ${n}`)}}function Ge(n){if(n instanceof Float32Array)return n;const e=n,t=new Float32Array(e.length);for(let i=0;i<e.length;i++)t[i]=e[i];return t}function Yo(n){const e=new Float32Array(n*3);for(let t=0;t<n;t++)e[t*3+2]=1;return e}function Ko(n){return new Float32Array(n*2)}function qo(n){const e=new Uint32Array(n);for(let t=0;t<n;t++)e[t]=t;return e}const k={baseColorFactor:[1,1,1,1],metallicFactor:1,roughnessFactor:1,emissiveFactor:[0,0,0],alphaMode:"OPAQUE",alphaCutoff:.5,doubleSided:!1,unlit:!1};function Jo(n,e,t,i){const r=n.attributes.POSITION;if(r===void 0)throw new Error("GLB: primitive has no POSITION attribute");const o=e[r];if(!o)throw new Error(`GLB: POSITION accessor index ${r} out of range`);const s=Ge(_e(o,t,i)),a=o.count;let l;const c=n.attributes.NORMAL;if(c!==void 0){const f=e[c];if(!f)throw new Error(`GLB: NORMAL accessor index ${c} out of range`);l=Ge(_e(f,t,i))}else l=Yo(a);let h;const u=n.attributes.TEXCOORD_0;if(u!==void 0){const f=e[u];if(!f)throw new Error(`GLB: TEXCOORD_0 accessor index ${u} out of range`);h=Ge(_e(f,t,i))}else h=Ko(a);let d,p;if(n.indices!==void 0){const f=e[n.indices];if(!f)throw new Error(`GLB: indices accessor index ${n.indices} out of range`);const g=_e(f,t,i);if(g instanceof Uint16Array)d=g;else if(g instanceof Uint32Array)d=g;else{const x=g,v=new Uint32Array(x.length);for(let y=0;y<x.length;y++)v[y]=x[y];d=v}p=f.count}else d=qo(a),p=a;return{positions:s,normals:l,texcoords:h,indices:d,vertexCount:a,indexCount:p}}function Qo(n,e){if(n===void 0||!e||!e[n])return{...k};const t=e[n],i=t.pbrMetallicRoughness,r=i?.baseColorFactor,o={baseColorFactor:r&&r.length>=4?[r[0],r[1],r[2],r[3]]:k.baseColorFactor,metallicFactor:i?.metallicFactor??k.metallicFactor,roughnessFactor:i?.roughnessFactor??k.roughnessFactor,emissiveFactor:t.emissiveFactor&&t.emissiveFactor.length>=3?[t.emissiveFactor[0],t.emissiveFactor[1],t.emissiveFactor[2]]:k.emissiveFactor,alphaMode:t.alphaMode??k.alphaMode,alphaCutoff:t.alphaCutoff??k.alphaCutoff,doubleSided:t.doubleSided??k.doubleSided,unlit:t.extensions?.KHR_materials_unlit!==void 0};return i?.baseColorTexture!==void 0&&(o.baseColorTextureIndex=i.baseColorTexture.index),i?.metallicRoughnessTexture!==void 0&&(o.metallicRoughnessTextureIndex=i.metallicRoughnessTexture.index),t.normalTexture!==void 0&&(o.normalTextureIndex=t.normalTexture.index),t.occlusionTexture!==void 0&&(o.occlusionTextureIndex=t.occlusionTexture.index),t.emissiveTexture!==void 0&&(o.emissiveTextureIndex=t.emissiveTexture.index),o}function en(n,e,t,i){const r=e.textures;if(!r||!r[n])return;const o=r[n];if(o.source===void 0)return;const s=e.images;if(!s||!s[o.source])return;const a=s[o.source];if(a.bufferView===void 0)return;const l=t[a.bufferView];if(!l)return;const c=l.byteOffset??0,h=new Uint8Array(l.byteLength);return h.set(i.subarray(c,c+l.byteLength)),{data:h,mimeType:a.mimeType??"image/png"}}function tn(n){if(n.byteLength<12)throw new Error("GLB: data too small to contain a valid header");const e=new DataView(n),t=e.getUint32(0,!0);if(t!==Bt)throw new Error(`GLB: invalid magic 0x${t.toString(16).padStart(8,"0")}, expected 0x${Bt.toString(16).padStart(8,"0")}`);const i=e.getUint32(4,!0);if(i!==Xo)throw new Error(`GLB: unsupported version ${i}, only version 2 is supported`);const r=e.getUint32(8,!0);if(r>n.byteLength)throw new Error(`GLB: declared length ${r} exceeds buffer size ${n.byteLength}`);let o=12;if(o+8>r)throw new Error("GLB: missing JSON chunk header");const s=e.getUint32(o,!0),a=e.getUint32(o+4,!0);if(a!==Gt)throw new Error(`GLB: first chunk type 0x${a.toString(16)} is not JSON (0x${Gt.toString(16)})`);if(o+=8,o+s>r)throw new Error("GLB: JSON chunk extends beyond file");const l=new Uint8Array(n,o,s),c=new TextDecoder().decode(l),h=JSON.parse(c);o+=s;let u=new Uint8Array(0);if(o+8<=r){const d=e.getUint32(o,!0),p=e.getUint32(o+4,!0);if(p!==Et)throw new Error(`GLB: second chunk type 0x${p.toString(16)} is not BIN (0x${Et.toString(16)})`);if(o+=8,o+d>r)throw new Error("GLB: BIN chunk extends beyond file");u=new Uint8Array(n,o,d)}return ri(h,u)}function rn(n,e){const t=n;let i=0;for(const a of e)i+=a.byteLength;const r=new Uint8Array(i),o=[];let s=0;for(const a of e)o.push(s),r.set(new Uint8Array(a),s),s+=a.byteLength;if(t.bufferViews)for(const a of t.bufferViews){const l=o[a.buffer]??0;a.byteOffset=(a.byteOffset??0)+l,a.buffer=0}return ri(t,r)}function ri(n,e){if(!n.meshes||n.meshes.length===0)throw new Error("GLB: no meshes found in JSON");const t=n.accessors??[],i=n.bufferViews??[],r=[];for(const o of n.meshes)for(const s of o.primitives){const a=Jo(s,t,i,e),l=Qo(s.material,n.materials),c=new Map,h=[l.baseColorTextureIndex,l.normalTextureIndex,l.metallicRoughnessTextureIndex,l.occlusionTextureIndex,l.emissiveTextureIndex];for(const u of h)if(u!==void 0&&!c.has(u)){const d=en(u,n,i,e);d&&c.set(u,d)}r.push({mesh:a,material:l,imageData:c,name:o.name})}if(r.length===0)throw new Error("GLB: no primitives found");return{primitives:r}}const Ee=20037508342789244e-9;function on(n,e,t,i,r){const o=n.length/2;if(o===0)return{entries:[],membership:[]};const s=e>0?e:60,a=2*Ee/(256*Math.pow(2,t)),l=s*a,c=l*l,h=i[0]-l,u=i[1]-l,d=i[2]+l,p=i[3]+l,f=new Map;for(let P=0;P<o;P++){const T=n[P*2],w=n[P*2+1];if(T<h||T>d||w<u||w>p)continue;const S=Math.floor((T+Ee)/l),B=Math.floor((w+Ee)/l);if(!Number.isFinite(S)||!Number.isFinite(B))continue;const G=`${S},${B}`;let L=f.get(G);L||(L={cellX:S,cellY:B,sumX:0,sumY:0,count:0,members:[]},f.set(G,L)),L.sumX+=T,L.sumY+=w,L.count++,L.members.push(P)}if(f.size===0)return{entries:[],membership:[]};const g=Array.from(f.values());g.sort((P,T)=>P.cellY-T.cellY||P.cellX-T.cellX);const x=new Map;for(let P=0;P<g.length;P++){const T=g[P];x.set(`${T.cellX},${T.cellY}`,P)}const v=new nn(g.length),y=new Float64Array(g.length),m=new Float64Array(g.length);for(let P=0;P<g.length;P++){const T=g[P];y[P]=T.sumX/T.count,m[P]=T.sumY/T.count}for(let P=0;P<g.length;P++){const T=g[P];for(let w=T.cellY-1;w<=T.cellY+1;w++)for(let S=T.cellX-1;S<=T.cellX+1;S++){if(S<T.cellX||S===T.cellX&&w<=T.cellY)continue;const B=x.get(`${S},${w}`);if(B===void 0||B<=P)continue;const G=y[P]-y[B],L=m[P]-m[B];G*G+L*L<=c&&v.union(P,B)}}const _=new Map;for(let P=0;P<g.length;P++){const T=v.find(P),w=g[P];let S=_.get(T);S||(S={sumX:0,sumY:0,count:0,members:[],minMember:1/0},_.set(T,S)),S.sumX+=w.sumX,S.sumY+=w.sumY,S.count+=w.count,S.members.push(...w.members);for(const B of w.members)B<S.minMember&&(S.minMember=B)}const b=Array.from(_.values());b.sort((P,T)=>P.minMember-T.minMember);const C=[],M=[];for(const P of b){if(P.count>=r){const w=P.sumX/P.count,S=P.sumY/P.count,B=P.members.slice().sort((L,$)=>L-$);let G=0;G=1,P.count>=100?G|=4:P.count>=10&&(G|=2),C.push({posX:w,posY:S,count:P.count,flags:G}),M.push(B);continue}const T=P.members.slice().sort((w,S)=>w-S);for(const w of T){const S=n[w*2],B=n[w*2+1];C.push({posX:S,posY:B,count:1,flags:0}),M.push([w])}}return{entries:C,membership:M}}class nn{parent;rank;constructor(e){this.parent=new Int32Array(e),this.rank=new Uint8Array(e);for(let t=0;t<e;t++)this.parent[t]=t}find(e){let t=e;for(;this.parent[t]!==t;)t=this.parent[t];let i=e;for(;this.parent[i]!==i;){const r=this.parent[i];this.parent[i]=t,i=r}return t}union(e,t){let i=this.find(e),r=this.find(t);if(i===r)return;const o=this.rank[i],s=this.rank[r];o<s&&([i,r]=[r,i]),this.parent[r]=i,o===s&&(this.rank[i]=o+1)}}function sn(n){const e=new Float32Array(n.length*4),t=new Uint32Array(e.buffer);for(let i=0;i<n.length;i++){const r=n[i],o=i*4;e[o]=r.posX,e[o+1]=r.posY,t[o+2]=r.count,t[o+3]=r.flags}return e}const an=`

${O}

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
`;function ln(n){return n.createBindGroupLayout({label:"cluster-render-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{}}]})}function cn(n){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=n,r=ln(e),o=e.createShaderModule({label:"cluster-render-shader",code:an}),s=e.createPipelineLayout({label:"cluster-render-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"cluster-render-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"},multisample:{count:n.sampleCount??F}}),l=e.createSampler({label:"cluster-digit-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,renderBindGroupLayout:r,sampler:l}}const un=`

${ee}

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
`;function hn(n){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=n,r=e.createBindGroupLayout({label:"cluster-globe-render-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{}}]}),o=e.createShaderModule({label:"cluster-globe-render-shader",code:un}),s=e.createPipelineLayout({label:"cluster-globe-render-pipeline-layout",bindGroupLayouts:[i,r]}),a=e.createRenderPipeline({label:"cluster-globe-render-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!1,depthCompare:"always"},multisample:{count:n.sampleCount??F}}),l=e.createSampler({label:"cluster-globe-digit-sampler",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});return{pipeline:a,renderBindGroupLayout:r,sampler:l}}const dn=`

// ─── Bindings ───
${O}
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
`;function fn(n){return n.createBindGroupLayout({label:"extrusion-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]})}function pn(n){const{device:e,colorFormat:t,cameraBindGroupLayout:i}=n,r=fn(e),o=e.createShaderModule({label:"extrusion-shader",code:dn}),s=e.createPipelineLayout({label:"extrusion-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"extrusion-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:32,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"back"},depthStencil:{format:n.depthFormat??"depth24plus",depthWriteEnabled:!0,depthCompare:n.depthCompare??"less"},multisample:{count:n.sampleCount??F}}),materialBindGroupLayout:r}}function mn(n){return n==="greater"||n==="greater-equal"?1:-1}function gn(n){const e=mn(n);return`

// ─── Bindings ───
${Ce}
${ei}
const EARTH_RADIUS_M: f32 = 6378137.0;
const ROOF_DEPTH_BIAS: f32 = 1e-4;
const WALL_DEPTH_BIAS: f32 = 2e-5;
const EXTRUSION_SURFACE_BIAS: f32 = 5e-5;
const ROOF_DEPTH_BIAS_SIGN: f32 = ${e};
${ti}

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
`}function xn(n){const{device:e,colorFormat:t,globeCameraBindGroupLayout:i}=n,r=e.createBindGroupLayout({label:"globe-extrusion-material-bind-group-layout",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),o=e.createShaderModule({label:"globe-extrusion-shader",code:gn(n.depthCompare)}),s=e.createPipelineLayout({label:"globe-extrusion-pipeline-layout",bindGroupLayouts:[i,r]});return{pipeline:e.createRenderPipeline({label:"globe-extrusion-pipeline",layout:s,vertex:{module:o,entryPoint:"vs_main",buffers:[{arrayStride:32,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32x2"}]}]},fragment:{module:o,entryPoint:"fs_main",targets:[{format:t,blend:{color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}}}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:n.depthFormat??"depth32float",depthWriteEnabled:!0,depthCompare:n.depthCompare??"greater"},multisample:{count:n.sampleCount??F}}),materialBindGroupLayout:r}}class vn{ctx;pickingPipeline=null;constructor(e){this.ctx=e}ensurePickingPipeline(){if(!this.pickingPipeline){const e=this.ctx.canvas?.width||1,t=this.ctx.canvas?.height||1;this.pickingPipeline=Xr({device:this.ctx.device,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,width:e,height:t,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc})}return this.pickingPipeline}async pick(e,t){if(!this.ctx.device||!this.ctx.cameraBindGroup||this.ctx.deviceLost)return null;const i=this.ensurePickingPipeline();if(e<0||e>=i.width||t<0||t>=i.height)return null;const r=this.ctx.device.createCommandEncoder({label:"picking-command-encoder"}),o=r.beginRenderPass({label:"picking-render-pass",colorAttachments:[{view:i.pickingTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:i.depthTexture.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});o.setPipeline(i.pipeline),o.setBindGroup(0,this.ctx.cameraBindGroup);let s=1;for(const f of this.ctx.pickingDrawCalls){const g=(s&255)/255,x=(s>>8&255)/255,v=(s>>16&255)/255,y=1/255,m=new Float32Array([g,x,v,y]),_=this.ctx.bufferPool.allocateWithData(m,GPUBufferUsage.UNIFORM,"transient"),b=this.ctx.device.createBindGroup({label:"picking-id-bind-group",layout:i.pickingBindGroupLayout,entries:[{binding:0,resource:{buffer:_}}]});o.setBindGroup(1,b),f.type==="points"?(o.setVertexBuffer(0,f.vertexBuffer),o.draw(f.vertexCount,f.instanceCount)):(o.setVertexBuffer(0,f.vertexBuffer),o.setIndexBuffer(f.indexBuffer,"uint32"),o.drawIndexed(f.indexCount)),s++}o.end(),r.copyTextureToBuffer({texture:i.pickingTexture,origin:{x:Math.floor(e),y:Math.floor(t)}},{buffer:i.readbackBuffer,bytesPerRow:256},{width:1,height:1}),this.ctx.device.queue.submit([r.finish()]),await i.readbackBuffer.mapAsync(GPUMapMode.READ);const a=new Uint8Array(i.readbackBuffer.getMappedRange(0,4)),l=a[0],c=a[1],h=a[2],u=a[3];i.readbackBuffer.unmap();const d=$r(l,c,h,u);return d?{layerId:this.ctx.pickingDrawCalls[s-1]?.layerId??`layer-${d.layerIndex}`,featureId:d.featureId,screenX:e,screenY:t}:null}destroy(){this.pickingPipeline&&(this.pickingPipeline.pickingTexture.destroy(),this.pickingPipeline.depthTexture.destroy(),this.pickingPipeline.readbackBuffer.destroy(),this.pickingPipeline=null)}reset(){this.pickingPipeline=null}}const Z={enabled:!0,ambient:.35,diffuse:.85,shadowStrength:.35,shadowSoftness:.4,sunAzimuth:315,sunAltitude:45};class _n{ctx;rasterPipeline=null;globeRasterPipeline=null;debugSuite2D=null;debugSuiteGlobe=null;constructor(e){this.ctx=e}initRasterPipeline(){this.ctx.device&&(this.rasterPipeline=Rr({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,sampleCount:this.ctx.sampleCount}))}ensureGlobeRasterPipeline(){return this.globeRasterPipeline||(this.ctx.ensureGlobeCameraResources(),this.globeRasterPipeline=Sr({device:this.ctx.device,colorFormat:this.ctx.colorFormat,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globeRasterPipeline}ensureDebugSuite2D(){return this.debugSuite2D||(this.debugSuite2D=St({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,globe:!1,sampleCount:this.ctx.sampleCount})),this.debugSuite2D}ensureDebugSuiteGlobe(){return this.debugSuiteGlobe||(this.ctx.ensureGlobeCameraResources(),this.debugSuiteGlobe=St({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,globe:!0,sampleCount:this.ctx.sampleCount})),this.debugSuiteGlobe}drawImagery(e){if(!this.ctx.device||!this.ctx.renderPass||!this.rasterPipeline||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const t=new Float32Array(8);t[0]=e.extent[0],t[1]=e.extent[1],t[2]=e.extent[2],t[3]=e.extent[3],t[4]=e.opacity,t[5]=e.filters?.brightness??1,t[6]=e.filters?.contrast??1,t[7]=e.filters?.saturate??1;const i=this.ctx.bufferPool.allocateWithData(t,GPUBufferUsage.UNIFORM,"transient"),r=this.ctx.device.createBindGroup({label:"raster-tile-bind-group",layout:this.rasterPipeline.rasterBindGroupLayout,entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:this.rasterPipeline.sampler},{binding:2,resource:e.texture.createView()}]});this.ctx.renderPass.setPipeline(this.rasterPipeline.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,r),this.ctx.renderPass.draw(4),this.ctx.debugTileVertices&&this._drawDebugOverlay(e.extent,!1)}drawGlobeTile(e){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const t=this.ensureGlobeRasterPipeline();this.ctx.ensureGlobeCameraWritten();const i=(e.heightMode??0)===1,r=e.terrainUvOffsetScale??[0,0,1,1],o=e.heightExaggeration??this.ctx.heightExaggeration,s={enabled:e.lighting3D?.enabled??Z.enabled,ambient:e.lighting3D?.ambient??Z.ambient,diffuse:e.lighting3D?.diffuse??Z.diffuse,shadowStrength:e.lighting3D?.shadowStrength??Z.shadowStrength,shadowSoftness:e.lighting3D?.shadowSoftness??Z.shadowSoftness,sunAzimuth:e.lighting3D?.sunAzimuth??Z.sunAzimuth,sunAltitude:e.lighting3D?.sunAltitude??Z.sunAltitude},a=new Float32Array(24);a[0]=e.mercatorExtent[0],a[1]=e.mercatorExtent[1],a[2]=e.mercatorExtent[2],a[3]=e.mercatorExtent[3],a[4]=e.opacity,a[5]=o,a[6]=i?1:0,a[8]=r[0],a[9]=r[1],a[10]=r[2],a[11]=r[3],a[12]=Math.max(0,Math.min(1,s.ambient)),a[13]=Math.max(0,Math.min(2,s.diffuse)),a[14]=Math.max(0,Math.min(1,s.shadowStrength)),a[15]=Math.max(0,Math.min(1,s.shadowSoftness)),a[16]=s.sunAzimuth,a[17]=Math.max(0,Math.min(89.9,s.sunAltitude)),a[18]=s.enabled?1:0,a[20]=e.filters?.brightness??1,a[21]=e.filters?.contrast??1,a[22]=e.filters?.saturate??1;const l=this.ctx.bufferPool.allocateWithData(a,GPUBufferUsage.UNIFORM,"transient"),c=this.ctx.device.createBindGroup({label:"globe-tile-bind-group",layout:t.globeTileBindGroupLayout,entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:t.sampler},{binding:2,resource:e.texture.createView()}]});let h=t.zeroHeightBindGroup;i?e.terrainHeightTexture&&(h=this.ctx.device.createBindGroup({label:"globe-terrain-height-bind-group",layout:t.heightBindGroupLayout,entries:[{binding:0,resource:e.terrainHeightTexture.createView()},{binding:1,resource:t.heightSampler}]})):h=this.ctx.heightBrush?.getBindGroup(this.ctx.device)??t.zeroHeightBindGroup,this.ctx.renderPass.setPipeline(t.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,c),this.ctx.renderPass.setBindGroup(2,h),this.ctx.renderPass.setVertexBuffer(0,t.subdivisionMesh.vertexBuffer),this.ctx.renderPass.setIndexBuffer(t.subdivisionMesh.indexBuffer,t.subdivisionMesh.vertexCount>65535?"uint32":"uint16"),this.ctx.renderPass.drawIndexed(t.subdivisionMesh.indexCount),this.ctx.debugTileVertices&&this._drawDebugOverlay(e.mercatorExtent,!0,{mode:i?1:0,exaggeration:o,terrainUvOffsetScale:r,terrainHeightTexture:e.terrainHeightTexture})}_drawDebugOverlay(e,t,i){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const r=t?this.ctx.globeCameraBindGroup:this.ctx.cameraBindGroup;if(!r)return;const o=t?this.ensureDebugSuiteGlobe():this.ensureDebugSuite2D(),s=new Float32Array(28);s[0]=e[0],s[1]=e[1],s[2]=e[2],s[3]=e[3],s[4]=me[0],s[5]=me[1],s[6]=me[2],s[7]=me[3],s[8]=ge[0],s[9]=ge[1],s[10]=ge[2],s[11]=ge[3],s[12]=xe[0],s[13]=xe[1],s[14]=xe[2],s[15]=xe[3],s[16]=ho,s[17]=fo,s[18]=i?.exaggeration??this.ctx.heightExaggeration,s[19]=o.mesh.subdivisions,s[20]=i?.mode??0,s[24]=i?.terrainUvOffsetScale[0]??0,s[25]=i?.terrainUvOffsetScale[1]??0,s[26]=i?.terrainUvOffsetScale[2]??1,s[27]=i?.terrainUvOffsetScale[3]??1;const a=this.ctx.bufferPool.allocateWithData(s,GPUBufferUsage.UNIFORM,"transient"),l=this.ctx.device.createBindGroup({label:"tile-debug-bind-group",layout:o.bindGroupLayout,entries:[{binding:0,resource:{buffer:a}}]});let c=o.zeroHeightBindGroup;t&&(i?.mode??0)===1?i?.terrainHeightTexture&&(c=this.ctx.device.createBindGroup({label:"tile-debug-terrain-height-bind-group",layout:o.heightBindGroupLayout,entries:[{binding:0,resource:i.terrainHeightTexture.createView()},{binding:1,resource:o.heightSampler}]})):c=this.ctx.heightBrush?.getBindGroup(this.ctx.device)??o.zeroHeightBindGroup;const u=this.ctx.renderPass,d=o.mesh.vertexCount>65535?"uint32":"uint16";u.setPipeline(o.wireframePipeline),u.setBindGroup(0,r),u.setBindGroup(1,l),u.setBindGroup(2,c),u.setVertexBuffer(0,o.mesh.vertexBuffer),u.setIndexBuffer(o.mesh.wireframeIndexBuffer,d),u.drawIndexed(o.mesh.wireframeIndexCount),u.setPipeline(o.borderPipeline),u.setBindGroup(0,r),u.setBindGroup(1,l),u.setBindGroup(2,c),u.draw(24),u.setPipeline(o.dotPipeline),u.setBindGroup(0,r),u.setBindGroup(1,l),u.setBindGroup(2,c),u.setVertexBuffer(0,o.quadBuffer),u.setVertexBuffer(1,o.mesh.vertexBuffer),u.draw(6,o.mesh.vertexCount)}destroy(){this.rasterPipeline=null,this.globeRasterPipeline=null,this.debugSuite2D=null,this.debugSuiteGlobe=null}reset(){this.rasterPipeline=null,this.globeRasterPipeline=null,this.debugSuite2D=null,this.debugSuiteGlobe=null}}function Lt(n,e,t){const i=t.dashArray;if(!i||i.length===0)return;const r=Math.min(i.length,8);let o=0;for(let s=0;s<r;s++){const a=i[s]??0;n[e+s]=a,o+=a}n[e+8]=r,n[e+9]=o}class yn{ctx;getIconAtlas;globePointPipeline=null;globeLinePipeline=null;globePolygonPipeline=null;poleCapPipeline=null;atmospherePipeline=null;globeIconPipeline=null;pointMaterials=new Map;lineMaterials=new Map;polygonMaterials=new Map;iconMaterials=new Map;atmosphereMaterials=new Map;poleCapMaterials=new Map;textureResourceIds=new WeakMap;nextTextureResourceId=0;constructor(e,t){this.ctx=e,this.getIconAtlas=t}ensureGlobePointPipeline(){return this.globePointPipeline||(this.ctx.ensureGlobeCameraResources(),this.globePointPipeline=ro({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globePointPipeline}ensureGlobeLinePipeline(){return this.globeLinePipeline||(this.ctx.ensureGlobeCameraResources(),this.globeLinePipeline=so({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globeLinePipeline}ensureGlobePolygonPipeline(){return this.globePolygonPipeline||(this.ctx.ensureGlobeCameraResources(),this.globePolygonPipeline=co({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globePolygonPipeline}ensurePoleCapPipeline(){return this.poleCapPipeline||(this.ctx.ensureGlobeCameraResources(),this.poleCapPipeline=So({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.poleCapPipeline}ensureAtmospherePipeline(){return this.atmospherePipeline||(this.ctx.ensureGlobeCameraResources(),this.atmospherePipeline=Fo({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,sampleCount:this.ctx.sampleCount})),this.atmospherePipeline}ensureGlobeIconPipeline(){return this.globeIconPipeline||(this.ctx.ensureGlobeCameraResources(),this.globeIconPipeline=Io({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globeIconPipeline}getOrCreateUniformResource(e,t,i,r,o){let s=e.get(t);const a=o||!s;if(!s){const l=this.ctx.bufferPool.allocate(i.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,"persistent");l.label=`${r}:${t}`,s={buffer:l,resourceId:`buf-${l.label??`${r}:${t}`}`},e.set(t,s)}return a&&this.ctx.device.queue.writeBuffer(s.buffer,0,i.buffer,i.byteOffset,i.byteLength),s}getOrCreateBindGroup(e,t,i){return this.ctx.bindGroupCache?.getOrCreate({pipelineId:e,resourceIds:t},i)??i()}releaseUniformResources(e){for(const{buffer:t}of e.values())this.ctx.bufferPool?.release(t);e.clear()}getTextureResourceId(e,t){let i=this.textureResourceIds.get(e);if(!i){const r=e.label?`:${e.label}`:"";i=`tex-${t}-${++this.nextTextureResourceId}${r}`,this.textureResourceIds.set(e,i)}return i}drawGlobePoints(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;if(t.type==="icon"&&t.src){this._drawGlobeIconPoints(e,t);return}const i=this.ensureGlobePointPipeline();if(this.ctx.ensureGlobeCameraWritten(),t.glowColor&&t.glowSize&&t.glowSize>0){const l=new Float32Array(12);l[0]=t.glowColor[0]/255,l[1]=t.glowColor[1]/255,l[2]=t.glowColor[2]/255,l[3]=t.glowColor[3]/255*.35,l[8]=t.size+t.glowSize*2,l[9]=0,l[10]=0,l[11]=1;const c=`glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`,h=this.getOrCreateUniformResource(this.pointMaterials,c,l,"globe-point-material",!1),u=this.getOrCreateBindGroup(`globe-point:${c}`,[h.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-point-glow-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:h.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,u),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}const r=new Float32Array(12);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255,r[4]=(t.outlineColor?.[0]??0)/255,r[5]=(t.outlineColor?.[1]??0)/255,r[6]=(t.outlineColor?.[2]??0)/255,r[7]=(t.outlineColor?.[3]??255)/255,r[8]=t.size,r[9]=t.outlineWidth??0,r[10]=0,r[11]=0;const o=[t.color.join(","),t.outlineColor?.join(",")??"",t.size,t.outlineWidth??0].join(":"),s=this.getOrCreateUniformResource(this.pointMaterials,o,r,"globe-point-material",!1),a=this.getOrCreateBindGroup(`globe-point:${o}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-point-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}drawGlobeLines(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const i=this.ensureGlobeLinePipeline();if(this.ctx.ensureGlobeCameraWritten(),t.glowColor&&t.glowWidth&&t.glowWidth>0){const l=new Float32Array(20);l[0]=t.glowColor[0]/255,l[1]=t.glowColor[1]/255,l[2]=t.glowColor[2]/255,l[3]=t.glowColor[3]/255*.35,l[4]=t.width+t.glowWidth*2,l[5]=Pe(t.style),l[6]=t.dashAnimationSpeed??0,l[7]=this.ctx.frameTime,Lt(l,8,t);const c=["glow",t.glowColor.join(","),t.width,t.glowWidth,t.style,t.dashArray?.join(",")??"",t.dashAnimationSpeed??0].join(":"),h=this.getOrCreateUniformResource(this.lineMaterials,c,l,"globe-line-material",(t.dashAnimationSpeed??0)!==0),u=this.getOrCreateBindGroup(`globe-line:${c}`,[h.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-line-glow-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:h.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,u),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}const r=new Float32Array(20);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255,r[4]=t.width,r[5]=Pe(t.style),r[6]=t.dashAnimationSpeed??0,r[7]=this.ctx.frameTime,Lt(r,8,t);const o=[t.color.join(","),t.width,t.style,t.dashArray?.join(",")??"",t.dashAnimationSpeed??0].join(":"),s=this.getOrCreateUniformResource(this.lineMaterials,o,r,"globe-line-material",(t.dashAnimationSpeed??0)!==0),a=this.getOrCreateBindGroup(`globe-line:${o}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-line-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}drawGlobePolygons(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const i=this.ensureGlobePolygonPipeline();this.ctx.ensureGlobeCameraWritten();const r=new Float32Array(4);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255;const o=t.color.join(","),s=this.getOrCreateUniformResource(this.polygonMaterials,o,r,"globe-polygon-material",!1),a=this.getOrCreateBindGroup(`globe-polygon:${o}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-polygon-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}drawPoleCaps(e){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const t=this.ensurePoleCapPipeline();this.ctx.ensureGlobeCameraWritten();const i=new Float32Array(4);i[0]=e[0],i[1]=e[1],i[2]=e[2],i[3]=e[3];const r=this.getOrCreateUniformResource(this.poleCapMaterials,"default",i,"pole-cap-material",!0),o=this.getOrCreateBindGroup("pole-cap:default",[r.resourceId],()=>this.ctx.device.createBindGroup({label:"pole-cap-color-bind-group",layout:t.poleCapBindGroupLayout,entries:[{binding:0,resource:{buffer:r.buffer}}]}));this.ctx.renderPass.setPipeline(t.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,o),this.ctx.renderPass.setVertexBuffer(0,t.mesh.vertexBuffer),this.ctx.renderPass.setIndexBuffer(t.mesh.indexBuffer,"uint16"),this.ctx.renderPass.drawIndexed(t.mesh.indexCount)}drawAtmosphere(e){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const t=this.ensureAtmospherePipeline();this.ctx.ensureGlobeCameraWritten();const i=new Float32Array(12);i[0]=.35,i[1]=.55,i[2]=1,i[3]=1,i[4]=.6,i[5]=.85,i[6]=1,i[7]=1,i[8]=e,i[9]=1.5;const r=this.getOrCreateUniformResource(this.atmosphereMaterials,"default",i,"atmosphere-material",!0),o=this.getOrCreateBindGroup("atmosphere:default",[r.resourceId],()=>this.ctx.device.createBindGroup({label:"atmosphere-bind-group",layout:t.atmosphereBindGroupLayout,entries:[{binding:0,resource:{buffer:r.buffer}}]}));this.ctx.renderPass.setPipeline(t.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,o),this.ctx.renderPass.setVertexBuffer(0,t.mesh.vertexBuffer),this.ctx.renderPass.setIndexBuffer(t.mesh.indexBuffer,t.mesh.vertexCount>65535?"uint32":"uint16"),this.ctx.renderPass.drawIndexed(t.mesh.indexCount)}_drawGlobeIconPoints(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const i=this.getIconAtlas(),r=i.getSprite(t.src);if(!r)return;const o=i.getTexture();if(!o)return;if(this.ctx.ensureGlobeCameraWritten(),t.glowColor&&t.glowSize&&t.glowSize>0){const f=this.ensureGlobePointPipeline(),g=new Float32Array(12);g[0]=t.glowColor[0]/255,g[1]=t.glowColor[1]/255,g[2]=t.glowColor[2]/255,g[3]=t.glowColor[3]/255*.35,g[8]=t.size+t.glowSize*2,g[9]=0,g[10]=0,g[11]=1;const x=`icon-glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`,v=this.getOrCreateUniformResource(this.pointMaterials,x,g,"globe-point-material",!1),y=this.getOrCreateBindGroup(`globe-icon-glow:${x}`,[v.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-icon-glow-bind-group",layout:f.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:v.buffer}}]}));this.ctx.renderPass.setPipeline(f.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,y),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}const s=this.ensureGlobeIconPipeline(),a=new Float32Array(20);a[0]=t.color[0]/255,a[1]=t.color[1]/255,a[2]=t.color[2]/255,a[3]=t.color[3]/255,a[4]=r.uv[0],a[5]=r.uv[1],a[6]=r.uv[2],a[7]=r.uv[3],a[8]=t.size,a[9]=t.rotation??0,a[10]=(t.backgroundSize??0)/2,a[11]=t.outlineWidth??0;const l=t.backgroundColor;a[12]=l?l[0]/255:0,a[13]=l?l[1]/255:0,a[14]=l?l[2]/255:0,a[15]=l?l[3]/255:0;const c=t.outlineColor;a[16]=c?c[0]/255:0,a[17]=c?c[1]/255:0,a[18]=c?c[2]/255:0,a[19]=c?c[3]/255:0;const h=[t.src??"",t.color.join(","),t.size,t.rotation??0,t.backgroundColor?.join(",")??"",t.backgroundSize??0,t.outlineColor?.join(",")??"",t.outlineWidth??0,r.uv.join(",")].join(":"),u=this.getOrCreateUniformResource(this.iconMaterials,h,a,"globe-icon-material",!1),d=this.getTextureResourceId(o,"sprite-atlas-texture"),p=this.getOrCreateBindGroup(`globe-icon:${h}`,[u.resourceId,d],()=>this.ctx.device.createBindGroup({label:"globe-icon-material-bind-group",layout:s.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:u.buffer}},{binding:1,resource:s.sampler},{binding:2,resource:o.createView()}]}));this.ctx.renderPass.setPipeline(s.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,p),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}destroy(){this.globePointPipeline=null,this.globeLinePipeline=null,this.globePolygonPipeline=null,this.poleCapPipeline=null,this.atmospherePipeline=null,this.globeIconPipeline=null,this.releaseUniformResources(this.pointMaterials),this.releaseUniformResources(this.lineMaterials),this.releaseUniformResources(this.polygonMaterials),this.releaseUniformResources(this.iconMaterials),this.releaseUniformResources(this.atmosphereMaterials),this.releaseUniformResources(this.poleCapMaterials)}reset(){this.destroy()}}function Dt(n,e,t){const i=t.dashArray;if(!i||i.length===0)return;const r=Math.min(i.length,8);let o=0;for(let s=0;s<r;s++){const a=i[s]??0;n[e+s]=a,o+=a}n[e+8]=r,n[e+9]=o}class bn{ctx;getIconAtlas;pointPipeline=null;linePipeline=null;polygonPipeline=null;textPipeline=null;postProcessPipeline=null;iconPipeline=null;pointMaterials=new Map;lineMaterials=new Map;polygonMaterials=new Map;textMaterials=new Map;iconMaterials=new Map;postProcessMaterials=new Map;textureResourceIds=new WeakMap;nextTextureResourceId=0;constructor(e,t){this.ctx=e,this.getIconAtlas=t}ensurePointPipeline(){return this.pointPipeline||(this.pointPipeline=Ir({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.pointPipeline}ensureLinePipeline(){return this.linePipeline||(this.linePipeline=Vr({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.linePipeline}ensurePolygonPipeline(){return this.polygonPipeline||(this.polygonPipeline=Hr({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.polygonPipeline}ensureTextPipeline(){return this.textPipeline||(this.textPipeline=Kr({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.textPipeline}ensurePostProcessPipeline(){return this.postProcessPipeline||(this.postProcessPipeline=Qr({device:this.ctx.device,colorFormat:this.ctx.colorFormat,sampleCount:this.ctx.sampleCount})),this.postProcessPipeline}ensureIconPipeline(){return this.iconPipeline||(this.iconPipeline=Ro({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.iconPipeline}getOrCreateUniformResource(e,t,i,r,o){let s=e.get(t);const a=o||!s;if(!s){const l=this.ctx.bufferPool.allocate(i.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,"persistent");l.label=`${r}:${t}`,s={buffer:l,resourceId:`buf-${l.label??`${r}:${t}`}`},e.set(t,s)}return a&&this.ctx.device.queue.writeBuffer(s.buffer,0,i.buffer,i.byteOffset,i.byteLength),s}getOrCreateBindGroup(e,t,i){return this.ctx.bindGroupCache?.getOrCreate({pipelineId:e,resourceIds:t},i)??i()}releaseUniformResources(e){for(const{buffer:t}of e.values())this.ctx.bufferPool?.release(t);e.clear()}getTextureResourceId(e,t){let i=this.textureResourceIds.get(e);if(!i){const r=e.label?`:${e.label}`:"";i=`tex-${t}-${++this.nextTextureResourceId}${r}`,this.textureResourceIds.set(e,i)}return i}drawPoints(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;if(t.type==="icon"&&t.src){this._drawIconPoints(e,t);return}const i=this.ensurePointPipeline();if(t.glowColor&&t.glowSize&&t.glowSize>0){const l=new Float32Array(12);l[0]=t.glowColor[0]/255,l[1]=t.glowColor[1]/255,l[2]=t.glowColor[2]/255,l[3]=t.glowColor[3]/255*.35,l[8]=t.size+t.glowSize*2,l[9]=0,l[10]=0,l[11]=1;const c=`glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`,h=this.getOrCreateUniformResource(this.pointMaterials,c,l,"point-material",!1),u=this.getOrCreateBindGroup(`point:${c}`,[h.resourceId],()=>this.ctx.device.createBindGroup({label:"point-glow-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:h.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,u),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}const r=new Float32Array(12);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255,r[4]=(t.outlineColor?.[0]??0)/255,r[5]=(t.outlineColor?.[1]??0)/255,r[6]=(t.outlineColor?.[2]??0)/255,r[7]=(t.outlineColor?.[3]??255)/255,r[8]=t.size,r[9]=t.outlineWidth??0,r[10]=(t.type==="simple-marker",0),r[11]=0;const o=[t.color.join(","),t.outlineColor?.join(",")??"",t.size,t.outlineWidth??0].join(":"),s=this.getOrCreateUniformResource(this.pointMaterials,o,r,"point-material",!1),a=this.getOrCreateBindGroup(`point:${o}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"point-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}drawLines(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const i=this.ensureLinePipeline();if(t.glowColor&&t.glowWidth&&t.glowWidth>0){const l=new Float32Array(20);l[0]=t.glowColor[0]/255,l[1]=t.glowColor[1]/255,l[2]=t.glowColor[2]/255,l[3]=t.glowColor[3]/255*.35,l[4]=t.width+t.glowWidth*2,l[5]=Pe(t.style),l[6]=t.dashAnimationSpeed??0,l[7]=this.ctx.frameTime,Dt(l,8,t);const c=["glow",t.glowColor.join(","),t.width,t.glowWidth,t.style,t.dashArray?.join(",")??"",t.dashAnimationSpeed??0].join(":"),h=this.getOrCreateUniformResource(this.lineMaterials,c,l,"line-material",(t.dashAnimationSpeed??0)!==0),u=this.getOrCreateBindGroup(`line:${c}`,[h.resourceId],()=>this.ctx.device.createBindGroup({label:"line-glow-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:h.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,u),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}const r=new Float32Array(20);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255,r[4]=t.width,r[5]=Pe(t.style),r[6]=t.dashAnimationSpeed??0,r[7]=this.ctx.frameTime,Dt(r,8,t);const o=[t.color.join(","),t.width,t.style,t.dashArray?.join(",")??"",t.dashAnimationSpeed??0].join(":"),s=this.getOrCreateUniformResource(this.lineMaterials,o,r,"line-material",(t.dashAnimationSpeed??0)!==0),a=this.getOrCreateBindGroup(`line:${o}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"line-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount),this.ctx.pickingDrawCalls.push({type:"indexed",vertexBuffer:e.vertexBuffer,indexBuffer:e.indexBuffer,indexCount:e.indexCount,layerId:this.ctx.currentLayerId})}drawPolygons(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const i=this.ensurePolygonPipeline(),r=new Float32Array(4);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255;const o=t.color.join(","),s=this.getOrCreateUniformResource(this.polygonMaterials,o,r,"polygon-material",!1),a=this.getOrCreateBindGroup(`polygon:${o}`,[s.resourceId],()=>this.ctx.device.createBindGroup({label:"polygon-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,a),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount),this.ctx.pickingDrawCalls.push({type:"indexed",vertexBuffer:e.vertexBuffer,indexBuffer:e.indexBuffer,indexCount:e.indexCount,layerId:this.ctx.currentLayerId})}drawText(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const i=this.ensureTextPipeline(),r=new Float32Array(12);r[0]=t.color[0]/255,r[1]=t.color[1]/255,r[2]=t.color[2]/255,r[3]=t.color[3]/255,r[4]=(t.haloColor?.[0]??0)/255,r[5]=(t.haloColor?.[1]??0)/255,r[6]=(t.haloColor?.[2]??0)/255,r[7]=(t.haloColor?.[3]??255)/255,r[8]=t.fontSize,r[9]=t.haloWidth??0;const o={center:0,left:1,right:2,top:3,bottom:4};r[10]=o[t.anchor]??0,r[11]=0;const s=[t.color.join(","),t.haloColor?.join(",")??"",t.fontSize,t.haloWidth??0,t.anchor].join(":"),a=this.getOrCreateUniformResource(this.textMaterials,s,r,"text-material",!1),l=this.ctx.placeholderTexture,c=this.getTextureResourceId(l,"placeholder-texture"),h=this.getOrCreateBindGroup(`text:${s}`,[a.resourceId,c],()=>this.ctx.device.createBindGroup({label:"text-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:a.buffer}},{binding:1,resource:i.sampler},{binding:2,resource:l.createView()}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,h),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}drawPostProcess(e){if(!this.ctx.device||!this.ctx.context||!this.ctx.bufferPool)return;const t=this.ensurePostProcessPipeline(),i=this.ctx.canvas?.width||1,r=this.ctx.canvas?.height||1,o=new Float32Array(4);o[0]=1/i,o[1]=1/r,o[2]=.75,o[3]=0;const s=this.getOrCreateUniformResource(this.postProcessMaterials,"default",o,"post-process-material",!0),a=this.getTextureResourceId(e,"post-process-scene"),l=this.getOrCreateBindGroup(`post-process:${i}x${r}`,[s.resourceId,a],()=>this.ctx.device.createBindGroup({label:"post-process-bind-group",layout:t.bindGroupLayout,entries:[{binding:0,resource:{buffer:s.buffer}},{binding:1,resource:t.sampler},{binding:2,resource:e.createView()}]})),c=this.ctx.device.createCommandEncoder({label:"post-process-encoder"}),h=this.ctx.context.getCurrentTexture().createView(),u=c.beginRenderPass({label:"post-process-pass",colorAttachments:[{view:h,loadOp:"load",storeOp:"store"}]});u.setPipeline(t.pipeline),u.setBindGroup(0,l),u.draw(4),u.end(),this.ctx.device.queue.submit([c.finish()])}_drawIconPoints(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const i=this.getIconAtlas(),r=i.getSprite(t.src);if(!r)return;const o=i.getTexture();if(!o)return;if(t.glowColor&&t.glowSize&&t.glowSize>0){const f=this.ensurePointPipeline(),g=new Float32Array(12);g[0]=t.glowColor[0]/255,g[1]=t.glowColor[1]/255,g[2]=t.glowColor[2]/255,g[3]=t.glowColor[3]/255*.35,g[8]=t.size+t.glowSize*2,g[9]=0,g[10]=0,g[11]=1;const x=`icon-glow:${t.glowColor.join(",")}:${t.size}:${t.glowSize}`,v=this.getOrCreateUniformResource(this.pointMaterials,x,g,"point-material",!1),y=this.getOrCreateBindGroup(`icon-glow:${x}`,[v.resourceId],()=>this.ctx.device.createBindGroup({label:"icon-glow-bind-group",layout:f.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:v.buffer}}]}));this.ctx.renderPass.setPipeline(f.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,y),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}const s=this.ensureIconPipeline(),a=new Float32Array(20);a[0]=t.color[0]/255,a[1]=t.color[1]/255,a[2]=t.color[2]/255,a[3]=t.color[3]/255,a[4]=r.uv[0],a[5]=r.uv[1],a[6]=r.uv[2],a[7]=r.uv[3],a[8]=t.size,a[9]=t.rotation??0,a[10]=(t.backgroundSize??0)/2,a[11]=t.outlineWidth??0;const l=t.backgroundColor;a[12]=l?l[0]/255:0,a[13]=l?l[1]/255:0,a[14]=l?l[2]/255:0,a[15]=l?l[3]/255:0;const c=t.outlineColor;a[16]=c?c[0]/255:0,a[17]=c?c[1]/255:0,a[18]=c?c[2]/255:0,a[19]=c?c[3]/255:0;const h=[t.src??"",t.color.join(","),t.size,t.rotation??0,t.backgroundColor?.join(",")??"",t.backgroundSize??0,t.outlineColor?.join(",")??"",t.outlineWidth??0,r.uv.join(",")].join(":"),u=this.getOrCreateUniformResource(this.iconMaterials,h,a,"icon-material",!1),d=this.getTextureResourceId(o,"sprite-atlas-texture"),p=this.getOrCreateBindGroup(`icon:${h}`,[u.resourceId,d],()=>this.ctx.device.createBindGroup({label:"icon-material-bind-group",layout:s.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:u.buffer}},{binding:1,resource:s.sampler},{binding:2,resource:o.createView()}]}));this.ctx.renderPass.setPipeline(s.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,p),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.draw(6,e.count)}loadIcon(e,t){if(!this.ctx.device)return;const i=this.getIconAtlas(),o=new OffscreenCanvas(t.width,t.height).getContext("2d");o.drawImage(t,0,0);const s=o.getImageData(0,0,t.width,t.height),a=new Uint8Array(s.data.buffer);i.addSprite(e,a,t.width,t.height)}destroy(){this.pointPipeline=null,this.linePipeline=null,this.polygonPipeline=null,this.textPipeline=null,this.postProcessPipeline=null,this.iconPipeline=null,this.releaseUniformResources(this.pointMaterials),this.releaseUniformResources(this.lineMaterials),this.releaseUniformResources(this.polygonMaterials),this.releaseUniformResources(this.textMaterials),this.releaseUniformResources(this.iconMaterials),this.releaseUniformResources(this.postProcessMaterials)}reset(){this.destroy()}}class Pn{ctx;modelPipeline=null;globeModelPipeline=null;modelManager=null;constructor(e){this.ctx=e}ensureModelPipeline(){return this.modelPipeline||(this.modelPipeline=ko({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.modelPipeline}ensureGlobeModelPipeline(){return this.globeModelPipeline||(this.ctx.ensureGlobeCameraResources(),this.globeModelPipeline=Wo({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globeModelPipeline}ensureModelManager(){return this.modelManager||(this.modelManager=new Zo(this.ctx.device)),this.modelManager}async loadModel(e,t){if(!this.ctx.device)return;const i=this.ensureModelManager();if(i.has(e))return;const r=t instanceof ArrayBuffer?tn(t):rn(t.json,t.buffers);r.primitives.some(s=>s.imageData.size>0)?await i.uploadAsync(e,r):i.upload(e,r)}drawModels(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const r=this.ensureModelManager().get(t.modelId);if(!r)return;const o=this.ensureModelPipeline(),s=t.tintColor??[255,255,255,255];for(const a of r.primitives){const l=this._createMaterialBindGroup(a,s,o.materialBindGroupLayout,o.sampler);this.ctx.renderPass.setPipeline(o.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,l),this.ctx.renderPass.setVertexBuffer(0,a.vertexBuffer),this.ctx.renderPass.setVertexBuffer(1,e.instanceBuffer),this.ctx.renderPass.setIndexBuffer(a.indexBuffer,a.indexFormat),this.ctx.renderPass.drawIndexed(a.indexCount,e.instanceCount)}}drawGlobeModels(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const r=this.ensureModelManager().get(t.modelId);if(!r)return;const o=this.ensureGlobeModelPipeline();this.ctx.ensureGlobeCameraWritten();const s=t.tintColor??[255,255,255,255];for(const a of r.primitives){const l=this._createMaterialBindGroup(a,s,o.materialBindGroupLayout,o.sampler);this.ctx.renderPass.setPipeline(o.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,l),this.ctx.renderPass.setVertexBuffer(0,a.vertexBuffer),this.ctx.renderPass.setVertexBuffer(1,e.instanceBuffer),this.ctx.renderPass.setIndexBuffer(a.indexBuffer,a.indexFormat),this.ctx.renderPass.drawIndexed(a.indexCount,e.instanceCount)}}destroy(){this.modelPipeline=null,this.globeModelPipeline=null,this.modelManager?.destroy(),this.modelManager=null}reset(){this.modelPipeline=null,this.globeModelPipeline=null,this.modelManager?.destroy(),this.modelManager=null}_createMaterialBindGroup(e,t,i,r){const o=e.material,s=this.ctx.placeholderTexture,a=new Float32Array(20);a[0]=o.baseColorFactor[0],a[1]=o.baseColorFactor[1],a[2]=o.baseColorFactor[2],a[3]=o.baseColorFactor[3],a[4]=t[0]/255,a[5]=t[1]/255,a[6]=t[2]/255,a[7]=t[3]/255,a[8]=o.emissiveFactor[0],a[9]=o.emissiveFactor[1],a[10]=o.emissiveFactor[2],a[11]=o.metallicFactor,a[12]=o.roughnessFactor,a[13]=e.baseColorTexture?1:0,a[14]=e.normalTexture?1:0,a[15]=e.metallicRoughnessTexture?1:0,a[16]=e.occlusionTexture?1:0,a[17]=e.emissiveTexture?1:0,a[18]=o.alphaMode==="MASK"?o.alphaCutoff:0,a[19]=o.unlit?1:0;const l=this.ctx.bufferPool.allocateWithData(a,GPUBufferUsage.UNIFORM,"transient");return this.ctx.device.createBindGroup({label:"model-material-bind-group",layout:i,entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:r},{binding:2,resource:(e.baseColorTexture??s).createView()},{binding:3,resource:(e.normalTexture??s).createView()},{binding:4,resource:(e.metallicRoughnessTexture??s).createView()},{binding:5,resource:(e.occlusionTexture??s).createView()},{binding:6,resource:(e.emissiveTexture??s).createView()}]})}}class Cn{ctx;customPipelines=new Map;customPipelineErrors=new Set;_customDrawDbgCount=0;constructor(e){this.ctx=e}drawCustom(e){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool||this.customPipelineErrors.has(e.pipelineKey))return;e.useGlobeCamera&&!this.ctx.globeCameraBindGroupLayout&&this.ctx.ensureGlobeCameraResources();let t=this.customPipelines.get(e.pipelineKey);if(t)this._customDrawDbgCount<3&&console.log("[CP3-PIPE]",{pipelineKey:e.pipelineKey,cached:!0,useGlobeCamera:e.useGlobeCamera});else try{const l=e.useGlobeCamera&&this.ctx.globeCameraBindGroupLayout?this.ctx.globeCameraBindGroupLayout:this.ctx.cameraBindGroupLayout;this._customDrawDbgCount<3&&(console.log("[CP3-PIPE]",{pipelineKey:e.pipelineKey,cached:!1,useGlobeCamera:e.useGlobeCamera}),console.log("[CP3-CAM]",{globeLayout:!!(e.useGlobeCamera&&this.ctx.globeCameraBindGroupLayout),camLayoutLabel:l.label??"n/a"}),console.log("[CP3-BLEND]",JSON.stringify(e.blendState))),t=zo({device:this.ctx.device,colorFormat:this.ctx.colorFormat,depthFormat:this.ctx.depthConfig.format,cameraBindGroupLayout:l,shaderSource:e.shaderSource,vertexBufferLayouts:e.vertexBufferLayouts,topology:e.topology??"triangle-list",hasCustomUniforms:e.customUniforms!==null,hasTexture:e.textures.length>0,blendState:e.blendState,sampleCount:this.ctx.sampleCount}),this.customPipelines.set(e.pipelineKey,t)}catch(l){console.error(`[mapgpu] Custom pipeline creation failed for key "${e.pipelineKey}":`,l),console.error("[CP3-ERR]",l),this.customPipelineErrors.add(e.pipelineKey);return}const i=this.ctx.bufferPool.allocateWithData(e.frameUniforms,GPUBufferUsage.UNIFORM,"transient"),r=this.ctx.device.createBindGroup({label:"custom-frame-bind-group",layout:t.frameBindGroupLayout,entries:[{binding:0,resource:{buffer:i}}]});let o=null;if(e.customUniforms&&t.customBindGroupLayout){const l=e.customUniforms instanceof Float32Array?e.customUniforms:new Float32Array(e.customUniforms),c=this.ctx.bufferPool.allocateWithData(l,GPUBufferUsage.UNIFORM,"transient");o=this.ctx.device.createBindGroup({label:"custom-user-bind-group",layout:t.customBindGroupLayout,entries:[{binding:0,resource:{buffer:c}}]})}let s=null;if(e.textures.length>0&&t.textureBindGroupLayout){const l=e.textures[0],c=this.ctx.device.createSampler(l.sampler??{magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"});s=this.ctx.device.createBindGroup({label:"custom-texture-bind-group",layout:t.textureBindGroupLayout,entries:[{binding:0,resource:c},{binding:1,resource:l.texture.createView()}]})}this.ctx.renderPass.setPipeline(t.pipeline),e.useGlobeCamera&&this.ctx.globeCameraBindGroup?(this.ctx.ensureGlobeCameraWritten(),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup)):this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,r);let a=2;if(t.customBindGroupLayout&&(o&&this.ctx.renderPass.setBindGroup(a,o),a++),t.textureBindGroupLayout){if(!t.customBindGroupLayout){const l=this.ctx.device.createBindGroupLayout({label:"custom-empty-placeholder",entries:[]}),c=this.ctx.device.createBindGroup({label:"custom-empty-bind-group",layout:l,entries:[]});this.ctx.renderPass.setBindGroup(2,c),a=3}s&&this.ctx.renderPass.setBindGroup(a,s)}this._customDrawDbgCount<3&&(console.log("[CP4-BIND]",{group0:e.useGlobeCamera?"globe":"flat",group1_frameSize:e.frameUniforms.byteLength,group2_customSize:e.customUniforms?(e.customUniforms instanceof ArrayBuffer,e.customUniforms.byteLength):null,group3_texture:e.textures.length>0?"yes":null}),console.log("[CP4-VB]",{bufferCount:e.vertexBuffers.length,bufferSizes:e.vertexBuffers.map(l=>l.size)}),console.log("[CP4-IB]",{hasIndex:!!e.indexBuffer,indexCount:e.indexCount,indexFormat:e.indexFormat}));for(let l=0;l<e.vertexBuffers.length;l++)this.ctx.renderPass.setVertexBuffer(l,e.vertexBuffers[l]);e.indexBuffer?(this.ctx.renderPass.setIndexBuffer(e.indexBuffer,e.indexFormat??"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount??0,e.instanceCount??1),this._customDrawDbgCount<3&&console.log("[CP4-DRAW]",{type:"drawIndexed",indexCount:e.indexCount??0,instanceCount:e.instanceCount??1})):(this.ctx.renderPass.draw(e.vertexCount??0,e.instanceCount??1),this._customDrawDbgCount<3&&console.log("[CP4-DRAW]",{type:"draw",vertexCount:e.vertexCount??0,instanceCount:e.instanceCount??1})),this._customDrawDbgCount<3&&this._customDrawDbgCount++}destroy(){this.customPipelines.clear(),this.customPipelineErrors.clear()}reset(){this.customPipelines.clear(),this.customPipelineErrors.clear()}}class wn{ctx;renderPipeline2D=null;renderPipelineGlobe=null;layerStates=new Map;digitAtlasTexture=null;constructor(e){this.ctx=e}setSource(e,t,i){if(!this.ctx.device)return;const r=this.layerStates.get(e);if(r&&r.sourceVersion===i)return;r?.sourceBuffer.destroy();const o=this.ctx.device.createBuffer({label:`cluster-source-${e}`,size:Math.max(t.byteLength,4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST,mappedAtCreation:!0});new Float32Array(o.getMappedRange()).set(t),o.unmap();const s=r?.countersBuffer??this.ctx.device.createBuffer({label:`cluster-counters-${e}`,size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.INDIRECT});this.layerStates.set(e,{sourceBuffer:o,sourcePoints:t,pointCount:t.length/2,sourceVersion:i,outputBuffer:r?.outputBuffer??null,outputCapacity:r?.outputCapacity??0,countersBuffer:s,lastResult:null,lastZoom:-1,lastExtentKey:"",lastClusterRadius:-1,lastMinClusterPoints:-1})}drawClusters(e,t,i,r,o,s,a){const l=this.layerStates.get(e);if(!l||!this.ctx.device||!this.ctx.renderPass||l.pointCount===0)return;this.digitAtlasTexture||(this.digitAtlasTexture=this._createDigitAtlas());const c=`${s[0]},${s[1]},${s[2]},${s[3]}`,h=Math.max(0,Math.floor(o)),u=h,d=Math.round(i*100);(!l.lastResult||l.lastZoom!==u||l.lastExtentKey!==c||l.lastClusterRadius!==d||l.lastMinClusterPoints!==r)&&(l.lastResult=on(l.sourcePoints,i,h,s,r),l.lastZoom=u,l.lastExtentKey=c,l.lastClusterRadius=d,l.lastMinClusterPoints=r);const p=l.lastResult,f=p.entries.length;if(f===0)return;const g=sn(p.entries);if(!l.outputBuffer||l.outputCapacity<f){l.outputBuffer?.destroy();const m=Math.max(f,64);l.outputBuffer=this.ctx.device.createBuffer({label:`cluster-output-${e}`,size:m*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),l.outputCapacity=m}this.ctx.device.queue.writeBuffer(l.outputBuffer,0,g.buffer);const x=new Uint32Array([6,f,0,0]);this.ctx.device.queue.writeBuffer(l.countersBuffer,0,x.buffer);const v=new Float32Array(36);v[0]=t.clusterFillSmall[0]/255,v[1]=t.clusterFillSmall[1]/255,v[2]=t.clusterFillSmall[2]/255,v[3]=t.clusterFillSmall[3]/255,v[4]=t.clusterFillMedium[0]/255,v[5]=t.clusterFillMedium[1]/255,v[6]=t.clusterFillMedium[2]/255,v[7]=t.clusterFillMedium[3]/255,v[8]=t.clusterFillLarge[0]/255,v[9]=t.clusterFillLarge[1]/255,v[10]=t.clusterFillLarge[2]/255,v[11]=t.clusterFillLarge[3]/255,v[12]=t.clusterStroke[0]/255,v[13]=t.clusterStroke[1]/255,v[14]=t.clusterStroke[2]/255,v[15]=t.clusterStroke[3]/255,v[16]=t.clusterText[0]/255,v[17]=t.clusterText[1]/255,v[18]=t.clusterText[2]/255,v[19]=t.clusterText[3]/255,v[20]=t.pointFill[0]/255,v[21]=t.pointFill[1]/255,v[22]=t.pointFill[2]/255,v[23]=t.pointFill[3]/255,v[24]=t.pointStroke[0]/255,v[25]=t.pointStroke[1]/255,v[26]=t.pointStroke[2]/255,v[27]=t.pointStroke[3]/255,v[28]=t.pointSize,v[29]=t.pointStrokeWidth,v[30]=t.clusterBaseSize,v[31]=t.clusterGrowRate,v[32]=t.clusterStrokeWidth,v[33]=0,v[34]=0,v[35]=0;const y=this.ctx.bufferPool.allocateWithData(v,GPUBufferUsage.UNIFORM,"transient");a?this._drawGlobe(l,y):this._draw2D(l,y)}_draw2D(e,t){if(!this.ctx.device||!this.ctx.renderPass)return;this.renderPipeline2D||(this.renderPipeline2D=cn({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount}));const i=this.ctx.device.createBindGroup({label:"cluster-render-bind-group",layout:this.renderPipeline2D.renderBindGroupLayout,entries:[{binding:0,resource:{buffer:e.outputBuffer}},{binding:1,resource:{buffer:t}},{binding:2,resource:this.digitAtlasTexture.createView()},{binding:3,resource:this.renderPipeline2D.sampler}]});this.ctx.renderPass.setPipeline(this.renderPipeline2D.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,i),this.ctx.renderPass.drawIndirect(e.countersBuffer,0)}_drawGlobe(e,t){if(!this.ctx.device||!this.ctx.renderPass)return;this.ctx.ensureGlobeCameraResources(),this.ctx.ensureGlobeCameraWritten(),this.renderPipelineGlobe||(this.renderPipelineGlobe=hn({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount}));const i=this.ctx.device.createBindGroup({label:"cluster-globe-render-bind-group",layout:this.renderPipelineGlobe.renderBindGroupLayout,entries:[{binding:0,resource:{buffer:e.outputBuffer}},{binding:1,resource:{buffer:t}},{binding:2,resource:this.digitAtlasTexture.createView()},{binding:3,resource:this.renderPipelineGlobe.sampler}]});this.ctx.renderPass.setPipeline(this.renderPipelineGlobe.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,i),this.ctx.renderPass.drawIndirect(e.countersBuffer,0)}_createDigitAtlas(){let r;if(typeof OffscreenCanvas<"u"){const a=new OffscreenCanvas(640,64).getContext("2d");a.clearRect(0,0,640,64),a.font='700 46px "Roboto Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif',a.textAlign="center",a.textBaseline="middle",a.lineJoin="round",a.lineCap="round",a.lineWidth=7,a.strokeStyle="rgba(4, 10, 20, 0.92)",a.fillStyle="white";for(let u=0;u<10;u++){const d=u*64+32,p=64*.52,f=String(u);a.strokeText(f,d,p),a.fillText(f,d,p)}const l=a.getImageData(0,0,640,64),c=new Uint8Array(l.data.buffer);r=new Uint8Array(c.length);const h=640*4;for(let u=0;u<64;u++){const d=u*h,p=(63-u)*h;r.set(c.subarray(d,d+h),p)}}else r=this._createBitmapDigitAtlas(640,64,64);const o=this.ctx.device.createTexture({label:"cluster-digit-atlas",size:{width:640,height:64},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});return this.ctx.device.queue.writeTexture({texture:o},r.buffer,{bytesPerRow:640*4},{width:640,height:64}),o}_createBitmapDigitAtlas(e,t,i){const r=new Uint8Array(e*t*4),o=[[14,17,19,21,25,17,14],[4,12,4,4,4,4,14],[14,17,1,6,8,16,31],[14,17,1,6,1,17,14],[2,6,10,18,31,2,2],[31,16,30,1,1,17,14],[6,8,16,30,17,17,14],[31,1,2,4,8,8,8],[14,17,17,14,17,17,14],[14,17,17,15,1,2,12]],s=Math.max(3,Math.floor(i/9)),a=5*s,l=7*s;for(let c=0;c<10;c++){const h=o[c],d=c*i+Math.floor((i-a)/2),p=Math.floor((t-l)/2);for(let f=0;f<7;f++){const g=h[f];for(let x=0;x<5;x++)if(g&1<<4-x)for(let v=0;v<s;v++)for(let y=0;y<s;y++){const m=d+x*s+y,_=p+f*s+v,b=t-1-_;if(m<e&&b>=0&&b<t){const C=(b*e+m)*4;r[C]=255,r[C+1]=255,r[C+2]=255,r[C+3]=255}}}}return r}destroy(){for(const e of this.layerStates.values())e.sourceBuffer.destroy(),e.outputBuffer?.destroy(),e.countersBuffer.destroy();this.layerStates.clear(),this.digitAtlasTexture?.destroy(),this.digitAtlasTexture=null,this.renderPipeline2D=null,this.renderPipelineGlobe=null}}class Mn{ctx;extrusionPipeline=null;globeExtrusionPipeline=null;extrusionMaterials=new Map;globeExtrusionMaterials=new Map;animState=new Map;animCompleted=new Set;constructor(e){this.ctx=e}ensureExtrusionPipeline(){return this.extrusionPipeline||(this.extrusionPipeline=pn({device:this.ctx.device,colorFormat:this.ctx.colorFormat,cameraBindGroupLayout:this.ctx.cameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.extrusionPipeline}ensureGlobeExtrusionPipeline(){return this.globeExtrusionPipeline||(this.ctx.ensureGlobeCameraResources(),this.globeExtrusionPipeline=xn({device:this.ctx.device,colorFormat:this.ctx.colorFormat,globeCameraBindGroupLayout:this.ctx.globeCameraBindGroupLayout,depthFormat:this.ctx.depthConfig.format,depthCompare:this.ctx.depthConfig.compareFunc,sampleCount:this.ctx.sampleCount})),this.globeExtrusionPipeline}drawExtrusion(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.cameraBindGroup||!this.ctx.bufferPool)return;const i=this.ensureExtrusionPipeline(),r=this._createMaterialResource(this.extrusionMaterials,t,"extrusion-material",e),o=this.getOrCreateBindGroup(`extrusion:${t.color.join(",")}:${t.ambient??.35}`,[r.resourceId],()=>this.ctx.device.createBindGroup({label:"extrusion-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:r.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.cameraBindGroup),this.ctx.renderPass.setBindGroup(1,o),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}drawGlobeExtrusion(e,t){if(!this.ctx.device||!this.ctx.renderPass||!this.ctx.bufferPool)return;const i=this.ensureGlobeExtrusionPipeline();this.ctx.ensureGlobeCameraWritten();const r=this._createMaterialResource(this.globeExtrusionMaterials,t,"globe-extrusion-material",e,!0),o=this.getOrCreateBindGroup(`globe-extrusion:${t.color.join(",")}:${t.ambient??.35}`,[r.resourceId],()=>this.ctx.device.createBindGroup({label:"globe-extrusion-material-bind-group",layout:i.materialBindGroupLayout,entries:[{binding:0,resource:{buffer:r.buffer}}]}));this.ctx.renderPass.setPipeline(i.pipeline),this.ctx.renderPass.setBindGroup(0,this.ctx.globeCameraBindGroup),this.ctx.renderPass.setBindGroup(1,o),this.ctx.renderPass.setVertexBuffer(0,e.vertexBuffer),this.ctx.renderPass.setIndexBuffer(e.indexBuffer,"uint32"),this.ctx.renderPass.drawIndexed(e.indexCount)}_createMaterialResource(e,t,i,r,o=!1){const s=this.ctx.extrusionDebugMode?1:0,a=t.animation,l=a?(a.duration??800)/1e3:0,c=a?.delayFactor??2,h=this.ctx.currentCamera;let u=0;h&&(u=Math.atan2(h.viewMatrix[1],h.viewMatrix[0]));let d=0,p=.5,f=.5;const g=r.id??`buf:${r.vertexBuffer.label??String(this.animState.size)}`;let x=l;if(l>0&&this.animCompleted.has(g)&&(x=0),x>0){let C=this.animState.get(g);if(!C){if(h){const P=2003750834e-2;p=(h.position[0]+P)/(2*P),f=1-(h.position[1]+P)/(2*P)}C={startTime:this.ctx.frameTime,origin:[p,f]},this.animState.set(g,C)}d=this.ctx.frameTime-C.startTime,p=C.origin[0],f=C.origin[1];const M=1.4142*c;d<x+M?this.ctx.needsContinuousRender=!0:this.animCompleted.add(g)}const v=x>0&&this.ctx.needsContinuousRender,y=t.color.join(","),m=v?`${i}:anim:${g}:${y}:${this.ctx.frameTime}`:[y,t.ambient??.35,s].join(":"),_=o?20:16,b=new Float32Array(_);return b[0]=t.color[0]/255,b[1]=t.color[1]/255,b[2]=t.color[2]/255,b[3]=t.color[3]/255,b[4]=t.ambient??.35,b[5]=s,b[6]=d,b[7]=x,b[8]=p,b[9]=f,b[10]=c,b[11]=o?0:u,b[12]=t.shininess??32,b[13]=t.specularStrength??.15,o&&h?.cameraMerc01&&(b[16]=h.cameraMerc01[0],b[17]=h.cameraMerc01[1],b[18]=h.cameraMerc01[2]),this.getOrCreateMaterialResource(e,m,b,i)}getOrCreateMaterialResource(e,t,i,r){let o=e.get(t);if(!o){const s=this.ctx.bufferPool.allocate(i.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,"persistent");s.label=`${r}:${t}`,o={buffer:s,resourceId:`buf-${s.label??`${r}:${t}`}`},e.set(t,o)}return this.ctx.device.queue.writeBuffer(o.buffer,0,i.buffer,i.byteOffset,i.byteLength),o}getOrCreateBindGroup(e,t,i){return this.ctx.bindGroupCache?.getOrCreate({pipelineId:e,resourceIds:t},i)??i()}releaseMaterials(e){for(const{buffer:t}of e.values())this.ctx.bufferPool?.release(t);e.clear()}destroy(){this.extrusionPipeline=null,this.globeExtrusionPipeline=null,this.releaseMaterials(this.extrusionMaterials),this.releaseMaterials(this.globeExtrusionMaterials),this.animState.clear(),this.animCompleted.clear()}}class Gn{ctx=new Er;_capabilities=null;textureManager=null;bindGroupCache=null;iconAtlas=null;pickingDelegate=null;rasterDelegate=null;globeDelegate=null;vectorDelegate=null;modelDelegate=null;customDelegate=null;clusterDelegate=null;extrusionDelegate=null;_clearColor={r:.05,g:.05,b:.1,a:1};get capabilities(){if(!this._capabilities)throw new Error("[mapgpu] RenderEngine not initialized. Call init() first.");return this._capabilities}get depthConfig(){return this.ctx.depthConfig}get needsContinuousRender(){return this.ctx.needsContinuousRender}ensureIconAtlas(){return this.iconAtlas||(this.iconAtlas=new eo(this.ctx.device)),this.iconAtlas}async init(e,t){this.ctx.canvas=e,this.ctx.depthConfig=t??Ie;const i=await gr();if(!i.device||!i.adapter)return this._capabilities={mode:i.mode,features:i.features,limits:i.limits},this._capabilities;this.ctx.device=i.device,this.ctx.device.lost.then(o=>{o.reason!=="destroyed"&&(this.ctx.deviceLost=!0,console.error(`[mapgpu] GPU device lost: ${o.reason} — ${o.message}`))}),this.ctx.device.addEventListener("uncapturederror",o=>{console.error("[mapgpu] GPU VALIDATION ERROR:",o.error.message)}),this.ctx.context=e.getContext("webgpu"),this.ctx.colorFormat=navigator.gpu.getPreferredCanvasFormat(),this.ctx.context.configure({device:this.ctx.device,format:this.ctx.colorFormat,alphaMode:"premultiplied"}),this.ctx.bufferPool=new vr(this.ctx.device),this.textureManager=new _r(this.ctx.device),this.bindGroupCache=new yr,this.ctx.bindGroupCache=this.bindGroupCache,this.ctx.cameraBuffer=this.ctx.bufferPool.allocate(Br,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,"persistent"),this.ctx.cameraBindGroupLayout=Lr(this.ctx.device),this.ctx.cameraBindGroup=this.ctx.device.createBindGroup({label:"camera-bind-group",layout:this.ctx.cameraBindGroupLayout,entries:[{binding:0,resource:{buffer:this.ctx.cameraBuffer}}]}),this.ctx.msaaColorTexture=this.ctx.device.createTexture({label:"msaa-color-texture",size:{width:e.width||1,height:e.height||1},format:this.ctx.colorFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT,sampleCount:this.ctx.sampleCount}),this.ctx.depthTexture=this.ctx.device.createTexture({label:"main-depth-texture",size:{width:e.width||1,height:e.height||1},format:this.ctx.depthConfig.format,usage:GPUTextureUsage.RENDER_ATTACHMENT,sampleCount:this.ctx.sampleCount}),this.ctx.placeholderTexture=this.ctx.device.createTexture({label:"placeholder-texture",size:{width:1,height:1},format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.ctx.device.queue.writeTexture({texture:this.ctx.placeholderTexture},new Uint8Array([255,255,255,255]),{bytesPerRow:4},{width:1,height:1});const r=()=>this.ensureIconAtlas();return this.pickingDelegate=new vn(this.ctx),this.rasterDelegate=new _n(this.ctx),this.globeDelegate=new yn(this.ctx,r),this.vectorDelegate=new bn(this.ctx,r),this.modelDelegate=new Pn(this.ctx),this.customDelegate=new Cn(this.ctx),this.clusterDelegate=new wn(this.ctx),this.extrusionDelegate=new Mn(this.ctx),this.rasterDelegate.initRasterPipeline(),this._capabilities={mode:i.mode,features:i.features,limits:i.limits},this._capabilities}setClearColor(e,t,i,r){this._clearColor={r:e,g:t,b:i,a:r}}setDebugTileVertices(e){this.ctx.debugTileVertices=e}setExtrusionDebug(e){this.ctx.extrusionDebugMode=e}setLighting(e){this.ctx.lightConfig=e}applyDebugBrush(e,t,i,r,o){if(this.ctx.device){if(!this.ctx.heightBrush){const s=Pr(this.ctx.device);this.ctx.heightBrush=new br(this.ctx.device,s)}this.ctx.heightBrush.apply(e,t,i,r,o)}}clearDebugBrush(){this.ctx.heightBrush?.clear()}setHeightExaggeration(e){this.ctx.heightExaggeration=e}beginFrame(e){if(!this.ctx.device||!this.ctx.context||this.ctx.deviceLost)return;this.ctx.frameTime+=1/60,this.ctx.needsContinuousRender=!1,this.ctx.pickingDrawCalls=[],this.ctx.currentCamera=e;const t=Qt(e.projectionMatrix,e.viewMatrix),i=new Float32Array(20);if(i.set(t,0),i[16]=e.viewportWidth,i[17]=e.viewportHeight,this.ctx.device.queue.writeBuffer(this.ctx.cameraBuffer,0,i.buffer),this.ctx.globeCameraBuffer&&e.projectionTransition!==void 0){const l=new Float32Array(40);l.set(t,0),e.flatViewProjectionMatrix&&l.set(e.flatViewProjectionMatrix,16),l[32]=e.viewportWidth,l[33]=e.viewportHeight,l[34]=e.projectionTransition,l[35]=e.globeRadius??1,e.clippingPlane&&(l[36]=e.clippingPlane[0],l[37]=e.clippingPlane[1],l[38]=e.clippingPlane[2],l[39]=e.clippingPlane[3]),this.ctx.device.queue.writeBuffer(this.ctx.globeCameraBuffer,0,l.buffer)}this.ctx.heightBrush?.flush(this.ctx.device);const r=this.ctx.canvas?.width||1,o=this.ctx.canvas?.height||1;this.ctx.depthTexture&&(this.ctx.depthTexture.width!==r||this.ctx.depthTexture.height!==o)&&(this.ctx.depthTexture.destroy(),this.ctx.depthTexture=this.ctx.device.createTexture({label:"main-depth-texture",size:{width:r,height:o},format:this.ctx.depthConfig.format,usage:GPUTextureUsage.RENDER_ATTACHMENT,sampleCount:this.ctx.sampleCount}),this.ctx.msaaColorTexture&&(this.ctx.msaaColorTexture.destroy(),this.ctx.msaaColorTexture=this.ctx.device.createTexture({label:"msaa-color-texture",size:{width:r,height:o},format:this.ctx.colorFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT,sampleCount:this.ctx.sampleCount}))),this.ctx.commandEncoder=this.ctx.device.createCommandEncoder({label:"frame-command-encoder"});const s=this.ctx.context.getCurrentTexture().createView(),a=this.ctx.msaaColorTexture?.createView();this.ctx.renderPass=this.ctx.commandEncoder.beginRenderPass({label:"main-render-pass",colorAttachments:[a?{view:a,resolveTarget:s,clearValue:this._clearColor,loadOp:"clear",storeOp:"discard"}:{view:s,clearValue:this._clearColor,loadOp:"clear",storeOp:"store"}],depthStencilAttachment:this.ctx.depthTexture?{view:this.ctx.depthTexture.createView(),depthClearValue:this.ctx.depthConfig.clearValue,depthLoadOp:"clear",depthStoreOp:"store"}:void 0})}drawImagery(e){this.rasterDelegate?.drawImagery(e)}drawGlobeTile(e){this.rasterDelegate?.drawGlobeTile(e)}drawPoleCaps(e){this.globeDelegate?.drawPoleCaps(e)}drawAtmosphere(e){this.globeDelegate?.drawAtmosphere(e)}drawGlobePoints(e,t){this.globeDelegate?.drawGlobePoints(e,t)}drawGlobeLines(e,t){this.globeDelegate?.drawGlobeLines(e,t)}drawGlobePolygons(e,t){this.globeDelegate?.drawGlobePolygons(e,t)}drawPoints(e,t){this.vectorDelegate?.drawPoints(e,t)}drawLines(e,t){this.vectorDelegate?.drawLines(e,t)}drawPolygons(e,t){this.vectorDelegate?.drawPolygons(e,t)}drawText(e,t){this.vectorDelegate?.drawText(e,t)}drawPostProcess(e){this.vectorDelegate?.drawPostProcess(e)}drawCustom(e){this.customDelegate?.drawCustom(e)}async loadModel(e,t){await this.modelDelegate?.loadModel(e,t)}drawModels(e,t){this.modelDelegate?.drawModels(e,t)}drawGlobeModels(e,t){this.modelDelegate?.drawGlobeModels(e,t)}drawExtrusion(e,t){this.extrusionDelegate?.drawExtrusion(e,t)}drawGlobeExtrusion(e,t){this.extrusionDelegate?.drawGlobeExtrusion(e,t)}setClusterSource(e,t,i){this.clusterDelegate?.setSource(e,t,i)}drawClusters(e,t,i,r,o,s,a){this.clusterDelegate?.drawClusters(e,t,i,r,o,s,a)}loadIcon(e,t){this.vectorDelegate?.loadIcon(e,t)}setCurrentLayerId(e){this.ctx.currentLayerId=e}setPickingEnabled(e){this.ctx.pickingEnabled=e}async pick(e,t){return this.ctx.pickingEnabled?this.pickingDelegate?.pick(e,t)??null:null}endFrame(){if(!this.ctx.device||!this.ctx.commandEncoder||!this.ctx.renderPass)return;this.ctx.renderPass.end();const e=this.ctx.commandEncoder.finish();this.ctx.device.queue.submit([e]),this.ctx.commandEncoder=null,this.ctx.renderPass=null,this.ctx.bufferPool?.releaseTransient()}createTexture(e){if(!this.textureManager)throw new Error("[mapgpu] RenderEngine not initialized.");return this.textureManager.createFromImageBitmap(e)}createBuffer(e,t){if(!this.ctx.bufferPool)throw new Error("[mapgpu] RenderEngine not initialized.");return this.ctx.bufferPool.allocateWithData(e,t,"persistent")}writeBuffer(e,t,i){this.ctx.device&&this.ctx.device.queue.writeBuffer(e,t,i.buffer,i.byteOffset,i.byteLength)}releaseBuffer(e){this.ctx.bufferPool?.release(e),this.bindGroupCache?.invalidate(`buf-${e.label??"unknown"}`)}releaseTexture(e){this.textureManager?.release(e),this.bindGroupCache?.invalidate(`tex-${e.label??"unknown"}`)}createFloat32Texture(e,t,i){if(!this.textureManager)throw new Error("RenderEngine not initialized");return this.textureManager.createFromFloat32(e,t,i)}createUint8Texture(e,t,i){if(!this.textureManager)throw new Error("RenderEngine not initialized");return this.textureManager.createFromUint8(e,t,i)}createRGBA8Texture(e,t,i){if(!this.textureManager)throw new Error("RenderEngine not initialized");return this.textureManager.createFromRGBA8(e,t,i)}getMemoryAccounting(){const e=this.ctx.bufferPool?.getMemoryAccounting()??{persistentBufferBytes:0,transientBufferBytes:0},t=this.textureManager?.textureBytes??0;return{persistentBufferBytes:e.persistentBufferBytes,transientBufferBytes:e.transientBufferBytes,textureBytes:t,totalTrackedBytes:e.persistentBufferBytes+e.transientBufferBytes+t}}async recover(e){if(!this.ctx.canvas)throw new Error("[mapgpu] Cannot recover: no canvas reference.");this.pickingDelegate?.destroy(),this.rasterDelegate?.destroy(),this.globeDelegate?.destroy(),this.vectorDelegate?.destroy(),this.modelDelegate?.destroy(),this.customDelegate?.destroy(),this.clusterDelegate?.destroy(),this.extrusionDelegate?.destroy(),this.pickingDelegate=null,this.rasterDelegate=null,this.globeDelegate=null,this.vectorDelegate=null,this.modelDelegate=null,this.customDelegate=null,this.clusterDelegate=null,this.extrusionDelegate=null,this.ctx.bufferPool=null,this.textureManager=null,this.bindGroupCache=null,this.ctx.bindGroupCache=null,this.iconAtlas=null,this.ctx.globeCameraBuffer=null,this.ctx.globeCameraBindGroup=null,this.ctx.globeCameraBindGroupLayout=null,this.ctx.cameraBuffer=null,this.ctx.cameraBindGroup=null,this.ctx.cameraBindGroupLayout=null,this.ctx.commandEncoder=null,this.ctx.renderPass=null,this.ctx.depthTexture=null,this.ctx.msaaColorTexture=null,this.ctx.placeholderTexture=null,this.ctx.device=null,this.ctx.context=null,this.ctx.deviceLost=!1,this.ctx.pickingDrawCalls=[],await this.init(this.ctx.canvas,e??this.ctx.depthConfig)}destroy(){this.ctx.renderPass=null,this.ctx.commandEncoder=null,this.ctx.bufferPool?.destroy(),this.ctx.bufferPool=null,this.textureManager?.destroy(),this.textureManager=null,this.bindGroupCache?.clear(),this.bindGroupCache=null,this.ctx.bindGroupCache=null,this.pickingDelegate?.destroy(),this.rasterDelegate?.destroy(),this.globeDelegate?.destroy(),this.vectorDelegate?.destroy(),this.modelDelegate?.destroy(),this.customDelegate?.destroy(),this.clusterDelegate?.destroy(),this.extrusionDelegate?.destroy(),this.pickingDelegate=null,this.rasterDelegate=null,this.globeDelegate=null,this.vectorDelegate=null,this.modelDelegate=null,this.customDelegate=null,this.clusterDelegate=null,this.extrusionDelegate=null,this.iconAtlas=null,this.ctx.globeCameraBuffer=null,this.ctx.globeCameraBindGroup=null,this.ctx.globeCameraBindGroupLayout=null,this.ctx.depthTexture?.destroy(),this.ctx.depthTexture=null,this.ctx.msaaColorTexture?.destroy(),this.ctx.msaaColorTexture=null,this.ctx.placeholderTexture?.destroy(),this.ctx.placeholderTexture=null,this.ctx.cameraBuffer=null,this.ctx.cameraBindGroup=null,this.ctx.cameraBindGroupLayout=null,this.ctx.context?.unconfigure(),this.ctx.context=null,this.ctx.device?.destroy(),this.ctx.device=null,this._capabilities=null,this.ctx.canvas=null,this.ctx.deviceLost=!1,this.ctx.pickingDrawCalls=[]}}let Rt=0;function Sn(n){return Rt+=1,`${n}-${Rt}`}class Tn{id;_visible;_opacity;_loaded=!1;_destroyed=!1;minScale;maxScale;zIndex;interactive;blendMode;filters;_fullExtent;eventBus=new Q;constructor(e={}){this.id=e.id??Sn("layer"),this._visible=e.visible??!0,this._opacity=e.opacity??1,this.minScale=e.minScale,this.maxScale=e.maxScale,this.zIndex=e.zIndex,this.interactive=e.interactive??!0,this.blendMode=e.blendMode??"normal",this.filters=e.filters}get visible(){return this._visible}set visible(e){this._visible!==e&&(this._visible=e,this.eventBus.emit("visibility-change",e))}get opacity(){return this._opacity}set opacity(e){const t=Math.max(0,Math.min(1,e));this._opacity!==t&&(this._opacity=t,this.eventBus.emit("opacity-change",t))}get loaded(){return this._loaded}setLoaded(e){this._loaded=e}get fullExtent(){return this._fullExtent}async load(){if(!this._loaded){if(this._destroyed)throw new Error(`Layer "${this.id}" has been destroyed and cannot be loaded.`);try{await this.onLoad(),this._loaded=!0,this.eventBus.emit("load",void 0)}catch(e){const t={code:"LAYER_LOAD_FAILED",message:e instanceof Error?e.message:String(e),cause:e instanceof Error?e:new Error(String(e))};throw this.eventBus.emit("error",t),e}}}refresh(){this.eventBus.emit("refresh",void 0)}redraw(){this.eventBus.emit("refresh",void 0)}destroy(){this._destroyed||(this._destroyed=!0,this._loaded=!1,this.eventBus.removeAll())}on(e,t){this.eventBus.on(e,t)}off(e,t){this.eventBus.off(e,t)}}class En extends Tn{type="raster-tile";urlTemplate;tms;subdomains;minZoom;maxZoom;attribution;subdomainIndex=0;constructor(e){if(super(e),!e.urlTemplate)throw new Error("RasterTileLayer requires a urlTemplate option.");this.urlTemplate=e.urlTemplate,this.tms=e.tms??!1,this.subdomains=e.subdomains??[],this.minZoom=e.minZoom??0,this.maxZoom=e.maxZoom??22,this.attribution=e.attribution,this._fullExtent={minX:-180,minY:-85.0511287798,maxX:180,maxY:85.0511287798}}async onLoad(){this.validateTemplate()}validateTemplate(){const e=this.urlTemplate.includes("{z}"),t=this.urlTemplate.includes("{x}"),i=this.urlTemplate.includes("{y}");if(!e||!t||!i)throw new Error("RasterTileLayer urlTemplate must contain {z}, {x}, and {y} placeholders.");if(this.urlTemplate.includes("{s}")&&this.subdomains.length===0)throw new Error("RasterTileLayer urlTemplate contains {s} but no subdomains were provided.")}getTileUrl(e,t,i){let r=this.urlTemplate;const o=this.tms?(1<<e)-1-i:i;if(r=r.replace("{z}",String(e)),r=r.replace("{x}",String(t)),r=r.replace("{y}",String(o)),this.subdomains.length>0&&r.includes("{s}")){const s=this.subdomains[this.subdomainIndex%this.subdomains.length];this.subdomainIndex=(this.subdomainIndex+1)%this.subdomains.length,r=r.replace("{s}",s)}return r}isZoomValid(e){return e>=this.minZoom&&e<=this.maxZoom}get fullExtent(){return this._fullExtent}}typeof TextDecoder>"u"||new TextDecoder("utf-8");export{Q as E,Tn as L,Bn as M,Gn as R,En as a,ye as b,on as g,q as l,Ke as m,tn as p};
