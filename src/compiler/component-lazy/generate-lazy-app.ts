import * as d from '../../declarations';
import { bundleApp } from '../app-core/bundle-app-core';
import { getBuildFeatures, updateBuildConditionals } from '../app-core/build-conditionals';
import { isOutputTargetHydrate } from '../output-targets/output-utils';
import { generateEsm } from './generate-esm';
import { generateEsmBrowser } from './generate-esm-browser';

import { generateSystem } from './generate-system';
import { generateCjs } from './generate-cjs';
import { generateModuleGraph } from '../entries/component-graph';

export async function generateLazyLoadedApp(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTargets: d.OutputTargetDistLazy[]) {
  const timespan = buildCtx.createTimeSpan(`bundling components started`);

  const cmps = buildCtx.components;
  const build = getBuildConditionals(config, cmps);
  const rollupBuild = await bundleLazyApp(config, compilerCtx, buildCtx, build);
  if (buildCtx.hasError) {
    return;
  }

  await buildCtx.stylesPromise;

  const [componentBundle] = await Promise.all([
    generateEsmBrowser(config, compilerCtx, buildCtx, build, rollupBuild, outputTargets),
    generateEsm(config, compilerCtx, buildCtx, rollupBuild, outputTargets),
    generateSystem(config, compilerCtx, buildCtx, build, rollupBuild, outputTargets),
    generateCjs(config, compilerCtx, buildCtx, build, rollupBuild, outputTargets),
  ]);

  timespan.finish(`bundling components finished`);
  buildCtx.componentGraph = generateModuleGraph(buildCtx.components, componentBundle);
}

function getBuildConditionals(config: d.Config, cmps: d.ComponentCompilerMeta[]) {
  const build = getBuildFeatures(cmps) as d.Build;

  build.lazyLoad = true;
  build.hydrateServerSide = false;
  build.cssVarShim = true;

  const hasHydrateOutputTargets = config.outputTargets.some(isOutputTargetHydrate);
  build.hydrateClientSide = hasHydrateOutputTargets;

  updateBuildConditionals(config, build);

  return build;
}

async function bundleLazyApp(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, build: d.Build) {
  const loader: any = {
    '@core-entrypoint': BROWSER_ENTRY,
    '@external-entrypoint': EXTERNAL_ENTRY,
  };

  // Provide an empty index.js if the projects does not provide one
  const usersIndexJsPath = config.sys.path.join(config.srcDir, 'index.js');
  const hasUserDefinedIndex = await compilerCtx.fs.access(usersIndexJsPath);
  if (!hasUserDefinedIndex) {
    // We can use the loader rollup plugin to inject content to the "index" chunk
    loader[usersIndexJsPath] = `//! Autogenerated index`;
  }

  const bundleAppOptions: d.BundleAppOptions = {
    loader,
    inputs: {
      [config.fsNamespace]: '@core-entrypoint',
      'loader': '@external-entrypoint',
      'index': usersIndexJsPath
    },
    emitCoreChunk: true,
    cache: compilerCtx.rollupCacheLazy
  };

  buildCtx.entryModules.forEach(entryModule => {
    bundleAppOptions.inputs[entryModule.entryKey] = entryModule.entryKey;
  });

  const rollupBuild = await bundleApp(config, compilerCtx, buildCtx, build, bundleAppOptions);
  if (rollupBuild != null) {
    compilerCtx.rollupCacheLazy = rollupBuild.cache;
  } else {
    compilerCtx.rollupCacheLazy = null;
  }
  return rollupBuild;
}

const BROWSER_ENTRY = `
import { bootstrapLazy, patchBrowser } from '@stencil/core';
patchBrowser().then(resourcesUrl => {
  bootstrapLazy([/*!__STENCIL_LAZY_DATA__*/], { resourcesUrl });
});
`;

// This is for webpack
const EXTERNAL_ENTRY = `
import { bootstrapLazy, patchEsm } from '@stencil/core';

export const defineCustomElements = (win, options) => {
  patchEsm().then(() => {
    return bootstrapLazy([/*!__STENCIL_LAZY_DATA__*/], options);
  });
};
`;
