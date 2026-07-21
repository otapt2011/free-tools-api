/**
 * background-dropdowns.js – Custom dropdowns and theme toggle.
 */
(function() {
  // ----- Custom dropdowns -----
  let allDropdowns = [];
  function initCustomSelect(wrap) {
    const select = wrap.querySelector('select');
    const button = wrap.querySelector('.dropdown-button');
    const textSpan = button.querySelector('.dropdown-text');
    const list = wrap.querySelector('.dropdown-list');
    let isOpen = false, highlightedIndex = -1;
    const options = select.options;
    function buildList() {
      list.innerHTML = '';
      for (let i = 0; i < options.length; i++) {
        const li = document.createElement('li');
        li.textContent = options[i].text;
        li.dataset.index = i;
        li.dataset.value = options[i].value;
        li.className = 'px-2 py-0.5 text-[10px] text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors';
        if (options[i].selected) {
          li.classList.add('selected', 'bg-blue-100', 'dark:bg-blue-900/30', 'font-medium');
          textSpan.textContent = options[i].text;
        }
        li.addEventListener('click', function(e) {
          e.stopPropagation();
          selectOption(i);
          closeDropdown();
        });
        list.appendChild(li);
      }
    }
    function selectOption(index) {
      if (index < 0 || index >= options.length) return;
      select.selectedIndex = index;
      textSpan.textContent = options[index].text;
      const items = list.querySelectorAll('li');
      items.forEach((li, i) => {
        li.classList.toggle('selected', i === index);
        li.classList.toggle('bg-blue-100', i === index);
        li.classList.toggle('dark:bg-blue-900/30', i === index);
        li.classList.toggle('font-medium', i === index);
      });
      const evt = new Event('change', { bubbles: true });
      select.dispatchEvent(evt);
      closeDropdown();
    }
    function closeDropdown() {
      isOpen = false;
      list.classList.add('hidden');
      highlightedIndex = -1;
      list.querySelectorAll('li').forEach(li => li.classList.remove('bg-gray-100', 'dark:bg-gray-700'));
      button.classList.remove('ring-1', 'ring-blue-500');
    }
    function openDropdown() {
      if (select.disabled) return;
      allDropdowns.forEach(d => { if (d !== wrap && d._close) d._close(); });
      isOpen = true;
      list.classList.remove('hidden');
      highlightedIndex = -1;
      const items = list.querySelectorAll('li');
      for (let i = 0; i < items.length; i++) {
        if (items[i].classList.contains('selected')) {
          highlightedIndex = i;
          items[i].classList.add('bg-gray-100', 'dark:bg-gray-700');
          break;
        }
      }
      button.classList.add('ring-1', 'ring-blue-500');
    }
    function toggleDropdown() {
      if (select.disabled) return;
      if (isOpen) closeDropdown();
      else openDropdown();
    }
    button.addEventListener('click', function(e) { e.stopPropagation(); toggleDropdown(); });
    button.addEventListener('keydown', function(e) {
      if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
        e.preventDefault(); openDropdown(); return;
      }
      if (!isOpen) return;
      const items = list.querySelectorAll('li'), total = items.length;
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); highlightedIndex = (highlightedIndex + 1) % total; updateHighlight(); break;
        case 'ArrowUp': e.preventDefault(); highlightedIndex = (highlightedIndex - 1 + total) % total; updateHighlight(); break;
        case 'Enter': e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < total) selectOption(highlightedIndex); closeDropdown(); break;
        case 'Escape': e.preventDefault(); closeDropdown(); break;
      }
    });
    function updateHighlight() {
      const items = list.querySelectorAll('li');
      items.forEach((li, i) => { li.classList.toggle('bg-gray-100', i === highlightedIndex); li.classList.toggle('dark:bg-gray-700', i === highlightedIndex); });
      if (highlightedIndex >= 0) items[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
    document.addEventListener('click', function(e) { if (!wrap.contains(e.target)) closeDropdown(); });
    select.addEventListener('change', function() {
      const idx = select.selectedIndex;
      if (idx >= 0 && idx < options.length) {
        textSpan.textContent = options[idx].text;
        const items = list.querySelectorAll('li');
        items.forEach((li, i) => {
          li.classList.toggle('selected', i === idx);
          li.classList.toggle('bg-blue-100', i === idx);
          li.classList.toggle('dark:bg-blue-900/30', i === idx);
          li.classList.toggle('font-medium', i === idx);
        });
      }
    });
    function updateDisabled() {
      if (select.disabled) {
        button.disabled = true;
        button.classList.add('opacity-50', 'pointer-events-none');
      } else {
        button.disabled = false;
        button.classList.remove('opacity-50', 'pointer-events-none');
      }
    }
    const observer = new MutationObserver(updateDisabled);
    observer.observe(select, { attributes: true, attributeFilter: ['disabled'] });
    wrap._close = closeDropdown;
    allDropdowns.push(wrap);
    buildList();
    updateDisabled();
    wrap._update = function() { buildList(); updateDisabled(); };
  }

  // Initialize dropdowns when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.custom-select-wrap').forEach(initCustomSelect);
  });

  // ----- Theme toggle -----
  document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const saved = localStorage.getItem('sshot-theme');
    if (saved) {
      html.setAttribute('data-bs-theme', saved);
      if (saved === 'dark') html.classList.add('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.setAttribute('data-bs-theme', 'dark');
      html.classList.add('dark');
    }
    toggle.addEventListener('click', function() {
      const current = html.getAttribute('data-bs-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-bs-theme', next);
      localStorage.setItem('sshot-theme', next);
      html.classList.toggle('dark', next === 'dark');
    });
  });
})();