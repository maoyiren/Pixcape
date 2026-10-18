(() => {
  'use strict';

  const IMPORT_EVENT = 'pixcape:import-preset';
  const RESULT_EVENT = 'pixcape:import-complete';
  let language = 'zh-CN';
  let importing = false;

  function reply(source, payload) {
    source.postMessage({ type: RESULT_EVENT, ...payload }, window.location.origin);
  }

  function isSkinProject() {
    const project = window.Project;
    const format = project && project.format;
    return Boolean(project && format && (format.id === 'skin' || format.id === 'minecraft_skin' || format.name === 'Minecraft Skin'));
  }

  function waitForRuntime(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        const ready = typeof window.newProject === 'function'
          && typeof window.Texture === 'function'
          && window.Formats
          && window.Formats.skin;
        if (ready) {
          window.clearInterval(timer);
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          window.clearInterval(timer);
          reject(new Error('Blockbench 编辑器尚未初始化完成，请稍后重试。'));
        }
      }, 100);
    });
  }

  async function importPreset(source, payload) {
    if (importing) {
      reply(source, { ok: false, error: '正在导入，请稍候再试。' });
      return;
    }
    importing = true;
    try {
      if (!payload || typeof payload.skinDataUrl !== 'string' || !payload.skinDataUrl.startsWith('data:image/png;base64,')) {
        throw new Error('预制皮肤数据无效：需要 PNG data URL。');
      }
      if (payload.modelType !== 'steve' && payload.modelType !== 'alex') {
        throw new Error('角色模型类型无效，应为 Steve 或 Alex。');
      }

      await waitForRuntime();

      // Create a skin project only when needed. Avoid calling Texture.add()
      // against an undefined project/texture collection, which can surface as
      // an internal "reading includes" exception in Blockbench.
      if (!isSkinProject()) {
        window.newProject('skin');
      }

      const started = Date.now();
      while ((!window.Project || !window.Project.textures || !window.Project.format) && Date.now() - started < 5000) {
        await new Promise(resolve => window.setTimeout(resolve, 50));
      }
      if (!window.Project || !window.Project.textures || !window.Project.format) {
        throw new Error('无法创建 Minecraft 皮肤项目，请在 Blockbench 中先选择“Minecraft 皮肤”格式后重试。');
      }

      const texture = new window.Texture({ name: payload.skinName || 'pixcape-skin.png' });
      if (typeof texture.fromDataURL !== 'function' || typeof texture.add !== 'function') {
        throw new Error('当前 Blockbench 版本不支持从 PNG data URL 导入纹理。');
      }
      texture.fromDataURL(payload.skinDataUrl);
      texture.add(false);

      if (typeof texture.select === 'function') texture.select();
      if (window.Modes && window.Modes.paint && typeof window.Modes.paint.select === 'function') {
        window.Modes.paint.select();
      }

      reply(source, { ok: true, count: 1, names: [texture.name || payload.skinName || 'pixcape-skin.png'] });
    } catch (error) {
      reply(source, { ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      importing = false;
    }
  }

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || !event.data || typeof event.data.type !== 'string') return;
    if (event.data.type === 'pixcape:set-language') {
      language = event.data.language === 'en-US' ? 'en-US' : 'zh-CN';
      return;
    }
    if (event.data.type === IMPORT_EVENT) {
      void importPreset(event.source || window.parent, event.data.payload);
    }
  });
})();
