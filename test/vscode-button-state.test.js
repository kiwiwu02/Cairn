import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('保留 VS Code 按钮，但只有本地 Bridge 模式可用', async () => {
  const unavailableTitle = '当前版暂不支持 VS Code 关联，请从 Github 克隆到本地使用此功能';
  let getVscodeButtonState;
  try {
    ({getVscodeButtonState} = await import('../src/vscode-button-state.js'));
  } catch (error) {
    assert.fail(`VS Code 按钮状态模块不可用：${error.message}`);
  }

  assert.deepEqual(
    getVscodeButtonState({localSource: null, hasSelectedFile: true, unavailableTitle}),
    {visible: true, enabled: false, title: unavailableTitle},
  );
  assert.deepEqual(
    getVscodeButtonState({localSource: 'browser', hasSelectedFile: true, unavailableTitle}),
    {visible: true, enabled: false, title: unavailableTitle},
  );
  assert.deepEqual(
    getVscodeButtonState({localSource: 'bridge', hasSelectedFile: true, unavailableTitle}),
    {visible: true, enabled: true, title: ''},
  );
  assert.deepEqual(
    getVscodeButtonState({localSource: 'bridge', hasSelectedFile: false, unavailableTitle}),
    {visible: false, enabled: false, title: unavailableTitle},
  );
});

test('禁用的 VS Code 按钮由非禁用容器承载悬浮提示', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

  assert.match(html, /id="openVscodeTooltip"/);
  assert.match(html, /id="openVscodeButton"[^>]*aria-describedby="openVscodeTooltipText"/);
  assert.match(html, /id="openVscodeTooltipText"[^>]*role="tooltip"/);
  assert.match(css, /\.vscode-action-tooltip:hover \.vscode-action-tooltip-text/);
  assert.match(css, /\.vscode-action-tooltip-text:empty/);
});
