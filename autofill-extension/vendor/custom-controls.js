// DOM-only custom controls. No model-provided selectors, framework internals or
// page code are executed. The host owns write guards, events, waits and verification.
(function attachCustomControls(scope) {
  const ROOTS = '.ant-select, .ant-cascader, .ant-cascader-picker, .el-select, .el-cascader, .arco-select, .arco-cascader, .phoenix-select';
  const SHELLS = '.ant-select-dropdown, .ant-cascader-dropdown, .el-select__popper, .el-select-dropdown, .el-cascader__dropdown, .arco-select-popup, .arco-cascader-popup, .arco-trigger-popup, .phoenix-selectList, .area-selector-container';
  const POPUPS = `${SHELLS}, [role="listbox"], [role="tree"]`;
  const trim = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  function shown(node) {
    for(let current=node;current;current=current.parentElement){
      if(current.hidden || current.getAttribute('aria-hidden')==='true') return false;
      const css=current.ownerDocument.defaultView.getComputedStyle(current);
      if(css.display==='none' || css.visibility==='hidden') return false;
    }
    return true;
  }
  function describe(target) {
    const el = target?.element || target;
    const root = el?.closest?.(ROOTS) || target?.root || el;
    const library = root?.matches?.('.ant-select, .ant-cascader, .ant-cascader-picker') ? 'antd'
      : root?.matches?.('.el-select, .el-cascader') ? 'element'
      : root?.matches?.('.arco-select, .arco-cascader') ? 'arco'
      : root?.matches?.('.phoenix-select') ? 'phoenix' : 'aria';
    const cascade = target?.controlKind === 'cascader' || root?.matches?.('.ant-cascader, .ant-cascader-picker, .el-cascader, .arco-cascader');
    const combo = root?.matches?.('[role="combobox"]') ? root : root?.querySelector?.('[role="combobox"]') || el;
    const multiple = combo?.getAttribute?.('aria-multiselectable') === 'true'
      || root?.matches?.('.ant-select-multiple, .el-select--multiple, .arco-select-multiple, .phoenix-select--multi')
      || Boolean(root?.querySelector?.('.ant-select-selection-overflow, .el-select__tags, .arco-select-view-tag, .phoenix-select__tagItem'));
    const tree = Boolean(root?.matches?.('.ant-tree-select, .ant-select-tree-select'));
    return { el, root, combo, library, tree, cascade: Boolean(cascade), multiple: Boolean(multiple) };
  }
  function selectedTexts(info) {
    const { root, el, library, cascade } = info;
    if (!root?.isConnected) return null;
    if (library === 'aria' && el.tagName === 'INPUT' && (!el.readOnly || info.requireCommitSignal)) {
      const explicit = trim(info.combo.getAttribute('aria-valuetext'));
      if (explicit) return [explicit];
      const hidden = root.querySelectorAll('input[type="hidden"]');
      if (hidden.length === 1) return hidden[0].value ? [String(hidden[0].value)] : [];
      // aria-selected in an open popup can describe visual focus rather than a
      // committed value. Editable controls always need a persistent signal.
      // The input may contain a query even after Escape/blur closed the popup.
      // Without an independent selected-state signal, commitment is unknown.
      return el.value ? null : [];
    }
    // Phoenix uses a persistent tip label for the committed value. Its input
    // can hold a search query; neither that nor the placeholder proves selection.
    const selector = library === 'antd' ? '.ant-select-selection-item, .ant-cascader-picker-label'
      : library === 'element' ? '.el-select__selected-item:not(.el-select__input-wrapper):not(.is-transparent), .el-select__tags-text'
      : library === 'arco' ? '.arco-select-view-value, .arco-select-view-tag, .arco-cascader-view-value'
      : library === 'phoenix' ? '.phoenix-select__tipEle' : '';
    if (library === 'element' && cascade && (info.requireCascadeSignal || !el.readOnly)) {
      const leaf = info.lastChoice;
      const checked = leaf?.isConnected && (leaf.getAttribute('aria-checked') === 'true'
        || leaf.classList.contains('is-checked') || Boolean(leaf.querySelector('input[type="radio"]:checked, .el-radio.is-checked')));
      if (!checked) return [];
    }
    if (selector) {
      const values = Array.from(root.querySelectorAll(selector), node => trim(node.textContent)).filter(value => value && !scope.ResumeProAIHelpers?.isPlaceholderOption(value));
      if (values.length) return cascade ? values.join(' / ').split(/\s*(?:\/|>|→)\s*/).filter(Boolean) : values;
      // Element UI (Vue 2) stores the committed label directly in its readonly input.
      if (library !== 'element' || (!cascade && !el.readOnly)) return [];
    }
    const value = trim(el.tagName === 'INPUT' ? el.value : el.getAttribute('role') === 'combobox' ? el.textContent : '');
    if (!value || scope.ResumeProAIHelpers?.isPlaceholderOption(value)) return [];
    return cascade ? value.split(/\s*(?:\/|>|→)\s*/).filter(Boolean) : [value];
  }
  function snapshot(target) {
    const info = describe(target);
    if (!info.root?.isConnected || !info.el?.isConnected) return null;
    return JSON.stringify({ selection: selectedTexts(info),
      query: info.el.tagName === 'INPUT' && !info.el.readOnly ? String(info.el.value ?? '') : null });
  }
  function hasExistingValue(target) {
    const info = describe(target), values = selectedTexts(info);
    // A query is existing user input which needs overwrite protection, not
    // evidence of a committed selection. The snapshot tracks it separately.
    return values === null || values.length > 0 || (info.el.tagName === 'INPUT' && !info.el.readOnly && Boolean(info.el.value));
  }
  // 用户眼前显示的已选文字（#189 保存到「我的信息」用）。读不准就返回 null，不猜；没选返回空数组。
  function readSelection(target) {
    const info = describe(target), texts = selectedTexts(info);
    return texts === null ? null : { texts, cascade: info.cascade };
  }
  function outerPopup(node) { return node?.closest?.(SHELLS) || node; }
  function popups(doc, visible) {
    const all = Array.from(new Set(Array.from(doc.querySelectorAll(POPUPS), outerPopup))).filter(visible);
    return all.filter(node => !all.some(other => other !== node && other.contains(node)));
  }
  function ownedPopup(info, visible) {
    if(info.library==='phoenix'){
      const popup=scope.XiaomaiPhoenix?.openPopup(info.root,'.phoenix-selectList,.area-selector-container');
      if(popup)return {hasIds:false,popup,ambiguous:false};
    }
    const sources = [info.combo, info.el, info.root, ...info.root.querySelectorAll('[aria-controls], [aria-owns]')];
    const ids = new Set(sources.flatMap(node => `${node.getAttribute('aria-controls') || ''} ${node.getAttribute('aria-owns') || ''}`.split(/\s+/).filter(Boolean)));
    // Duplicate ids are invalid HTML but occur in repeated application rows.
    // getElementById would silently pick the first popup and could select a
    // different row's option. Only one visible referenced popup is acceptable.
    // Resolve only declared ids. Attribute-string CSS escaping also works where
    // CSS.escape is unavailable; no page value becomes an executable selector.
    const escaped = id => id.replace(/[\u0000-\u001f\u007f"\\]/g, character => `\\${character.codePointAt(0).toString(16)} `);
    const referenced = Array.from(ids).flatMap(id => Array.from(info.el.ownerDocument.querySelectorAll(`[id="${escaped(id)}"]`)));
    const owned = Array.from(new Set(referenced.map(outerPopup).filter(visible)));
    return { hasIds: ids.size > 0, popup: owned.length === 1 ? owned[0] : null, ambiguous: owned.length > 1 };
  }
  function optionNodes(popup, info, level) {
    if (info.tree) {
      // TreeSelect groups are navigation, not values. Only activate selectable leaves.
      return Array.from(popup.querySelectorAll('.ant-select-tree-node-content-wrapper')).filter(node => {
        const row = node.closest('.ant-select-tree-treenode');
        const switcher = row?.querySelector('.ant-select-tree-switcher');
        return row && !row.matches('.ant-select-tree-treenode-disabled, .ant-select-tree-treenode-unselectable')
          && (!switcher || switcher.matches('.ant-select-tree-switcher-noop'));
      });
    }
    if (info.cascade) {
      if (info.library === 'aria' && popup.getAttribute('role') === 'tree') {
        const parent = level === 0 ? popup : info.pathNodes?.[level - 1];
        if (!parent?.isConnected) return [];
        return Array.from(parent.querySelectorAll('[role="treeitem"]')).filter(node => {
          const ancestor = node.parentElement.closest('[role="treeitem"]');
          return level === 0 ? !ancestor : ancestor === parent;
        });
      }
      const columns = popup.querySelectorAll('.ant-cascader-menu, .el-cascader-menu, .arco-cascader-list, [role="group"]');
      const column = columns[level];
      return column ? Array.from(column.querySelectorAll('.ant-cascader-menu-item, .el-cascader-node, .arco-cascader-list-item, [role="treeitem"], [role="option"]')) : [];
    }
    const realSelector = info.library === 'antd' ? '.ant-select-item-option'
      : info.library === 'element' ? '.el-select-dropdown__item'
      : info.library === 'arco' ? '.arco-select-option'
      : info.library === 'phoenix' ? '.phoenix-selectList__listItem' : '';
    const real = realSelector ? Array.from(popup.querySelectorAll(realSelector)) : [];
    return real.length ? real : Array.from(popup.querySelectorAll('[role="option"]'));
  }
  function options(popup, info, level, h) {
    return optionNodes(popup, info, level).filter(h.visible).map(node => {
      const label = node.querySelector('.ant-select-item-option-content, .ant-select-tree-title, .el-cascader-node__label, .arco-cascader-list-item-label, .phoenix-selectList__singleLabel') || node;
      const text = info.library === 'aria' && info.cascade ? trim(node.getAttribute('aria-label') || Array.from(node.childNodes)
        .filter(child => child.nodeType !== 1 || !child.matches('[role="group"]')).map(child => child.textContent).join(' ')) : trim(label.textContent);
      return { node, text, value: node.getAttribute('data-value') ?? node.getAttribute('value') ?? text,
        disabled: node.getAttribute('aria-disabled') === 'true' || node.matches('.ant-select-item-option-disabled, .ant-cascader-menu-item-disabled, .is-disabled, .arco-select-option-disabled, .arco-cascader-list-item-disabled, .phoenix-selectList__listItem--disabled') || Boolean(node.disabled) };
    });
  }
  function match(list, value, helpers) {
    const index = helpers.findSelectOptionIndex(list, value);
    if (index < 0) {
      const possible = list.filter(option => !helpers.isPlaceholderOption(option)).filter(option => {
        const text = helpers.normalizeText(option.text), target = helpers.normalizeText(value);
        return text.includes(target) || target.includes(text);
      });
      return { reason: possible.length > 1 ? 'ambiguous_option' : 'no_option_match' };
    }
    // Preserve native first-exact semantics, but never guess between indistinguishable
    // custom choices. Re-running the same resolver without the winner exposes ties.
    const remaining = list.map((option, at) => at === index ? { ...option, disabled: true } : option);
    const another = helpers.findSelectOptionIndex(remaining, value);
    if (another >= 0) {
      const exact = option => [trim(option.value), trim(option.text)].includes(trim(value));
      const normalized = option => [option.value, option.text].some(text => helpers.normalizeText(text) === helpers.normalizeText(value));
      if ((exact(list[index]) && exact(list[another])) || (!exact(list[index]) && normalized(list[index]) && normalized(list[another]))) return { reason: 'ambiguous_option' };
    }
    return { option: list[index] };
  }
  async function perform(ctx, raw, h, state) {
    const info = describe(ctx.entry);
    state.info = info;
    const selectionBefore=JSON.stringify(selectedTexts(info));
    info.requireCommitSignal = info.library === 'aria' && ctx.startedEditable;
    info.requireCascadeSignal = info.library === 'element' && info.cascade && ctx.startedEditable;
    if (!info.root || info.multiple || ctx.hints.multiple === true) return { reason: 'unsupported_control' };
    let desired = info.cascade ? (Array.isArray(raw) ? raw.map(trim) : trim(raw).split(/\s*(?:\/|>|→)\s*/)) : [trim(raw)];
    if (!desired.length || desired.length > 8 || desired.some(value => !value)) return { reason: 'no_option_match' };
    const doc = info.el.ownerDocument;
    const before = new Set(popups(doc, h.visible));
    const initiallyOwned = ownedPopup(info, h.visible);
    const alreadyOpen = initiallyOwned.popup && (info.combo.getAttribute('aria-expanded') === 'true' || info.library==='phoenix');
    const trigger = info.cascade ? info.el : info.library === 'antd' ? info.root.querySelector('.ant-select-selector') || info.root
      : info.library === 'element' ? info.root.querySelector('.el-select__wrapper, .el-input') || info.root
      : info.library === 'arco' ? info.root.querySelector('.arco-select-view') || info.root
      : info.library === 'phoenix' ? info.root : info.combo;
    if (!alreadyOpen) { const reason = h.click(trigger, ctx); if (reason) return { reason }; }
    const opened = await h.waitUntil(ctx, doc.documentElement, () => {
      const owned = ownedPopup(info, h.visible);
      if (owned.ambiguous) return { reason: 'ambiguous_popup' };
      if (owned.popup) return { popup: owned.popup };
      // AntD Cascader 4 advertises an aria-controls id that is never mounted.
      // A library adapter may associate one newly opened shell; generic ARIA
      // controls with explicit ids must never fall through to another popup.
      if (owned.hasIds && info.library === 'aria') return null;
      const added = popups(doc, h.visible).filter(node => !before.has(node));
      return added.length > 1 ? { reason: 'ambiguous_popup' } : added.length === 1 ? { popup: added[0] } : null;
    }, Boolean);
    if (opened.reason) return { reason: opened.reason === 'verification_timeout' ? 'options_not_rendered' : opened.reason };
    if (opened.value.reason) return opened.value;
    let popup = opened.value.popup; ctx.popup = popup;
    info.popup = popup;
    if(info.library==='phoenix'&&popup.matches('.area-selector-container')){
      return scope.XiaomaiPhoenix?.runArea(ctx,raw,h,popup)||{reason:'unsupported_control'};
    }
    const role = popup.getAttribute('role');
    ctx.observed = { library: info.library, popupRole: ['listbox', 'tree', 'menu'].includes(role) ? role : 'component', optionCount: 0 };
    const multiplePopup = () => popup.getAttribute('aria-multiselectable') === 'true'
      || Boolean(popup.querySelector('[aria-multiselectable="true"]'))
      || (info.library === 'element' && (popup.matches('.el-select-dropdown.is-multiple')
        || Boolean(popup.querySelector('.el-select-dropdown.is-multiple'))));
    if (multiplePopup()) return { reason: 'unsupported_control' };
    const safeSearch = input => input?.tagName === 'INPUT' && !input.readOnly && !input.disabled
      && ['text', 'search', 'email', 'tel', 'url'].includes(input.type);
    state.safeSearch = safeSearch;
    const candidates = [info.combo, ...info.root.querySelectorAll('input'), ...popup.querySelectorAll('input')];
    const searchInput = candidates.find(input => safeSearch(input) && h.visible(input));
    const searchable = ctx.hints.searchable !== false && !info.cascade && searchInput && (ctx.hints.searchable === true
      || info.combo.getAttribute('aria-autocomplete') === 'list' || searchInput.getAttribute('aria-autocomplete') === 'list'
      || searchInput.getAttribute('role') === 'searchbox' || searchInput.type === 'search'
      || info.root.matches('.ant-select-show-search, .phoenix-select--singleSearch')
      || Boolean(popup.querySelector('.phoenix-selectList__searchWrapper input'))
      || Boolean(info.root.querySelector('.el-select__wrapper.is-filterable')));
    let searchDone = false;
    const readOptions = level => {
      if (!popup.isConnected) {
        const linked = ownedPopup(info, h.visible);
        if (linked.popup && !linked.ambiguous) { popup = linked.popup; ctx.popup = popup; info.popup = popup; }
      }
      return options(popup, info, level, h);
    };
    const loading = () => info.combo.getAttribute('aria-busy') === 'true' || popup.getAttribute('aria-busy') === 'true'
      || info.root.matches('.ant-select-loading, .el-select.is-loading, .arco-select-loading')
      || popup.matches('.phoenix-selectList--defaultLoading')
      || Array.from(popup.querySelectorAll('.ant-spin-spinning, .ant-select-tree-treenode-loading, .el-loading-mask, .phoenix-selectList__contentWraper--loading')).some(h.visible);
    // rc-select exposes a search input even for dictionaries loaded by onFocus.
    // Wait for the initial dictionary before filtering: 男性 would hide 男, and
    // a delayed response can otherwise overwrite the result of an early search.
    const initialStarted = Date.now();
    let stableSignature = '', stableSince = initialStarted;
    const readyOptions = async level => h.waitUntil(ctx, doc.documentElement, () => {
      const list = readOptions(level);
      const signature = list.map(option => `${option.value}:${option.text}`).join('\n');
      if (signature !== stableSignature || loading()) { stableSignature = signature; stableSince = Date.now(); }
      return list;
    }, list => !loading() && (list.length > 0 && Date.now() - stableSince >= 100
      || info.tree && popup.querySelector('.ant-select-tree-switcher_close') && Date.now() - stableSince >= 100
      || searchable && !searchDone && list.length === 0 && Date.now() - initialStarted >= 1400));
    const settleOptions = async level => {
      let signature = null, since = Date.now();
      return h.waitUntil(ctx, doc.documentElement, () => {
        const list = readOptions(level), next = list.map(option => `${option.value}:${option.text}`).join('\n');
        if (next !== signature || loading()) { signature = next; since = Date.now(); }
        return list;
      }, () => !loading() && Date.now() - since >= 120);
    };
    // Walk visible DOM options, including virtual lists and collapsed tree groups.
    // This never reads framework state or fabricates the option's stored code.
    const browseOptions = async (level, wanted, initial) => {
      let list = initial, found = match(list, wanted, h.helpers);
      const expanded = new WeakSet();
      for (let step = 0; step < 80 && !found.option && found.reason !== 'ambiguous_option'; step++) {
        const stopped = h.stop(ctx, true); if (stopped) return { reason: stopped };
        const branch = info.tree && Array.from(popup.querySelectorAll('.ant-select-tree-switcher_close'))
          .find(node => h.visible(node) && !expanded.has(node) && !node.closest('.ant-select-tree-treenode-disabled'));
        if (branch) {
          expanded.add(branch);
          const reason = h.click(branch, ctx); if (reason) return { reason };
          const next = await settleOptions(level); if (next.reason) return { reason: next.reason };
          list = next.value; found = match(list, wanted, h.helpers); continue;
        }
        const column = info.cascade ? popup.querySelectorAll('.ant-cascader-menu, .el-cascader-menu, .arco-cascader-list')[level] : popup;
        const holders = column ? Array.from(column.querySelectorAll('.rc-virtual-list-holder, .ant-select-tree-list-holder, .el-scrollbar__wrap, .arco-select-popup-inner, .phoenix-selectList__virtualList-holder')) : [];
        if (info.cascade && column) holders.push(column);
        const holder = holders.find(node => h.visible(node) && node.clientHeight > 0 && node.scrollHeight > node.clientHeight
          && node.scrollTop < node.scrollHeight - node.clientHeight - 1);
        if (!holder) return { list, found };
        const previous = holder.scrollTop;
        holder.scrollTop = Math.min(holder.scrollHeight - holder.clientHeight, previous + Math.max(40, holder.clientHeight * .8));
        holder.dispatchEvent(new Event('scroll', { bubbles: true }));
        if (holder.scrollTop === previous) return { list, found };
        const next = await settleOptions(level); if (next.reason) return { reason: next.reason };
        list = next.value; found = match(list, wanted, h.helpers);
      }
      return found.option || found.reason === 'ambiguous_option' ? { list, found } : { reason: 'options_scan_limit' };
    };
    const isBranch = node => node.getAttribute('aria-expanded')!==null
      || node.matches('.ant-cascader-menu-item-expand, .el-cascader-node:not(.is-leaf), .arco-cascader-list-item-expand')
      || Boolean(node.querySelector('.ant-cascader-menu-item-expand-icon, .el-cascader-node__postfix'));
    // A certificate/skill can contain only a leaf name. Browse classification
    // nodes without selecting leaves, and accept only one exact/equivalent path.
    // Do not use this to infer a missing district from a province/city prefix.
    const alternatives=ctx.hints.leafAlternatives;
    if (info.cascade && (desired.length===1 || alternatives) && info.library==='antd') {
      const initial=await readyOptions(0);
      if (initial.reason) return {reason:'options_not_rendered'};
      const direct=alternatives ? {reason:'no_option_match'} : match(initial.value,desired[0],h.helpers);
      if (direct.reason==='ambiguous_option') return direct;
      if (direct.option && isBranch(direct.option.node)) return {reason:'incomplete_cascade'};
      if (!direct.option) {
        const paths=[], targets=alternatives||[desired[0]], started=Date.now(); let visits=0, failure='';
        const walk=async (level,path) => {
          if (++visits>40 || Date.now()-started>10000 || level>7) {failure='options_scan_limit';return;}
          const stopped=h.stop(ctx,true);if(stopped){failure=stopped;return;}
          const ready=await settleOptions(level);if(ready.reason){failure=ready.reason;return;}
          const list=ready.value.filter(x=>!x.disabled);
          // rc-cascader lists are not virtualized. Reject rather than silently
          // skipping a scroll-virtualized list introduced by another adapter.
          for (const option of list) {
            if (failure || paths.length>1) break;
            if (!isBranch(option.node)) {
              if (targets.some(wanted=>h.helpers.equivalentOption?.(option.text,wanted)
                || h.helpers.normalizeText(option.text)===h.helpers.normalizeText(wanted))) paths.push([...path,option.text]);
              continue;
            }
            const latest=readOptions(level).filter(x=>x.text===option.text&&!x.disabled);
            if(latest.length!==1){failure='ambiguous_option';break;}
            const previous=readOptions(level+1),active=latest[0].node.classList.contains('ant-cascader-menu-item-active');
            const reason=h.click(latest[0].node,ctx);if(reason){failure=reason;break;}
            const children=await h.waitUntil(ctx,doc.documentElement,()=>readOptions(level+1),nodes=>!loading()&&nodes.length>0&&(active||nodes.some((x,i)=>x.node!==previous[i]?.node||x.text!==previous[i]?.text)));
            if(children.reason){failure='cascade_timeout';break;}
            await walk(level+1,[...path,option.text]);
          }
        };
        await walk(0,[]);
        ctx.observed.cascadeBranches=visits;
        if(failure) return {reason:failure};
        if(paths.length!==1) return {reason:paths.length>1?'ambiguous_option':'no_option_match'};
        desired=paths[0];ctx.observed.cascadeResolution='unique-leaf';
      }
    }
    const chosenLabels = [], chosenValues = [];
    for (let level = 0; level < desired.length; level++) {
      const ready = await readyOptions(level);
      if (ready.reason) return { reason: ready.reason === 'verification_timeout' ? info.cascade ? 'cascade_timeout' : 'options_not_rendered' : ready.reason };
      let list = ready.value;
      let found = match(list, desired[level], h.helpers);
      if (!found.option && found.reason !== 'ambiguous_option') {
        const browsed = await browseOptions(level, desired[level], list);
        if (browsed.reason) return { reason: browsed.reason };
        list = browsed.list; found = browsed.found;
      }
      if (searchable && !found.option && found.reason !== 'ambiguous_option' && !searchDone) {
        const reason = h.stop(ctx, true); if (reason) return { reason };
        if (!safeSearch(searchInput)) return { reason: 'unsupported_control' };
        if (!searchInput.isConnected || (!info.root.contains(searchInput) && !popup.contains(searchInput))) return { reason: 'element_disconnected' };
        const signature = list.map(option => `${option.value}:${option.text}`).join('\n');
        state.searchInput = searchInput; state.searchBefore = searchInput.value; state.query = desired[level];
        info.requireCommitSignal = info.library === 'aria';
        h.write(searchInput, desired[level], ctx); h.input(searchInput); searchDone = true;
        let lastSignature = signature, stableSince = Date.now();
        const updated = await h.waitUntil(ctx, doc.documentElement, () => {
          const current = readOptions(level);
          const next = current.map(option => `${option.value}:${option.text}`).join('\n');
          if (next !== lastSignature) { stableSince = Date.now(); lastSignature = next; }
          return current;
        }, current => !loading() && lastSignature !== signature && current.length > 0 && Date.now() - stableSince >= 80);
        if (updated.reason) return { reason: updated.reason === 'verification_timeout' ? 'options_timeout' : updated.reason };
        list = updated.value; found = match(list, desired[level], h.helpers);
      }
      ctx.observed.optionCount = Math.min(200, list.length);
      ctx.observed.selectionMethod = searchDone ? 'search-fallback' : info.tree ? 'tree-options' : 'loaded-options';
      if (found.reason) return found;
      // Re-read immediately before activation: async renders can replace an option.
      const latest = match(readOptions(level), desired[level], h.helpers);
      if (multiplePopup()) return { reason: 'unsupported_control' };
      if (latest.reason) return latest;
      if (info.cascade && level===desired.length-1 && isBranch(latest.option.node)) return {reason:'incomplete_cascade'};
      if (!info.pathNodes) info.pathNodes = [];
      info.pathNodes[level] = latest.option.node;
      const previousChildren = info.cascade ? readOptions(level + 1) : [];
      const parentActive = latest.option.node.getAttribute('aria-expanded') === 'true'
        || latest.option.node.matches('.ant-cascader-menu-item-active, .el-cascader-node.is-active, .arco-cascader-list-item-active');
      // Some cascaders commit parent selections (changeOnSelect/checkStrictly).
      // Every path activation can change component state, even before the leaf.
      const activation = info.library === 'arco' && info.cascade
        ? latest.option.node.querySelector('.arco-cascader-list-item-label') || latest.option.node : latest.option.node;
      state.activated = true;
      info.lastChoice = latest.option.node;
      const reason = h.click(activation, ctx, true);
      if (reason) return { reason };
      chosenLabels.push(latest.option.text);
      chosenValues.push(String(latest.option.value));
      if (info.cascade && level < desired.length - 1) {
        const next = await h.waitUntil(ctx, doc.documentElement, () => readOptions(level + 1), children => !loading() && children.length > 0 && (parentActive
          || children.length !== previousChildren.length || children.some((child, index) => child.node !== previousChildren[index]?.node || child.value !== previousChildren[index]?.value || child.text !== previousChildren[index]?.text)));
        if (next.reason) return { reason: next.reason === 'verification_timeout' ? 'cascade_timeout' : next.reason };
      }
    }
    const accepted = () => {
      const values = selectedTexts(info);
      if (!values) return false;
      // Some cascaders render only the leaf. Require a persisted label after
      // the popup closes AND the actual full chosen path was active at click.
      const shortDisplay=info.library==='antd' && info.cascade && chosenLabels.length>1 && values.length===1
        && values[0]===chosenLabels[chosenLabels.length-1] && (!popup.isConnected || !shown(popup))
        && JSON.stringify(values)!==selectionBefore
        && info.root.querySelector('.ant-select-selection-item, .ant-cascader-picker-label');
      if (shortDisplay) return true;
      if (values.length !== chosenLabels.length) return false;
      const hidden = info.library === 'aria' && info.el.tagName === 'INPUT' && (!info.el.readOnly || info.requireCommitSignal)
        ? info.root.querySelectorAll('input[type="hidden"]') : [];
      const explicitLabel = trim(info.combo.getAttribute('aria-valuetext'));
      const expected = hidden.length === 1 && !explicitLabel ? chosenValues : chosenLabels;
      if (!values.every((value, index) => h.helpers.normalizeText(value) === h.helpers.normalizeText(expected[index]))) return false;
      return true;
    };
    const committed = await h.waitUntil(ctx, doc.documentElement, accepted, Boolean);
    if (committed.reason) return { reason: committed.reason === 'verification_timeout' ? 'selection_not_committed' : committed.reason };
    return { accepted };
  }
  async function run(ctx, raw, h) {
    const state = {}; let outcome;
    try { outcome = await perform(ctx, raw, h, state); return outcome; }
    finally {
      // Cancellation, user edits and stale bindings forbid further actions,
      // including cleanup. Never undo an attempted semantic selection.
      if (outcome?.reason && !h.stop(ctx)) {
        const input = state.searchInput;
        if (!state.activated && input?.isConnected && state.safeSearch?.(input)
          && (state.info.root.contains(input) || ctx.popup?.contains(input)) && input.value === state.query) {
          h.write(input, state.searchBefore); h.input(input);
        }
        const info = state.info;
        if (info?.root?.contains(info.el.ownerDocument.activeElement) && !h.stop(ctx)) h.blur(info.el);
      }
    }
  }
  scope.ResumeProCustomControls = { describe, snapshot, hasExistingValue, readSelection, run };
})(typeof self !== 'undefined' ? self : globalThis);
