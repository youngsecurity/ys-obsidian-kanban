// Optional real-browser regression check. Install Playwright separately, or set
// PLAYWRIGHT_MODULE to its module entry point. BROWSER_EXECUTABLE can select an
// existing Chromium browser. No Obsidian vault is accessed.
import { build } from 'esbuild';
import { lessLoader } from 'esbuild-plugin-less';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const stubs = new Map([
  ['src/components/helpers.ts', `export const c = name => 'kanban-plugin__' + name;`],
  ['src/components/Item/helpers.ts', 'export const getItemClassModifiers = () => [];'],
  ['src/components/Item/ItemCheckbox.tsx', 'export const ItemCheckbox = () => null;'],
  [
    'src/components/Item/ItemMenu.ts',
    `export const useItemMenu = () => () => { window.menuClicks++; };`,
  ],
  ['src/components/Item/MetadataTable.tsx', 'export const ItemMetadata = () => null;'],
  [
    'src/dnd/components/Droppable.tsx',
    'export const Droppable = ({children}) => children; export const useNestedEntityPath = () => [0, 0];',
  ],
  ['src/dnd/managers/DragManager.ts', 'export const useDragHandle = () => () => {};'],
  [
    'src/dnd/components/context.ts',
    `import { createContext } from 'preact'; export const DndManagerContext = createContext({dragManager:{emitter:{on(){}, off(){}}}});`,
  ],
  ['src/parsers/common.ts', `export const frontmatterKey = 'kanban-plugin';`],
  [
    'src/components/Item/ItemContent.tsx',
    `
    import { isEditing } from '../types';
    export function ItemContent({item, editState}) {
      return <div className="kanban-plugin__item-title">
        {isEditing(editState) ? <textarea aria-label="Card editor" /> : item.data.filter ?
          <div className="filter-results"><button className="copy-code-button" onClick={() => window.copyClicks++}>Copy</button><p>Filter results</p><pre>{'task '.repeat(60)}</pre></div> :
          <span className="kanban-plugin__markdown-preview-wrapper">{'Ordinary card content '.repeat(12) + 'unbreakable'.repeat(20)}</span>}
      </div>;
    }
  `,
  ],
]);
const host = {
  name: 'obsidian-layout-host',
  setup(builder) {
    builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'host' }));
    builder.onLoad({ filter: /.*/, namespace: 'host' }, () => ({
      contents: `export const setIcon = el => { el.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/></svg>'; };`,
    }));
    builder.onLoad({ filter: /\.[jt]sx?$/ }, ({ path: filename }) => {
      const contents = stubs.get(path.relative(root, filename));
      return contents === undefined
        ? undefined
        : { contents, loader: 'tsx', resolveDir: path.dirname(filename) };
    });
  },
};
const bundled = await build({
  absWorkingDir: root,
  stdin: {
    resolveDir: root,
    sourcefile: 'pin-layout-fixture.tsx',
    loader: 'tsx',
    contents: `
      import { render } from 'preact';
      import { useState } from 'preact/hooks';
      import { DraggableItem } from './src/components/Item/Item';
      import { KanbanContext } from './src/components/context';
      import './src/styles.less';
      window.menuClicks = 0; window.pinClicks = 0; window.copyClicks = 0;
      function Fixture() {
        const [pinned, setPinned] = useState(false);
        const [filter, setFilter] = useState(false);
        window.setPinned = setPinned; window.setFilter = setFilter;
        const item = { id: 'test', type: 'item', accepts: [], children: [], data: { pinned, filter, titleRaw: 'Card', titleSearch: '', metadata: {} } };
        return <KanbanContext.Provider value={{ stateManager: {}, boardModifiers: { toggleItemPin: () => { window.pinClicks++; setPinned(false); } } }}>
          <DraggableItem item={item} itemIndex={0}/>
        </KanbanContext.Provider>;
      }
      render(<Fixture/>, document.getElementById('card'));
    `,
  },
  outfile: 'pin-layout.js',
  bundle: true,
  write: false,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  plugins: [host, lessLoader()],
});
const script = bundled.outputFiles.find((file) => file.path.endsWith('.js')).text;
const css = bundled.outputFiles.find((file) => file.path.endsWith('.css')).text;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('http://kanban.test/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html></html>' })
  );
  await page.goto('http://kanban.test/');
  await page.setContent(`<style>
    :root { --background-primary: white; --text-muted: #555; --text-accent: #606; --line-height-tight: 1.3; }
    * { box-sizing: border-box; } body { margin: 20px; font-family: sans-serif; }
    .clickable-icon { padding: 4px; border: 0; background: none; display: flex; cursor: pointer; }
    .filter-results { position: relative; padding-top: 28px; }
    .copy-code-button { position: absolute; top: 0; right: 40px; }
    pre { overflow: auto; margin: 0; }
    #card { width: 272px; }
  </style><div id="card"></div>`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  const title = page.locator('.kanban-plugin__item-title');
  const pin = page.getByRole('button', { name: 'Unpin card' });
  const menu = page.getByLabel('More options');
  for (const filter of [false, true]) {
    for (const width of [180, 272, 480]) {
      await page.evaluate(
        ({ filter, width }) => {
          window.setPinned(false);
          window.setFilter(filter);
          document.getElementById('card').style.width = `${width}px`;
        },
        { filter, width }
      );
      await pin.waitFor({ state: 'hidden' });
      const before = await title.boundingBox();
      await page.evaluate(() => window.setPinned(true));
      await pin.waitFor({ state: 'visible' });
      const after = await title.boundingBox();
      assert.equal(
        after.width,
        before.width,
        `Pin must not reduce content width (${filter ? 'filter' : 'ordinary'}, ${width}px): ${before.width} -> ${after.width}`
      );
      assert.equal(after.x, before.x, 'Pin must not move the content left edge');
      const pinBox = await pin.boundingBox();
      const menuBox = await menu.boundingBox();
      assert.ok(
        pinBox.x + pinBox.width <= menuBox.x,
        'Pin must sit before the menu without overlap'
      );
      assert.ok(
        menuBox.x - pinBox.x - pinBox.width <= 8,
        'Pin must be immediately beside the menu'
      );
      assert.ok(Math.abs(pinBox.y - menuBox.y) <= 1, 'Pin and menu must align vertically');
      const textLayout = await title.evaluate((element) => {
        const pinRect = document.querySelector('.kanban-plugin__item-pin').getBoundingClientRect();
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let overlap = false;
        let usesCornerWidthBelowPin = false;
        while (walker.nextNode()) {
          const text = walker.currentNode;
          for (let i = 0; i < text.textContent.length; i++) {
            if (!text.textContent[i].trim()) continue;
            const range = document.createRange();
            range.setStart(text, i);
            range.setEnd(text, i + 1);
            for (const rect of range.getClientRects()) {
              if (
                rect.width &&
                rect.height &&
                rect.left < pinRect.right &&
                rect.right > pinRect.left &&
                rect.top < pinRect.bottom &&
                rect.bottom > pinRect.top
              )
                overlap = true;
              if (rect.left >= pinRect.left && rect.top >= pinRect.bottom)
                usesCornerWidthBelowPin = true;
            }
          }
        }
        return { overlap, usesCornerWidthBelowPin };
      });
      assert.equal(textLayout.overlap, false, 'Pin must not overlap readable text');
      if (!filter)
        assert.equal(
          textLayout.usesCornerWidthBelowPin,
          true,
          'Text below the pin must use the full content width'
        );
      if (filter) {
        const copyBox = await page.getByRole('button', { name: 'Copy' }).boundingBox();
        assert.ok(
          copyBox.x + copyBox.width <= pinBox.x,
          'Filter copy control must remain separate from pin'
        );
        await page.getByRole('button', { name: 'Copy' }).click();
      }
      await menu.click();
      await pin.click();
      await pin.waitFor({ state: 'hidden' });
      console.log(`PASS ${filter ? 'filter' : 'ordinary'} card at ${width}px`);
    }
  }
  assert.equal(await page.evaluate(() => window.pinClicks), 6);
  assert.equal(await page.evaluate(() => window.menuClicks), 6);
  assert.equal(await page.evaluate(() => window.copyClicks), 3);
  await page.evaluate(() => window.setPinned(true));
  await pin.waitFor({ state: 'visible' });
  await title.dblclick();
  await page.getByRole('textbox', { name: 'Card editor' }).waitFor({ state: 'visible' });
  await pin.waitFor({ state: 'hidden' });
  await page.getByLabel('Cancel', { exact: true }).click();
  await pin.waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => window.pinClicks), 6, 'Editing must not unpin the card');
  assert.deepEqual(pageErrors, [], 'Browser must not report runtime errors');
  console.log('PASS pin/menu/copy actions remain clickable and editing preserves pin state');
} finally {
  await browser.close();
}
