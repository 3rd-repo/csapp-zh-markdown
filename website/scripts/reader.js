/* Progressive reading helpers. Source text, tables and figure URLs stay intact. */
(() => {
  // Quarto 1.9.38 exposes this function but no ranking option. Keep the adapter
  // narrow: only reorder existing results for a complete dotted section number.
  const search = window.fuseSearch;
  if (typeof search === 'function') {
    window.fuseSearch = async function (query, ...args) {
      const results = await search.call(this, query, ...args);
      const number = typeof query === 'string' ? query.trim() : '';
      if (!/^\d+(?:\.\d+)+$/.test(number)) return results;
      const exact = new RegExp(`^${number.replaceAll('.', '\\.')}($|\\s|[：:])`);
      const rank = item => exact.test(item.title || '') ? 2 : exact.test(item.section || '') ? 1 : 0;
      return [...results].sort((a, b) => {
        const difference = rank(b) - rank(a);
        if (difference || !rank(a)) return difference;
        return Number(a.href.includes('#')) - Number(b.href.includes('#'));
      });
    };
  }

  function init() {
    const main = document.querySelector('main.content');
    if (!main || main.dataset.readerReady) return;
    main.dataset.readerReady = 'true';

    main.querySelectorAll('table').forEach((table, index) => {
      const region = document.createElement('div');
      region.className = 'reader-table';
      region.tabIndex = 0;
      region.setAttribute('role', 'region');
      region.setAttribute('aria-label', table.caption?.textContent.trim() || `表格 ${index + 1}`);
      table.before(region);
      region.append(table);
      table.querySelectorAll('th, td').forEach(cell => {
        const text = cell.textContent.trim();
        const shortValue = text.length <= 48 && !/[\u2e80-\u9fff]/u.test(text);
        const shortHeader = cell.tagName === 'TH' && text.length <= 14;
        if ((shortValue || shortHeader) && !cell.querySelector('p, pre, ul, ol, br')) {
          cell.classList.add('reader-compact');
        }
      });
    });

    let dialog;
    let opener;
    let previousOverflow;

    function iconButton(icon, label, attribute) {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute(attribute, '');
      const glyph = document.createElement('i');
      glyph.className = `bi bi-${icon}`;
      glyph.setAttribute('aria-hidden', 'true');
      button.append(glyph);
      return button;
    }

    function createDialog() {
      dialog = document.createElement('dialog');
      dialog.className = 'reader-image-dialog';
      dialog.setAttribute('aria-label', '查看图片');
      const toolbar = document.createElement('div');
      toolbar.className = 'reader-image-toolbar';
      const caption = document.createElement('span');
      caption.className = 'reader-image-caption';
      const zoom = iconButton('zoom-in', '原始尺寸', 'data-reader-zoom');
      zoom.setAttribute('aria-pressed', 'false');
      const close = iconButton('x-lg', '关闭图片', 'data-reader-close');
      close.autofocus = true;
      toolbar.append(caption, zoom, close);
      const stage = document.createElement('div');
      stage.className = 'reader-image-stage';
      stage.tabIndex = 0;
      stage.setAttribute('role', 'region');
      stage.setAttribute('aria-label', '图片');
      stage.append(document.createElement('img'));
      dialog.append(toolbar, stage);
      document.body.append(dialog);

      zoom.addEventListener('click', () => {
        const full = dialog.classList.toggle('reader-fullsize');
        zoom.setAttribute('aria-pressed', String(full));
        zoom.title = full ? '适应窗口' : '原始尺寸';
        zoom.setAttribute('aria-label', zoom.title);
        zoom.firstElementChild.className = full ? 'bi bi-zoom-out' : 'bi bi-zoom-in';
      });
      close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      });
      // Native dialog handles Escape, focus trapping and background inertness.
      dialog.addEventListener('close', () => {
        document.body.style.overflow = previousOverflow;
        opener?.focus({ preventScroll: true });
      });
      return dialog;
    }

    main.querySelectorAll('img.reader-figure').forEach(img => {
      if (img.closest('a, button')) return;
      const link = document.createElement('a');
      link.className = 'reader-image';
      link.href = img.src;
      link.title = '查看原图';
      link.setAttribute('aria-label', `查看原图：${img.alt || '图片'}`);
      img.before(link);
      link.append(img);
      link.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
        event.preventDefault();
        const modal = dialog || createDialog();
        const large = modal.querySelector('img');
        large.src = img.src;
        large.alt = img.alt;
        modal.querySelector('.reader-image-caption').textContent = img.alt;
        modal.classList.remove('reader-fullsize');
        const zoom = modal.querySelector('[data-reader-zoom]');
        zoom.setAttribute('aria-pressed', 'false');
        zoom.title = '原始尺寸';
        zoom.setAttribute('aria-label', zoom.title);
        zoom.firstElementChild.className = 'bi bi-zoom-in';
        opener = link;
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        modal.showModal();
        const stage = modal.querySelector('.reader-image-stage');
        stage.scrollTop = 0;
        stage.scrollLeft = 0;
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
