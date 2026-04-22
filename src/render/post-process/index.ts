/**
 * Post-Processing Effects Module
 */

export {
  resolvePostProcessConfig,
} from './PostProcessTypes.js';
export type {
  PostProcessConfig,
  PostProcessPassConfig,
  ResolvedPostProcessConfig,
} from './PostProcessTypes.js';

export { BLOOM_SHADER_SOURCE, createDefaultBloomState } from './BloomPass.js';
export type { BloomPassState } from './BloomPass.js';

export { HDR_SHADER_SOURCE, createDefaultHDRState } from './HDRPass.js';
export type { HDRPassState } from './HDRPass.js';

export { SSAO_SHADER_SOURCE, createDefaultSSAOState } from './SSAOPass.js';
export type { SSAOPassState } from './SSAOPass.js';
